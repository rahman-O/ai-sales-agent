import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {getRecentConversationMessages} from '../../../../packages/agent-adapters/src/recent-conversation-messages.js';
test('MB15B long context keeps newest target and chronological history under runtime RLS',async()=>{
 const pool=new pg.Pool({connectionString:process.env.MIGRATION_DATABASE_URL});const c=await pool.connect();const org=randomUUID(),other=randomUUID(),channel=randomUUID(),customer=randomUUID(),conversation=randomUUID(),identity=randomUUID();
 try{await c.query('BEGIN');await c.query("INSERT INTO organizations(id,name) VALUES($1,'MB15B context synthetic')",[org]);await c.query("INSERT INTO channel_connections(id,organization_id,provider,external_channel_id,status) VALUES($1,$2,'whatsapp',$3,'ACTIVE')",[channel,org,`mb15b-${channel}`]);await c.query("INSERT INTO customers(id,organization_id,display_name) VALUES($1,$2,'MB15B synthetic')",[customer,org]);await c.query("INSERT INTO customer_identities(id,organization_id,customer_id,channel_connection_id,channel,external_address) VALUES($1,$2,$3,$4,'whatsapp',$5)",[identity,org,customer,channel,`synthetic-${identity}`]);await c.query("INSERT INTO conversations(id,organization_id,customer_id,channel_connection_id,identity_id,mode,next_sequence,next_timeline_sequence) VALUES($1,$2,$3,$4,$5,'AI_ACTIVE',61,61)",[conversation,org,customer,channel,identity]);
 for(let i=1;i<=60;i++)await c.query("INSERT INTO messages(id,organization_id,conversation_id,channel_connection_id,direction,origin,ingress_sequence,timeline_sequence,content_text,content_digest,delivery_state) VALUES($1,$2,$3,$4,'INBOUND','CUSTOMER',$5,$5,$6,$7,'ACCEPTED')",[randomUUID(),org,conversation,channel,i,`synthetic turn ${i}`,`digest-${i}`]);
 await c.query('SET LOCAL ROLE app_runtime');assert.equal((await c.query('SELECT current_user')).rows[0].current_user,'app_runtime');await c.query("SELECT set_config('app.current_organization_id',$1,true)",[org]);await c.query("SELECT set_config('app.current_user_id',$1,true)",[randomUUID()]);
 const rows=(await getRecentConversationMessages(c,org,conversation,60)).rows;assert.equal(rows.length,50);assert.equal(rows[0].ingress_sequence,11);assert.equal(rows.at(-1)?.ingress_sequence,60);assert.ok(rows.every((r,i)=>r.ingress_sequence===i+11));
 const historical=(await getRecentConversationMessages(c,org,conversation,55)).rows;assert.equal(historical.at(-1)?.ingress_sequence,55);assert.equal((await getRecentConversationMessages(c,other,conversation,60)).rowCount,0);
 }finally{await c.query('ROLLBACK');c.release();await pool.end();}
});
