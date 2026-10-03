import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { loadDemoCliEnv } from '../demo/load-demo-cli-env.ts';
import { requireLocalDemoDb } from '../demo/assert-local-demo-db.ts';
import { DEMO_ORG_ID,DEMO_META_SIMULATOR_PHONE_NUMBER_ID } from '../demo/constants.ts';
loadDemoCliEnv();requireLocalDemoDb();
const p=new pg.Pool({connectionString:process.env.MIGRATION_DATABASE_URL});
async function main(){
 const messageId=`wamid.SIM_HANDOFF_RECOVERY_${randomUUID()}`,from=`1555${Date.now().toString().slice(-9)}`;
 const response=await fetch('http://127.0.0.1:3415/simulator/inbound',{method:'POST',body:JSON.stringify({webhookUrl:'http://api:3001/v1/webhooks/whatsapp/meta',phoneNumberId:DEMO_META_SIMULATOR_PHONE_NUMBER_ID,from,messageId,text:'أريد التحدث مع موظف بشري لو سمحت'})});
 if(!response.ok)throw new Error('simulator_inbound_failed');
 for(let n=0;n<100;n++){
  const r=(await p.query(`SELECT ar.id,ar.status,cv.mode,ack.provider_message_id,
  (SELECT count(*)::int FROM usage_events u WHERE u.agent_run_id=ar.id AND u.provider='deepseek' AND u.model='deepseek-chat') audited_model_calls,
  EXISTS(SELECT 1 FROM tool_calls t WHERE t.agent_run_id=ar.id AND t.tool_name='handoffToHuman' AND t.result_code='OK' AND t.authz_result='ALLOWED') handoff_tool_ok
  FROM messages inbound JOIN conversations cv ON cv.organization_id=inbound.organization_id AND cv.id=inbound.conversation_id
  JOIN agent_runs ar ON ar.organization_id=inbound.organization_id AND ar.conversation_id=inbound.conversation_id AND ar.target_ingress_sequence=inbound.ingress_sequence
  LEFT JOIN outbox_events e ON e.organization_id=ar.organization_id AND e.event_type='OutboundMessageReady' AND e.payload_json->'payload'->>'agentRunId'=ar.id::text
  LEFT JOIN messages ack ON ack.organization_id=e.organization_id AND ack.id::text=e.payload_json->'payload'->>'messageId'
  WHERE inbound.organization_id=$1 AND inbound.provider_message_id=$2`,[DEMO_ORG_ID,messageId])).rows[0];
  if(r?.provider_message_id){const sends=await fetch('http://127.0.0.1:3415/simulator/messages').then(r=>r.json()) as {messages:{providerMessageId:string}[]};const received=sends.messages.some(m=>m.providerMessageId===r.provider_message_id);const pass=r.status==='HANDOFF_REQUESTED'&&r.mode==='AI_PAUSED'&&r.audited_model_calls>0&&r.handoff_tool_ok&&received;console.log(JSON.stringify({target_inbound_id:messageId,...r,simulator_received:received,HUMAN_HANDOFF_FLOW:pass?'PASS':'FAIL'}));if(!pass)process.exitCode=1;return;}
  if(r && !['RUNNING','HANDOFF_REQUESTED'].includes(r.status)){console.log(JSON.stringify({target_inbound_id:messageId,...r,HUMAN_HANDOFF_FLOW:'FAIL'}));process.exitCode=1;return;}
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 throw new Error('handoff_timeout');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>p.end());
