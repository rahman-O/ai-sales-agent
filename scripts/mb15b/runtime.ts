import { randomUUID, createHash } from 'node:crypto';
import { execFileSync,spawnSync } from 'node:child_process';
import fs from 'node:fs';
import {getRecentConversationMessages} from '../../packages/agent-adapters/src/recent-conversation-messages.ts';
import pg from 'pg';
import { loadDemoCliEnv } from '../demo/load-demo-cli-env.ts';
import { requireLocalDemoDb } from '../demo/assert-local-demo-db.ts';
import { DEMO_ORG_ID, DEMO_META_SIMULATOR_PHONE_NUMBER_ID } from '../demo/constants.ts';
export type Status='PASS'|'FAIL'|'BLOCKED_PRECONDITION'|'BLOCKED_EXTERNAL_PROVIDER'|'NOT_ENABLED'|'NOT_RUN';
export const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
export const assert=(value:unknown,reason:string)=>{if(!value)throw new Error(reason);};
export const percentile=(xs:number[],q:number)=>[...xs].sort((a,b)=>a-b)[Math.max(0,Math.ceil(xs.length*q)-1)]??0;
export class Harness {
 runId=process.env.MB15B_RUN_ID??randomUUID(); pool:pg.Pool; org=DEMO_ORG_ID;
 evidence:any[]=[]; scenarios:Record<string,any>={}; conversations=new Set<string>(); counter=0;
 output=''; service:any; date=''; closedDate='';
 constructor(){loadDemoCliEnv();requireLocalDemoDb();this.pool=new pg.Pool({connectionString:process.env.MIGRATION_DATABASE_URL,max:12,connectionTimeoutMillis:5000});this.output=`docs/operations/MB15B-${this.runId}.json`;}
 phone(){return `1555${parseInt(createHash('sha256').update(this.runId).digest('hex').slice(0,6),16).toString().padStart(7,'0')}${(++this.counter).toString().padStart(3,'0')}`;}
 save(){fs.writeFileSync(this.output,JSON.stringify({runId:this.runId,scenarios:this.scenarios,evidence:this.evidence},null,2));}
 async scenario(name:string,fn:()=>Promise<any>){try{const details=await fn();this.scenarios[name]={status:'PASS',details};}catch(e){this.scenarios[name]={status:'FAIL',reason:e instanceof Error?e.message:'test_error'};}this.save();console.log(JSON.stringify({scenario:name,...this.scenarios[name]}));}
 async preflight(){
 const worker=JSON.parse(execFileSync('docker',['exec','ai-sales-demo-worker','node','-e',`console.log(JSON.stringify({provider:process.env.AI_PROVIDER,keyConfigured:Boolean(process.env.DEEPSEEK_API_KEY?.trim()),simulatorOnly:process.env.META_GRAPH_BASE_URL==='http://provider-simulator:3415',syntheticToken:process.env.META_WHATSAPP_ACCESS_TOKEN==='mb15a-simulator-access-token',scripted:process.env.AI_PROVIDER!=='deepseek'&&process.env.ZERO_COST_DEMO==='1'&&process.env.AI_ALLOW_FAKE==='true'}))`],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
 assert(worker.provider==='deepseek'&&worker.keyConfigured&&worker.simulatorOnly&&worker.syntheticToken&&!worker.scripted,'worker_provider_or_simulator_preflight');
 assert((await fetch('http://127.0.0.1:3001/health/live')).ok,'api_unhealthy');
 await this.pool.query('SELECT 1');
 this.service=(await this.pool.query('SELECT id,name,amount_minor,currency FROM services WHERE organization_id=$1 AND booking_enabled AND active ORDER BY id LIMIT 1',[this.org])).rows[0];assert(this.service,'missing_bookable_service');
 const days=(await this.pool.query('SELECT DISTINCT day_of_week FROM staff_availability_rules WHERE organization_id=$1 AND is_active',[this.org])).rows.map(r=>r.day_of_week);
 for(let n=2;n<16;n++){const d=new Date(Date.now()+n*86400000);const wd=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Baghdad',weekday:'long'}).format(d))||7;const iso=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Baghdad'}).format(d);if(days.includes(wd)&&!this.date){const occupied=(await this.pool.query("SELECT count(*)::int n FROM bookings WHERE organization_id=$1 AND status='CONFIRMED' AND (starts_at AT TIME ZONE 'Asia/Baghdad')::date=$2::date",[this.org,iso])).rows[0].n;if(occupied===0)this.date=iso;}if(!days.includes(wd)&&!this.closedDate)this.closedDate=iso;}
 assert(this.date&&this.closedDate,'fixture_days_missing');this.scenarios.PREFLIGHT={status:'PASS',details:worker};this.save();
 }
 async inbound(phone:string,text:string,id=`wamid.MB15B_${this.runId}_${randomUUID()}`){
 const began=Date.now();const r=await fetch('http://127.0.0.1:3415/simulator/inbound',{method:'POST',body:JSON.stringify({webhookUrl:'http://api:3001/v1/webhooks/whatsapp/meta',phoneNumberId:DEMO_META_SIMULATOR_PHONE_NUMBER_ID,from:phone,messageId:id,text})});
 assert(r.ok,`inbound_http_${r.status}`);
 const m=(await this.pool.query('SELECT id,conversation_id,ingress_sequence FROM messages WHERE organization_id=$1 AND provider_message_id=$2',[this.org,id])).rows[0];assert(m,'inbound_not_persisted');this.conversations.add(m.conversation_id);return {...m,providerInboundId:id,phone,began};
 }
 async rawState(conversationId:string){return (await this.pool.query('SELECT version,customer_id,lead_id,state_json FROM conversation_working_state WHERE organization_id=$1 AND conversation_id=$2',[this.org,conversationId])).rows[0];}
 stateEvidence(s:any){return s?{version:s.version,customerId:s.customer_id,leadId:s.lead_id,workflow:s.state_json.activeWorkflow?.id,stage:s.state_json.activeWorkflow?.stage,selectedService:s.state_json.selectedEntity?.entityId,slotCount:s.state_json.candidateSlots?.length??0,slotFingerprints:(s.state_json.candidateSlots??[]).map((x:any)=>createHash('sha256').update(JSON.stringify(x)).digest('hex'))}:null;}
 async mutations(conversationId:string){return (await this.pool.query(`SELECT (SELECT count(*)::int FROM bookings b WHERE b.organization_id=c.organization_id AND b.customer_id=c.customer_id) bookings,(SELECT count(*)::int FROM quotes q WHERE q.organization_id=c.organization_id AND q.customer_id=c.customer_id) quotes,(SELECT count(*)::int FROM orders o WHERE o.organization_id=c.organization_id AND o.customer_id=c.customer_id) orders FROM conversations c WHERE c.organization_id=$1 AND c.id=$2`,[this.org,conversationId])).rows[0];}
 async settle(m:any,timeout=360000){
 const before=await this.mutations(m.conversation_id);let ar:any;const transitions:any[]=[];const started=Date.now();
 while(Date.now()-started<timeout){
  const s=this.stateEvidence(await this.rawState(m.conversation_id));if(JSON.stringify(s)!==JSON.stringify(transitions.at(-1)))transitions.push(s);
  ar=(await this.pool.query('SELECT id,status,terminal_reason,started_at,finished_at,model_calls FROM agent_runs WHERE organization_id=$1 AND conversation_id=$2 AND target_ingress_sequence=$3 ORDER BY started_at DESC LIMIT 1',[this.org,m.conversation_id,m.ingress_sequence])).rows[0];
  if(ar&&ar.status!=='RUNNING')break;await delay(300);
 }
 const tools=ar?(await this.pool.query('SELECT ordinal,tool_name,args_hash,result_code,authz_result FROM tool_calls WHERE organization_id=$1 AND agent_run_id=$2 ORDER BY ordinal',[this.org,ar.id])).rows:[];
 const usage=ar?(await this.pool.query('SELECT provider,model,input_tokens,output_tokens FROM usage_events WHERE agent_run_id=$1 ORDER BY created_at',[ar.id])).rows:[];
 let out:any;
 if(ar&&['SUCCEEDED','HANDOFF_REQUESTED'].includes(ar.status))for(let i=0;i<Math.ceil(timeout/500);i++){
  out=(await this.pool.query(`SELECT m.id,m.provider_message_id,m.content_text,m.delivery_state FROM messages m WHERE m.organization_id=$1 AND (m.id=(SELECT final_outbound_message_id FROM agent_runs WHERE id=$2::uuid) OR EXISTS(SELECT 1 FROM outbox_events e WHERE e.organization_id=m.organization_id AND e.event_type='OutboundMessageReady' AND e.payload_json->'payload'->>'agentRunId'=$2::text AND e.payload_json->'payload'->>'messageId'=m.id::text)) LIMIT 1`,[this.org,ar.id])).rows[0];
  if(out?.provider_message_id)break;await delay(500);
 }
 let received=false;if(out?.provider_message_id){const sends=await fetch('http://127.0.0.1:3415/simulator/messages').then(r=>r.json()) as {messages:{providerMessageId:string}[]};received=sends.messages.some(s=>s.providerMessageId===out.provider_message_id);}
 const current=(await getRecentConversationMessages(this.pool,this.org,m.conversation_id,m.ingress_sequence)).rows;
 const responseMs=Date.now()-m.began;let structuredRepairCount=0;if(ar){const logs=spawnSync('docker',['logs','ai-sales-demo-worker'],{encoding:'utf8',maxBuffer:20*1024*1024});for(const line of `${logs.stdout??''}\n${logs.stderr??''}`.split('\n')){try{const event=JSON.parse(line);if(event.event==='provider_structured_repair'&&event.agentRunId===ar.id)structuredRepairCount++;}catch{}}}
 const rec={runId:this.runId,inboundId:m.providerInboundId,conversationId:m.conversation_id,ingressSequence:m.ingress_sequence,agentRunId:ar?.id,status:ar?.status??'NO_RUN',terminalReason:ar?.terminal_reason,modelCalls:Math.max(usage.length,ar?.model_calls??0),structuredRepairCount,tools,usage,transitions,mutationsBefore:before,mutationsAfter:await this.mutations(m.conversation_id),providerMessageId:out?.provider_message_id,simulatorReceived:received,responseMs,queueLatencyMs:ar?new Date(ar.started_at).getTime()-m.began:null,workerLatencyMs:ar?.finished_at?new Date(ar.finished_at).getTime()-new Date(ar.started_at).getTime():null,targetInContext:current.some(x=>x.id===m.id),contextSourceChars:current.reduce((n,r)=>n+r.content_text.length,0),canonicalResponse:ar?.status==='SUCCEEDED',duplicates:tools.some((t,i)=>tools.slice(0,i).some(p=>p.tool_name===t.tool_name&&p.args_hash===t.args_hash))};
 this.evidence.push(rec);this.save();return {...rec,text:out?.content_text??'',rawState:await this.rawState(m.conversation_id),message:m};
 }
 async turn(phone:string,text:string){return this.settle(await this.inbound(phone,text));}
 success(t:any,needed:string[]=[]){assert(t.status==='SUCCEEDED'&&t.simulatorReceived,`turn_${t.status}_${t.terminalReason??'no_outbound'}`);assert(t.modelCalls>0&&t.usage.every((u:any)=>u.provider==='deepseek'&&u.model==='deepseek-chat'),'missing_real_deepseek_audit');assert(t.modelCalls<=6,'model_budget_exceeded');for(const tool of needed)assert(t.tools.some((c:any)=>c.tool_name===tool&&c.result_code==='OK'&&c.authz_result==='ALLOWED'),`missing_tool_${tool}`);}
 async status(providerMessageId:string,status:string,phone:string){const r=await fetch('http://127.0.0.1:3415/simulator/status',{method:'POST',body:JSON.stringify({webhookUrl:'http://api:3001/v1/webhooks/whatsapp/meta',phoneNumberId:DEMO_META_SIMULATOR_PHONE_NUMBER_ID,providerMessageId,status,recipientId:phone})});assert(r.ok,'callback_failed');}
 metrics(){const lines=execFileSync('docker',['stats','--no-stream','--format','{{json .}}','ai-sales-demo-worker','ai-sales-demo-postgres','ai-sales-demo-redis'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim().split('\n').filter(Boolean);return lines.map(line=>JSON.parse(line));}
 async operationalMetrics(){
  const redis=(...args:string[])=>execFileSync('docker',['exec','ai-sales-demo-redis','redis-cli',...args],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
  const db=(await this.pool.query("SELECT state,count(*)::int connections FROM pg_stat_activity WHERE datname=current_database() GROUP BY state")).rows;
  const workerIp=execFileSync('docker',['inspect','--format','{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}','ai-sales-demo-worker'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
  const workerDbConnectionsByState=(await this.pool.query("SELECT state,count(*)::int connections FROM pg_stat_activity WHERE datname=current_database() AND client_addr=$1::inet GROUP BY state",[workerIp])).rows;
  const started=Date.now();const simulator=await fetch('http://127.0.0.1:3415/health');await simulator.arrayBuffer();const simulatorHealthLatencyMs=Date.now()-started;
  return {redisHealth:redis('ping'),queueWaiting:Number(redis('LLEN','bull:conversation-wake:wait')),queueActive:Number(redis('LLEN','bull:conversation-wake:active')),queueDelayed:Number(redis('ZCARD','bull:conversation-wake:delayed')),dbConnectionsByState:db,workerDbConnectionsByState,workerPoolMaximum:4,harnessPool:{total:this.pool.totalCount,idle:this.pool.idleCount,waiting:this.pool.waitingCount},simulatorHealthStatus:simulator.status,simulatorHealthLatencyMs};
 }
 async close(){this.save();await this.pool.end();}
}
