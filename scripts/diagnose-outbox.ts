import { loadLocalEnv } from './load-local-env.ts';
import { createPgPool } from './pg-pool.ts';
async function main(){loadLocalEnv();const pool=createPgPool(process.env.MIGRATION_DATABASE_URL!,{max:1});try {
  const {rows}=await pool.query(`SELECT id,organization_id,event_type,publication_status,available_at,claimed_until,created_at FROM outbox_events WHERE publication_status='PENDING' AND available_at<=now() ORDER BY available_at,id LIMIT 20`);
  console.log(JSON.stringify({classificationInput:rows.map(r=>({...r,predatesRun:new Date(r.created_at).getTime()<Date.now()-60_000}))},null,2));
} finally {await pool.end();}}
main().catch(e=>{console.error((e as Error).message);process.exit(1)});
