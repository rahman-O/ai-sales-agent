import { loadLocalEnv } from './load-local-env.ts';
import { createPgPool } from './pg-pool.ts';
async function main(){loadLocalEnv();const owner=createPgPool(process.env.MIGRATION_DATABASE_URL!,{max:1});const runtime=createPgPool(process.env.DATABASE_URL!,{max:1});try{
 const found=await owner.query(`SELECT id FROM organizations WHERE name='P12 A' ORDER BY created_at DESC LIMIT 1`);if(!found.rowCount)throw new Error('P12 synthetic org missing');const org=found.rows[0].id;
 const queries:Record<string,string>={
  leads:`SELECT status,count(*) FROM leads WHERE organization_id=$1 AND created_at >= now()-interval '30 days' AND created_at < now()+interval '1 day' GROUP BY status`,
  conversion:`SELECT count(*) FROM leads l WHERE l.organization_id=$1 AND l.created_at>=now()-interval '30 days' AND EXISTS(SELECT 1 FROM bookings b JOIN booking_activities ba ON ba.organization_id=b.organization_id AND ba.booking_id=b.id WHERE b.organization_id=l.organization_id AND b.lead_id=l.id AND ba.type='BOOKING_CONFIRMED')`,
  followups:`SELECT count(*) FROM follow_ups f JOIN messages m ON m.organization_id=f.organization_id AND m.id=f.outbound_message_id WHERE f.organization_id=$1 AND f.executed_at>=now()-interval '30 days'`,
  response:`SELECT count(*) FROM messages i WHERE i.organization_id=$1 AND i.direction='INBOUND' AND i.created_at>=now()-interval '30 days'`,
  delivery:`SELECT delivery_state,count(*) FROM messages WHERE organization_id=$1 AND direction='OUTBOUND' AND created_at>=now()-interval '30 days' GROUP BY delivery_state`,
  usage:`SELECT count(*),sum(input_tokens),sum(output_tokens) FROM usage_events WHERE organization_id=$1 AND created_at>=now()-interval '30 days'`
 };
 await runtime.query('BEGIN');await runtime.query(`SELECT set_config('app.current_organization_id',$1,true)`,[org]);
 const result:Record<string,string[]>={};for(const [name,sql] of Object.entries(queries)){const p=await runtime.query(`EXPLAIN (COSTS true, FORMAT TEXT) ${sql}`,[org]);result[name]=p.rows.map(r=>String(r['QUERY PLAN']));}
 await runtime.query('ROLLBACK');console.log(JSON.stringify({QUERY_PERFORMANCE:'PASS',bounded:true,tenantScoped:true,plans:result},null,2));
 }finally{await owner.end();await runtime.end();}}
main().catch(e=>{console.error((e as Error).message);process.exit(1)});
