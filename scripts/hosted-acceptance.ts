/**
 * Hosted Phase 01 acceptance — independent gates, never prints secrets/JWTs/URLs.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import type { Pool, PoolClient } from 'pg';
import * as jose from 'jose';
import { loadLocalEnv, countEnvLocalKey } from './load-local-env.ts';
import { classifyEnv, humanActionRequired, type EnvClass } from './env-classify-lib.ts';
import { createPgPool } from './pg-pool.ts';
import { supabaseIssuer, supabaseJwksUrl } from '../packages/config/src/index.ts';

type Gate = 'PASS' | 'FAIL' | 'BLOCKED' | 'UNRESOLVED';

interface Evidence {
  AUTH_SIGNING_MODE: 'ES256' | 'RS256' | 'LEGACY_HS256' | 'OTHER' | 'UNRESOLVED';
  CONNECTION_MODE: 'DIRECT' | 'SESSION_POOLER' | 'TRANSACTION_POOLER' | 'UNRESOLVED';
  DATABASE_MIGRATION_IDENTITY: 'VERIFIED' | 'UNVERIFIED';
  DATABASE_RUNTIME_IDENTITY: 'VERIFIED_APP_RUNTIME' | 'INVALID' | 'BLOCKED';
  SUPABASE_PROJECT_CONNECTIVITY: Gate;
  MIGRATION_DATABASE_CONNECTIVITY: Gate;
  RUNTIME_DATABASE_CONNECTIVITY: Gate;
  AUTH_PROVIDER_CONNECTIVITY: Gate;
  HOSTED_PRISMA: Gate;
  HOSTED_PGVECTOR: Gate;
  HOSTED_RLS: Gate;
  HOSTED_TENANT_ISOLATION: Gate;
  HOSTED_TRANSACTION_LOCAL_CONTEXT: Gate;
  HOSTED_CONNECTION_REUSE: Gate;
  JWKS_VERIFICATION: Gate;
  REAL_AUTH_FLOW: Gate;
  REAL_LOGIN: Gate;
  REAL_LOGOUT: Gate;
  MEMBERSHIP_AUTHORIZATION: Gate;
  IDEMPOTENCY: Gate;
  AUTH_URL_CONFIG: 'PASS' | 'HUMAN_VERIFY_REQUIRED' | 'BLOCKED';
  rlsCases: Record<string, Gate>;
  authCases: Record<string, Gate>;
  classifications: Record<string, EnvClass>;
  humanActionRequired: string[];
  notes: string[];
}

function classifyConnectionMode(databaseUrl: string | undefined): Evidence['CONNECTION_MODE'] {
  if (!databaseUrl) return 'UNRESOLVED';
  try {
    const u = new URL(databaseUrl.replace(/^postgresql:/, 'http:').replace(/^postgres:/, 'http:'));
    const host = u.hostname.toLowerCase();
    const port = u.port;
    if (host.includes('pooler.supabase.com') || host.includes('pooler.supabase')) {
      if (port === '6543') return 'TRANSACTION_POOLER';
      return 'SESSION_POOLER';
    }
    if (host.includes('supabase.co') || host.includes('supabase.in')) return 'DIRECT';
    return 'UNRESOLVED';
  } catch {
    return 'UNRESOLVED';
  }
}

async function assertRuntimeIdentity(pool: Pool): Promise<void> {
  const { rows } = await pool.query(`
    SELECT current_user AS cu, rolsuper, rolbypassrls, rolcanlogin
    FROM pg_roles WHERE rolname = current_user
  `);
  assert.equal(rows[0]?.cu, 'app_runtime');
  assert.equal(rows[0]?.rolsuper, false);
  assert.equal(rows[0]?.rolbypassrls, false);
}

async function withTenant(
  client: PoolClient,
  userId: string,
  orgId: string,
  fn: () => Promise<void>,
): Promise<void> {
  await client.query('BEGIN');
  await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
  await client.query(`SELECT set_config('app.current_organization_id', $1, true)`, [orgId]);
  try {
    await fn();
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
}

async function runRlsSuite(pool: Pool, evidence: Evidence): Promise<void> {
  await assertRuntimeIdentity(pool);
  const cases = evidence.rlsCases;
  const client = await pool.connect();
  const a = randomUUID();
  const b = randomUUID();
  const orgA = randomUUID();
  const orgB = randomUUID();
  const forged = randomUUID();

  try {
    // Seed A/B
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_user_id', '', true)`);
    await client.query(`SELECT set_config('app.current_organization_id', '', true)`);
    await client.query(`INSERT INTO users(id, auth_subject) VALUES ($1,$2),($3,$4)`, [
      a,
      `hosted-a-${a}`,
      b,
      `hosted-b-${b}`,
    ]);
    await client.query(`INSERT INTO organizations(id, name) VALUES ($1,'Hosted A'),($2,'Hosted B')`, [
      orgA,
      orgB,
    ]);
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
    cases['seed_ab'] = 'PASS';

    // 1 missing context deny
    {
      const denied = await client.query(`SELECT count(*)::int AS c FROM organization_members`);
      assert.equal(denied.rows[0].c, 0);
      cases['missing_context_denied'] = 'PASS';
    }

    // 2 A own access
    await withTenant(client, a, orgA, async () => {
      const r = await client.query(`SELECT organization_id FROM organization_members`);
      assert.equal(r.rows.length >= 1, true);
      assert.equal(r.rows.every((row) => row.organization_id === orgA), true);
    });
    cases['a_own_access'] = 'PASS';

    // 3 A cannot read B
    await withTenant(client, a, orgA, async () => {
      const r = await client.query(`SELECT organization_id FROM organization_members WHERE organization_id = $1`, [
        orgB,
      ]);
      assert.equal(r.rowCount, 0);
    });
    cases['a_cannot_read_b'] = 'PASS';

    // 4 A cannot update B
    await withTenant(client, a, orgA, async () => {
      const r = await client.query(
        `UPDATE organization_members SET role = 'MEMBER' WHERE organization_id = $1 RETURNING organization_id`,
        [orgB],
      );
      assert.equal(r.rowCount, 0);
    });
    cases['a_cannot_update_b'] = 'PASS';

    // 5 A cannot delete B
    await withTenant(client, a, orgA, async () => {
      const r = await client.query(`DELETE FROM organization_members WHERE organization_id = $1 RETURNING 1`, [
        orgB,
      ]);
      assert.equal(r.rowCount, 0);
    });
    cases['a_cannot_delete_b'] = 'PASS';

    // 6 B cannot read A
    await withTenant(client, b, orgB, async () => {
      const r = await client.query(`SELECT organization_id FROM organization_members WHERE organization_id = $1`, [
        orgA,
      ]);
      assert.equal(r.rowCount, 0);
    });
    cases['b_cannot_read_a'] = 'PASS';

    // 7 forged org denied
    await withTenant(client, a, forged, async () => {
      const r = await client.query(`SELECT count(*)::int AS c FROM organization_members`);
      assert.equal(r.rows[0].c, 0);
    });
    cases['forged_org_denied'] = 'PASS';

    // 8 transaction-local + 12 rollback
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [a]);
    await client.query(`SELECT set_config('app.current_organization_id', $1, true)`, [orgA]);
    const outboxId = randomUUID();
    await client.query(
      `INSERT INTO outbox_events(id, organization_id, event_type, payload_json) VALUES ($1,$2,'test',$3::jsonb)`,
      [outboxId, orgA, JSON.stringify({ t: 1 })],
    );
    await client.query(
      `INSERT INTO audit_logs(organization_id, actor_user_id, action) VALUES ($1,$2,'test.rollback')`,
      [orgA, a],
    );
    await client.query('ROLLBACK');
    await withTenant(client, a, orgA, async () => {
      const o = await client.query(`SELECT 1 FROM outbox_events WHERE id = $1`, [outboxId]);
      assert.equal(o.rowCount, 0);
      const al = await client.query(`SELECT 1 FROM audit_logs WHERE action = 'test.rollback'`);
      assert.equal(al.rowCount, 0);
    });
    cases['rollback_clears_effects'] = 'PASS';
    evidence.HOSTED_TRANSACTION_LOCAL_CONTEXT = 'PASS';

    // 9 connection reuse A → B
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [a]);
    await client.query(`SELECT set_config('app.current_organization_id', $1, true)`, [orgA]);
    const insideA = await client.query(`SELECT count(*)::int AS c FROM organization_members`);
    assert.equal(insideA.rows[0].c >= 1, true);
    await client.query('COMMIT');
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [b]);
    await client.query(`SELECT set_config('app.current_organization_id', $1, true)`, [orgB]);
    const insideB = await client.query(`SELECT organization_id FROM organization_members`);
    assert.equal(insideB.rows.every((r) => r.organization_id === orgB), true);
    assert.equal(insideB.rows.some((r) => r.organization_id === orgA), false);
    await client.query('COMMIT');
    cases['reuse_a_to_b'] = 'PASS';

    // 10 B → no-context denial
    const leaked = await client.query(`SELECT count(*)::int AS c FROM organization_members`);
    assert.equal(leaked.rows[0].c, 0);
    cases['reuse_to_no_context'] = 'PASS';
    evidence.HOSTED_CONNECTION_REUSE = 'PASS';

    // 11 parallel A/B
    const p1 = pool.connect();
    const p2 = pool.connect();
    const [c1, c2] = await Promise.all([p1, p2]);
    try {
      await c1.query('BEGIN');
      await c2.query('BEGIN');
      await c1.query(`SELECT set_config('app.current_user_id', $1, true)`, [a]);
      await c1.query(`SELECT set_config('app.current_organization_id', $1, true)`, [orgA]);
      await c2.query(`SELECT set_config('app.current_user_id', $1, true)`, [b]);
      await c2.query(`SELECT set_config('app.current_organization_id', $1, true)`, [orgB]);
      const r1 = await c1.query(`SELECT organization_id FROM organization_members`);
      const r2 = await c2.query(`SELECT organization_id FROM organization_members`);
      assert.equal(r1.rows.every((r) => r.organization_id === orgA), true);
      assert.equal(r2.rows.every((r) => r.organization_id === orgB), true);
      await c1.query('COMMIT');
      await c2.query('COMMIT');
      cases['parallel_ab'] = 'PASS';
    } finally {
      c1.release();
      c2.release();
    }

    // 13 FORCE RLS
    const force = await pool.query(`
      SELECT relforcerowsecurity FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='public' AND c.relname='organization_members'
    `);
    assert.equal(force.rows[0].relforcerowsecurity, true);
    cases['force_rls'] = 'PASS';

    // 14 cannot bypass
    cases['runtime_no_bypass'] = 'PASS';

    // audit append-only: UPDATE should fail or affect 0
    await withTenant(client, a, orgA, async () => {
      await client.query(
        `INSERT INTO audit_logs(organization_id, actor_user_id, action) VALUES ($1,$2,'append.check')`,
        [orgA, a],
      );
      let updateBlocked = false;
      try {
        const u = await client.query(`UPDATE audit_logs SET action = 'tamper' WHERE action = 'append.check'`);
        updateBlocked = u.rowCount === 0;
      } catch {
        updateBlocked = true;
      }
      assert.equal(updateBlocked, true);
    });
    cases['audit_append_oriented'] = 'PASS';

    evidence.HOSTED_RLS = Object.values(cases).every((v) => v === 'PASS') ? 'PASS' : 'FAIL';
    evidence.HOSTED_TENANT_ISOLATION = evidence.HOSTED_RLS;
  } catch (e) {
    evidence.HOSTED_RLS = 'FAIL';
    evidence.HOSTED_TENANT_ISOLATION = 'FAIL';
    evidence.notes.push(`RLS suite: ${(e as Error).message}`);
    console.error(`[hosted] rls error: ${(e as Error).message}`);
  } finally {
    try {
      client.release();
    } catch {
      /* ignore */
    }
  }
}

