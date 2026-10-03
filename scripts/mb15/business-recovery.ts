import { spawn } from 'node:child_process';
import fs from 'node:fs';
import pg from 'pg';
import { loadDemoCliEnv } from '../demo/load-demo-cli-env.ts';
import { requireLocalDemoDb } from '../demo/assert-local-demo-db.ts';
import { DEMO_ORG_ID } from '../demo/constants.ts';
loadDemoCliEnv();requireLocalDemoDb();
async function main(){
 const p=new pg.Pool({connectionString:process.env.MIGRATION_DATABASE_URL});
 const open=(await p.query('SELECT DISTINCT day_of_week FROM staff_availability_rules WHERE organization_id=$1 AND is_active=true',[DEMO_ORG_ID])).rows.map(r=>r.day_of_week);
 const service=(await p.query('SELECT name FROM services WHERE organization_id=$1 AND active AND booking_enabled ORDER BY id LIMIT 1',[DEMO_ORG_ID])).rows[0].name;
 let date='',closed='';for(let n=1;n<=14;n++){const d=new Date(Date.now()+n*86400000);const wd=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Baghdad',weekday:'long'}).format(d))||7;const iso=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Baghdad'}).format(d);if(open.includes(wd)&&!date)date=iso;if(!open.includes(wd)&&!closed)closed=iso;}
 const resumePhone=process.argv.includes('--remaining')?(await p.query("SELECT ci.external_address FROM agent_runs ar JOIN conversations cv ON cv.organization_id=ar.organization_id AND cv.id=ar.conversation_id JOIN customer_identities ci ON ci.organization_id=cv.organization_id AND ci.customer_id=cv.customer_id WHERE ar.terminal_reason='unparseable_provider_json' ORDER BY ar.started_at DESC LIMIT 1")).rows[0]?.external_address:null;
 await p.end();if(!date||!closed)throw new Error('fixture_days_missing');
 const base=`1555${Date.now().toString().slice(-8)}`;
 const probes=[
 ['POLICY','ما هي سياسة الإلغاء؟','getEffectivePolicy',base+'1'],
 ['KNOWLEDGE','أين موقع العيادة ومواعيد العمل؟','searchKnowledge',base+'2'],
 ['BOOKING_DISCOVERY',`أريد حجز خدمة ${service} بتاريخ ${date}، اعرض المواعيد المتاحة`,'getAvailableSlots',base+'3'],
 ['BOOKING_CONFIRMATION','تمام احجزلي أول موعد','createBooking',base+'3'],
 ['TOPIC_START',`أريد حجز خدمة ${service}`,'searchServices',base+'4'],
 ['TOPIC_OFFERS','لحظة، هل لديكم عروض حالياً؟','getActiveOffers',base+'4'],
 ['TOPIC_RESUME','تمام، لنكمل حجز الموعد','',base+'4'],
 ['ZERO_SLOT',`أريد حجز خدمة ${service} بتاريخ ${closed}، اعرض المواعيد المتاحة`,'getAvailableSlots',base+'5'],
 ];
 for(const [name,text,tool,fixturePhone] of probes){
 if(process.argv.includes('--topic') && !['TOPIC_START','TOPIC_OFFERS','TOPIC_RESUME','ZERO_SLOT'].includes(name))continue;
 if(process.argv.includes('--remaining') && !['TOPIC_RESUME','ZERO_SLOT'].includes(name))continue;
 const phone=name==='TOPIC_RESUME' && resumePhone?resumePhone:fixturePhone;
 const file=fs.openSync(`/tmp/mb15-recovery-${name.toLowerCase()}.log`,'w');
 const code=await new Promise<number|null>(resolve=>{const child=spawn('npm',['run','mb15:probe'],{env:{...process.env,MB15_PROBE_TEXT:text,MB15_PROBE_REQUIRED_TOOL:tool,MB15_PROBE_PHONE:phone},stdio:['ignore',file,file]});child.on('exit',resolve);});fs.closeSync(file);console.log(`${name}: ${code===0?'PASS':'FAIL'}`);if(code!==0)throw new Error(name+'_failed');
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
