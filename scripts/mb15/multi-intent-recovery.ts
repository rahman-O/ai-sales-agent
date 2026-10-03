import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import pg from 'pg';
import { loadDemoCliEnv } from '../demo/load-demo-cli-env.ts';
import { requireLocalDemoDb } from '../demo/assert-local-demo-db.ts';
import { DEMO_ORG_ID, DEMO_META_SIMULATOR_PHONE_NUMBER_ID } from '../demo/constants.ts';
loadDemoCliEnv(); requireLocalDemoDb();
const pool = new pg.Pool({connectionString:process.env.MIGRATION_DATABASE_URL});
async function main() {
 const messageId=`wamid.SIM_MULTI_RECOVERY_${randomUUID()}`;
 const from=`1555${Date.now().toString().slice(-9)}`;
 const text='شكد سعر خدمة Dental Consultation (Demo Synthetic) وعندكم خصم عليها وأريد أحجز بتاريخ 2026-10-04؟';
 const before=(await pool.query('SELECT count(*)::int n FROM bookings WHERE organization_id=$1',[DEMO_ORG_ID])).rows[0].n;
 const response=await fetch('http://127.0.0.1:3415/simulator/inbound',{method:'POST',body:JSON.stringify({webhookUrl:'http://api:3001/v1/webhooks/whatsapp/meta',phoneNumberId:DEMO_META_SIMULATOR_PHONE_NUMBER_ID,from,messageId,text})});
 if(!response.ok) throw new Error('simulator_inbound_failed');
 let evidence:any; const transitions:any[]=[];
 for(let i=0;i<120;i++) {
  const row=(await pool.query(`SELECT m.conversation_id,ar.id agent_run_id,ar.status,ar.terminal_reason,ar.model_calls,ar.final_outbound_message_id,m.ingress_sequence FROM messages m LEFT JOIN agent_runs ar ON ar.organization_id=m.organization_id AND ar.conversation_id=m.conversation_id AND ar.target_ingress_sequence=m.ingress_sequence WHERE m.organization_id=$1 AND m.provider_message_id=$2 ORDER BY ar.started_at DESC LIMIT 1`,[DEMO_ORG_ID,messageId])).rows[0];
  if(row?.conversation_id){
   const state=(await pool.query(`SELECT version,customer_id,lead_id,state_json->>'activeWorkflow' active_workflow,state_json->>'activeIntent' active_intent,state_json->'selectedEntity'->>'entityId' service_id,jsonb_array_length(COALESCE(state_json->'candidateSlots','[]'::jsonb)) candidate_slot_count FROM conversation_working_state WHERE organization_id=$1 AND conversation_id=$2`,[DEMO_ORG_ID,row.conversation_id])).rows[0];
   if(state && JSON.stringify(state)!==JSON.stringify(transitions.at(-1))) transitions.push(state);
  }
  if(row?.status && row.status!=='RUNNING'){evidence=row;break;}
  await new Promise(r=>setTimeout(r,1000));
 }
 if(!evidence) throw new Error('run_timeout');
 const tools=(await pool.query('SELECT ordinal,tool_name,result_code,authz_result,args_hash FROM tool_calls WHERE agent_run_id=$1 ORDER BY ordinal',[evidence.agent_run_id])).rows;
 const usage=(await pool.query('SELECT provider,model FROM usage_events WHERE agent_run_id=$1 ORDER BY created_at',[evidence.agent_run_id])).rows;
 const outbound=(await pool.query('SELECT provider_message_id FROM messages WHERE id=$1',[evidence.final_outbound_message_id])).rows[0];
 let received=false;
 for(let i=0;i<15 && evidence.status==='SUCCEEDED';i++){
  const out=(await pool.query('SELECT provider_message_id FROM messages WHERE id=$1',[evidence.final_outbound_message_id])).rows[0];
  if(out?.provider_message_id){outbound.provider_message_id=out.provider_message_id;const sends=await fetch('http://127.0.0.1:3415/simulator/messages').then(r=>r.json()) as {messages:{providerMessageId:string}[]};received=sends.messages.some(m=>m.providerMessageId===out.provider_message_id);if(received)break;}
  await new Promise(r=>setTimeout(r,1000));
 }
 const names=tools.filter(t=>t.result_code==='OK' && t.authz_result==='ALLOWED').map(t=>t.tool_name);
 const duplicate=tools.some((t,i)=>tools.slice(0,i).some(p=>p.tool_name===t.tool_name && p.args_hash===t.args_hash));
 const after=(await pool.query('SELECT count(*)::int n FROM bookings WHERE organization_id=$1',[DEMO_ORG_ID])).rows[0].n;
 const pass=evidence.status==='SUCCEEDED' && usage.length>0 && usage.every(u=>u.provider==='deepseek'&&u.model==='deepseek-chat') && names.includes('getServicePrice') && names.includes('getActiveOffers') && names.includes('getAvailableSlots') && transitions.some(s=>s.candidate_slot_count>0) && !duplicate && before===after && received;
 const report={target_inbound_id:messageId,...evidence,audited_model_calls:usage.length,usage,tools,transitions,provider_message_id:outbound?.provider_message_id,simulator_received:received,duplicate_tools:duplicate,bookings_unchanged:before===after,MULTI_INTENT_FLOW:pass?'PASS':'FAIL'};
 const destination=process.env.MB15_RECOVERY_EVIDENCE??'/tmp/mb15-multi-intent-recovery.json';fs.writeFileSync(destination,JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!pass)process.exitCode=1;
}
main().catch(()=>{console.error('MULTI_INTENT_RECOVERY_ERROR');process.exitCode=1;}).finally(()=>pool.end());
