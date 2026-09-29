import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import {
  createPreviewToolExecutor,
} from './preview-tool-executor.js';
import {
  signSlotToken,
  resolveSlotTokenSecret,
} from './slot-token.js';
import { updateWorkingStateDataWithToolResult } from './conversation-working-state.js';

test('MB-09: Preview tool executor handles read-only tools and simulated mutations', async () => {
  const traces: any[] = [];
  const fakePool: any = {
    connect: async () => ({
      query: async (sql: string, params?: any[]) => {
        if (sql.includes('FROM services') && sql.includes('WHERE organization_id = $1 AND id = $2')) {
          return {
            rows: [
              {
                id: params?.[1] ?? 'svc-1',
                name: 'Dental Check-up',
                description: 'Full exam',
                amount_minor: '50000',
                currency: 'IQD',
                duration_minutes: 30,
                booking_enabled: true,
              },
            ],
          };
        }
        if (sql.includes('FROM services')) {
          return {
            rows: [
              {
                id: 'svc-1',
                name: 'Dental Check-up',
                description: 'Full exam',
                amount_minor: '50000',
                currency: 'IQD',
                duration_minutes: 30,
                active: true,
              },
            ],
          };
        }
        if (sql.includes('FROM offers')) {
          return {
            rows: [
              {
                id: 'off-1',
                name: 'New Year 10% Off',
                description: '10% discount on all exams',
                discount_type: 'PERCENTAGE',
                discount_value: '10',
                currency: 'IQD',
                code: 'NEWYEAR10',
              },
            ],
          };
        }
        if (sql.includes('FROM business_policies')) {
          return {
            rows: [
              {
                id: 'pol-1',
                title: 'Cancellation Cutoff',
                summary: 'Must cancel 2 hours prior',
                rules_json: { cutoffMinutes: 120, allowAfterCutoff: false },
                version: 1,
              },
            ],
          };
        }
        if (sql.includes('FROM organization_capabilities')) {
          return {
            rows: [{ supports_booking: true, supports_leads: true }],
          };
        }
        return { rows: [] };
      },
      release: () => {},
    }),
  };

  const executor = createPreviewToolExecutor(fakePool, (t) => traces.push(t));

  const ctx: any = {
    organizationId: 'org-test',
    conversationId: 'conv-test',
    customerId: 'cust-test',
    runKey: 'run-key',
    agentRunId: 'run-1',
    leaseOwner: 'worker',
    leaseFence: 1,
    ownershipEpoch: 1,
    targetIngressSequence: 1,
    toolCallOrdinal: 1,
    sandbox: true,
  };

  // 1. Search Services (Read-only)
  const resServices = await executor.execute('searchServices', { query: 'فحص' }, ctx);
  assert.equal(resServices.ok, true);
  assert.equal(traces.length, 1);
  assert.equal(traces[0].toolName, 'searchServices');
  assert.equal(traces[0].simulated, false);
  assert.equal(traces[0].sourceUsed?.type, 'CATALOG');

  // 2. Active Offers (Read-only)
  const resOffers = await executor.execute('getActiveOffers', {}, ctx);
  assert.equal(resOffers.ok, true);
  assert.equal(traces[1].sourceUsed?.type, 'OFFER');

  // 3. Effective Policy (Read-only)
  const resPolicy = await executor.execute('getEffectivePolicy', { policyType: 'CANCELLATION' }, ctx);
  assert.equal(resPolicy.ok, true);
  assert.equal(traces[2].sourceUsed?.type, 'POLICY');

  // 4. Ensure Lead (Simulated)
  const resLead = await executor.execute('ensureLead', { serviceId: 'svc-1' }, ctx);
  assert.equal(resLead.ok, true);
  assert.equal(traces[3].simulated, true);
  assert.equal(traces[3].wouldSucceed, true);
  assert.equal((resLead.data as any).simulated, true);

  const secret = resolveSlotTokenSecret({ BOOKING_SLOT_TOKEN_SECRET: 'test-secret-at-least-32-chars-long-abc' });
  process.env.BOOKING_SLOT_TOKEN_SECRET = 'test-secret-at-least-32-chars-long-abc';
  const signedToken = signSlotToken(
    {
      organizationId: 'org-test',
      customerId: 'cust-test',
      serviceId: 'a0500001-0001-4001-8001-000000000001',
      staffMemberId: 'a0300001-0001-4001-8001-000000000001',
      locationId: 'a0100001-0001-4001-8001-000000000001',
      startsAt: '2026-09-30T10:00:00.000Z',
      endsAt: '2026-09-30T10:30:00.000Z',
      ttlMs: 900_000,
    },
    secret,
  );

  const resBooking = await executor.execute('createBooking', { slotToken: signedToken }, ctx);
  assert.equal(resBooking.ok, true);
  assert.equal(traces[4].simulated, true);
  assert.equal(traces[4].wouldSucceed, true);
  assert.equal((resBooking.data as any).simulated, true);
  assert.equal((resBooking.data as any).wouldSucceed, true);

  // 6. Create Booking with invalid token -> fails simulation safely
  const resInvalidToken = await executor.execute('createBooking', { slotToken: 'invalid-fake-token' }, ctx);
  assert.equal(resInvalidToken.ok, false);
  assert.equal(traces[5].simulated, true);
  assert.equal(traces[5].wouldSucceed, false);
});

test('MB-09: Working state transition logic updates candidate slots and selected entity', () => {
  let state = {};
  const searchRes = updateWorkingStateDataWithToolResult(state, 'searchServices', { query: 'فحص' }, {
    ok: true,
    data: { services: [{ id: 'svc-1', name: 'Dental Check-up' }] },
  });
  assert.equal(searchRes.changed, true);
  assert.equal(searchRes.stateData.selectedEntity?.entityId, 'svc-1');

  const slotsRes = updateWorkingStateDataWithToolResult(searchRes.stateData, 'getAvailableSlots', { serviceId: 'svc-1' }, {
    ok: true,
    data: {
      slots: [
        {
          staffMemberId: 'st-1',
          locationId: 'loc-1',
          startsAt: '2026-09-30T10:00:00.000Z',
          endsAt: '2026-09-30T10:30:00.000Z',
          localDate: '2026-09-30',
          localStartTime: '10:00',
          slotToken: 'tok-1',
        },
      ],
    },
  });
  assert.equal(slotsRes.changed, true);
  assert.equal(slotsRes.stateData.candidateSlots?.length, 1);
  assert.equal(slotsRes.stateData.candidateSlots?.[0]?.slotToken, 'tok-1');

  const bookingRes = updateWorkingStateDataWithToolResult(slotsRes.stateData, 'createBooking', { slotToken: 'tok-1' }, {
    ok: true,
    data: { bookingId: 'sim-bk-1' },
  });
  assert.equal(bookingRes.changed, true);
  assert.equal(bookingRes.stateData.candidateSlots, undefined);
  assert.equal(bookingRes.stateData.lastConfirmedBookingId, 'sim-bk-1');
});
