import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import type { PoolClient } from 'pg';
import { createAppPool } from '../../src/database/pg-pool.js';
import {
  createToolExecutor,
  isoDayOfWeekInZone,
  localToUtcCandidates,
  occupiedRange,
  signSlotToken,
  toolGetAvailableSlots,
  toolCreateBooking,
  toolRescheduleBooking,
  verifySlotToken,
} from '@ai-sales-agent/agent-adapters';
import { P04_TOOL_NAMES, P07_TOOL_NAMES } from '@ai-sales-agent/contracts';
import type { RunStorePort } from '@ai-sales-agent/agent-core';

const runtimeUrl = process.env.DATABASE_URL;
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
assert.ok(runtimeUrl && migrationUrl, 'DATABASE_URL and MIGRATION_DATABASE_URL required');
assert.notEqual(runtimeUrl, migrationUrl);

process.env.NODE_ENV = 'test';
process.env.AI_ALLOW_FAKE = 'true';
process.env.BOOKING_SLOT_TOKEN_SECRET =
  process.env.BOOKING_SLOT_TOKEN_SECRET ?? 'test-booking-slot-token-secret';

const runtime = createAppPool(runtimeUrl, { max: 8 });
const owner = createAppPool(migrationUrl, { max: 1 });

function digest(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

async function context(c: PoolClient, org: string, user: string) {
  await c.query('BEGIN');
  await c.query(`SELECT set_config('app.current_user_id',$1,true)`, [user]);
  await c.query(`SELECT set_config('app.current_organization_id',$1,true)`, [org]);
}

function fakeStore(): RunStorePort {
  const ops = new Map<string, { id: string; resultJson?: unknown }>();
  return {
    async claimCommand(input) {
      const existing = ops.get(input.operationKey);
      if (existing?.resultJson) {
        return {
          operationId: existing.id,
          alreadySucceeded: true,
          resultJson: existing.resultJson,
        };
      }
      const id = randomUUID();
      ops.set(input.operationKey, { id });
      return { operationId: id, alreadySucceeded: false };
    },
  } as unknown as RunStorePort;
}

/** Next local weekday (ISO DOW) at least `minDays` ahead in zone. */
function nextLocalDate(zone: string, isoDow: number, minDays = 3): string {
  const now = new Date();
  for (let i = minDays; i < minDays + 21; i++) {
    const probe = new Date(now.getTime() + i * 86_400_000);
    // Use noon UTC then format in zone via localToUtcCandidates reverse: pick calendar date in zone
    const ymd = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(probe);
    const noon = localToUtcCandidates(ymd, '12:00:00', zone)[0];
    if (noon && isoDayOfWeekInZone(noon, zone) === isoDow) return ymd;
  }
  throw new Error('no_future_dow');
}

test('Phase 07 bookings: RLS, GiST, confirmation, DST, buffers, tools, concurrency', async () => {
  for (const name of P07_TOOL_NAMES) {
    assert.equal((P04_TOOL_NAMES as readonly string[]).includes(name), false);
  }

  // Schema + FORCE RLS + btree_gist
  const ext = await owner.query(
    `SELECT extname, extversion FROM pg_extension WHERE extname='btree_gist'`,
  );
  assert.equal(ext.rowCount, 1);

  const tables = await owner.query(
    `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
     FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public'
       AND c.relname IN (
         'bookings','booking_activities',
         'staff_availability_rules','staff_availability_exceptions'
       )
     ORDER BY 1`,
  );
  assert.equal(tables.rowCount, 4);
  for (const row of tables.rows) {
    assert.equal(row.relrowsecurity, true, row.relname);
    assert.equal(row.relforcerowsecurity, true, row.relname);
  }

  const grants = await owner.query(
    `SELECT privilege_type FROM information_schema.role_table_grants
     WHERE grantee='app_runtime' AND table_name='booking_activities'
     ORDER BY 1`,
  );
  const privs = grants.rows.map((r: { privilege_type: string }) => r.privilege_type);
  assert.ok(privs.includes('SELECT'));
  assert.ok(privs.includes('INSERT'));
  assert.ok(!privs.includes('UPDATE'));
  assert.ok(!privs.includes('DELETE'));

  const excl = await owner.query(
    `SELECT conname FROM pg_constraint
     WHERE conname IN ('bookings_staff_occupied_excl','bookings_customer_occupied_excl')
     ORDER BY 1`,
  );
  assert.equal(excl.rowCount, 2);

  const user = randomUUID();
  const org = randomUUID();
  const orgOther = randomUUID();
  await owner.query(`INSERT INTO users(id,auth_subject) VALUES($1,$2)`, [user, `p07-${user}`]);
  await owner.query(`INSERT INTO organizations(id,name) VALUES($1,'P07 Org')`, [org]);
  await owner.query(`INSERT INTO organizations(id,name) VALUES($1,'P07 Other')`, [orgOther]);
  await owner.query(
    `INSERT INTO organization_members(organization_id,user_id,role,status) VALUES($1,$2,'OWNER','ACTIVE')`,
    [org, user],
  );
  await owner.query(
    `INSERT INTO organization_members(organization_id,user_id,role,status) VALUES($1,$2,'OWNER','ACTIVE')`,
    [orgOther, user],
  );

  const zone = 'America/New_York';
  const bookDate = nextLocalDate(zone, 1, 5); // Monday
  let c = await runtime.connect();
  let customerId = '';
  let customerB = '';
  let locId = '';
  let serviceId = '';
  let staffId = '';
  let staffB = '';
  let conversationId = '';
  let connId = '';
  let confirmMsgId = '';
  let inquiryMsgId = '';
  let agentRunId = '';
  let leadId = '';
  try {
    await context(c, org, user);
    locId = randomUUID();
    await c.query(
      `INSERT INTO locations(id,organization_id,name,timezone,active) VALUES($1,$2,'NYC',$3,true)`,
      [locId, org, zone],
    );
    serviceId = randomUUID();
    await c.query(
      `INSERT INTO services(
         id,organization_id,location_id,name,duration_minutes,
         buffer_before_minutes,buffer_after_minutes,
         amount_minor,currency,pricing_version,active,
         booking_enabled,minimum_lead_minutes,maximum_advance_days
       ) VALUES($1,$2,$3,'Consult',30,0,15,10000,'USD',1,true,true,0,60)`,
      [serviceId, org, locId],
    );
    staffId = randomUUID();
    staffB = randomUUID();
    await c.query(
      `INSERT INTO staff_members(id,organization_id,location_id,display_name,active)
       VALUES($1,$2,$3,'Dr A',true),($4,$2,$3,'Dr B',true)`,
      [staffId, org, locId, staffB],
    );
    await c.query(
      `INSERT INTO service_staff(organization_id,service_id,staff_id) VALUES($1,$2,$3),($1,$2,$4)`,
      [org, serviceId, staffId, staffB],
    );
    // Mon–Fri 09:00–17:00
    for (const dow of [1, 2, 3, 4, 5]) {
      await c.query(
        `INSERT INTO staff_availability_rules(
           organization_id,staff_member_id,location_id,day_of_week,local_start_time,local_end_time
         ) VALUES($1,$2,$3,$4,'09:00','17:00')`,
        [org, staffId, locId, dow],
      );
      await c.query(
        `INSERT INTO staff_availability_rules(
           organization_id,staff_member_id,location_id,day_of_week,local_start_time,local_end_time
         ) VALUES($1,$2,$3,$4,'09:00','17:00')`,
        [org, staffB, locId, dow],
      );
    }

    customerId = randomUUID();
    customerB = randomUUID();
    await c.query(`INSERT INTO customers(id,organization_id,display_name) VALUES($1,$2,'A'),($3,$2,'B')`, [
      customerId,
      org,
      customerB,
    ]);
    connId = randomUUID();
    await c.query(
      `INSERT INTO channel_connections(id,organization_id,provider,external_channel_id,status)
       VALUES($1,$2,'whatsapp',$3,'ACTIVE')`,
      [connId, org, `fixture:${org}:wa`],
    );
    const identityId = randomUUID();
    await c.query(
      `INSERT INTO customer_identities(id,organization_id,customer_id,channel_connection_id,channel,external_address)
       VALUES($1,$2,$3,$4,'whatsapp','+12025550107')`,
      [identityId, org, customerId, connId],
    );
    conversationId = randomUUID();
    await c.query(
      `INSERT INTO conversations(
         id,organization_id,customer_id,channel_connection_id,identity_id,
         mode,ownership_epoch,next_sequence,processed_sequence,next_timeline_sequence,lease_fence,version,
         lease_owner, lease_expires_at
       ) VALUES($1,$2,$3,$4,$5,'AI_ACTIVE',0,3,0,3,0,1,$6,now()+interval '10 minutes')`,
      [conversationId, org, customerId, connId, identityId, 'worker-p07'],
    );
    inquiryMsgId = randomUUID();
    await c.query(
      `INSERT INTO messages(
         id,organization_id,conversation_id,channel_connection_id,direction,origin,
         provider_message_id,ingress_sequence,timeline_sequence,content_text,content_digest,delivery_state
       ) VALUES($1,$2,$3,$4,'INBOUND','CUSTOMER','p07-inq',1,1,$5,$6,'ACCEPTED')`,
      [
        inquiryMsgId,
        org,
        conversationId,
        connId,
        'What times are available?',
        digest('What times are available?'),
      ],
    );
    confirmMsgId = randomUUID();
    await c.query(
      `INSERT INTO messages(
         id,organization_id,conversation_id,channel_connection_id,direction,origin,
         provider_message_id,ingress_sequence,timeline_sequence,content_text,content_digest,delivery_state
       ) VALUES($1,$2,$3,$4,'INBOUND','CUSTOMER','p07-yes',2,2,$5,$6,'ACCEPTED')`,
      [confirmMsgId, org, conversationId, connId, 'yes book 10:00', digest('yes book 10:00')],
    );

    const cfgId = randomUUID();
    await c.query(
      `INSERT INTO agent_configs(id,organization_id,version,status,prompt_version,model_profile,tool_allowlist,budgets_json)
       VALUES($1,$2,1,'ACTIVE','p07','fake',$3::jsonb,'{}'::jsonb)`,
      [cfgId, org, JSON.stringify([...P04_TOOL_NAMES, ...P07_TOOL_NAMES])],
    );
    agentRunId = randomUUID();
    await c.query(
      `INSERT INTO agent_runs(
         id,organization_id,conversation_id,run_key,target_ingress_sequence,
         ownership_epoch,lease_fence,agent_config_id,prompt_version,model_profile,status
       ) VALUES($1,$2,$3,'p07-run',2,0,0,$4,'p07','fake','RUNNING')`,
      [agentRunId, org, conversationId, cfgId],
    );

    leadId = randomUUID();
    await c.query(
      `INSERT INTO leads(id,organization_id,customer_id,status,primary_service_id)
       VALUES($1,$2,$3,'QUALIFIED',$4)`,
      [leadId, org, customerId, serviceId],
    );

    // Buffer end-of-day: 16:30 appointment with bufferAfter 15 is NOT available
    const slotsProbe = await toolGetAvailableSlots(c, org, customerId, {
      serviceId,
      startDate: bookDate,
      staffMemberId: staffId,
      limit: 20,
    });
    assert.equal(slotsProbe.ok, true);
    const slots = (
      slotsProbe.data as { slots: Array<{ localStartsAt: string; startsAt: string }> }
    ).slots;
    assert.ok(slots.length > 0, 'expected slots');
    assert.ok(
      !slots.some((s) => s.localStartsAt.includes('T16:30')),
      '16:30 must be excluded when bufferAfter pushes occupied past 17:00',
    );
    assert.ok(slots.some((s) => s.localStartsAt.includes('T10:00')));

    // DST dual candidates appear as distinct tokens for ambiguous local times (unit-covered);
    // spring-forward nonexistent yields zero candidates (unit-covered).

    await c.query('COMMIT');
  } finally {
    c.release();
  }

  // Tenant isolation: bare select empty
  {
    const bare = await runtime.connect();
    try {
      const n = await bare.query(`SELECT count(*)::int AS n FROM bookings`);
      assert.equal(n.rows[0].n, 0);
    } finally {
      bare.release();
    }
  }

  const secret = process.env.BOOKING_SLOT_TOKEN_SECRET!;
  const store = fakeStore();
  const tools = createToolExecutor(runtime, store, false);
  const baseCtx = {
    organizationId: org,
    conversationId,
    customerId,
    agentRunId,
    runKey: 'p07-rk',
    toolCallOrdinal: 1,
    ownershipEpoch: 0,
    leaseOwner: 'worker-p07',
    leaseFence: 0,
    targetIngressSequence: 2,
    sandbox: false,
  };

  // getAvailableSlots via executor
  const avail = await tools.execute(
    'getAvailableSlots',
    { serviceId, startDate: bookDate, staffMemberId: staffId, limit: 5 },
    { ...baseCtx, runKey: 'p07-avail' },
  );
  assert.equal(avail.ok, true, JSON.stringify(avail));
  const slotList = (
    avail.data as { slots: Array<{ slotToken: string; localStartsAt: string }> }
  ).slots;
  assert.ok(slotList.length >= 1);
  const ten = slotList.find((s) => s.localStartsAt.includes('T10:00'));
  assert.ok(ten, 'need 10:00 slot');
  const slotToken = ten!.slotToken
  const verified = verifySlotToken(slotToken, secret, { organizationId: org, customerId });
  assert.equal(verified.ok, true);

  // Confirmation negative: inquiry message cannot book even with valid token
  {
    const tc = await runtime.connect();
    try {
      await context(tc, org, user);
      const bad = await toolCreateBooking(
        tc,
        org,
        customerId,
        { slotToken, confirmationMessageId: inquiryMsgId, leadId },
        {
          conversationId,
          agentRunId,
          targetIngressSequence: 1,
        },
      );
      assert.equal(bad.ok, false);
      assert.equal(bad.code, 'CONFIRMATION_REQUIRED');
      await tc.query('COMMIT');
    } finally {
      tc.release();
    }
  }

  // Successful create with proven confirmation
  const created = await tools.execute(
    'createBooking',
    { slotToken, confirmationMessageId: confirmMsgId, leadId },
    { ...baseCtx, runKey: 'p07-create', toolCallOrdinal: 1 },
  );
  assert.equal(created.ok, true, JSON.stringify(created));
  const bookingId = (created.data as { bookingId: string }).bookingId;
  assert.ok(bookingId);

  // Lead activity BOOKING_CONFIRMED (no BOOKED status)
  {
    const tc = await runtime.connect();
    try {
      await context(tc, org, user);
      const lead = await tc.query(`SELECT status FROM leads WHERE id=$1`, [leadId]);
      assert.equal(lead.rows[0].status, 'QUALIFIED');
      const acts = await tc.query(
        `SELECT type FROM lead_activities WHERE lead_id=$1 AND type='BOOKING_CONFIRMED'`,
        [leadId],
      );
      assert.equal(acts.rowCount, 1);
      await tc.query('COMMIT');
    } finally {
      tc.release();
    }
  }

  // Staff double-book + customer overlap via GiST
  {
    const tc = await runtime.connect();
    try {
      await context(tc, org, user);
      const again = await toolCreateBooking(
        tc,
        org,
        customerId,
        { slotToken, confirmationMessageId: confirmMsgId },
        { conversationId, agentRunId, targetIngressSequence: 2 },
      );
      assert.equal(again.ok, false);
      assert.equal(again.code, 'SLOT_UNAVAILABLE');

      // Different customer, same staff+slot → staff EXCLUDE
      const startsAt = (verified as { ok: true; payload: { startsAt: string } }).payload.startsAt;
      const endsAt = (verified as { ok: true; payload: { endsAt: string } }).payload.endsAt;
      const occ = occupiedRange(new Date(startsAt), 30, 0, 15);
      await tc.query('SAVEPOINT staff_excl');
      await assert.rejects(
        () =>
          tc.query(
            `INSERT INTO bookings(
               id,organization_id,customer_id,service_id,location_id,staff_member_id,
               starts_at,ends_at,occupied_starts_at,occupied_ends_at,timezone,
               duration_minutes,buffer_before_minutes,buffer_after_minutes,status,created_by_type
             ) VALUES(
               $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,30,0,15,'CONFIRMED','USER'
             )`,
            [
              randomUUID(),
              org,
              customerB,
              serviceId,
              locId,
              staffId,
              startsAt,
              endsAt,
              occ.occupiedStartsAt.toISOString(),
              occ.occupiedEndsAt.toISOString(),
              zone,
            ],
          ),
        /exclusion|conflict|23P01/i,
      );
      await tc.query('ROLLBACK TO SAVEPOINT staff_excl');

      // Same customer overlapping different staff → customer EXCLUDE
      const overlapStart = localToUtcCandidates(bookDate, '10:15:00', zone)[0]!;
      const occ2 = occupiedRange(overlapStart, 30, 0, 15);
      await tc.query('SAVEPOINT cust_excl');
      await assert.rejects(
        () =>
          tc.query(
            `INSERT INTO bookings(
               id,organization_id,customer_id,service_id,location_id,staff_member_id,
               starts_at,ends_at,occupied_starts_at,occupied_ends_at,timezone,
               duration_minutes,buffer_before_minutes,buffer_after_minutes,status,created_by_type
             ) VALUES(
               $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,30,0,15,'CONFIRMED','USER'
             )`,
            [
              randomUUID(),
              org,
              customerId,
              serviceId,
              locId,
              staffB,
              overlapStart.toISOString(),
              occ2.endsAt.toISOString(),
              occ2.occupiedStartsAt.toISOString(),
              occ2.occupiedEndsAt.toISOString(),
              zone,
            ],
          ),
        /exclusion|conflict|23P01/i,
      );
      await tc.query('ROLLBACK TO SAVEPOINT cust_excl');
      await tc.query('COMMIT');
    } finally {
      tc.release();
    }
  }

  // Concurrent double-create: only one succeeds
  {
    const startsAt = (verified as { ok: true; payload: { startsAt: string } }).payload.startsAt;
    const endsAt = (verified as { ok: true; payload: { endsAt: string } }).payload.endsAt;
    // Cancel current booking first so slot is free, then race two inserts for customerB
    const prep = await runtime.connect();
    try {
      await context(prep, org, user);
      await prep.query(
        `UPDATE bookings SET status='CANCELLED', version=version+1 WHERE id=$1`,
        [bookingId],
      );
      await prep.query('COMMIT');
    } finally {
      prep.release();
    }

    const tokenA = signSlotToken(
      {
        organizationId: org,
        customerId: customerB,
        serviceId,
        locationId: locId,
        staffMemberId: staffId,
        startsAt,
        endsAt,
      },
      secret,
    );
    const tokenB = signSlotToken(
      {
        organizationId: org,
        customerId: customerB,
        serviceId,
        locationId: locId,
        staffMemberId: staffId,
        startsAt,
        endsAt,
      },
      secret,
    );
    // Need conversation/customerB setup for tools — use raw insert race instead
    const occ = occupiedRange(new Date(startsAt), 30, 0, 15);
    async function tryInsert(id: string) {
      const x = await runtime.connect();
      try {
        await context(x, org, user);
        try {
          await x.query(
            `INSERT INTO bookings(
               id,organization_id,customer_id,service_id,location_id,staff_member_id,
               starts_at,ends_at,occupied_starts_at,occupied_ends_at,timezone,
               duration_minutes,buffer_before_minutes,buffer_after_minutes,status,created_by_type
             ) VALUES(
               $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,30,0,15,'CONFIRMED','USER'
             )`,
            [
              id,
              org,
              customerB,
              serviceId,
              locId,
              staffId,
              startsAt,
              endsAt,
              occ.occupiedStartsAt.toISOString(),
              occ.occupiedEndsAt.toISOString(),
              zone,
            ],
          );
          await x.query('COMMIT');
          return true;
        } catch {
          await x.query('ROLLBACK');
          return false;
        }
      } finally {
        x.release();
      }
    }
    const id1 = randomUUID();
    const id2 = randomUUID();
    const [a, b] = await Promise.all([tryInsert(id1), tryInsert(id2)]);
    assert.equal(Number(a) + Number(b), 1, `expected exactly one winner got a=${a} b=${b}`);
    void tokenA;
    void tokenB;
  }

  // Reschedule self-conflict: same interval + overlapping own + into another booking
  {
    const tc = await runtime.connect();
    try {
      await context(tc, org, user);
      // Restore customer A booking at 14:00
      const start14 = localToUtcCandidates(bookDate, '14:00:00', zone)[0]!;
      const occ14 = occupiedRange(start14, 30, 0, 15);
      const bookingA = randomUUID();
      await tc.query(
        `INSERT INTO bookings(
           id,organization_id,customer_id,service_id,location_id,staff_member_id,
           starts_at,ends_at,occupied_starts_at,occupied_ends_at,timezone,
           duration_minutes,buffer_before_minutes,buffer_after_minutes,status,created_by_type,version
         ) VALUES(
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,30,0,15,'CONFIRMED','USER',1
         )`,
        [
          bookingA,
          org,
          customerId,
          serviceId,
          locId,
          staffId,
          start14.toISOString(),
          occ14.endsAt.toISOString(),
          occ14.occupiedStartsAt.toISOString(),
          occ14.occupiedEndsAt.toISOString(),
          zone,
        ],
      );

      // Same interval reschedule → success
      const sameTok = signSlotToken(
        {
          organizationId: org,
          customerId,
          serviceId,
          locationId: locId,
          staffMemberId: staffId,
          startsAt: start14.toISOString(),
          endsAt: occ14.endsAt.toISOString(),
        },
        secret,
      );
      const same = await toolRescheduleBooking(
        tc,
        org,
        customerId,
        { bookingId: bookingA, expectedVersion: 1, slotToken: sameTok },
        { agentRunId },
      );
      assert.equal(same.ok, true, JSON.stringify(same));
      const v2 = Number((same.data as { version: number }).version);

      // Overlapping own old interval (14:15) → success
      const start1415 = localToUtcCandidates(bookDate, '14:15:00', zone)[0]!;
      const occ1415 = occupiedRange(start1415, 30, 0, 15);
      const overlapOwnTok = signSlotToken(
        {
          organizationId: org,
          customerId,
          serviceId,
          locationId: locId,
          staffMemberId: staffId,
          startsAt: start1415.toISOString(),
          endsAt: occ1415.endsAt.toISOString(),
        },
        secret,
      );
      const own = await toolRescheduleBooking(
        tc,
        org,
        customerId,
        { bookingId: bookingA, expectedVersion: v2, slotToken: overlapOwnTok },
        { agentRunId },
      );
      assert.equal(own.ok, true, JSON.stringify(own));
      const v3 = Number((own.data as { version: number }).version);
      const afterOwn = await tc.query(`SELECT starts_at FROM bookings WHERE id=$1`, [bookingA]);
      assert.equal(new Date(afterOwn.rows[0].starts_at).toISOString(), start1415.toISOString());

      // Into another booking (customerB holds 10:00 on staffId) → SLOT_UNAVAILABLE, original unchanged
      const held = await tc.query(
        `SELECT starts_at, ends_at FROM bookings WHERE customer_id=$1 AND status='CONFIRMED' LIMIT 1`,
        [customerB],
      );
      assert.ok(held.rows[0]);
      const conflictTok = signSlotToken(
        {
          organizationId: org,
          customerId,
          serviceId,
          locationId: locId,
          staffMemberId: staffId,
          startsAt: new Date(held.rows[0].starts_at).toISOString(),
          endsAt: new Date(held.rows[0].ends_at).toISOString(),
        },
        secret,
      );
      const conflict = await toolRescheduleBooking(
        tc,
        org,
        customerId,
        { bookingId: bookingA, expectedVersion: v3, slotToken: conflictTok },
        { agentRunId },
      );
      assert.equal(conflict.ok, false);
      assert.equal(conflict.code, 'SLOT_UNAVAILABLE');
      const still = await tc.query(`SELECT starts_at, version, status FROM bookings WHERE id=$1`, [
        bookingA,
      ]);
      assert.equal(still.rows[0].status, 'CONFIRMED');
      assert.equal(Number(still.rows[0].version), v3);
      assert.equal(new Date(still.rows[0].starts_at).toISOString(), start1415.toISOString());

      await tc.query('COMMIT');
    } finally {
      tc.release();
    }
  }

  // Stale token: duration change → SLOT_UNAVAILABLE
  {
    const tc = await runtime.connect();
    try {
      await context(tc, org, user);
      const start15 = localToUtcCandidates(bookDate, '15:00:00', zone)[0]!;
      const ends30 = new Date(start15.getTime() + 30 * 60_000);
      const staleTok = signSlotToken(
        {
          organizationId: org,
          customerId,
          serviceId,
          locationId: locId,
          staffMemberId: staffB,
          startsAt: start15.toISOString(),
          endsAt: ends30.toISOString(),
        },
        secret,
      );
      await tc.query(
        `UPDATE services SET duration_minutes=45, version=version+1 WHERE id=$1`,
        [serviceId],
      );
      const stale = await toolCreateBooking(
        tc,
        org,
        customerId,
        { slotToken: staleTok, confirmationMessageId: confirmMsgId },
        { conversationId, agentRunId, targetIngressSequence: 2 },
      );
      assert.equal(stale.ok, false);
      assert.equal(stale.code, 'SLOT_UNAVAILABLE');
      await tc.query(`UPDATE services SET duration_minutes=30 WHERE id=$1`, [serviceId]);
      await tc.query('COMMIT');
    } finally {
      tc.release();
    }
  }

  // Cancel via tool
  {
    const list = await tools.execute('getBookings', {}, { ...baseCtx, runKey: 'p07-list' });
    assert.equal(list.ok, true);
    const bookings = (list.data as { bookings: Array<{ id: string; version: number; status: string }> })
      .bookings;
    const active = bookings.find((b) => b.status === 'CONFIRMED');
    assert.ok(active);
    const cancelled = await tools.execute(
      'cancelBooking',
      { bookingId: active!.id, expectedVersion: active!.version, reasonCode: 'CUSTOMER_REQUEST' },
      { ...baseCtx, runKey: 'p07-cancel', toolCallOrdinal: 2 },
    );
    assert.equal(cancelled.ok, true, JSON.stringify(cancelled));
  }

  // Cross-tenant isolation
  {
    const tc = await runtime.connect();
    try {
      await context(tc, orgOther, user);
      const n = await tc.query(`SELECT count(*)::int AS n FROM bookings`);
      assert.equal(n.rows[0].n, 0);
      await tc.query('COMMIT');
    } finally {
      tc.release();
    }
  }

  await runtime.end();
  await owner.end();
});
