import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import * as jose from 'jose';
import { createAppPool } from '../../src/database/pg-pool.js';

const runtimeUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.SUPABASE_JWT_SECRET ?? 'local-test-hs256-secret-not-for-prod';
const issuer = `${process.env.SUPABASE_URL ?? 'https://example.supabase.co'}/auth/v1`;

assert.ok(runtimeUrl, 'DATABASE_URL (app_runtime) required');
assert.ok(!runtimeUrl.includes('postgres:p01_migrate'), 'Must use app_runtime, not migration owner');

function pool() {
  return createAppPool(runtimeUrl!, { max: 1 });
}

test('runtime role is not superuser and cannot bypass RLS', async () => {
  const p = pool();
  try {
    const { rows } = await p.query(
      `SELECT current_user AS cu, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`,
    );
    assert.equal(rows[0].cu, 'app_runtime');
    assert.equal(rows[0].rolsuper, false);
    assert.equal(rows[0].rolbypassrls, false);
  } finally {
    await p.end();
  }
});

test('missing tenant context denies organization_members', async () => {
  const p = pool();
  try {
    const { rows } = await p.query(`SELECT count(*)::int AS c FROM organization_members`);
    assert.equal(rows[0].c, 0);
  } finally {
    await p.end();
  }
});

test('org A cannot read org B members under tenant context', async () => {
  const p = pool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_user_id', '', true)`);
    await client.query(`SELECT set_config('app.current_organization_id', '', true)`);
    const a = randomUUID();
    const b = randomUUID();
    const orgA = randomUUID();
    const orgB = randomUUID();
    await client.query(`INSERT INTO users(id, auth_subject) VALUES ($1,$2),($3,$4)`, [
      a,
      `iso-a-${a}`,
      b,
      `iso-b-${b}`,
    ]);
    await client.query(`INSERT INTO organizations(id, name) VALUES ($1,'Iso A'),($2,'Iso B')`, [orgA, orgB]);
    await client.query(`SELECT set_config('app.current_organization_id', $1, true)`, [orgA]);
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [a]);
    await client.query(
      `INSERT INTO organization_members(organization_id,user_id,role,status) VALUES ($1,$2,'OWNER','ACTIVE')`,
      [orgA, a],
    );
    await client.query(`SELECT set_config('app.current_organization_id', $1, true)`, [orgB]);
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [b]);
    await client.query(
      `INSERT INTO organization_members(organization_id,user_id,role,status) VALUES ($1,$2,'OWNER','ACTIVE')`,
      [orgB, b],
    );
    await client.query('COMMIT');

    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [a]);
    await client.query(`SELECT set_config('app.current_organization_id', $1, true)`, [orgA]);
    const { rows } = await client.query(`SELECT organization_id FROM organization_members`);
    await client.query('COMMIT');
    assert.equal(rows.every((r) => r.organization_id === orgA), true);
    assert.equal(rows.some((r) => r.organization_id === orgB), false);
  } finally {
    client.release();
    await p.end();
  }
});

test('connection reuse does not leak tenant context', async () => {
  const p = pool();
  const client = await p.connect();
  try {
    const u = randomUUID();
    const org = randomUUID();
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_user_id', '', true)`);
    await client.query(`SELECT set_config('app.current_organization_id', '', true)`);
    await client.query(`INSERT INTO users(id, auth_subject) VALUES ($1,$2)`, [u, `reuse-${u}`]);
    await client.query(`INSERT INTO organizations(id, name) VALUES ($1,'Reuse')`, [org]);
    await client.query(`SELECT set_config('app.current_organization_id', $1, true)`, [org]);
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [u]);
    await client.query(
      `INSERT INTO organization_members(organization_id,user_id,role,status) VALUES ($1,$2,'OWNER','ACTIVE')`,
      [org, u],
    );
    await client.query('COMMIT');

    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [u]);
    await client.query(`SELECT set_config('app.current_organization_id', $1, true)`, [org]);
    const inside = await client.query(`SELECT count(*)::int AS c FROM organization_members`);
    await client.query('COMMIT');
    assert.equal(inside.rows[0].c, 1);

    const leaked = await client.query(`SELECT count(*)::int AS c FROM organization_members`);
    assert.equal(leaked.rows[0].c, 0);
  } finally {
    client.release();
    await p.end();
  }
});