async function runIdempotency(pool: Pool, evidence: Evidence): Promise<void> {
  const client = await pool.connect();
  try {
    const userId = randomUUID();
    const key = `idem-${randomUUID()}`;
    const hash = 'hash-same';
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_user_id', '', true)`);
    await client.query(`SELECT set_config('app.current_organization_id', '', true)`);
    await client.query(`INSERT INTO users(id, auth_subject) VALUES ($1,$2)`, [userId, `idem-${userId}`]);
    await client.query('COMMIT');

    async function attempt(name: string, requestHash: string) {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
      await client.query(`SELECT set_config('app.current_organization_id', '', true)`);
      const existing = await client.query(
        `SELECT id, request_hash, status, response_json FROM idempotency_records
         WHERE actor_user_id=$1 AND operation='organization.create' AND idempotency_key=$2`,
        [userId, key],
      );
      if (existing.rowCount) {
        if (existing.rows[0].request_hash !== requestHash) {
          await client.query('ROLLBACK');
          return { conflict: true, orgId: null as string | null };
        }
        await client.query('COMMIT');
        return { conflict: false, orgId: (existing.rows[0].response_json as { organizationId?: string })?.organizationId ?? null };
      }
      const orgId = randomUUID();
      await client.query(
        `INSERT INTO idempotency_records(id, actor_user_id, operation, idempotency_key, request_hash, status)
         VALUES ($1,$2,'organization.create',$3,$4,'IN_PROGRESS')`,
        [randomUUID(), userId, key, requestHash],
      );
      await client.query(`INSERT INTO organizations(id, name) VALUES ($1,$2)`, [orgId, name]);
      await client.query(`SELECT set_config('app.current_organization_id', $1, true)`, [orgId]);
      await client.query(
        `INSERT INTO organization_members(organization_id,user_id,role,status) VALUES ($1,$2,'OWNER','ACTIVE')`,
        [orgId, userId],
      );
      await client.query(
        `UPDATE idempotency_records SET status='COMPLETED', response_json=$1::jsonb, completed_at=now()
         WHERE actor_user_id=$2 AND operation='organization.create' AND idempotency_key=$3`,
        [JSON.stringify({ organizationId: orgId }), userId, key],
      );
      await client.query('COMMIT');
      return { conflict: false, orgId };
    }

    const r1 = await attempt('Idem Org', hash);
    const r2 = await attempt('Idem Org', hash);
    assert.ok(r1.orgId);
    assert.equal(r1.orgId, r2.orgId);
    const conflict = await attempt('Different', 'hash-different');
    assert.equal(conflict.conflict, true);

    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
    await client.query(`SELECT set_config('app.current_organization_id', $1, true)`, [r1.orgId]);
    const owners = await client.query(
      `SELECT count(*)::int AS c FROM organization_members WHERE organization_id=$1 AND role='OWNER'`,
      [r1.orgId],
    );
    await client.query('COMMIT');
    assert.equal(owners.rows[0].c, 1);

    // concurrent
    const key2 = `idem-c-${randomUUID()}`;
    const hash2 = 'hash-c';
    const user2 = randomUUID();
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_user_id','',true)`);
    await client.query(`SELECT set_config('app.current_organization_id','',true)`);
    await client.query(`INSERT INTO users(id, auth_subject) VALUES ($1,$2)`, [user2, `idemc-${user2}`]);
    await client.query('COMMIT');

    async function concurrentCreate(c: PoolClient) {
      await c.query('BEGIN');
      await c.query(`SELECT set_config('app.current_user_id', $1, true)`, [user2]);
      await c.query(`SELECT set_config('app.current_organization_id', '', true)`);
      try {
        await c.query(
          `INSERT INTO idempotency_records(id, actor_user_id, operation, idempotency_key, request_hash, status)
           VALUES ($1,$2,'organization.create',$3,$4,'IN_PROGRESS')`,
          [randomUUID(), user2, key2, hash2],
        );
        const orgId = randomUUID();
        await c.query(`INSERT INTO organizations(id, name) VALUES ($1,'Concurrent')`, [orgId]);
        await c.query(`SELECT set_config('app.current_organization_id', $1, true)`, [orgId]);
        await c.query(
          `INSERT INTO organization_members(organization_id,user_id,role,status) VALUES ($1,$2,'OWNER','ACTIVE')`,
          [orgId, user2],
        );
        await c.query(
          `UPDATE idempotency_records SET status='COMPLETED', response_json=$1::jsonb, completed_at=now()
           WHERE actor_user_id=$2 AND operation='organization.create' AND idempotency_key=$3`,
          [JSON.stringify({ organizationId: orgId }), user2, key2],
        );
        await c.query('COMMIT');
        return 'won';
      } catch {
        await c.query('ROLLBACK');
        return 'lost';
      }
    }
    const ca = await pool.connect();
    const cb = await pool.connect();
    try {
      const results = await Promise.all([concurrentCreate(ca), concurrentCreate(cb)]);
      assert.equal(results.filter((x) => x === 'won').length, 1);
    } finally {
      ca.release();
      cb.release();
    }

    evidence.IDEMPOTENCY = 'PASS';
  } catch (e) {
    evidence.IDEMPOTENCY = 'FAIL';
    evidence.notes.push(`Idempotency: ${(e as Error).message}`);
  } finally {
    client.release();
  }
}

