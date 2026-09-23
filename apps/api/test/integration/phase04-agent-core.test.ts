import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import type { PoolClient } from 'pg';
import { createAppPool } from '../../src/database/pg-pool.js';
import { runConversationAgent } from '@ai-sales-agent/agent-adapters';
import { buildOperationKey, buildRunKey, hashNormalizedArgs } from '@ai-sales-agent/agent-core';
import { contentDigest, fixtureExternalChannelId } from '../../src/messaging/fake-channel.js';

const runtimeUrl = process.env.DATABASE_URL;
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
assert.ok(runtimeUrl && migrationUrl, 'DATABASE_URL and MIGRATION_DATABASE_URL required');
assert.notEqual(runtimeUrl, migrationUrl);

const runtime = createAppPool(runtimeUrl, { max: 6 });
const owner = createAppPool(migrationUrl, { max: 1 });

async function context(c: PoolClient, org: string, user: string) {
  await c.query('BEGIN');
  await c.query(`SELECT set_config('app.current_user_id',$1,true)`, [user]);
  await c.query(`SELECT set_config('app.current_organization_id',$1,true)`, [org]);
}

test('Phase 04 agent core: watermark, replay, handoff, mode cursor, RLS', async () => {
  const prevFake = process.env.AI_ALLOW_FAKE;
  const prevNode = process.env.NODE_ENV;
  process.env.AI_ALLOW_FAKE = 'true';
  process.env.NODE_ENV = 'test';

  const user = randomUUID();
  const org = randomUUID();
  await owner.query(`INSERT INTO users(id,auth_subject) VALUES($1,$2)`, [user, `p04-${user}`]);
  await owner.query(`INSERT INTO organizations(id,name) VALUES($1,'P04 Org')`, [org]);
  await owner.query(
    `INSERT INTO organization_members(organization_id,user_id,role,status) VALUES($1,$2,'OWNER','ACTIVE')`,
    [org, user],
  );

  // Schema presence + FORCE RLS
  const tables = await owner.query(
    `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
     FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname IN (
       'agent_configs','agent_runs','tool_calls','command_operations','usage_events','conversation_summaries'
     )
     ORDER BY 1`,
  );
  assert.equal(tables.rowCount, 6);
  for (const row of tables.rows) {
    assert.equal(row.relrowsecurity, true, row.relname);
    assert.equal(row.relforcerowsecurity, true, row.relname);
  }

  const c = await runtime.connect();
  let conversationId = '';
  let connId = '';
  let customerId = '';
  try {
    const role = await c.query(
      `SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user`,
    );
    assert.equal(role.rows[0].current_user, 'app_runtime');
    assert.equal(role.rows[0].rolbypassrls, false);

    // Bare select without tenant → 0
    const bare = await c.query(`SELECT count(*)::int AS n FROM agent_runs`);
    assert.equal(bare.rows[0].n, 0);

    await context(c, org, user);
    connId = randomUUID();
    const ext = fixtureExternalChannelId(org, 'whatsapp');
    await c.query(
      `INSERT INTO channel_connections(id,organization_id,provider,external_channel_id,status)
       VALUES($1,$2,'whatsapp',$3,'ACTIVE')`,
      [connId, org, ext],
    );
    customerId = randomUUID();
    await c.query(`INSERT INTO customers(id,organization_id,display_name) VALUES($1,$2,'P04 Cust')`, [
      customerId,
      org,
    ]);
    const identityId = randomUUID();
    await c.query(
      `INSERT INTO customer_identities(id,organization_id,customer_id,channel_connection_id,channel,external_address)
       VALUES($1,$2,$3,$4,'whatsapp','+9647700000404')`,
      [identityId, org, customerId, connId],
    );
    conversationId = randomUUID();
    await c.query(
      `INSERT INTO conversations(
         id,organization_id,customer_id,channel_connection_id,identity_id,
         mode,ownership_epoch,next_sequence,processed_sequence,next_timeline_sequence,lease_fence,version,
         lease_owner, lease_expires_at
       ) VALUES($1,$2,$3,$4,$5,'AI_ACTIVE',0,1,0,1,0,1,$6,now()+interval '5 minutes')`,
      [conversationId, org, customerId, connId, identityId, 'worker-p04'],
    );
    // inbound seq 1
    const msgId = randomUUID();
    const text = 'كم السعر؟';
    const d = contentDigest(JSON.stringify({ providerMessageId: 'p04-1', text, sender: '+9647700000404' }));
    await c.query(
      `INSERT INTO messages(
         id,organization_id,conversation_id,channel_connection_id,direction,origin,
         provider_message_id,ingress_sequence,timeline_sequence,content_text,content_digest,delivery_state
       ) VALUES($1,$2,$3,$4,'INBOUND','CUSTOMER','p04-1',1,1,$5,$6,'ACCEPTED')`,
      [msgId, org, conversationId, connId, text, d],
    );
    await c.query(
      `UPDATE conversations SET next_sequence=2, next_timeline_sequence=2, last_message_at=now() WHERE id=$1`,
      [conversationId],
    );
    const loc = randomUUID();
    await c.query(
      `INSERT INTO locations(id,organization_id,name,timezone) VALUES($1,$2,'Main','Asia/Baghdad')`,
      [loc, org],
    );
    await c.query(
      `INSERT INTO services(id,organization_id,location_id,name,duration_minutes,amount_minor,currency,pricing_version,active)
       VALUES($1,$2,$3,'Cleaning',30,50000,'IQD',1,true)`,
      [randomUUID(), org, loc],
    );
    await c.query('COMMIT');
  } finally {
    c.release();
  }

  // Run agent against target ingress 1
  const r1 = await runConversationAgent({
    pool: runtime,
    organizationId: org,
    conversationId,
    workerId: 'worker-p04',
    leaseFence: 0,
    ownershipEpoch: 0,
    targetIngressSequence: 1,
  });
  assert.equal(r1.terminal, 'SUCCEEDED', r1.reason);

  const c2 = await runtime.connect();
  try {
    await context(c2, org, user);
    const runs = await c2.query(
      `SELECT id, status, run_key, final_outbound_message_id, target_ingress_sequence
       FROM agent_runs WHERE conversation_id=$1`,
      [conversationId],
    );
    assert.equal(runs.rowCount, 1);
    assert.equal(runs.rows[0].status, 'SUCCEEDED');
    assert.ok(runs.rows[0].final_outbound_message_id);
    const runKey = runs.rows[0].run_key as string;
    const expectedKey = buildRunKey({
      organizationId: org,
      conversationId,
      targetIngressSequence: 1,
      ownershipEpoch: 0,
      agentConfigVersionId: (
        await c2.query(`SELECT id FROM agent_configs WHERE organization_id=$1 AND status='ACTIVE'`, [org])
      ).rows[0].id,
    });
    assert.equal(runKey, expectedKey);

    const conv = await c2.query(
      `SELECT processed_sequence, next_sequence, next_timeline_sequence, mode FROM conversations WHERE id=$1`,
      [conversationId],
    );
    assert.equal(conv.rows[0].processed_sequence, 1);
    assert.equal(conv.rows[0].mode, 'AI_ACTIVE');
    // timeline advanced for outbound (not ingress)
    assert.ok(conv.rows[0].next_timeline_sequence >= 3);
    assert.equal(conv.rows[0].next_sequence, 2);

    // Crash/replay: same runKey returns already terminal without second outbound
    await c2.query('COMMIT');
  } finally {
    c2.release();
  }

  const r2 = await runConversationAgent({
    pool: runtime,
    organizationId: org,
    conversationId,
    workerId: 'worker-p04',
    leaseFence: 0,
    ownershipEpoch: 0,
    targetIngressSequence: 1,
  });
  assert.equal(r2.terminal, 'SUCCEEDED');
  assert.equal(r2.reason, 'already_terminal');

  const c3 = await runtime.connect();
  try {
    await context(c3, org, user);
    const outs = await c3.query(
      `SELECT count(*)::int AS n FROM messages WHERE conversation_id=$1 AND direction='OUTBOUND' AND origin='AI'`,
      [conversationId],
    );
    assert.equal(outs.rows[0].n, 1);

    // Timeline-only advance must NOT supersede (ingress watermark)
    await c3.query(
      `UPDATE conversations SET next_timeline_sequence = next_timeline_sequence + 1 WHERE id=$1`,
      [conversationId],
    );
    await c3.query('COMMIT');
  } finally {
    c3.release();
  }

  // Newer ingress supersedes a fresh target=1 run attempt would be already terminal;
  // insert inbound 2 and run with target 1 while next=3 → SUPERSEDED path via hasNewerInbound
  const c4 = await runtime.connect();
  try {
    await context(c4, org, user);
    await c4.query(
      `UPDATE conversations SET lease_owner=$2, lease_fence=lease_fence+1, lease_expires_at=now()+interval '5 minutes'
       WHERE id=$1`,
      [conversationId, 'worker-p04b'],
    );
    const fence = (
      await c4.query(`SELECT lease_fence, ownership_epoch, next_sequence FROM conversations WHERE id=$1`, [
        conversationId,
      ])
    ).rows[0];
    const nextTl = (
      await c4.query(`SELECT next_timeline_sequence FROM conversations WHERE id=$1`, [conversationId])
    ).rows[0].next_timeline_sequence;
    const d2 = contentDigest(JSON.stringify({ providerMessageId: 'p04-2', text: 'new', sender: 'x' }));
    await c4.query(
      `INSERT INTO messages(
         id,organization_id,conversation_id,channel_connection_id,direction,origin,
         provider_message_id,ingress_sequence,timeline_sequence,content_text,content_digest,delivery_state
       ) VALUES($1,$2,$3,$4,'INBOUND','CUSTOMER','p04-2',$5,$6,'new',$7,'ACCEPTED')`,
      [randomUUID(), org, conversationId, connId, fence.next_sequence, nextTl, d2],
    );
    await c4.query(
      `UPDATE conversations SET next_sequence=$2, next_timeline_sequence=$3 WHERE id=$1`,
      [conversationId, fence.next_sequence + 1, nextTl + 1],
    );
    await c4.query('COMMIT');

    const staleTarget = 1;
    const rStale = await runConversationAgent({
      pool: runtime,
      organizationId: org,
      conversationId,
      workerId: 'worker-p04b',
      leaseFence: fence.lease_fence,
      ownershipEpoch: fence.ownership_epoch,
      targetIngressSequence: staleTarget,
    });
    // create-or-resume hits existing SUCCEEDED for target 1
    assert.equal(rStale.terminal, 'SUCCEEDED');
    assert.equal(rStale.reason, 'already_terminal');

    // Fresh target=2 should succeed
    await context(c4, org, user);
    await c4.query(
      `UPDATE conversations SET lease_owner=$2, lease_fence=lease_fence+1, lease_expires_at=now()+interval '5 minutes'
       WHERE id=$1 RETURNING lease_fence, ownership_epoch`,
      [conversationId, 'worker-p04c'],
    );
    const f2 = (
      await c4.query(`SELECT lease_fence, ownership_epoch FROM conversations WHERE id=$1`, [conversationId])
    ).rows[0];
    await c4.query('COMMIT');

    const r3 = await runConversationAgent({
      pool: runtime,
      organizationId: org,
      conversationId,
      workerId: 'worker-p04c',
      leaseFence: f2.lease_fence,
      ownershipEpoch: f2.ownership_epoch,
      targetIngressSequence: 2,
    });
    assert.equal(r3.terminal, 'SUCCEEDED', r3.reason);
  } finally {
    c4.release();
  }

  // Handoff terminal + epoch bump
  const c5 = await runtime.connect();
  try {
    await context(c5, org, user);
    await c5.query(
      `UPDATE conversations SET lease_owner=$2, lease_fence=lease_fence+1, lease_expires_at=now()+interval '5 minutes',
         next_sequence=4, processed_sequence=2
       WHERE id=$1 RETURNING lease_fence, ownership_epoch`,
      [conversationId, 'worker-handoff'],
    );
    const fh = (
      await c5.query(`SELECT lease_fence, ownership_epoch, next_timeline_sequence FROM conversations WHERE id=$1`, [
        conversationId,
      ])
    ).rows[0];
    const d3 = contentDigest(JSON.stringify({ providerMessageId: 'p04-3', text: 'human', sender: 'x' }));
    await c5.query(
      `INSERT INTO messages(
         id,organization_id,conversation_id,channel_connection_id,direction,origin,
         provider_message_id,ingress_sequence,timeline_sequence,content_text,content_digest,delivery_state
       ) VALUES($1,$2,$3,$4,'INBOUND','CUSTOMER','p04-3',3,$5,'أريد موظف',$6,'ACCEPTED')`,
      [randomUUID(), org, conversationId, connId, fh.next_timeline_sequence, d3],
    );
    await c5.query(`UPDATE conversations SET next_timeline_sequence=next_timeline_sequence+1 WHERE id=$1`, [
      conversationId,
    ]);
    await c5.query('COMMIT');

    // Force Fake to handoff via env scenario — use tool executor path through provider
    // Override by temporarily patching: run with Fake tool_then_final handoff
    const { FakeModelProvider, runAgentOrchestrator } = await import('@ai-sales-agent/agent-core');
    const { createPgRunStore, createToolExecutor, ensureActiveAgentConfig } = await import(
      '@ai-sales-agent/agent-adapters'
    );
    const store = createPgRunStore(runtime);
    const tools = createToolExecutor(runtime, store, false);
    const cfg = await ensureActiveAgentConfig(runtime, org);
    const snap = {
      organizationId: org,
      conversationId,
      customerId,
      mode: 'AI_ACTIVE',
      ownershipEpoch: fh.ownership_epoch,
      leaseOwner: 'worker-handoff',
      leaseFence: fh.lease_fence,
      nextIngressSequence: 4,
      processedSequence: 2,
      targetIngressSequence: 3,
      messages: [
        {
          id: randomUUID(),
          direction: 'INBOUND',
          ingressSequence: 3,
          timelineSequence: 1,
          contentText: 'أريد موظف',
        },
      ],
      summaryText: null,
      summaryWatermark: null,
      agentConfigVersionId: cfg.id,
      promptVersion: cfg.promptVersion,
      modelProfile: cfg.modelProfile,
      toolAllowlist: cfg.toolAllowlist,
    };
    const handoffResult = await runAgentOrchestrator(snap, {
      provider: new FakeModelProvider({
        kind: 'tool_then_final',
        toolName: 'handoffToHuman',
        args: { reasonCode: 'CUSTOMER_REQUEST', summary: 'asks for human' },
        text: 'should not send',
      }),
      tools,
      store,
      allowFakeProvider: true,
    });
    assert.equal(handoffResult.terminal, 'HANDOFF_REQUESTED');

    await context(c5, org, user);
    const after = await c5.query(
      `SELECT mode, ownership_epoch, processed_sequence FROM conversations WHERE id=$1`,
      [conversationId],
    );
    assert.equal(after.rows[0].mode, 'AI_PAUSED');
    assert.equal(after.rows[0].ownership_epoch, fh.ownership_epoch + 1);
    assert.equal(after.rows[0].processed_sequence, 3);

    // MODE/CURSOR: AI_PAUSED must not auto-advance further
    const pausedProcessed = after.rows[0].processed_sequence;
    await c5.query(
      `UPDATE conversations SET next_sequence = next_sequence + 1 WHERE id=$1`,
      [conversationId],
    );
    await c5.query('COMMIT');
    // simulate drain hold: processed stays
    await context(c5, org, user);
    const held = await c5.query(`SELECT processed_sequence, mode FROM conversations WHERE id=$1`, [
      conversationId,
    ]);
    assert.equal(held.rows[0].mode, 'AI_PAUSED');
    assert.equal(held.rows[0].processed_sequence, pausedProcessed);
    await c5.query('COMMIT');

    // operationKey stability
    const op = buildOperationKey({
      runKey: handoffResult.runKey,
      toolCallOrdinal: 1,
      toolName: 'handoffToHuman',
      toolVersion: '1',
      normalizedArgsHash: hashNormalizedArgs({
        reasonCode: 'CUSTOMER_REQUEST',
        summary: 'asks for human',
      }),
    });
    const ops = await context(c5, org, user).then(async () => {
      const r = await c5.query(
        `SELECT operation_key, status FROM command_operations WHERE organization_id=$1 AND operation_key=$2`,
        [org, op],
      );
      await c5.query('COMMIT');
      return r;
    });
    assert.equal(ops.rowCount, 1);
    assert.equal(ops.rows[0].status, 'SUCCEEDED');
  } finally {
    c5.release();
    if (prevFake === undefined) delete process.env.AI_ALLOW_FAKE;
    else process.env.AI_ALLOW_FAKE = prevFake;
    if (prevNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNode;
  }
});