test('transaction rollback removes outbox and audit', async () => {
  const p = pool();
  const client = await p.connect();
  try {
    const u = randomUUID();
    const org = randomUUID();
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_user_id', '', true)`);
    await client.query(`SELECT set_config('app.current_organization_id', '', true)`);
    await client.query(`INSERT INTO users(id, auth_subject) VALUES ($1,$2)`, [u, `rb-${u}`]);
    await client.query(`INSERT INTO organizations(id, name) VALUES ($1,'RB')`, [org]);
    await client.query(`SELECT set_config('app.current_organization_id', $1, true)`, [org]);
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [u]);
    await client.query(
      `INSERT INTO organization_members(organization_id,user_id,role,status) VALUES ($1,$2,'OWNER','ACTIVE')`,
      [org, u],
    );
    await client.query('COMMIT');

    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [u]);
      await client.query(`SELECT set_config('app.current_organization_id', $1, true)`, [org]);
      await client.query(
        `INSERT INTO audit_logs(id, organization_id, actor_user_id, action) VALUES ($1,$2,$3,'should_rollback')`,
        [randomUUID(), org, u],
      );
      await client.query(
        `INSERT INTO outbox_events(id, organization_id, event_type, payload_json) VALUES ($1,$2,'ShouldRollback','{}')`,
        [randomUUID(), org],
      );
      throw new Error('intentional');
    } catch {
      await client.query('ROLLBACK');
    }

    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [u]);
    await client.query(`SELECT set_config('app.current_organization_id', $1, true)`, [org]);
    const audit = await client.query(`SELECT count(*)::int AS c FROM audit_logs WHERE action='should_rollback'`);
    const outbox = await client.query(`SELECT count(*)::int AS c FROM outbox_events WHERE event_type='ShouldRollback'`);
    await client.query('COMMIT');
    assert.equal(audit.rows[0].c, 0);
    assert.equal(outbox.rows[0].c, 0);
  } finally {
    client.release();
    await p.end();
  }
});

test('idempotent org create: second key reuse conflicts; exactly one OWNER membership', async () => {
  const p = pool();
  const userId = randomUUID();
  const key = `key-${randomUUID()}`;
  const name = `Idem ${randomUUID()}`;

  const c = await p.connect();
  try {
    await c.query(`INSERT INTO users(id, auth_subject) VALUES ($1,$2)`, [userId, `idem-${userId}`]);

    async function createOnce(): Promise<'ok' | 'conflict'> {
      await c.query('BEGIN');
      await c.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
      await c.query(`SELECT set_config('app.current_organization_id', '', true)`);
      const inserted = await c.query(
        `INSERT INTO idempotency_records(id, actor_user_id, operation, idempotency_key, request_hash, status)
         VALUES ($1,$2,'organization.create',$3,'hash','IN_PROGRESS')
         ON CONFLICT (actor_user_id, operation, idempotency_key) DO NOTHING
         RETURNING id`,
        [randomUUID(), userId, key],
      );
      if ((inserted.rowCount ?? 0) === 0) {
        await c.query('ROLLBACK');
        return 'conflict';
      }
      const orgId = randomUUID();
      await c.query(`INSERT INTO organizations(id, name) VALUES ($1,$2)`, [orgId, name]);
      await c.query(`SELECT set_config('app.current_organization_id', $1, true)`, [orgId]);
      await c.query(
        `INSERT INTO organization_members(organization_id,user_id,role,status) VALUES ($1,$2,'OWNER','ACTIVE')`,
        [orgId, userId],
      );
      await c.query(
        `UPDATE idempotency_records SET status='COMPLETED', organization_id=$1, completed_at=now()
         WHERE actor_user_id=$2 AND operation='organization.create' AND idempotency_key=$3`,
        [orgId, userId, key],
      );
      await c.query('COMMIT');
      return 'ok';
    }

    assert.equal(await createOnce(), 'ok');
    assert.equal(await createOnce(), 'conflict');

    await c.query('BEGIN');
    await c.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
    await c.query(`SELECT set_config('app.current_organization_id', '', true)`);
    const members = await c.query(
      `SELECT organization_id FROM organization_members WHERE user_id=$1 AND status='ACTIVE'`,
      [userId],
    );
    await c.query('COMMIT');
    assert.equal(members.rows.length, 1);
  } finally {
    c.release();
    await p.end();
  }
});

