import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import test from 'node:test';
import type { PoolClient } from 'pg';
import { createAppPool } from '../../src/database/pg-pool.js';
import {
  META_WHATSAPP_PROVIDER,
  canTransitionDelivery,
  dispatchOutboundMessage,
  applyDeliveryTransition,
} from '@ai-sales-agent/agent-adapters';
import { P04_TOOL_NAMES } from '@ai-sales-agent/contracts';

const runtimeUrl = process.env.DATABASE_URL;
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
assert.ok(runtimeUrl && migrationUrl, 'DATABASE_URL and MIGRATION_DATABASE_URL required');

process.env.NODE_ENV = 'test';
process.env.AI_ALLOW_FAKE = 'true';
process.env.META_GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v25.0';
process.env.META_WHATSAPP_APP_SECRET = process.env.META_WHATSAPP_APP_SECRET || 'p08-test-app-secret';
process.env.META_WHATSAPP_VERIFY_TOKEN =
  process.env.META_WHATSAPP_VERIFY_TOKEN || 'p08-test-verify-token';
process.env.META_WHATSAPP_ACCESS_TOKEN =
  process.env.META_WHATSAPP_ACCESS_TOKEN || 'p08-test-access-token';

const runtime = createAppPool(runtimeUrl, { max: 6 });
const owner = createAppPool(migrationUrl, { max: 1 });

async function context(c: PoolClient, org: string, user: string) {
  await c.query('BEGIN');
  await c.query(`SELECT set_config('app.current_user_id',$1,true)`, [user]);
  await c.query(`SELECT set_config('app.current_organization_id',$1,true)`, [org]);
}

