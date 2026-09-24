import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import type { PoolClient } from 'pg';
import { GoneException } from '@nestjs/common';
import { createAppPool } from '../../src/database/pg-pool.js';
import { dispatchOutboundMessage } from '@ai-sales-agent/agent-adapters';
import { ConversationsService } from '../../src/conversations/conversations.service.js';
import { fixtureExternalChannelId } from '../../src/messaging/fake-channel.js';

const runtimeUrl = process.env.DATABASE_URL;
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
assert.ok(runtimeUrl && migrationUrl, 'DATABASE_URL and MIGRATION_DATABASE_URL required');

const runtime = createAppPool(runtimeUrl!, { max: 6 });
const owner = createAppPool(migrationUrl!, { max: 1 });

async function context(c: PoolClient, org: string, user: string) {
  await c.query('BEGIN');
  await c.query(`SELECT set_config('app.current_user_id',$1,true)`, [user]);
  await c.query(`SELECT set_config('app.current_organization_id',$1,true)`, [org]);
}

function digest(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

test('Phase 09 human takeover: eligibility, authority epoch, /mode hardened, claim race', async () => {
  // Schema columns
  const cols = await owner.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='conversations'
       AND column_name IN (
         'ai_eligible_after_sequence','paused_at','pause_reason_code','pause_reason_text','resumed_at'
       )
     ORDER BY 1`,
  );
  assert.equal(cols.rowCount, 5);
  const msgCol = await owner.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name='messages' AND column_name='authority_epoch'`,
  );
  assert.equal(msgCol.rowCount, 1);
  const fk = await owner.query(
    `SELECT 1 FROM pg_constraint WHERE conname='conversations_owner_member_fk'`,
  );
  assert.equal(fk.rowCount, 1);

  // Legacy /mode endpoint hardened
  const svc = Object.create(ConversationsService.prototype) as ConversationsService;
  await assert.rejects(
    () =>
      svc.transitionMode(
        { userId: randomUUID(), requestId: 't' } as never,
        randomUUID(),
        randomUUID(),
        'AI_ACTIVE',
        1,
      ),
    (e: unknown) => e instanceof GoneException,
  );
  await assert.rejects(
    () =>
      svc.transitionMode(
        { userId: randomUUID(), requestId: 't' } as never,
        randomUUID(),
        randomUUID(),
        'HUMAN_ACTIVE',
        1,
      ),
    (e: unknown) => e instanceof GoneException,
  );

  const userA = randomUUID();
  const userB = randomUUID();
  const org = randomUUID();
  const orgOther = randomUUID();
  await owner.query(`INSERT INTO users(id,auth_subject) VALUES($1,$2),($3,$4)`, [
    userA,
    `p09-a-${userA}`,
    userB,
    `p09-b-${userB}`,
  ]);
  await owner.query(`INSERT INTO organizations(id,name) VALUES($1,'P09'),($2,'P09-other')`, [
    org,
    orgOther,
  ]);
  await owner.query(
    `INSERT INTO organization_members(organization_id,user_id,role,status) VALUES
       ($1,$2,'OWNER','ACTIVE'),($1,$3,'MEMBER','ACTIVE'),($4,$2,'OWNER','ACTIVE')`,
    [org, userA, userB, orgOther],
  );

  // Cross-org owner FK rejected
  await assert.rejects(
    async () => {
      const badConv = randomUUID();
      const conn = randomUUID();
      const cust = randomUUID();
      const ident = randomUUID();
      await owner.query(
        `INSERT INTO channel_connections(id,organization_id,provider,external_channel_id,status)
         VALUES($1,$2,'whatsapp',$3,'ACTIVE')`,
        [conn, org, fixtureExternalChannelId(org, 'whatsapp')],
      );
      await owner.query(`INSERT INTO customers(id,organization_id,display_name) VALUES($1,$2,'x')`, [
        cust,
        org,
      ]);
      await owner.query(
        `INSERT INTO customer_identities(id,organization_id,customer_id,channel_connection_id,channel,external_address)
         VALUES($1,$2,$3,$4,'whatsapp','+9647700000100')`,
        [ident, org, cust, conn],
      );
      await owner.query(
        `INSERT INTO conversations(
           id,organization_id,customer_id,channel_connection_id,identity_id,mode,owner_member_id
         ) VALUES($1,$2,$3,$4,$5,'AI_PAUSED',$6)`,
        [badConv, org, cust, conn, ident, userA /* userA is member of orgOther too but FK is (org, user) — userA IS in org */],
      );
      // Force fail: assign owner that is ONLY in orgOther — need a user not in org
      const stranger = randomUUID();
      await owner.query(`INSERT INTO users(id,auth_subject) VALUES($1,$2)`, [
        stranger,
        `p09-s-${stranger}`,
      ]);
      await owner.query(
        `INSERT INTO organization_members(organization_id,user_id,role,status) VALUES($1,$2,'OWNER','ACTIVE')`,
        [orgOther, stranger],
      );
      await owner.query(
        `UPDATE conversations SET owner_member_id=$2 WHERE id=$1`,
        [badConv, stranger],
      );
    },
    /foreign key|violates|23503/i,
  );

  const c = await runtime.connect();
  try {
    await context(c, org, userA);
    const connId = randomUUID();
    const ext = fixtureExternalChannelId(org, 'fixture-wa');
    await c.query(
      `INSERT INTO channel_connections(id,organization_id,provider,external_channel_id,status,health_status)
       VALUES($1,$2,'fixture_whatsapp',$3,'ACTIVE','ACTIVE')`,
      [connId, org, ext],
    );
    const customerId = randomUUID();
    await c.query(`INSERT INTO customers(id,organization_id,display_name) VALUES($1,$2,'P09')`, [
      customerId,
      org,
    ]);
    const identityId = randomUUID();
    await c.query(
      `INSERT INTO customer_identities(id,organization_id,customer_id,channel_connection_id,channel,external_address)
       VALUES($1,$2,$3,$4,'whatsapp','+9647700000101')`,
      [identityId, org, customerId, connId],
    );
    const conversationId = randomUUID();
    await c.query(
      `INSERT INTO conversations(
         id,organization_id,customer_id,channel_connection_id,identity_id,
         mode,ownership_epoch,next_sequence,processed_sequence,next_timeline_sequence,
         ai_eligible_after_sequence,lease_fence,version,last_customer_inbound_at
       ) VALUES($1,$2,$3,$4,$5,'AI_ACTIVE',7,1,0,1,0,0,1,now())`,
      [conversationId, org, customerId, connId, identityId],
    );

    // AI PENDING at epoch 7
    const aiMsgId = randomUUID();
    await c.query(
      `INSERT INTO messages(
         id,organization_id,conversation_id,channel_connection_id,direction,origin,
         timeline_sequence,content_text,content_digest,delivery_state,authority_epoch
       ) VALUES($1,$2,$3,$4,'OUTBOUND','AI',1,'ai-pending',$5,'PENDING',7)`,
      [aiMsgId, org, conversationId, connId, digest('ai-pending')],
    );
    await c.query(
      `UPDATE conversations SET next_timeline_sequence=2 WHERE id=$1`,
      [conversationId],
    );
    await c.query('COMMIT');

    // Takeover → AI_PAUSED + owner + epoch 8 + suppress PENDING AI
    await context(c, org, userA);
    await c.query(
      `UPDATE messages SET delivery_state='SUPPRESSED'
       WHERE conversation_id=$1 AND origin='AI' AND delivery_state='PENDING'`,
      [conversationId],
    );
    await c.query(
      `UPDATE conversations SET
         mode='AI_PAUSED', owner_member_id=$2, ownership_epoch=8, version=version+1,
         paused_at=now(), pause_reason_code='OPERATOR_MANUAL_TAKEOVER'
       WHERE id=$1`,
      [conversationId, userA],
    );
    await c.query('COMMIT');

    const suppressed = await runtime.query(
      `SELECT delivery_state FROM messages WHERE id=$1`,
      [aiMsgId],
    );
    // Need tenant context for RLS - use owner
    const suppressedOwner = await owner.query(
      `SELECT delivery_state FROM messages WHERE id=$1`,
      [aiMsgId],
    );
    assert.equal(suppressedOwner.rows[0].delivery_state, 'SUPPRESSED');

    // Dispatch of already-SUPPRESSED is SKIPPED
    await context(c, org, userA);
    const skip = await dispatchOutboundMessage(c, org, aiMsgId);
    assert.equal(skip.outcome, 'SKIPPED');
    await c.query('COMMIT');

    // Fresh PENDING AI with stale authority_epoch after resume path:
    // Create PENDING with authority 7 while conversation will be AI_ACTIVE epoch 9
    const zombieId = randomUUID();
    await context(c, org, userA);
    // Simulate resume: eligibility cursor + AI_ACTIVE epoch 9
    // First insert 3 paused inbound
    for (let i = 0; i < 3; i++) {
      const locked = await c.query(
        `SELECT next_sequence, next_timeline_sequence FROM conversations WHERE id=$1 FOR UPDATE`,
        [conversationId],
      );
      const ns = locked.rows[0].next_sequence;
      const nt = locked.rows[0].next_timeline_sequence;
      await c.query(
        `INSERT INTO messages(
           id,organization_id,conversation_id,channel_connection_id,direction,origin,
           provider_message_id,ingress_sequence,timeline_sequence,content_text,content_digest,delivery_state
         ) VALUES($1,$2,$3,$4,'INBOUND','CUSTOMER',$5,$6,$7,$8,$9,'ACCEPTED')`,
        [
          randomUUID(),
          org,
          conversationId,
          connId,
          `pm-pause-${i}-${randomUUID()}`,
          ns,
          nt,
          `paused-${i}`,
          digest(`paused-${i}`),
        ],
      );
      await c.query(
        `UPDATE conversations SET next_sequence=$2, next_timeline_sequence=$3, last_message_at=now()
         WHERE id=$1`,
        [conversationId, ns + 1, nt + 1],
      );
    }
    // processed_sequence stays 0 (not advanced while paused)
    const beforeResume = await c.query(
      `SELECT next_sequence, processed_sequence, ownership_epoch FROM conversations WHERE id=$1`,
      [conversationId],
    );
    assert.equal(Number(beforeResume.rows[0].processed_sequence), 0);
    assert.ok(Number(beforeResume.rows[0].next_sequence) >= 4);

    const eligibleAfter = Number(beforeResume.rows[0].next_sequence) - 1;
    await c.query(
      `UPDATE conversations SET
         mode='AI_ACTIVE', owner_member_id=NULL, ownership_epoch=9,
         ai_eligible_after_sequence=$2, resumed_at=now(),
         paused_at=NULL, pause_reason_code=NULL, pause_reason_text=NULL
       WHERE id=$1`,
      [conversationId, eligibleAfter],
    );

    // Zombie AI created under epoch 7 still PENDING somehow
    await c.query(
      `INSERT INTO messages(
         id,organization_id,conversation_id,channel_connection_id,direction,origin,
         timeline_sequence,content_text,content_digest,delivery_state,authority_epoch
       ) VALUES($1,$2,$3,$4,'OUTBOUND','AI',
         (SELECT next_timeline_sequence FROM conversations WHERE id=$3),
         'zombie',$5,'PENDING',7)`,
      [zombieId, org, conversationId, connId, digest('zombie')],
    );
    await c.query(
      `UPDATE conversations SET next_timeline_sequence=next_timeline_sequence+1 WHERE id=$1`,
      [conversationId],
    );
    await c.query('COMMIT');

    // Eligibility: targetIngress = next-1 <= eligibleAfter → no agent
    await context(c, org, userA);
    const elig = await c.query(
      `SELECT next_sequence, processed_sequence, ai_eligible_after_sequence, mode
       FROM conversations WHERE id=$1`,
      [conversationId],
    );
    const nextSeq = Number(elig.rows[0].next_sequence);
    const target = nextSeq - 1;
    const cursor = Number(elig.rows[0].ai_eligible_after_sequence);
    assert.equal(elig.rows[0].mode, 'AI_ACTIVE');
    assert.ok(target <= cursor, 'paused backlog must not be eligible');
    await c.query('COMMIT');

    // Zombie dispatch suppressed despite AI_ACTIVE
    await context(c, org, userA);
    const z = await dispatchOutboundMessage(c, org, zombieId);
    assert.equal(z.outcome, 'SUPPRESSED');
    await c.query('COMMIT');
    const zState = await owner.query(`SELECT delivery_state FROM messages WHERE id=$1`, [zombieId]);
    assert.equal(zState.rows[0].delivery_state, 'SUPPRESSED');

    // Current-epoch AI while AI_ACTIVE → dispatch allowed (fixture → ACCEPTED)
    const liveAi = randomUUID();
    await context(c, org, userA);
    await c.query(
      `INSERT INTO messages(
         id,organization_id,conversation_id,channel_connection_id,direction,origin,
         timeline_sequence,content_text,content_digest,delivery_state,authority_epoch
       ) VALUES($1,$2,$3,$4,'OUTBOUND','AI',
         (SELECT next_timeline_sequence FROM conversations WHERE id=$3),
         'live',$5,'PENDING',9)`,
      [liveAi, org, conversationId, connId, digest('live')],
    );
    await c.query(
      `UPDATE conversations SET next_timeline_sequence=next_timeline_sequence+1 WHERE id=$1`,
      [conversationId],
    );
    const live = await dispatchOutboundMessage(c, org, liveAi);
    assert.equal(live.outcome, 'ACCEPTED');
    await c.query('COMMIT');

    // New inbound above cursor becomes eligible
    await context(c, org, userA);
    const locked = await c.query(
      `SELECT next_sequence, next_timeline_sequence, ai_eligible_after_sequence FROM conversations WHERE id=$1 FOR UPDATE`,
      [conversationId],
    );
    const ns = Number(locked.rows[0].next_sequence);
    const nt = Number(locked.rows[0].next_timeline_sequence);
    const cur = Number(locked.rows[0].ai_eligible_after_sequence);
    await c.query(
      `INSERT INTO messages(
         id,organization_id,conversation_id,channel_connection_id,direction,origin,
         provider_message_id,ingress_sequence,timeline_sequence,content_text,content_digest,delivery_state
       ) VALUES($1,$2,$3,$4,'INBOUND','CUSTOMER',$5,$6,$7,'after-resume',$8,'ACCEPTED')`,
      [
        randomUUID(),
        org,
        conversationId,
        connId,
        `pm-new-${randomUUID()}`,
        ns,
        nt,
        digest('after-resume'),
      ],
    );
    await c.query(
      `UPDATE conversations SET next_sequence=$2, next_timeline_sequence=$3 WHERE id=$1`,
      [conversationId, ns + 1, nt + 1],
    );
    await c.query('COMMIT');
    assert.ok(ns > cur, 'new inbound must be above eligibility cursor');

    // SYSTEM handoff ack while AI_PAUSED allowed
    await context(c, org, userA);
    await c.query(
      `UPDATE conversations SET mode='AI_PAUSED', ownership_epoch=10, owner_member_id=$2,
         paused_at=now(), pause_reason_code='AI_UNCERTAIN' WHERE id=$1`,
      [conversationId, userA],
    );
    const sysId = randomUUID();
    await c.query(
      `INSERT INTO messages(
         id,organization_id,conversation_id,channel_connection_id,direction,origin,
         timeline_sequence,content_text,content_digest,delivery_state,authority_epoch
       ) VALUES($1,$2,$3,$4,'OUTBOUND','SYSTEM',
         (SELECT next_timeline_sequence FROM conversations WHERE id=$3),
         'handoff-ack',$5,'PENDING',10)`,
      [sysId, org, conversationId, connId, digest('handoff-ack')],
    );
    await c.query(
      `UPDATE conversations SET next_timeline_sequence=next_timeline_sequence+1 WHERE id=$1`,
      [conversationId],
    );
    const sys = await dispatchOutboundMessage(c, org, sysId);
    assert.equal(sys.outcome, 'ACCEPTED');

    // OPERATOR while paused + matching epoch allowed
    const opId = randomUUID();
    await c.query(
      `INSERT INTO messages(
         id,organization_id,conversation_id,channel_connection_id,direction,origin,
         timeline_sequence,content_text,content_digest,delivery_state,authority_epoch
       ) VALUES($1,$2,$3,$4,'OUTBOUND','OPERATOR',
         (SELECT next_timeline_sequence FROM conversations WHERE id=$3),
         'human-reply',$5,'PENDING',10)`,
      [opId, org, conversationId, connId, digest('human-reply')],
    );
    await c.query(
      `UPDATE conversations SET next_timeline_sequence=next_timeline_sequence+1 WHERE id=$1`,
      [conversationId],
    );
    const op = await dispatchOutboundMessage(c, org, opId);
    assert.equal(op.outcome, 'ACCEPTED');
    await c.query('COMMIT');

    // Concurrent claim: only one owner
    await context(c, org, userA);
    await c.query(
      `UPDATE conversations SET mode='AI_PAUSED', owner_member_id=NULL, ownership_epoch=11
       WHERE id=$1`,
      [conversationId],
    );
    await c.query('COMMIT');

    const a = await runtime.connect();
    const b = await runtime.connect();
    async function tryClaim(client: PoolClient, uid: string) {
      await context(client, org, uid);
      try {
        const row = await client.query(
          `SELECT ownership_epoch, owner_member_id FROM conversations WHERE id=$1 FOR UPDATE`,
          [conversationId],
        );
        if (row.rows[0].owner_member_id) {
          await client.query('ROLLBACK');
          return false;
        }
        const expected = Number(row.rows[0].ownership_epoch);
        const upd = await client.query(
          `UPDATE conversations SET owner_member_id=$2, ownership_epoch=ownership_epoch+1, version=version+1
           WHERE id=$1 AND ownership_epoch=$3 AND owner_member_id IS NULL
           RETURNING owner_member_id`,
          [conversationId, uid, expected],
        );
        if (!upd.rowCount) {
          await client.query('ROLLBACK');
          return false;
        }
        await client.query('COMMIT');
        return true;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }
    let results: boolean[];
    try {
      results = await Promise.all([tryClaim(a, userA), tryClaim(b, userB)]);
    } finally {
      a.release();
      b.release();
    }
    assert.equal(results.filter(Boolean).length, 1);
    const ownerRow = await owner.query(
      `SELECT owner_member_id FROM conversations WHERE id=$1`,
      [conversationId],
    );
    assert.ok(ownerRow.rows[0].owner_member_id === userA || ownerRow.rows[0].owner_member_id === userB);

    void suppressed; // silence unused when RLS blocks runtime read
  } finally {
    c.release();
  }
});
