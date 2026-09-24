/**
 * demo:seed — create deterministic local demo dataset (DB only).
 * Does not call the Nest API. Does not print credentials.
 */
import { createHash, randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../../prisma/generated/client/client.ts';
import { requireLocalDemoDb } from './assert-local-demo-db.ts';
import { digestText, nextValidAvailabilitySlots } from './availability-slots.ts';
import {
  DEMO_CHANNEL_ID,
  DEMO_CUSTOMER_COUNT,
  DEMO_LOCATION_ID,
  DEMO_OPERATOR_USER_ID,
  DEMO_ORG_ID,
  DEMO_ORG_NAME,
  DEMO_ORG_SLUG,
  DEMO_SERVICE_IDS,
  DEMO_STAFF_IDS,
  DEMO_TIMEZONE,
  DEMO_TOOL_ALLOWLIST,
  demoCustomerPhone,
} from './constants.ts';
import { loadDemoCliEnv } from './load-demo-cli-env.ts';
import { assertOrgIdentity } from './residual.ts';
import { normalizeContact } from '../../apps/api/src/domain/value-objects.ts';

type Section = { section: string; result: 'PASS' | 'FAIL' | 'PARTIAL' | 'SKIPPED'; detail?: string };

function timeDate(hhmmss: string): Date {
  return new Date(`1970-01-01T${hhmmss.length === 5 ? `${hhmmss}:00` : hhmmss}.000Z`);
}

async function resolveOperatorAuthSubject(): Promise<string | null> {
  if (process.env.DEMO_OPERATOR_AUTH_SUBJECT?.trim()) {
    return process.env.DEMO_OPERATOR_AUTH_SUBJECT.trim();
  }
  const url = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
  const email = (process.env.SUPABASE_TEST_EMAIL ?? '').trim();
  const password = process.env.SUPABASE_TEST_PASSWORD ?? '';
  if (!url || !key || !email || !password) return null;
  try {
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    const body = (await res.json()) as { user?: { id?: string } };
    return body.user?.id ?? null;
  } catch {
    return null;
  }
}

async function main() {
  loadDemoCliEnv();
  requireLocalDemoDb();
  console.log(JSON.stringify({ DEMO_ORG: DEMO_ORG_SLUG }));

  const sections: Section[] = [];
  const record = (s: Section) => {
    sections.push(s);
    console.log(JSON.stringify(s));
  };

  const pool = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const identity = await assertOrgIdentity(pool, DEMO_ORG_ID, DEMO_ORG_NAME);
    if (identity === 'collision') {
      throw new Error('DEMO_ORG_UUID_collision_name_mismatch');
    }

    // ——— Operator ———
    const authSubject = await resolveOperatorAuthSubject();
    let operatorId: string | null = null;
    if (!authSubject) {
      record({ section: 'OPERATOR', result: 'FAIL', detail: 'auth_subject_unresolved' });
      throw new Error('operator_auth_subject_unresolved');
    } else {
      const existingBySubject = await prisma.user.findUnique({ where: { authSubject } });
      if (existingBySubject) {
        operatorId = existingBySubject.id;
        await prisma.user.update({
          where: { id: operatorId },
          data: { displayName: existingBySubject.displayName ?? 'Demo Operator' },
        });
        record({
          section: 'OPERATOR',
          result: 'PASS',
          detail: `reused_auth_user:${operatorId.slice(0, 8)}`,
        });
      } else {
        await prisma.user.upsert({
          where: { id: DEMO_OPERATOR_USER_ID },
          update: { authSubject, displayName: 'Demo Operator' },
          create: {
            id: DEMO_OPERATOR_USER_ID,
            authSubject,
            displayName: 'Demo Operator',
          },
        });
        operatorId = DEMO_OPERATOR_USER_ID;
        record({ section: 'OPERATOR', result: 'PASS' });
      }
    }
    if (!operatorId) throw new Error('operator_user_missing');

    // ——— Organization ———
    await prisma.organization.upsert({
      where: { id: DEMO_ORG_ID },
      update: { name: DEMO_ORG_NAME },
      create: { id: DEMO_ORG_ID, name: DEMO_ORG_NAME },
    });
    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: { organizationId: DEMO_ORG_ID, userId: operatorId },
      },
      update: { role: 'OWNER', status: 'ACTIVE' },
      create: {
        organizationId: DEMO_ORG_ID,
        userId: operatorId,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    record({ section: 'ORGANIZATION', result: 'PASS' });
    console.log(JSON.stringify({ DEMO_OPERATOR: 'READY' }));

    // ——— Catalog ———
    await prisma.location.upsert({
      where: { organizationId_id: { organizationId: DEMO_ORG_ID, id: DEMO_LOCATION_ID } },
      update: {
        name: 'Main Test Clinic',
        timezone: DEMO_TIMEZONE,
        address: 'Synthetic Demo Address — Not a real clinic',
        active: true,
        archivedAt: null,
      },
      create: {
        id: DEMO_LOCATION_ID,
        organizationId: DEMO_ORG_ID,
        name: 'Main Test Clinic',
        timezone: DEMO_TIMEZONE,
        address: 'Synthetic Demo Address — Not a real clinic',
      },
    });

    const services = [
      {
        id: DEMO_SERVICE_IDS.consultation,
        name: 'Dental Consultation (Demo Synthetic)',
        durationMinutes: 30,
        amountMinor: 50000n,
      },
      {
        id: DEMO_SERVICE_IDS.cleaning,
        name: 'Teeth Cleaning (Demo Synthetic)',
        durationMinutes: 45,
        amountMinor: 75000n,
      },
      {
        id: DEMO_SERVICE_IDS.checkup,
        name: 'Dental Check-up (Demo Synthetic)',
        durationMinutes: 20,
        amountMinor: 35000n,
      },
    ];
    for (const s of services) {
      await prisma.service.upsert({
        where: { organizationId_id: { organizationId: DEMO_ORG_ID, id: s.id } },
        update: {
          name: s.name,
          durationMinutes: s.durationMinutes,
          amountMinor: s.amountMinor,
          currency: 'IQD',
          bookingEnabled: true,
          minimumLeadMinutes: 60,
          active: true,
          archivedAt: null,
        },
        create: {
          id: s.id,
          organizationId: DEMO_ORG_ID,
          locationId: DEMO_LOCATION_ID,
          name: s.name,
          durationMinutes: s.durationMinutes,
          amountMinor: s.amountMinor,
          currency: 'IQD',
          bookingEnabled: true,
          minimumLeadMinutes: 60,
        },
      });
    }

    for (const [key, id] of Object.entries(DEMO_STAFF_IDS)) {
      await prisma.staffMember.upsert({
        where: { organizationId_id: { organizationId: DEMO_ORG_ID, id } },
        update: {
          displayName: key === 'one' ? 'Dr Demo One' : 'Dr Demo Two',
          active: true,
          archivedAt: null,
        },
        create: {
          id,
          organizationId: DEMO_ORG_ID,
          locationId: DEMO_LOCATION_ID,
          displayName: key === 'one' ? 'Dr Demo One' : 'Dr Demo Two',
        },
      });
    }

    for (const serviceId of Object.values(DEMO_SERVICE_IDS)) {
      for (const staffId of Object.values(DEMO_STAFF_IDS)) {
        await prisma.serviceStaff.upsert({
          where: {
            organizationId_serviceId_staffId: {
              organizationId: DEMO_ORG_ID,
              serviceId,
              staffId,
            },
          },
          update: {},
          create: { organizationId: DEMO_ORG_ID, serviceId, staffId },
        });
      }
    }

    // Sun–Thu ISO DOW
    await prisma.staffAvailabilityRule.deleteMany({
      where: { organizationId: DEMO_ORG_ID },
    });
    const ruleRows = [];
    for (const staffId of Object.values(DEMO_STAFF_IDS)) {
      for (const dow of [7, 1, 2, 3, 4]) {
        ruleRows.push({
          id: randomUUID(),
          organizationId: DEMO_ORG_ID,
          staffMemberId: staffId,
          locationId: DEMO_LOCATION_ID,
          dayOfWeek: dow,
          localStartTime: timeDate('09:00:00'),
          localEndTime: timeDate('17:00:00'),
          isActive: true,
        });
      }
    }
    await prisma.staffAvailabilityRule.createMany({ data: ruleRows });
    record({ section: 'CATALOG', result: 'PASS' });
    record({ section: 'STAFF_AVAILABILITY', result: 'PASS' });

    // ——— Channel ———
    await prisma.channelConnection.upsert({
      where: { id: DEMO_CHANNEL_ID },
      update: {
        organizationId: DEMO_ORG_ID,
        provider: 'whatsapp',
        externalChannelId: `fixture:${DEMO_ORG_ID}:whatsapp`,
        status: 'ACTIVE',
        healthStatus: 'ACTIVE',
        displayPhoneNumber: '+15555550000',
        credentialRef: null,
      },
      create: {
        id: DEMO_CHANNEL_ID,
        organizationId: DEMO_ORG_ID,
        provider: 'whatsapp',
        externalChannelId: `fixture:${DEMO_ORG_ID}:whatsapp`,
        status: 'ACTIVE',
        healthStatus: 'ACTIVE',
        displayPhoneNumber: '+15555550000',
      },
    });
    record({ section: 'CHANNEL', result: 'PASS' });

    // ——— Customers ———
    const customerIds: string[] = [];
    const identityIds: string[] = [];
    for (let i = 1; i <= DEMO_CUSTOMER_COUNT; i++) {
      const customerId = `a070000${i}-000${i}-400${i}-800${i}-00000000000${i}`;
      // fix uuid format - need proper hex
      const cid = `a070000${i}-0001-4001-8001-${String(i).padStart(12, '0')}`;
      const iid = `a071000${i}-0001-4001-8001-${String(i).padStart(12, '0')}`;
      const phone = normalizeContact('whatsapp', demoCustomerPhone(i)).externalAddress;
      await prisma.customer.upsert({
        where: { organizationId_id: { organizationId: DEMO_ORG_ID, id: cid } },
        update: { displayName: `Demo Customer ${String(i).padStart(2, '0')}`, archivedAt: null },
        create: {
          id: cid,
          organizationId: DEMO_ORG_ID,
          displayName: `Demo Customer ${String(i).padStart(2, '0')}`,
        },
      });
      await prisma.customerIdentity.upsert({
        where: { organizationId_id: { organizationId: DEMO_ORG_ID, id: iid } },
        update: { externalAddress: phone, channel: 'whatsapp', revokedAt: null },
        create: {
          id: iid,
          organizationId: DEMO_ORG_ID,
          customerId: cid,
          channelConnectionId: DEMO_CHANNEL_ID,
          channel: 'whatsapp',
          externalAddress: phone,
        },
      });
      customerIds.push(cid);
      identityIds.push(iid);
    }
    record({ section: 'CUSTOMERS', result: 'PASS', detail: `count=${customerIds.length}` });

    // ——— Conversations + messages (+ analytics chain on first) ———
    const convSpecs: Array<{
      id: string;
      customerIdx: number;
      mode: string;
      owner?: boolean;
      pauseReason?: string;
      label: string;
    }> = [
      {
        id: 'a0800001-0001-4001-8001-000000000001',
        customerIdx: 0,
        mode: 'AI_ACTIVE',
        label: 'A',
      },
      {
        id: 'a0800002-0002-4002-8002-000000000002',
        customerIdx: 1,
        mode: 'AI_PAUSED',
        pauseReason: 'CUSTOMER_REQUESTED_HUMAN',
        label: 'B',
      },
      {
        id: 'a0800003-0003-4003-8003-000000000003',
        customerIdx: 2,
        mode: 'AI_PAUSED',
        owner: true,
        pauseReason: 'OPERATOR_MANUAL_TAKEOVER',
        label: 'C',
      },
      {
        id: 'a0800004-0004-4004-8004-000000000004',
        customerIdx: 3,
        mode: 'AI_ACTIVE',
        label: 'D',
      },
      {
        id: 'a0800005-0005-4005-8005-000000000005',
        customerIdx: 4,
        mode: 'AI_ACTIVE',
        label: 'E',
      },
    ];

    const agentConfigId = 'a0900001-0001-4001-8001-000000000001';
    // FK-safe wipe before recreating config + conversations
    await prisma.followUp.deleteMany({ where: { organizationId: DEMO_ORG_ID } });
    await prisma.bookingActivity.deleteMany({ where: { organizationId: DEMO_ORG_ID } });
    await prisma.booking.deleteMany({ where: { organizationId: DEMO_ORG_ID } });
    await prisma.leadActivity.deleteMany({ where: { organizationId: DEMO_ORG_ID } });
    await prisma.lead.updateMany({
      where: { organizationId: DEMO_ORG_ID },
      data: { sourceConversationId: null, sourceMessageId: null },
    });
    await prisma.toolCall.deleteMany({ where: { organizationId: DEMO_ORG_ID } });
    await prisma.usageEvent.deleteMany({ where: { organizationId: DEMO_ORG_ID } });
    await prisma.agentRun.deleteMany({ where: { organizationId: DEMO_ORG_ID } });
    await prisma.message.deleteMany({ where: { organizationId: DEMO_ORG_ID } });
    await prisma.conversation.deleteMany({ where: { organizationId: DEMO_ORG_ID } });
    await prisma.agentConfig.deleteMany({ where: { organizationId: DEMO_ORG_ID } });
    await prisma.agentConfig.create({
      data: {
        id: agentConfigId,
        organizationId: DEMO_ORG_ID,
        version: 1,
        status: 'ACTIVE',
        promptVersion: 'demo-dataset-v1',
        modelProfile: 'fake-demo-script',
        toolAllowlist: [...DEMO_TOOL_ALLOWLIST],
        budgetsJson: { maxModelCalls: 8, maxToolCalls: 12 },
        activatedAt: new Date(),
      },
    });
    record({ section: 'AGENT_CONFIG', result: 'PASS' });

    let analyticsChain: 'PASS' | 'PARTIAL' = 'PARTIAL';
    for (const spec of convSpecs) {
      const customerId = customerIds[spec.customerIdx]!;
      const identityId = identityIds[spec.customerIdx]!;
      await prisma.conversation.create({
        data: {
          id: spec.id,
          organizationId: DEMO_ORG_ID,
          customerId,
          channelConnectionId: DEMO_CHANNEL_ID,
          identityId,
          mode: spec.mode,
          ownerMemberId: spec.owner ? operatorId : null,
          ownershipEpoch: spec.mode === 'AI_PAUSED' ? 1 : 0,
          pauseReasonCode: spec.pauseReason ?? null,
          pausedAt: spec.mode === 'AI_PAUSED' ? new Date() : null,
          nextSequence: 3,
          processedSequence: 2,
          nextTimelineSequence: 5,
          lastMessageAt: new Date(),
          lastCustomerInboundAt: new Date(),
        },
      });

      const texts: Array<{
        direction: string;
        origin: string;
        text: string;
        ingress?: number;
        timeline: number;
        delivery?: string;
      }> = [
        {
          direction: 'INBOUND',
          origin: 'CUSTOMER',
          text: 'Do you offer dental consultations?',
          ingress: 1,
          timeline: 1,
        },
        {
          direction: 'OUTBOUND',
          origin: 'AI',
          text: 'Yes, the clinic offers dental consultations. (Demo synthetic reply)',
          timeline: 2,
        },
      ];
      if (spec.label === 'C' || spec.label === 'E') {
        texts.push({
          direction: 'INBOUND',
          origin: 'CUSTOMER',
          text: 'I want an appointment.',
          ingress: 2,
          timeline: 3,
        });
        texts.push({
          direction: 'OUTBOUND',
          origin: 'OPERATOR',
          text: 'Sure, I can help with that. (Demo operator)',
          timeline: 4,
        });
      }
      if (spec.label === 'D') {
        texts.push({
          direction: 'OUTBOUND',
          origin: 'AI',
          text: 'Demo outbound that failed delivery.',
          timeline: 3,
          delivery: 'FAILED',
        });
      }

      const createdMessageIds: string[] = [];
      for (const m of texts) {
        const mid = randomUUID();
        createdMessageIds.push(mid);
        await prisma.message.create({
          data: {
            id: mid,
            organizationId: DEMO_ORG_ID,
            conversationId: spec.id,
            channelConnectionId: DEMO_CHANNEL_ID,
            direction: m.direction,
            origin: m.origin,
            providerMessageId:
              m.direction === 'INBOUND' ? `demo-in-${spec.label}-${m.timeline}` : null,
            ingressSequence: m.ingress ?? null,
            timelineSequence: m.timeline,
            contentType: 'text',
            contentText: m.text,
            contentDigest: digestText(m.text),
            deliveryState: m.delivery ?? 'ACCEPTED',
            authorityEpoch: m.direction === 'OUTBOUND' ? 0 : null,
          },
        });
      }

      // Chronological analytics chain on conversation A
      if (spec.label === 'A') {
        const runId = 'a0910001-0001-4001-8001-000000000001';
        await prisma.agentRun.deleteMany({ where: { organizationId: DEMO_ORG_ID, id: runId } });
        await prisma.toolCall.deleteMany({ where: { organizationId: DEMO_ORG_ID, agentRunId: runId } });
        await prisma.usageEvent.deleteMany({ where: { organizationId: DEMO_ORG_ID, agentRunId: runId } });
        await prisma.agentRun.create({
          data: {
            id: runId,
            organizationId: DEMO_ORG_ID,
            conversationId: spec.id,
            runKey: `demo-run-${spec.id}`,
            targetIngressSequence: 1,
            ownershipEpoch: 0,
            leaseFence: 0,
            agentConfigId,
            promptVersion: 'demo-dataset-v1',
            modelProfile: 'fake-demo-script',
            status: 'SUCCEEDED',
            terminalReason: 'final_response',
            modelCalls: 1,
            toolCalls: 1,
            finalOutboundMessageId: createdMessageIds[1] ?? null,
            finishedAt: new Date(),
          },
        });
        await prisma.toolCall.create({
          data: {
            id: randomUUID(),
            organizationId: DEMO_ORG_ID,
            agentRunId: runId,
            ordinal: 1,
            toolName: 'searchServices',
            toolVersion: '1',
            argsHash: createHash('sha256').update('demo').digest('hex').slice(0, 32),
            authzResult: 'ALLOW',
            resultCode: 'OK',
            durationMs: 12,
          },
        });
        await prisma.usageEvent.create({
          data: {
            id: randomUUID(),
            organizationId: DEMO_ORG_ID,
            agentRunId: runId,
            provider: 'fake',
            model: 'fake-demo-script',
            inputTokens: 20,
            outputTokens: 40,
            estimated: false,
            latencyMs: 15,
          },
        });
        analyticsChain = 'PASS';
      }
    }
    record({ section: 'CONVERSATIONS', result: 'PASS', detail: `count=${convSpecs.length}` });
    record({ section: 'ANALYTICS_FUEL', result: analyticsChain });

    // ——— Leads ———
    const leadStatuses = ['NEW', 'ENGAGED', 'QUALIFIED', 'NURTURE', 'DISQUALIFIED'] as const;
    for (let i = 0; i < leadStatuses.length; i++) {
      const leadId = `a0a0000${i + 1}-0001-4001-8001-${String(i + 1).padStart(12, '0')}`;
      const status = leadStatuses[i]!;
      await prisma.lead.upsert({
        where: { organizationId_id: { organizationId: DEMO_ORG_ID, id: leadId } },
        update: {
          status,
          primaryServiceId: DEMO_SERVICE_IDS.consultation,
          locationId: DEMO_LOCATION_ID,
          preferredContactChannel: 'whatsapp',
          language: 'en',
          needSummary: `Demo lead ${status}`,
          statusReasonCode: status === 'DISQUALIFIED' ? 'NOT_INTERESTED' : null,
        },
        create: {
          id: leadId,
          organizationId: DEMO_ORG_ID,
          customerId: customerIds[i]!,
          status,
          primaryServiceId: DEMO_SERVICE_IDS.consultation,
          locationId: DEMO_LOCATION_ID,
          preferredContactChannel: 'whatsapp',
          language: 'en',
          needSummary: `Demo lead ${status}`,
          sourceType: 'INBOUND_CONVERSATION',
          sourceConversationId: convSpecs[Math.min(i, convSpecs.length - 1)]!.id,
          statusReasonCode: status === 'DISQUALIFIED' ? 'NOT_INTERESTED' : null,
          statusChangedByType: 'USER',
          statusChangedById: operatorId,
        },
      });
      await prisma.leadActivity.deleteMany({ where: { organizationId: DEMO_ORG_ID, leadId } });
      await prisma.leadActivity.create({
        data: {
          id: randomUUID(),
          organizationId: DEMO_ORG_ID,
          leadId,
          type: 'LEAD_CREATED',
          actorType: 'USER',
          actorId: operatorId,
          metadataJson: { demo: true },
        },
      });
      if (status !== 'NEW') {
        await prisma.leadActivity.create({
          data: {
            id: randomUUID(),
            organizationId: DEMO_ORG_ID,
            leadId,
            type: 'STATUS_CHANGED',
            actorType: 'USER',
            actorId: operatorId,
            metadataJson: { to: status },
          },
        });
      }
    }
    record({ section: 'LEADS', result: 'PASS', detail: `count=${leadStatuses.length}` });

    // ——— Bookings from availability ———
    await prisma.bookingActivity.deleteMany({ where: { organizationId: DEMO_ORG_ID } });
    await prisma.booking.deleteMany({ where: { organizationId: DEMO_ORG_ID } });
    const slots = nextValidAvailabilitySlots({
      rules: [7, 1, 2, 3, 4].flatMap((dow) =>
        Object.values(DEMO_STAFF_IDS).map((staffMemberId) => ({
          staffMemberId,
          dayOfWeek: dow,
          localStartTime: '09:00:00',
          localEndTime: '17:00:00',
        })),
      ),
      timezone: DEMO_TIMEZONE,
      durationMinutes: 30,
      minimumLeadMinutes: 60,
      count: 4,
      staffIds: [DEMO_STAFF_IDS.one, DEMO_STAFF_IDS.two],
    });
    if (slots.length < 3) throw new Error(`insufficient_availability_slots:${slots.length}`);

    const bookingIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const slot = slots[i]!;
      const bookingId = `a0b0000${i + 1}-0001-4001-8001-${String(i + 1).padStart(12, '0')}`;
      bookingIds.push(bookingId);
      await prisma.booking.create({
        data: {
          id: bookingId,
          organizationId: DEMO_ORG_ID,
          customerId: customerIds[i]!,
          serviceId: DEMO_SERVICE_IDS.consultation,
          locationId: DEMO_LOCATION_ID,
          staffMemberId: slot.staffMemberId,
          leadId: `a0a0000${i + 1}-0001-4001-8001-${String(i + 1).padStart(12, '0')}`,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          occupiedStartsAt: slot.occupiedStartsAt,
          occupiedEndsAt: slot.occupiedEndsAt,
          timezone: DEMO_TIMEZONE,
          durationMinutes: 30,
          status: 'CONFIRMED',
          serviceNameSnapshot: 'Dental Consultation (Demo Synthetic)',
          staffDisplayNameSnapshot: 'Dr Demo',
          createdByType: 'USER',
          createdByUserId: operatorId,
        },
      });
      await prisma.bookingActivity.create({
        data: {
          id: randomUUID(),
          organizationId: DEMO_ORG_ID,
          bookingId,
          type: 'BOOKING_CREATED',
          actorType: 'USER',
          actorId: operatorId,
          metadataJson: { demo: true },
        },
      });
    }
    // Cancel the 4th as CANCELLED snapshot
    const cancelSlot = slots[3]!;
    const cancelId = 'a0b00004-0001-4001-8001-000000000004';
    await prisma.booking.create({
      data: {
        id: cancelId,
        organizationId: DEMO_ORG_ID,
        customerId: customerIds[3]!,
        serviceId: DEMO_SERVICE_IDS.cleaning,
        locationId: DEMO_LOCATION_ID,
        staffMemberId: cancelSlot.staffMemberId,
        startsAt: cancelSlot.startsAt,
        endsAt: cancelSlot.endsAt,
        occupiedStartsAt: cancelSlot.occupiedStartsAt,
        occupiedEndsAt: cancelSlot.occupiedEndsAt,
        timezone: DEMO_TIMEZONE,
        durationMinutes: 45,
        status: 'CANCELLED',
        cancellationReasonCode: 'CUSTOMER_REQUEST',
        cancellationReasonText: 'Demo cancelled booking',
        serviceNameSnapshot: 'Teeth Cleaning (Demo Synthetic)',
        staffDisplayNameSnapshot: 'Dr Demo',
        createdByType: 'USER',
        createdByUserId: operatorId,
      },
    });
    await prisma.bookingActivity.create({
      data: {
        id: randomUUID(),
        organizationId: DEMO_ORG_ID,
        bookingId: cancelId,
        type: 'BOOKING_CANCELLED',
        actorType: 'USER',
        actorId: operatorId,
        metadataJson: { reasonCode: 'CUSTOMER_REQUEST' },
      },
    });
    record({
      section: 'BOOKINGS',
      result: 'PASS',
      detail: `confirmed=3 cancelled=1 firstLocalDate=${slots[0]!.localDate}`,
    });

    // ——— Follow-ups ———
    await prisma.organizationFollowUpPolicy.upsert({
      where: { organizationId: DEMO_ORG_ID },
      update: { followUpEnabled: true, timezone: DEMO_TIMEZONE },
      create: {
        organizationId: DEMO_ORG_ID,
        followUpEnabled: true,
        timezone: DEMO_TIMEZONE,
      },
    });
    await prisma.followUp.deleteMany({ where: { organizationId: DEMO_ORG_ID } });

    const fuBase = {
      organizationId: DEMO_ORG_ID,
      timezone: DEMO_TIMEZONE,
      channelConnectionId: DEMO_CHANNEL_ID,
      sendMode: 'FREE_FORM' as const,
      createdByType: 'USER' as const,
      createdByUserId: operatorId,
      payloadData: { demo: true, note: 'DISPATCHED_means_logical_handoff_not_provider_delivered' },
    };

    const now = new Date();
    await prisma.followUp.create({
      data: {
        ...fuBase,
        id: 'a0c00001-0001-4001-8001-000000000001',
        customerId: customerIds[0]!,
        leadId: 'a0a00001-0001-4001-8001-000000000001',
        conversationId: convSpecs[0]!.id,
        status: 'SCHEDULED',
        triggerType: 'MANUAL_SCHEDULED',
        originKind: 'OPERATOR_SCHEDULED',
        outreachBasis: 'OPERATOR_SCHEDULED',
        scheduledFor: new Date(now.getTime() + 3600_000),
        nextEligibleAt: new Date(now.getTime() + 3600_000),
        dedupKey: 'demo-fu-scheduled',
        operationKey: 'demo-fu-op-scheduled',
      },
    });
    // Legal terminal snapshots — not runtime state machine
    await prisma.followUp.create({
      data: {
        ...fuBase,
        id: 'a0c00002-0002-4002-8002-000000000002',
        customerId: customerIds[1]!,
        status: 'DISPATCHED',
        triggerType: 'LEAD_NO_RESPONSE',
        originKind: 'AUTOMATED',
        outreachBasis: 'CUSTOMER_INITIATED_CONVERSATION',
        scheduledFor: new Date(now.getTime() - 86400000),
        nextEligibleAt: new Date(now.getTime() - 86400000),
        executedAt: new Date(now.getTime() - 86000000),
        baselineOwnershipEpoch: 0,
        dedupKey: 'demo-fu-dispatched',
        operationKey: 'demo-fu-op-dispatched',
        resultReasonCode: 'DEMO_SNAPSHOT_LOGICAL_DISPATCH',
      },
    });
    await prisma.followUp.create({
      data: {
        ...fuBase,
        id: 'a0c00003-0003-4003-8003-000000000003',
        customerId: customerIds[2]!,
        status: 'SUPPRESSED',
        triggerType: 'LEAD_NO_RESPONSE',
        originKind: 'AUTOMATED',
        outreachBasis: 'CUSTOMER_INITIATED_CONVERSATION',
        scheduledFor: new Date(now.getTime() - 172800000),
        nextEligibleAt: new Date(now.getTime() - 172800000),
        suppressedAt: new Date(now.getTime() - 170000000),
        baselineOwnershipEpoch: 0,
        dedupKey: 'demo-fu-suppressed',
        operationKey: 'demo-fu-op-suppressed',
        resultReasonCode: 'CUSTOMER_REPLIED',
      },
    });
    await prisma.followUp.create({
      data: {
        ...fuBase,
        id: 'a0c00004-0004-4004-8004-000000000004',
        customerId: customerIds[3]!,
        status: 'FAILED',
        triggerType: 'MANUAL_SCHEDULED',
        originKind: 'OPERATOR_SCHEDULED',
        outreachBasis: 'OPERATOR_SCHEDULED',
        scheduledFor: new Date(now.getTime() - 259200000),
        nextEligibleAt: new Date(now.getTime() - 259200000),
        executedAt: new Date(now.getTime() - 258000000),
        dedupKey: 'demo-fu-failed',
        operationKey: 'demo-fu-op-failed',
        resultReasonCode: 'DEMO_SNAPSHOT_FAILED',
      },
    });
    record({
      section: 'FOLLOWUPS',
      result: 'PASS',
      detail: 'SCHEDULED+DISPATCHED_snapshot+SUPPRESSED+FAILED (DISPATCHED!=delivered)',
    });

    // ——— Knowledge PARTIAL (no fabricated publish) ———
    await prisma.knowledgeChunk.deleteMany({ where: { organizationId: DEMO_ORG_ID } });
    await prisma.knowledgeDocumentVersion.deleteMany({ where: { organizationId: DEMO_ORG_ID } });
    await prisma.knowledgeDocument.deleteMany({ where: { organizationId: DEMO_ORG_ID } });

    const doc1 = 'a0d00001-0001-4001-8001-000000000001';
    const ver1 = 'a0d10001-0001-4001-8001-000000000001';
    const text1 = 'Zero Cost Test Clinic is a synthetic demonstration clinic.';
    await prisma.knowledgeDocument.create({
      data: {
        id: doc1,
        organizationId: DEMO_ORG_ID,
        title: 'Clinic Services (Demo)',
      },
    });
    await prisma.knowledgeDocumentVersion.create({
      data: {
        id: ver1,
        organizationId: DEMO_ORG_ID,
        documentId: doc1,
        versionNumber: 1,
        objectKey: `demo/${DEMO_ORG_ID}/clinic-services.txt`,
        contentChecksum: digestText(text1),
        mimeType: 'text/plain',
        byteSize: Buffer.byteLength(text1),
        extractedText: text1,
        pipelineStatus: 'AWAITING_REVIEW',
        reviewStatus: 'PENDING',
      },
    });
    const doc2 = 'a0d00002-0002-4002-8002-000000000002';
    const ver2 = 'a0d10002-0002-4002-8002-000000000002';
    const text2 = 'Working hours for the demo are Sunday through Thursday.';
    await prisma.knowledgeDocument.create({
      data: {
        id: doc2,
        organizationId: DEMO_ORG_ID,
        title: 'Working Hours (Demo)',
      },
    });
    await prisma.knowledgeDocumentVersion.create({
      data: {
        id: ver2,
        organizationId: DEMO_ORG_ID,
        documentId: doc2,
        versionNumber: 1,
        objectKey: `demo/${DEMO_ORG_ID}/working-hours.txt`,
        contentChecksum: digestText(text2),
        mimeType: 'text/plain',
        byteSize: Buffer.byteLength(text2),
        extractedText: text2,
        pipelineStatus: 'AWAITING_REVIEW',
        reviewStatus: 'PENDING',
      },
    });
    record({
      section: 'KNOWLEDGE',
      result: 'PARTIAL',
      detail: 'AWAITING_REVIEW_no_fabricated_publish_TEI_storage_path_not_run',
    });

    const failed = sections.some((s) => s.result === 'FAIL');
    console.log(
      JSON.stringify({
        DEMO_SEED: failed ? 'FAIL' : 'PASS',
        KNOWLEDGE_DEMO: 'PARTIAL',
        DATASET_CREATED: failed ? 'FAIL' : 'PASS',
      }),
    );
    if (failed) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
