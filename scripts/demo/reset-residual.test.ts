/**
 * Integration-style checks for demo reset residual + survivor preservation.
 * Requires local Docker Postgres (DEMO_DB_TARGET=LOCAL).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool } from 'pg';
import { assertLocalDemoDb } from './assert-local-demo-db.ts';
import { DEMO_ORG_ID, DEMO_ORG_NAME } from './constants.ts';
import { loadDemoCliEnv } from './load-demo-cli-env.ts';
import { assertOrgIdentity, countDemoTenantRows, deleteDemoTenant } from './residual.ts';
import { randomUUID } from 'node:crypto';

loadDemoCliEnv();

const gate = assertLocalDemoDb(process.env);
const skip = !gate.ok;

test('reset residual leaves zero demo tenant rows and preserves survivor', { skip }, async () => {
  const pool = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL });
  const survivorId = randomUUID();
  try {
    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1::uuid, $2) ON CONFLICT (id) DO NOTHING`, [
      survivorId,
      'Demo Survivor Clinic (Keep)',
    ]);

    const identity = await assertOrgIdentity(pool, DEMO_ORG_ID, DEMO_ORG_NAME);
    if (identity === 'collision') throw new Error('collision');
    if (identity === 'match') {
      await deleteDemoTenant(pool, DEMO_ORG_ID);
    }
    const remaining = await countDemoTenantRows(pool, DEMO_ORG_ID);
    assert.equal(remaining, 0);
    assert.equal(await assertOrgIdentity(pool, DEMO_ORG_ID, DEMO_ORG_NAME), 'absent');

    const survivor = await pool.query(`SELECT name FROM organizations WHERE id=$1::uuid`, [survivorId]);
    assert.equal(survivor.rows[0]?.name, 'Demo Survivor Clinic (Keep)');
  } finally {
    await pool.query(`DELETE FROM organizations WHERE id=$1::uuid`, [survivorId]).catch(() => undefined);
    await pool.end();
  }
});

test('org UUID collision hard-fails conceptually', { skip }, async () => {
  const pool = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL });
  try {
    // If demo org exists with correct name → match; collision would be different name
    const r = await assertOrgIdentity(pool, DEMO_ORG_ID, 'Totally Different Name');
    if (r === 'match') throw new Error('unexpected match');
    assert.ok(r === 'absent' || r === 'collision');
  } finally {
    await pool.end();
  }
});