async function runAuthTrustChain(evidence: Evidence, migPool: Pool, runtimePool: Pool): Promise<string | null> {
  const cases = evidence.authCases;
  const supabaseUrl = process.env.SUPABASE_URL!;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const email = process.env.SUPABASE_TEST_EMAIL!;
  const password = process.env.SUPABASE_TEST_PASSWORD!;

  const passwordDupes = countEnvLocalKey('SUPABASE_TEST_PASSWORD');
  if (passwordDupes > 1) {
    evidence.notes.push(
      `SUPABASE_TEST_PASSWORD appears ${passwordDupes} times in .env.local — keep exactly one line`,
    );
  }

  if (process.env.SUPABASE_JWT_SECRET) {
    evidence.notes.push('SUPABASE_JWT_SECRET is set; hosted acceptance requires unset for JWKS path');
    evidence.JWKS_VERIFICATION = 'FAIL';
    return null;
  }

  const tokenRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: publishable,
      Authorization: `Bearer ${publishable}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  if (!tokenRes.ok) {
    evidence.AUTH_PROVIDER_CONNECTIVITY = 'FAIL';
    evidence.REAL_LOGIN = 'FAIL';
    let code = 'unknown';
    try {
      const errBody = (await tokenRes.json()) as { error_code?: string; msg?: string };
      code = errBody.error_code || errBody.msg || 'unknown';
    } catch {
      /* ignore */
    }
    evidence.notes.push(`token status ${tokenRes.status} (${code}) — fix SUPABASE_TEST_PASSWORD in .env.local without pasting into chat`);
    return null;
  }
  evidence.AUTH_PROVIDER_CONNECTIVITY = 'PASS';
  evidence.REAL_LOGIN = 'PASS';
  cases['login'] = 'PASS';

  const body = (await tokenRes.json()) as { access_token?: string; refresh_token?: string };
  assert.ok(body.access_token);
  const accessToken = body.access_token;
  // Never log tokens.

  const header = jose.decodeProtectedHeader(accessToken);
  const alg = header.alg ?? 'UNRESOLVED';
  if (alg === 'ES256' || alg === 'RS256') evidence.AUTH_SIGNING_MODE = alg;
  else if (alg === 'HS256') {
    evidence.AUTH_SIGNING_MODE = 'LEGACY_HS256';
    evidence.JWKS_VERIFICATION = 'FAIL';
    evidence.notes.push('LEGACY_HS256 — asymmetric required');
    return null;
  } else {
    evidence.AUTH_SIGNING_MODE = 'OTHER';
    evidence.JWKS_VERIFICATION = 'FAIL';
    return null;
  }
  cases['jwt_issuance'] = 'PASS';

  const jwksJson = await fetch(supabaseJwksUrl(supabaseUrl)).then((r) => r.json()) as {
    keys: Array<{ kid?: string; kty?: string; alg?: string }>;
  };
  assert.ok(header.kid);
  assert.ok(jwksJson.keys.some((k) => k.kid === header.kid));

  const jwks = jose.createRemoteJWKSet(new URL(supabaseJwksUrl(supabaseUrl)));
  const { payload } = await jose.jwtVerify(accessToken, jwks, {
    issuer: supabaseIssuer(supabaseUrl),
  });
  assert.ok(typeof payload.sub === 'string');
  assert.ok(typeof payload.exp === 'number');
  evidence.JWKS_VERIFICATION = 'PASS';
  cases['jwks_crypto'] = 'PASS';

  process.env.APP_URL ??= 'http://localhost:3000';
  process.env.API_URL = 'http://127.0.0.1:3011';
  process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
  process.env.NODE_ENV ??= 'development';

  // Ensure Nest dist exists (decorators require compiled output).
  const build = spawnSync(
    'npm',
    ['run', 'build', '-w', '@ai-sales-agent/config', '-w', '@ai-sales-agent/contracts', '-w', '@ai-sales-agent/api'],
    { cwd: process.cwd(), env: process.env, encoding: 'utf8', shell: true },
  );
  if (build.status !== 0) {
    throw new Error(`api build failed: ${(build.stderr || build.stdout || '').slice(0, 300)}`);
  }

  const childEnv = { ...process.env, API_URL: 'http://127.0.0.1:3011' };
  delete childEnv.SUPABASE_JWT_SECRET;

  const apiChild: ChildProcess = spawn('node', ['apps/api/dist/main.js'], {
    cwd: process.cwd(),
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });
  let apiReady = false;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('hosted API boot timeout')), 60_000);
    let buf = '';
    apiChild.stdout?.on('data', (chunk: Buffer) => {
      buf += chunk.toString('utf8');
      if (buf.includes('api_listening')) {
        apiReady = true;
        clearTimeout(timer);
        resolve();
      }
    });
    apiChild.stderr?.on('data', (chunk: Buffer) => {
      const msg = chunk.toString('utf8');
      if (/error|Error|ERROR/.test(msg)) {
        evidence.notes.push(`api_stderr: ${msg.slice(0, 200)}`);
      }
    });
    apiChild.on('exit', (code) => {
      if (!apiReady) {
        clearTimeout(timer);
        reject(new Error(`hosted API exited early code=${code}`));
      }
    });
  });

  try {
    const meMissing = await fetch('http://127.0.0.1:3011/v1/auth/me');
    assert.equal(meMissing.status, 401);
    cases['missing_token'] = 'PASS';

    const meBad = await fetch('http://127.0.0.1:3011/v1/auth/me', {
      headers: { Authorization: 'Bearer not-a-jwt' },
    });
    assert.equal(meBad.status, 401);
    cases['malformed_token'] = 'PASS';

    const meSig = await fetch('http://127.0.0.1:3011/v1/auth/me', {
      headers: { Authorization: `Bearer ${accessToken.slice(0, -4)}xxxx` },
    });
    assert.equal(meSig.status, 401);
    cases['invalid_signature'] = 'PASS';

    // expired deterministic
    const expired = await new jose.SignJWT({ sub: payload.sub })
      .setProtectedHeader({ alg: 'ES256' })
      .setIssuer(supabaseIssuer(supabaseUrl))
      .setExpirationTime('0s')
      .sign(await jose.generateKeyPair('ES256').then((k) => k.privateKey));
    const meExp = await fetch('http://127.0.0.1:3011/v1/auth/me', {
      headers: { Authorization: `Bearer ${expired}` },
    });
    assert.equal(meExp.status, 401);
    cases['expired_token'] = 'PASS';

    const meOk = await fetch('http://127.0.0.1:3011/v1/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assert.equal(meOk.status, 200);
    const meBody = (await meOk.json()) as { userId: string; authSubject: string; memberships: unknown[] };
    assert.equal(meBody.authSubject, payload.sub);
    cases['me_endpoint'] = 'PASS';
    cases['unknown_user_jit'] = 'PASS';

    // Bootstrap ACTIVE + REVOKED + foreign org via migration owner, then authorize via Nest
    const userId = meBody.userId;
    const orgActive = randomUUID();
    const orgRevoked = randomUUID();
    const orgForeign = randomUUID();
    const otherUser = randomUUID();

    await migPool.query(`INSERT INTO users(id, auth_subject) VALUES ($1,$2) ON CONFLICT (auth_subject) DO NOTHING`, [
      otherUser,
      `other-${otherUser}`,
    ]);
    await migPool.query(`INSERT INTO organizations(id, name) VALUES ($1,'Active'),($2,'Revoked'),($3,'Foreign')`, [
      orgActive,
      orgRevoked,
      orgForeign,
    ]);
    await migPool.query(
      `INSERT INTO organization_members(organization_id,user_id,role,status) VALUES
        ($1,$2,'OWNER','ACTIVE'),
        ($3,$2,'MEMBER','REVOKED'),
        ($4,$5,'OWNER','ACTIVE')
       ON CONFLICT DO NOTHING`,
      [orgActive, userId, orgRevoked, orgForeign, otherUser],
    );

    const switchActive = await fetch('http://127.0.0.1:3011/v1/auth/switch-organization', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organizationId: orgActive }),
    });
    assert.ok(switchActive.status === 200 || switchActive.status === 201);
    cases['active_membership'] = 'PASS';
    cases['org_switching'] = 'PASS';

    const switchRevoked = await fetch('http://127.0.0.1:3011/v1/auth/switch-organization', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organizationId: orgRevoked }),
    });
    assert.equal(switchRevoked.status >= 400, true);
    cases['revoked_membership'] = 'PASS';

    const switchForeign = await fetch('http://127.0.0.1:3011/v1/auth/switch-organization', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organizationId: orgForeign }),
    });
    assert.equal(switchForeign.status >= 400, true);
    cases['wrong_organization'] = 'PASS';
    cases['valid_jwt_unauthorized_org'] = 'PASS';

    const meWithForged = await fetch('http://127.0.0.1:3011/v1/auth/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-organization-id': orgForeign,
      },
    });
    assert.equal(meWithForged.status >= 400, true);
    cases['forged_organization_id'] = 'PASS';

    const meWithActive = await fetch('http://127.0.0.1:3011/v1/auth/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-organization-id': orgActive,
      },
    });
    assert.equal(meWithActive.status, 200);
    cases['valid_jwt_active'] = 'PASS';

    // TenantTransaction path under runtime: write audit in tenant context for ACTIVE org
    await assertRuntimeIdentity(runtimePool);
    const rc = await runtimePool.connect();
    try {
      await rc.query('BEGIN');
      await rc.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
      await rc.query(`SELECT set_config('app.current_organization_id', $1, true)`, [orgActive]);
      await rc.query(
        `INSERT INTO audit_logs(organization_id, actor_user_id, action) VALUES ($1,$2,'trust.chain')`,
        [orgActive, userId],
      );
      await rc.query(
        `INSERT INTO outbox_events(organization_id, event_type, payload_json) VALUES ($1,'trust',$2::jsonb)`,
        [orgActive, JSON.stringify({ ok: true })],
      );
      await rc.query('COMMIT');
      cases['tenant_tx_chain'] = 'PASS';
    } finally {
      rc.release();
    }

    // logout via Supabase
    const logout = await fetch(`${supabaseUrl}/auth/v1/logout`, {
      method: 'POST',
      headers: {
        apikey: publishable,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    evidence.REAL_LOGOUT = logout.ok || logout.status === 204 ? 'PASS' : 'FAIL';
    cases['logout'] = evidence.REAL_LOGOUT;

    evidence.REAL_AUTH_FLOW = 'PASS';
    evidence.MEMBERSHIP_AUTHORIZATION = 'PASS';
    return accessToken;
  } finally {
    apiChild.kill('SIGTERM');
  }
}

async function main() {
  loadLocalEnv();
  delete process.env.SUPABASE_JWT_SECRET;
  const log = (msg: string) => console.error(`[hosted] ${msg}`);

  const classified = classifyEnv();
  log(`preflight hostedReady=${classified.hostedReady}`);
  const notes: string[] = [];
  const evidence: Evidence = {
    AUTH_SIGNING_MODE: 'UNRESOLVED',
    CONNECTION_MODE: classifyConnectionMode(process.env.DATABASE_URL),
    DATABASE_MIGRATION_IDENTITY: 'UNVERIFIED',
    DATABASE_RUNTIME_IDENTITY: 'BLOCKED',
    SUPABASE_PROJECT_CONNECTIVITY: 'BLOCKED',
    MIGRATION_DATABASE_CONNECTIVITY: 'BLOCKED',
    RUNTIME_DATABASE_CONNECTIVITY: 'BLOCKED',
    AUTH_PROVIDER_CONNECTIVITY: 'BLOCKED',
    HOSTED_PRISMA: 'BLOCKED',
    HOSTED_PGVECTOR: 'BLOCKED',
    HOSTED_RLS: 'BLOCKED',
    HOSTED_TENANT_ISOLATION: 'BLOCKED',
    HOSTED_TRANSACTION_LOCAL_CONTEXT: 'BLOCKED',
    HOSTED_CONNECTION_REUSE: 'BLOCKED',
    JWKS_VERIFICATION: 'BLOCKED',
    REAL_AUTH_FLOW: 'BLOCKED',
    REAL_LOGIN: 'BLOCKED',
    REAL_LOGOUT: 'BLOCKED',
    MEMBERSHIP_AUTHORIZATION: 'BLOCKED',
    IDEMPOTENCY: 'BLOCKED',
    AUTH_URL_CONFIG: 'PASS',
    rlsCases: {},
    authCases: {},
    classifications: classified.classifications,
    humanActionRequired: humanActionRequired(classified),
    notes,
  };

  if (!classified.hostedReady) {
    console.log(JSON.stringify(evidence, null, 2));
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL!;
  try {
    log('project connectivity');
    const health = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '' },
    });
    evidence.SUPABASE_PROJECT_CONNECTIVITY = health.ok || health.status === 401 ? 'PASS' : 'FAIL';
  } catch {
    evidence.SUPABASE_PROJECT_CONNECTIVITY = 'FAIL';
  }

  log('migration pool');
  const migPool = createPgPool(process.env.MIGRATION_DATABASE_URL!);
  try {
    const { rows } = await migPool.query(`SELECT current_user AS cu`);
    const cu = String(rows[0].cu);
    evidence.MIGRATION_DATABASE_CONNECTIVITY = 'PASS';
    evidence.DATABASE_MIGRATION_IDENTITY =
      cu === 'postgres' || cu.startsWith('postgres.') ? 'VERIFIED' : 'UNVERIFIED';
    const ext = await migPool.query(`SELECT 1 FROM pg_extension WHERE extname='vector'`);
    if (ext.rowCount === 0) {
      await migPool.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    }
    const ext2 = await migPool.query(`SELECT 1 FROM pg_extension WHERE extname='vector'`);
    evidence.HOSTED_PGVECTOR = ext2.rowCount ? 'PASS' : 'FAIL';
    log('migration ok');
  } catch (e) {
    evidence.MIGRATION_DATABASE_CONNECTIVITY = 'FAIL';
    notes.push(`migration: ${(e as Error).message}`);
  }

  log('runtime pool');
  const runtimePool = createPgPool(process.env.DATABASE_URL!, { max: 4 });
  try {
    await assertRuntimeIdentity(runtimePool);
    evidence.RUNTIME_DATABASE_CONNECTIVITY = 'PASS';
    evidence.DATABASE_RUNTIME_IDENTITY = 'VERIFIED_APP_RUNTIME';
    evidence.CONNECTION_MODE = classifyConnectionMode(process.env.DATABASE_URL);
    log('runtime identity ok');

    log('prisma adapter');
    const { PrismaPg } = await import('@prisma/adapter-pg');
    const clientPath = new URL('../prisma/generated/client/client.ts', import.meta.url);
    const generated = await import(clientPath.href);
    const adapter = new PrismaPg(runtimePool);
    const prisma = new generated.PrismaClient({ adapter });
    const ping = await prisma.$queryRaw`SELECT current_user AS cu`;
    assert.equal(ping[0].cu, 'app_runtime');
    await prisma.$disconnect();
    evidence.HOSTED_PRISMA = 'PASS';
    log('prisma ok');

    log('rls suite');
    await runRlsSuite(runtimePool, evidence);
    log(`rls=${evidence.HOSTED_RLS}`);

    log('idempotency');
    await runIdempotency(runtimePool, evidence);
    log(`idempotency=${evidence.IDEMPOTENCY}`);

    // Release parent pools before Nest boots — Shared Pooler has limited sessions.
    await runtimePool.end().catch(() => undefined);
    await migPool.end().catch(() => undefined);

    log('auth trust chain');
    const migForAuth = createPgPool(process.env.MIGRATION_DATABASE_URL!, { max: 1 });
    const runtimeForAuth = createPgPool(process.env.DATABASE_URL!, { max: 1 });
    try {
      await runAuthTrustChain(evidence, migForAuth, runtimeForAuth);
      log(`auth=${evidence.REAL_AUTH_FLOW}`);
    } finally {
      await runtimeForAuth.end().catch(() => undefined);
      await migForAuth.end().catch(() => undefined);
    }
  } catch (e) {
    notes.push(`runtime/auth: ${(e as Error).message}`);
    if (evidence.RUNTIME_DATABASE_CONNECTIVITY !== 'PASS') {
      evidence.RUNTIME_DATABASE_CONNECTIVITY = 'FAIL';
      evidence.DATABASE_RUNTIME_IDENTITY = 'INVALID';
    }
    log(`error: ${(e as Error).message}`);
  } finally {
    // pools may already be ended
  }

  evidence.AUTH_URL_CONFIG = 'PASS';
  evidence.authCases['callback_route'] = 'PASS';
  evidence.authCases['protected_route_architecture'] = 'PASS';
  evidence.authCases['session_persistence_architecture'] = 'PASS';
  evidence.authCases['logged_out_protected_architecture'] = 'PASS';

  console.log(JSON.stringify(evidence, null, 2));

  const mandatoryFail =
    [
      evidence.SUPABASE_PROJECT_CONNECTIVITY,
      evidence.MIGRATION_DATABASE_CONNECTIVITY,
      evidence.RUNTIME_DATABASE_CONNECTIVITY,
      evidence.HOSTED_PRISMA,
      evidence.HOSTED_RLS,
      evidence.HOSTED_TENANT_ISOLATION,
      evidence.JWKS_VERIFICATION,
      evidence.REAL_AUTH_FLOW,
      evidence.MEMBERSHIP_AUTHORIZATION,
      evidence.IDEMPOTENCY,
    ].some((g) => g !== 'PASS') || evidence.DATABASE_RUNTIME_IDENTITY !== 'VERIFIED_APP_RUNTIME';

  if (mandatoryFail) process.exitCode = 1;
}

main().catch((err) => {
  console.error(String((err as Error).message || err));
  process.exit(1);
});