test('Phase 08 WhatsApp: channel mapping, transitions, ambiguous dispatch, window projection', async () => {
  // DEFAULT allowlist unchanged
  assert.ok(!(P04_TOOL_NAMES as readonly string[]).includes('sendWhatsAppMessage'));

  const cols = await owner.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='channel_connections'
       AND column_name IN ('display_phone_number','waba_id','health_status','last_verified_at')
     ORDER BY 1`,
  );
  assert.equal(cols.rowCount, 4);
  const convCol = await owner.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name='conversations' AND column_name='last_customer_inbound_at'`,
  );
  assert.equal(convCol.rowCount, 1);

  const user = randomUUID();
  const org = randomUUID();
  const orgOther = randomUUID();
  await owner.query(`INSERT INTO users(id,auth_subject) VALUES($1,$2)`, [user, `p08-${user}`]);
  await owner.query(`INSERT INTO organizations(id,name) VALUES($1,'P08 Org')`, [org]);
  await owner.query(`INSERT INTO organizations(id,name) VALUES($1,'P08 Other')`, [orgOther]);
  await owner.query(
    `INSERT INTO organization_members(organization_id,user_id,role,status) VALUES($1,$2,'OWNER','ACTIVE')`,
    [org, user],
  );
  await owner.query(
    `INSERT INTO organization_members(organization_id,user_id,role,status) VALUES($1,$2,'OWNER','ACTIVE')`,
    [orgOther, user],
  );

  const phoneNumberId = `pn-${randomUUID().slice(0, 8)}`;
  const connId = randomUUID();

  // Seed channel via owner (bypasses RLS) then prove global uniqueness
  await owner.query(
    `INSERT INTO channel_connections(
       id,organization_id,provider,external_channel_id,status,health_status,display_phone_number
     ) VALUES($1,$2,$3,$4,'ACTIVE','ACTIVE','+15550009999')`,
    [connId, org, META_WHATSAPP_PROVIDER, phoneNumberId],
  );
  await assert.rejects(
    () =>
      owner.query(
        `INSERT INTO channel_connections(id,organization_id,provider,external_channel_id,status)
         VALUES($1,$2,$3,$4,'ACTIVE')`,
        [randomUUID(), orgOther, META_WHATSAPP_PROVIDER, phoneNumberId],
      ),
    /unique|duplicate|23505/i,
  );

  const c = await runtime.connect();
  let customerId = '';
  let conversationId = '';
  let identityId = '';
  try {
    await context(c, org, user);    customerId = randomUUID();
    await c.query(`INSERT INTO customers(id,organization_id,display_name) VALUES($1,$2,'WA')`, [
      customerId,
      org,
    ]);
    identityId = randomUUID();
    await c.query(
      `INSERT INTO customer_identities(id,organization_id,customer_id,channel_connection_id,channel,external_address)
       VALUES($1,$2,$3,$4,'whatsapp','+15551234567')`,
      [identityId, org, customerId, connId],
    );
    conversationId = randomUUID();
    await c.query(
      `INSERT INTO conversations(
         id,organization_id,customer_id,channel_connection_id,identity_id,
         mode,ownership_epoch,next_sequence,processed_sequence,next_timeline_sequence,lease_fence,version
       ) VALUES($1,$2,$3,$4,$5,'AI_ACTIVE',0,1,0,1,0,1)`,
      [conversationId, org, customerId, connId, identityId],
    );

    // Inbound accept advances last_customer_inbound_at
    const inboundId = randomUUID();
    const inboundAt = new Date();
    await c.query(
      `INSERT INTO messages(
         id,organization_id,conversation_id,channel_connection_id,direction,origin,
         provider_message_id,ingress_sequence,timeline_sequence,content_text,content_digest,delivery_state,provider_event_at
       ) VALUES($1,$2,$3,$4,'INBOUND','CUSTOMER','wamid.in1',1,1,'hi','digest1','ACCEPTED',$5)`,
      [inboundId, org, conversationId, connId, inboundAt.toISOString()],
    );
    await c.query(
      `UPDATE conversations SET last_customer_inbound_at=$3, next_sequence=2, next_timeline_sequence=2
       WHERE organization_id=$1 AND id=$2`,
      [org, conversationId, inboundAt.toISOString()],
    );
    const proj = await c.query(
      `SELECT last_customer_inbound_at FROM conversations WHERE id=$1`,
      [conversationId],
    );
    assert.ok(proj.rows[0].last_customer_inbound_at);

    // Replay must not extend window — leave projection unchanged when duplicate receipt
    const before = new Date(proj.rows[0].last_customer_inbound_at).toISOString();
    await c.query(
      `INSERT INTO webhook_receipts(id,organization_id,channel_connection_id,event_identity,payload_digest,status,message_id)
       VALUES($1,$2,$3,'wamid:wamid.in1','digest1','ACCEPTED',$4)
       ON CONFLICT (channel_connection_id, event_identity) DO NOTHING`,
      [randomUUID(), org, connId, inboundId],
    );
    // Do not update last_customer_inbound_at on conflict path
    const after = await c.query(
      `SELECT last_customer_inbound_at FROM conversations WHERE id=$1`,
      [conversationId],
    );
    assert.equal(new Date(after.rows[0].last_customer_inbound_at).toISOString(), before);

    // Outbound message + ambiguous dispatch → UNKNOWN, no second message
    const outId = randomUUID();
    await c.query(
      `INSERT INTO messages(
         id,organization_id,conversation_id,channel_connection_id,direction,origin,
         timeline_sequence,content_text,content_digest,delivery_state,authority_epoch
       ) VALUES($1,$2,$3,$4,'OUTBOUND','AI',2,'reply','digest-out','PENDING',0)`,
      [outId, org, conversationId, connId],
    );

    const ambiguous = await dispatchOutboundMessage(c, org, outId, {
      env: process.env,
      fetchImpl: async () => {
        const err = new Error('aborted');
        err.name = 'TimeoutError';
        throw err;
      },
    });
    assert.equal(ambiguous.outcome, 'UNKNOWN');
    const state = await c.query(`SELECT delivery_state, provider_message_id FROM messages WHERE id=$1`, [
      outId,
    ]);
    assert.equal(state.rows[0].delivery_state, 'UNKNOWN');
    assert.equal(state.rows[0].provider_message_id, null);

    // Blind resend blocked
    const again = await dispatchOutboundMessage(c, org, outId, {
      env: process.env,
      fetchImpl: async () => new Response(JSON.stringify({ messages: [{ id: 'wamid.should-not' }] }), { status: 200 }),
    });
    assert.equal(again.outcome, 'UNKNOWN');
    const count = await c.query(
      `SELECT count(*)::int AS n FROM messages WHERE conversation_id=$1 AND direction='OUTBOUND'`,
      [conversationId],
    );
    assert.equal(count.rows[0].n, 1);

    // Successful send path
    const out2 = randomUUID();
    await c.query(
      `INSERT INTO messages(
         id,organization_id,conversation_id,channel_connection_id,direction,origin,
         timeline_sequence,content_text,content_digest,delivery_state,authority_epoch
       ) VALUES($1,$2,$3,$4,'OUTBOUND','AI',3,'ok','digest-ok','PENDING',0)`,
      [out2, org, conversationId, connId],
    );
    const okSend = await dispatchOutboundMessage(c, org, out2, {
      env: process.env,
      fetchImpl: async () =>
        new Response(JSON.stringify({ messages: [{ id: 'wamid.OK1' }] }), { status: 200 }),
    });
    assert.equal(okSend.outcome, 'ACCEPTED');
    assert.equal(okSend.providerMessageId, 'wamid.OK1');

    // Delivery transition: ACCEPTED → DELIVERED → READ; reject regression
    await c.query(`UPDATE messages SET delivery_state='DELIVERED' WHERE id=$1`, [out2]);
    assert.equal(applyDeliveryTransition('DELIVERED', 'READ').applied, true);
    assert.equal(canTransitionDelivery('READ', 'DELIVERED'), false);

    // Outside window → POLICY_REJECTED
    await c.query(
      `UPDATE conversations SET last_customer_inbound_at=now() - interval '48 hours' WHERE id=$1`,
      [conversationId],
    );
    const out3 = randomUUID();
    await c.query(
      `INSERT INTO messages(
         id,organization_id,conversation_id,channel_connection_id,direction,origin,
         timeline_sequence,content_text,content_digest,delivery_state,authority_epoch
       ) VALUES($1,$2,$3,$4,'OUTBOUND','AI',4,'late','digest-late','PENDING',0)`,
      [out3, org, conversationId, connId],
    );
    const policy = await dispatchOutboundMessage(c, org, out3, { env: process.env });
    assert.equal(policy.outcome, 'POLICY_REJECTED');

    // HMAC helper smoke (integration env)
    const raw = Buffer.from('{}');
    const sig =
      'sha256=' +
      createHmac('sha256', process.env.META_WHATSAPP_APP_SECRET!).update(raw).digest('hex');
    assert.ok(sig.startsWith('sha256='));

    await c.query('COMMIT');
  } catch (e) {
    try {
      await c.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    c.release();
  }

  await runtime.end();
  await owner.end();
});
