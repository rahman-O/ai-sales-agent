/** Narrow, reversible local history repair after exact SQL-replay catalog equivalence. */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { loadDemoCliEnv } from '../demo/load-demo-cli-env.ts';
import { requireLocalDemoDb } from '../demo/assert-local-demo-db.ts';
async function main() {
  loadDemoCliEnv(); requireLocalDemoDb();
  const name='202609262200_pre_p14_conversation_working_state';
  const oldChecksum='4e6b54a2a11b63dd101c51829e1f964344fe3bebbcb21422778749a2a97efdf3';
  const checksum=createHash('sha256').update(fs.readFileSync(`prisma/migrations/${name}/migration.sql`)).digest('hex');
  const checked=spawnSync('npx',['tsx','scripts/mb15/normalized-schema-drift.ts'],{env:process.env,stdio:'pipe'});
  if(checked.status!==1) throw new Error('expected_only_known_history_mismatch');
  const evidence=JSON.parse(fs.readFileSync('/tmp/mb15-normalized-schema.json','utf8'));
  if(evidence.differences.length!==1 || evidence.differences[0].kind!=='migrationHistory' || evidence.differences[0].object!==name) throw new Error('catalog_equivalence_not_proven');
  const pool=new pg.Pool({connectionString:process.env.MIGRATION_DATABASE_URL});
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const rows=await client.query(`SELECT id,migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations WHERE migration_name=$1 FOR UPDATE`,[name]);
    if(rows.rowCount!==1 || rows.rows[0].checksum!==oldChecksum || !rows.rows[0].finished_at || rows.rows[0].rolled_back_at) throw new Error('unexpected_migration_history');
    fs.writeFileSync('docs/operations/MB15A-HISTORY-RECONCILIATION.json',JSON.stringify({reason:'Full read-only catalog equivalence to fresh SQL replay; reconcile stale migration checksum only',before:rows.rows[0],afterChecksum:checksum,checkedCatalogs:Object.keys(evidence.snapshots),timestamp:new Date().toISOString()},null,2));
    const updated=await client.query(`UPDATE _prisma_migrations SET checksum=$1 WHERE id=$2 AND checksum=$3`,[checksum,rows.rows[0].id,oldChecksum]);
    if(updated.rowCount!==1) throw new Error('migration_history_update_not_unique');
    await client.query('COMMIT');
    console.log('WORKING_STATE_HISTORY_RECONCILED_NO_SCHEMA_OR_DATA_CHANGE');
  } catch(e) {await client.query('ROLLBACK');throw e;} finally {client.release();await pool.end();}
}
void main().catch(e=>{console.error(e instanceof Error?e.message:'history_reconciliation_failed');process.exitCode=1;});
