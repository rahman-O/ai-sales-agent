import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
test('MB15B expired publication claim recovers while live and published claims remain excluded', async () => {
  const pool = new pg.Pool({ connectionString: process.env.MIGRATION_DATABASE_URL });
  const c = await pool.connect();
  const org = randomUUID(), expired = randomUUID(), live = randomUUID(), published = randomUUID();
  try {
    await c.query('BEGIN');
    await c.query("INSERT INTO organizations(id,name) VALUES($1,'MB15B publication synthetic')", [org]);
    for (const [id, status, seconds] of [[expired,'CLAIMED',-60],[live,'CLAIMED',60],[published,'PUBLISHED',-60]] as const) {
      await c.query("INSERT INTO outbox_events(id,organization_id,event_type,payload_json,publication_status,available_at,claimed_until) VALUES($1,$2,'MB15BReclaim','{}',$3,now()-interval '100 years',now()+($4::text||' seconds')::interval)", [id,org,status,String(seconds)]);
    }
    await c.query('SET LOCAL ROLE app_runtime');
    const r = await c.query('SELECT * FROM claim_pending_outbox_events(100)');
    assert.ok(r.rows.some(x => x.work_id === expired));
    assert.ok(!r.rows.some(x => x.work_id === live || x.work_id === published));
    await c.query("SELECT set_config('app.current_organization_id',$1,true)", [org]);
    const row = (await c.query('SELECT publication_status,publication_attempts,claimed_until>now() active FROM outbox_events WHERE id=$1', [expired])).rows[0];
    assert.equal(row.publication_status,'CLAIMED');
    assert.equal(row.publication_attempts,1);
    assert.equal(row.active,true);
  } finally { await c.query('ROLLBACK'); c.release(); await pool.end(); }
});
