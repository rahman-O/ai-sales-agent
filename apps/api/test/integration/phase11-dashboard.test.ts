import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import type { PoolClient } from 'pg';
import { createAppPool } from '../../src/database/pg-pool.js';
import { AppConfigService } from '../../src/config/config.service.js';
import { PrismaService } from '../../src/database/prisma.service.js';
import { TenantContextService } from '../../src/database/tenant-context.service.js';
import { DashboardService } from '../../src/dashboard/dashboard.service.js';
import { fixtureExternalChannelId } from '../../src/messaging/fake-channel.js';
import { NotFoundException } from '@nestjs/common';

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

function digest(t: string) {
  return createHash('sha256').update(t).digest('hex');
}

test('Phase 11 dashboard: attention predicates, roles, tenant isolation, bounds', async () => {
  const ownerUser = randomUUID();
  const memberUser = randomUUID();
  const org = randomUUID();
  const orgOther = randomUUID();

  await owner.query(`INSERT INTO users(id,auth_subject) VALUES($1,$2),($3,$4)`, [
    ownerUser,
    `p11-o-${ownerUser}`,
    memberUser,
    `p11-m-${memberUser}`,
  ]);
  await owner.query(`INSERT INTO organizations(id,name) VALUES($1,'P11'),($2,'P11-other')`, [
    org,
    orgOther,
  ]);
  await owner.query(
    `INSERT INTO organization_members(organization_id,user_id,role,status) VALUES
       ($1,$2,'OWNER','ACTIVE'),($1,$3,'MEMBER','ACTIVE'),($4,$2,'OWNER','ACTIVE')`,
    [org, ownerUser, memberUser, orgOther],
  );

  const c = await runtime.connect();
  let prisma: PrismaService | null = null;
  try {
    await context(c, org, ownerUser);

    const connId = randomUUID();
    await c.query(
      `INSERT INTO channel_connections(id,organization_id,provider,external_channel_id,status,health_status,display_phone_number)
       VALUES($1,$2,'fixture_whatsapp',$3,'ACTIVE','AUTH_FAILED','+964700000011'),
              ($4,$2,'fixture_whatsapp',$5,'ACTIVE','DISABLED','+964700000012')`,
      [
        connId,
        org,
        fixtureExternalChannelId(org, 'wa-auth'),
        randomUUID(),
        fixtureExternalChannelId(org, 'wa-disabled'),
      ],
    );

    const customerId = randomUUID();
    await c.query(`INSERT INTO customers(id,organization_id,display_name) VALUES($1,$2,'P11 Cust')`, [
      customerId,
      org,
    ]);
    const identityId = randomUUID();
    await c.query(
      `INSERT INTO customer_identities(id,organization_id,customer_id,channel_connection_id,channel,external_address)
       VALUES($1,$2,$3,$4,'whatsapp','+9647700000111')`,
      [identityId, org, customerId, connId],
    );

    // Handoff unassigned
    const handoffConv = randomUUID();
    await c.query(
      `INSERT INTO conversations(
         id,organization_id,customer_id,channel_connection_id,identity_id,
         mode,owner_member_id,pause_reason_code,paused_at,
         ownership_epoch,next_sequence,processed_sequence,next_timeline_sequence,lease_fence,version
       ) VALUES($1,$2,$3,$4,$5,'AI_PAUSED',NULL,'CUSTOMER_REQUESTED_HUMAN',now(),0,3,0,3,0,1)`,
      [handoffConv, org, customerId, connId, identityId],
    );

    // Manual takeover unassigned (not handoff)
    const pausedConv = randomUUID();
    const ident2 = randomUUID();
    await c.query(
      `INSERT INTO customer_identities(id,organization_id,customer_id,channel_connection_id,channel,external_address)
       VALUES($1,$2,$3,$4,'whatsapp','+9647700000112')`,
      [ident2, org, customerId, connId],
    );
    await c.query(
      `INSERT INTO conversations(
         id,organization_id,customer_id,channel_connection_id,identity_id,
         mode,owner_member_id,pause_reason_code,paused_at,
         ownership_epoch,next_sequence,processed_sequence,next_timeline_sequence,lease_fence,version
       ) VALUES($1,$2,$3,$4,$5,'AI_PAUSED',NULL,'OPERATOR_MANUAL_TAKEOVER',now(),0,1,0,1,0,1)`,
      [pausedConv, org, customerId, connId, ident2],
    );

    // Waiting: owned by member, customer inbound after no operator reply
    const waitConv = randomUUID();
    const ident3 = randomUUID();
    await c.query(
      `INSERT INTO customer_identities(id,organization_id,customer_id,channel_connection_id,channel,external_address)
       VALUES($1,$2,$3,$4,'whatsapp','+9647700000113')`,
      [ident3, org, customerId, connId],
    );
    await c.query(
      `INSERT INTO conversations(
         id,organization_id,customer_id,channel_connection_id,identity_id,
         mode,owner_member_id,pause_reason_code,paused_at,last_message_at,
         ownership_epoch,next_sequence,processed_sequence,next_timeline_sequence,lease_fence,version
       ) VALUES($1,$2,$3,$4,$5,'AI_PAUSED',$6,'AI_UNCERTAIN',now(),now(),1,2,0,2,0,1)`,
      [waitConv, org, customerId, connId, ident3, memberUser],
    );
    await c.query(
      `INSERT INTO messages(
         id,organization_id,conversation_id,channel_connection_id,direction,origin,
         ingress_sequence,timeline_sequence,content_text,content_digest,delivery_state
       ) VALUES($1,$2,$3,$4,'INBOUND','CUSTOMER',1,1,'hello',$5,'ACCEPTED')`,
      [randomUUID(), org, waitConv, connId, digest('hello')],
    );

    // Not waiting: operator replied last
    const calmConv = randomUUID();
    const ident4 = randomUUID();
    await c.query(
      `INSERT INTO customer_identities(id,organization_id,customer_id,channel_connection_id,channel,external_address)
       VALUES($1,$2,$3,$4,'whatsapp','+9647700000114')`,
      [ident4, org, customerId, connId],
    );
    await c.query(
      `INSERT INTO conversations(
         id,organization_id,customer_id,channel_connection_id,identity_id,
         mode,owner_member_id,pause_reason_code,paused_at,last_message_at,
         ownership_epoch,next_sequence,processed_sequence,next_timeline_sequence,lease_fence,version
       ) VALUES($1,$2,$3,$4,$5,'AI_PAUSED',$6,'AI_UNCERTAIN',now(),now(),1,3,0,3,0,1)`,
      [calmConv, org, customerId, connId, ident4, memberUser],
    );
    await c.query(
      `INSERT INTO messages(
         id,organization_id,conversation_id,channel_connection_id,direction,origin,
         ingress_sequence,timeline_sequence,content_text,content_digest,delivery_state
       ) VALUES
         ($1,$2,$3,$4,'INBOUND','CUSTOMER',1,1,'hi',$5,'ACCEPTED'),
         ($6,$2,$3,$4,'OUTBOUND','OPERATOR',NULL,2,'reply',$7,'ACCEPTED')`,
      [
        randomUUID(),
        org,
        calmConv,
        connId,
        digest('hi'),
        randomUUID(),
        digest('reply'),
      ],
    );

    // Follow-ups: CUSTOMER_REPLIED should not be attention; TEMPLATE_DISABLED should
    const fuOk = randomUUID();
    const fuReview = randomUUID();
    const soon = new Date(Date.now() + 60_000).toISOString();
    await c.query(
      `INSERT INTO follow_ups(
         id,organization_id,customer_id,status,trigger_type,origin_kind,outreach_basis,
         scheduled_for,next_eligible_at,timezone,dedup_key,operation_key,
         result_reason_code,suppressed_at,created_by_type,conversation_id,channel_connection_id
       ) VALUES
         ($1,$2,$3,'SUPPRESSED','MANUAL_SCHEDULED','OPERATOR_SCHEDULED','OPERATOR_SCHEDULED',
          $4,$4,'Asia/Baghdad',$5,$6,'CUSTOMER_REPLIED',now(),'SYSTEM',$7,$8),
         ($9,$2,$3,'SUPPRESSED','MANUAL_SCHEDULED','OPERATOR_SCHEDULED','OPERATOR_SCHEDULED',
          $4,$4,'Asia/Baghdad',$10,$11,'TEMPLATE_DISABLED',now(),'SYSTEM',$7,$8)`,
      [
        fuOk,
        org,
        customerId,
        soon,
        `dedup-ok-${fuOk}`,
        `op-ok-${fuOk}`,
        waitConv,
        connId,
        fuReview,
        `dedup-rev-${fuReview}`,
        `op-rev-${fuReview}`,
      ],
    );

    // Incomplete lead
    const leadId = randomUUID();
    await c.query(
      `INSERT INTO leads(id,organization_id,customer_id,status,version)
       VALUES($1,$2,$3,'NEW',1)`,
      [leadId, org, customerId],
    );

    // Past booking must not be BOOKING_SOON
    const locId = randomUUID();
    await c.query(
      `INSERT INTO locations(id,organization_id,name,timezone,active)
       VALUES($1,$2,'HQ','Asia/Baghdad',true)`,
      [locId, org],
    );
    const svcId = randomUUID();
    await c.query(
      `INSERT INTO services(
         id,organization_id,location_id,name,duration_minutes,amount_minor,currency,active
       ) VALUES($1,$2,$3,'Cut',30,1000,'IQD',true)`,
      [svcId, org, locId],
    );
    const staffId = randomUUID();
    await c.query(
      `INSERT INTO staff_members(id,organization_id,location_id,display_name,active)
       VALUES($1,$2,$3,'Ali',true)`,
      [staffId, org, locId],
    );
    const pastStart = new Date(Date.now() - 60 * 60 * 1000);
    const pastEnd = new Date(pastStart.getTime() + 30 * 60 * 1000);
    await c.query(
      `INSERT INTO bookings(
         id,organization_id,customer_id,service_id,location_id,staff_member_id,
         starts_at,ends_at,occupied_starts_at,occupied_ends_at,timezone,duration_minutes,
         status,created_by_type,service_name_snapshot,staff_display_name_snapshot
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$7,$8,'Asia/Baghdad',30,'CONFIRMED','USER','Cut','Ali')`,
      [randomUUID(), org, customerId, svcId, locId, staffId, pastStart.toISOString(), pastEnd.toISOString()],
    );
    const soonStart = new Date(Date.now() + 30 * 60 * 1000);
    const soonEnd = new Date(soonStart.getTime() + 30 * 60 * 1000);
    const soonBooking = randomUUID();
    await c.query(
      `INSERT INTO bookings(
         id,organization_id,customer_id,service_id,location_id,staff_member_id,
         starts_at,ends_at,occupied_starts_at,occupied_ends_at,timezone,duration_minutes,
         status,created_by_type,service_name_snapshot,staff_display_name_snapshot
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$7,$8,'Asia/Baghdad',30,'CONFIRMED','USER','Cut','Ali')`,
      [soonBooking, org, customerId, svcId, locId, staffId, soonStart.toISOString(), soonEnd.toISOString()],
    );

    await c.query('COMMIT');

    // Other tenant data must not leak
    await context(c, orgOther, ownerUser);
    const otherConn = randomUUID();
    await c.query(
      `INSERT INTO channel_connections(id,organization_id,provider,external_channel_id,status,health_status)
       VALUES($1,$2,'fixture_whatsapp',$3,'ACTIVE','AUTH_FAILED')`,
      [otherConn, orgOther, fixtureExternalChannelId(orgOther, 'other')],
    );
    await c.query('COMMIT');

    prisma = new PrismaService(new AppConfigService());
    const tenants = new TenantContextService(prisma);
    const dashboard = new DashboardService(tenants);

    const asOwner = await dashboard.getDashboard(
      { userId: ownerUser, authSubject: `p11-o-${ownerUser}` },
      org,
    );

    assert.ok(asOwner.asOf);
    assert.ok(asOwner.attention.length <= 25);
    assert.ok(asOwner.attention.some((a) => a.type === 'HUMAN_HANDOFF_UNASSIGNED'));
    assert.ok(asOwner.attention.some((a) => a.type === 'PAUSED_CONVERSATION_UNASSIGNED'));
    assert.ok(asOwner.attention.some((a) => a.type === 'HUMAN_CONVERSATION_WAITING' && a.entityId === waitConv));
    assert.ok(!asOwner.attention.some((a) => a.entityId === calmConv && a.type === 'HUMAN_CONVERSATION_WAITING'));
    assert.ok(!asOwner.attention.some((a) => a.id.includes(fuOk)));
    assert.ok(asOwner.attention.some((a) => a.type === 'FOLLOWUP_SUPPRESSED_REVIEW' && a.entityId === fuReview));
    assert.ok(asOwner.attention.some((a) => a.type === 'CHANNEL_AUTH_FAILED'));
    assert.ok(!asOwner.attention.some((a) => a.type === 'CHANNEL_MISCONFIGURED' && a.description.includes('DISABLED')));
    // DISABLED channel is not unhealthy attention
    assert.equal(asOwner.summary.channelDisabled >= 1, true);
    assert.equal(asOwner.summary.channelUnhealthy >= 1, true);
    assert.ok(asOwner.attention.some((a) => a.type === 'BOOKING_SOON' && a.entityId === soonBooking));
    assert.ok(asOwner.knowledgeHealth !== null);
    assert.equal(Object.keys(asOwner.sectionErrors).length, 0);
    assert.ok(asOwner.summary.leadsNeedingQualification >= 1);
    assert.equal(asOwner.summary.myActiveConversations >= 0, true);
    // Owner own active: waitConv owned by member, not owner
    assert.equal(asOwner.summary.unassignedHandoffs >= 1, true);

    // No cross-tenant channel attention for other org's AUTH_FAILED
    assert.ok(!asOwner.channelHealth.some((ch) => ch.id === otherConn));

    const asMember = await dashboard.getDashboard(
      { userId: memberUser, authSubject: `p11-m-${memberUser}` },
      org,
    );
    assert.equal(asMember.knowledgeHealth, null);
    assert.ok(!('knowledgeHealth' in asMember.sectionErrors));
    assert.ok(asMember.attention.some((a) => a.type === 'HUMAN_CONVERSATION_WAITING'));
    assert.ok(asMember.summary.myActiveConversations >= 1);
    assert.ok(!asMember.attention.some((a) => a.type === 'KNOWLEDGE_PROCESSING_FAILED'));

    // Wrong tenant membership
    await assert.rejects(
      () =>
        dashboard.getDashboard(
          { userId: memberUser, authSubject: `p11-m-${memberUser}` },
          orgOther,
        ),
      (e: unknown) => e instanceof NotFoundException,
    );

    // Missing org
    await assert.rejects(
      () =>
        dashboard.getDashboard(
          { userId: ownerUser, authSubject: `p11-o-${ownerUser}` },
          randomUUID(),
        ),
      (e: unknown) => e instanceof NotFoundException,
    );
  } finally {
    try {
      await c.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    c.release();
    if (prisma) await prisma.onModuleDestroy();
  }
});
