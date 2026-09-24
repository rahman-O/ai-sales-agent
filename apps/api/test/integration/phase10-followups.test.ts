import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import type { PoolClient } from 'pg';
import { createAppPool } from '../../src/database/pg-pool.js';
import {
  computeNextEligibleAt,
  executeFollowUp,
  isInQuietHours,
} from '@ai-sales-agent/agent-adapters';
import { fixtureExternalChannelId } from '../../src/messaging/fake-channel.js';
import { P10_TOOL_NAMES, P04_TOOL_NAMES } from '@ai-sales-agent/contracts';

const runtimeUrl = process.env.DATABASE_URL;
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
assert.ok(runtimeUrl && migrationUrl);

const runtime = createAppPool(runtimeUrl!, { max: 6 });
const owner = createAppPool(migrationUrl!, { max: 1 });

async function context(c: PoolClient, org: string, user: string) {
  await c.query('BEGIN');
  await c.query(`SELECT set_config('app.current_user_id',$1,true)`, [user]);
  await c.query(`SELECT set_config('app.current_organization_id',$1,true)`, [org]);
}

function digest(t: string) {
  return createHash('sha256').update(t).digest('hex');
}

test('Phase 10 follow-ups: outbox timer, DISPATCHED, epoch fence, quiet hours, templates', async () => {
  assert.ok(!(P04_TOOL_NAMES as readonly string[]).includes('scheduleLeadFollowUp'));
  assert.ok((P10_TOOL_NAMES as readonly string[]).includes('scheduleLeadFollowUp'));

  assert.equal(isInQuietHours(21 * 60, 20 * 60, 9 * 60), true);
  assert.equal(isInQuietHours(10 * 60, 20 * 60, 9 * 60), false);
  const scheduled = new Date('2026-09-25T17:30:00.000Z'); // 20:30 Asia/Baghdad (UTC+3)
  const next = computeNextEligibleAt({
    scheduledFor: scheduled,
    timezone: 'Asia/Baghdad',
    quietStartMinute: 20 * 60,
    quietEndMinute: 9 * 60,
  });
  assert.ok(next.getTime() >= scheduled.getTime());

  const cols = await owner.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='follow_ups'
       AND column_name IN (
         'baseline_ownership_epoch','next_eligible_at','outreach_basis','outbound_message_id'
       )`,
  );
  assert.equal(cols.rowCount, 4);
  const msgCols = await owner.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='messages' AND column_name IN ('send_mode','template_version_id')`,
  );
  assert.equal(msgCols.rowCount, 2);

  const user = randomUUID();
  const org = randomUUID();
  await owner.query(`INSERT INTO users(id,auth_subject) VALUES($1,$2)`, [user, `p10-${user}`]);
  await owner.query(`INSERT INTO organizations(id,name) VALUES($1,'P10')`, [org]);
  await owner.query(
    `INSERT INTO organization_members(organization_id,user_id,role,status) VALUES($1,$2,'OWNER','ACTIVE')`,
    [org, user],
  );

  const c = await runtime.connect();
  try {
    await context(c, org, user);
    const connId = randomUUID();
    await c.query(
      `INSERT INTO channel_connections(id,organization_id,provider,external_channel_id,status,health_status)
       VALUES($1,$2,'fixture_whatsapp',$3,'ACTIVE','ACTIVE')`,
      [connId, org, fixtureExternalChannelId(org, 'fixture-wa')],
    );
    const customerId = randomUUID();
    await c.query(`INSERT INTO customers(id,organization_id,display_name) VALUES($1,$2,'P10')`, [
      customerId,
      org,
    ]);
    const identityId = randomUUID();
    await c.query(
      `INSERT INTO customer_identities(id,organization_id,customer_id,channel_connection_id,channel,external_address)
       VALUES($1,$2,$3,$4,'whatsapp','+9647700000200')`,
      [identityId, org, customerId, connId],
    );
    const conversationId = randomUUID();
    await c.query(
      `INSERT INTO conversations(
         id,organization_id,customer_id,channel_connection_id,identity_id,
         mode,ownership_epoch,next_sequence,processed_sequence,next_timeline_sequence,
         lease_fence,version,last_customer_inbound_at
       ) VALUES($1,$2,$3,$4,$5,'AI_ACTIVE',10,2,1,2,0,1,now())`,
      [conversationId, org, customerId, connId, identityId],
    );
    await c.query(
      `INSERT INTO messages(
         id,organization_id,conversation_id,channel_connection_id,direction,origin,
         provider_message_id,ingress_sequence,timeline_sequence,content_text,content_digest,delivery_state
       ) VALUES($1,$2,$3,$4,'INBOUND','CUSTOMER','pm1',1,1,'hi',$5,'ACCEPTED')`,
      [randomUUID(), org, conversationId, connId, digest('hi')],
    );

    const templateId = randomUUID();
    const versionId = randomUUID();
    await c.query(
      `INSERT INTO message_templates(id,organization_id,internal_name,internal_status)
       VALUES($1,$2,'welcome','APPROVED')`,
      [templateId, org],
    );
    await c.query(
      `INSERT INTO message_template_versions(
         id,organization_id,template_id,version,provider_template_name,provider_language_code,
         parameter_schema,body_preview,provider_status
       ) VALUES($1,$2,$3,1,'hello_ar','ar',$4::jsonb,'Hello',$5)`,
      [versionId, org, templateId, JSON.stringify({ customerFirstName: 'string' }), 'UNKNOWN'],
    );
    await c.query(
      `UPDATE message_templates SET active_version_id=$2 WHERE id=$1`,
      [templateId, versionId],
    );

    // AUTOMATED follow-up under epoch 10
    const followUpId = randomUUID();
    const due = new Date(Date.now() - 1000);
    await c.query(
      `INSERT INTO follow_ups(
         id,organization_id,customer_id,conversation_id,channel_connection_id,template_version_id,
         status,trigger_type,origin_kind,outreach_basis,send_mode,
         scheduled_for,next_eligible_at,timezone,dedup_key,operation_key,
         baseline_inbound_sequence,baseline_ownership_epoch,payload_data,created_by_type,version
       ) VALUES(
         $1,$2,$3,$4,$5,$6,'SCHEDULED','LEAD_NO_RESPONSE','AUTOMATED','CUSTOMER_INITIATED_CONVERSATION','TEMPLATE',
         $7,$7,'Asia/Baghdad',$8,$9,1,10,$10::jsonb,'SYSTEM',1
       )`,
      [
        followUpId,
        org,
        customerId,
        conversationId,
        connId,
        versionId,
        due.toISOString(),
        `LEAD_NO_RESPONSE::${conversationId}:1`,
        `followup:${followUpId}`,
        JSON.stringify({ params: { customerFirstName: 'Ali' } }),
      ],
    );
    const eventId = randomUUID();
    await c.query(
      `INSERT INTO outbox_events(id,organization_id,event_type,payload_json,available_at)
       VALUES($1,$2,'FollowUpDue',$3::jsonb,now())`,
      [
        eventId,
        org,
        JSON.stringify({
          eventId,
          eventType: 'FollowUpDue',
          payload: { followUpId, followUpVersion: 1 },
        }),
      ],
    );
    await c.query('COMMIT');

    // Execute while AI_ACTIVE epoch 10 → DISPATCHED
    const r1 = await executeFollowUp({
      pool: runtime,
      organizationId: org,
      followUpId,
      followUpVersion: 1,
      workerId: user,
    });
    assert.equal(r1.outcome, 'DISPATCHED');
    assert.ok(r1.outboundMessageId);
    const msg = await owner.query(
      `SELECT send_mode, delivery_state, origin FROM messages WHERE id=$1`,
      [r1.outboundMessageId],
    );
    assert.equal(msg.rows[0].send_mode, 'TEMPLATE');
    assert.equal(msg.rows[0].origin, 'SYSTEM');
    assert.equal(msg.rows[0].delivery_state, 'PENDING');
    const fu = await owner.query(`SELECT status FROM follow_ups WHERE id=$1`, [followUpId]);
    assert.equal(fu.rows[0].status, 'DISPATCHED');

    // Idempotent re-execute
    const r2 = await executeFollowUp({
      pool: runtime,
      organizationId: org,
      followUpId,
      workerId: user,
    });
    assert.equal(r2.outcome, 'ALREADY_DISPATCHED');
    assert.equal(r2.outboundMessageId, r1.outboundMessageId);

    // Epoch zombie: new AUTOMATED follow-up, then bump epoch (takeover/resume), then execute → suppress
    await context(c, org, user);
    const zombieId = randomUUID();
    await c.query(
      `INSERT INTO follow_ups(
         id,organization_id,customer_id,conversation_id,channel_connection_id,template_version_id,
         status,trigger_type,origin_kind,outreach_basis,send_mode,
         scheduled_for,next_eligible_at,timezone,dedup_key,operation_key,
         baseline_inbound_sequence,baseline_ownership_epoch,payload_data,created_by_type,version
       ) VALUES(
         $1,$2,$3,$4,$5,$6,'SCHEDULED','LEAD_NO_RESPONSE','AUTOMATED','CUSTOMER_INITIATED_CONVERSATION','TEMPLATE',
         now(),now(),'Asia/Baghdad',$7,$8,1,10,$9::jsonb,'SYSTEM',1
       )`,
      [
        zombieId,
        org,
        customerId,
        conversationId,
        connId,
        versionId,
        `zombie:${zombieId}`,
        `followup:${zombieId}`,
        JSON.stringify({ params: { customerFirstName: 'Ali' } }),
      ],
    );
    // Simulate takeover + resume → epoch 12
    await c.query(
      `UPDATE conversations SET ownership_epoch=12, mode='AI_ACTIVE', owner_member_id=NULL WHERE id=$1`,
      [conversationId],
    );
    await c.query('COMMIT');

    const z = await executeFollowUp({
      pool: runtime,
      organizationId: org,
      followUpId: zombieId,
      workerId: user,
    });
    assert.equal(z.outcome, 'SUPPRESSED');
    assert.equal(z.reasonCode, 'CONVERSATION_AUTHORITY_CHANGED');

    // Customer reply race: baseline 1, bump next_sequence with new inbound → CUSTOMER_REPLIED
    await context(c, org, user);
    const replyFu = randomUUID();
    await c.query(
      `INSERT INTO follow_ups(
         id,organization_id,customer_id,conversation_id,channel_connection_id,template_version_id,
         status,trigger_type,origin_kind,outreach_basis,send_mode,
         scheduled_for,next_eligible_at,timezone,dedup_key,operation_key,
         baseline_inbound_sequence,baseline_ownership_epoch,payload_data,created_by_type,version
       ) VALUES(
         $1,$2,$3,$4,$5,$6,'SCHEDULED','LEAD_NO_RESPONSE','AUTOMATED','CUSTOMER_INITIATED_CONVERSATION','TEMPLATE',
         now(),now(),'Asia/Baghdad',$7,$8,1,12,$9::jsonb,'SYSTEM',1
       )`,
      [
        replyFu,
        org,
        customerId,
        conversationId,
        connId,
        versionId,
        `reply:${replyFu}`,
        `followup:${replyFu}`,
        JSON.stringify({ params: { customerFirstName: 'Ali' } }),
      ],
    );
    await c.query(
      `INSERT INTO messages(
         id,organization_id,conversation_id,channel_connection_id,direction,origin,
         provider_message_id,ingress_sequence,timeline_sequence,content_text,content_digest,delivery_state
       ) VALUES($1,$2,$3,$4,'INBOUND','CUSTOMER','pm2',2,
         (SELECT next_timeline_sequence FROM conversations WHERE id=$3),'again',$5,'ACCEPTED')`,
      [randomUUID(), org, conversationId, connId, digest('again')],
    );
    await c.query(
      `UPDATE conversations SET next_sequence=3, next_timeline_sequence=next_timeline_sequence+1 WHERE id=$1`,
      [conversationId],
    );
    await c.query('COMMIT');

    const replied = await executeFollowUp({
      pool: runtime,
      organizationId: org,
      followUpId: replyFu,
      workerId: user,
    });
    assert.equal(replied.outcome, 'SUPPRESSED');
    assert.equal(replied.reasonCode, 'CUSTOMER_REPLIED');

    // Stale FollowUpDue version → NO_OP
    await context(c, org, user);
    const staleId = randomUUID();
    await c.query(
      `INSERT INTO follow_ups(
         id,organization_id,customer_id,conversation_id,channel_connection_id,template_version_id,
         status,trigger_type,origin_kind,outreach_basis,send_mode,
         scheduled_for,next_eligible_at,timezone,dedup_key,operation_key,
         baseline_inbound_sequence,baseline_ownership_epoch,payload_data,created_by_type,version
       ) VALUES(
         $1,$2,$3,$4,$5,$6,'SCHEDULED','MANUAL_SCHEDULED','OPERATOR_SCHEDULED','OPERATOR_SCHEDULED','TEMPLATE',
         now(),now(),'Asia/Baghdad',$7,$8,2,12,$9::jsonb,'USER',3
       )`,
      [
        staleId,
        org,
        customerId,
        conversationId,
        connId,
        versionId,
        `stale:${staleId}`,
        `followup:${staleId}`,
        JSON.stringify({ params: { customerFirstName: 'Ali' } }),
      ],
    );
    await c.query('COMMIT');
    const stale = await executeFollowUp({
      pool: runtime,
      organizationId: org,
      followUpId: staleId,
      followUpVersion: 1,
      workerId: user,
    });
    assert.equal(stale.outcome, 'NO_OP');
    assert.equal(stale.reasonCode, 'STALE_VERSION');
  } finally {
    c.release();
  }
});