test('concurrent idempotent org create allows only one winner', async () => {
  const p = createAppPool(runtimeUrl!, { max: 2 });
  const userId = randomUUID();
  const key = `key-${randomUUID()}`;
  const name = `Race ${randomUUID()}`;
  const boot = await p.connect();
  try {
    await boot.query(`INSERT INTO users(id, auth_subject) VALUES ($1,$2)`, [userId, `race-${userId}`]);
  } finally {
    boot.release();
  }

  async function attempt(): Promise<'ok' | 'conflict'> {
    const c = await p.connect();
    try {
      await c.query('BEGIN');
      await c.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
      await c.query(`SELECT set_config('app.current_organization_id', '', true)`);
      const inserted = await c.query(
        `INSERT INTO idempotency_records(id, actor_user_id, operation, idempotency_key, request_hash, status)
         VALUES ($1,$2,'organization.create',$3,'hash','IN_PROGRESS')
         ON CONFLICT (actor_user_id, operation, idempotency_key) DO NOTHING
         RETURNING id`,
        [randomUUID(), userId, key],
      );
      if ((inserted.rowCount ?? 0) === 0) {
        await c.query('ROLLBACK');
        return 'conflict';
      }
      // Serialize completion so the unique winner finishes before losers observe conflict.
      await c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [key]);
      const orgId = randomUUID();
      await c.query(`INSERT INTO organizations(id, name) VALUES ($1,$2)`, [orgId, name]);
      await c.query(`SELECT set_config('app.current_organization_id', $1, true)`, [orgId]);
      await c.query(
        `INSERT INTO organization_members(organization_id,user_id,role,status) VALUES ($1,$2,'OWNER','ACTIVE')`,
        [orgId, userId],
      );
      await c.query(
        `UPDATE idempotency_records SET status='COMPLETED', organization_id=$1, completed_at=now()
         WHERE actor_user_id=$2 AND operation='organization.create' AND idempotency_key=$3`,
        [orgId, userId, key],
      );
      await c.query('COMMIT');
      return 'ok';
    } catch (e) {
      try {
        await c.query('ROLLBACK');
      } catch {
        /* ignore */
      }
      return 'conflict';
    } finally {
      c.release();
    }
  }

  const results = await Promise.all([attempt(), attempt()]);
  assert.equal(results.filter((r) => r === 'ok').length, 1);

  const c = await p.connect();
  try {
    await c.query('BEGIN');
    await c.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
    await c.query(`SELECT set_config('app.current_organization_id', '', true)`);
    const members = await c.query(
      `SELECT organization_id FROM organization_members WHERE user_id=$1 AND status='ACTIVE'`,
      [userId],
    );
    await c.query('COMMIT');
    assert.equal(members.rows.length, 1);
  } finally {
    c.release();
    await p.end();
  }
});

test('local HS256 token signs for architecture tests (not provider evidence)', async () => {
  const key = new TextEncoder().encode(jwtSecret);
  const token = await new jose.SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('synthetic-subject')
    .setIssuer(issuer)
    .setExpirationTime('10m')
    .sign(key);
  const { payload } = await jose.jwtVerify(token, key, { issuer });
  assert.equal(payload.sub, 'synthetic-subject');
});
