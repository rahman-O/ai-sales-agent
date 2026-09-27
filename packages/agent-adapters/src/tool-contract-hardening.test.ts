import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidUuid, invalidUuidArg } from './uuid-validator.js';
import { toolGetAvailableSlots, toolCreateBooking, toolCancelBooking, toolRescheduleBooking } from './booking-tools.js';
import { toolEnsureLead, toolGetLead, toolTransitionLead, toolUpdateLeadQualification } from './lead-tools.js';

test('isValidUuid validates canonical RFC4122 UUID strings', () => {
  assert.equal(isValidUuid('a0500001-0001-4001-8001-000000000001'), true);
  assert.equal(isValidUuid('71a3ef24-75b7-4570-be13-928c7805808d'), true);
  assert.equal(isValidUuid('00000000-0000-0000-0000-000000000000'), false);
  assert.equal(isValidUuid('checkup'), false);
  assert.equal(isValidUuid('dental_checkup'), false);
  assert.equal(isValidUuid('Dental Check-up'), false);
  assert.equal(isValidUuid('1'), false);
  assert.equal(isValidUuid(''), false);
  assert.equal(isValidUuid(null), false);
  assert.equal(isValidUuid(undefined), false);
  assert.equal(isValidUuid(123), false);
});

test('toolGetAvailableSlots rejects non-UUID serviceId with TOOL_INVALID_ARGS without SQL crash', async () => {
  const dummyClient = {} as any; // Should never be touched
  const res1 = await toolGetAvailableSlots(dummyClient, 'org-1', 'cust-1', {
    serviceId: 'checkup',
    startDate: '2026-09-27',
  });
  assert.equal(res1.ok, false);
  assert.equal(res1.code, 'TOOL_INVALID_ARGS');

  const res2 = await toolGetAvailableSlots(dummyClient, 'org-1', 'cust-1', {
    serviceId: 'dental_checkup',
    startDate: '2026-09-27',
  });
  assert.equal(res2.ok, false);
  assert.equal(res2.code, 'TOOL_INVALID_ARGS');
});

test('toolGetAvailableSlots rejects non-UUID locationId or staffMemberId with TOOL_INVALID_ARGS', async () => {
  const dummyClient = {} as any;
  const res1 = await toolGetAvailableSlots(dummyClient, 'org-1', 'cust-1', {
    serviceId: 'a0500001-0001-4001-8001-000000000001',
    startDate: '2026-09-27',
    locationId: 'main-clinic',
  });
  assert.equal(res1.ok, false);
  assert.equal(res1.code, 'TOOL_INVALID_ARGS');

  const res2 = await toolGetAvailableSlots(dummyClient, 'org-1', 'cust-1', {
    serviceId: 'a0500001-0001-4001-8001-000000000001',
    startDate: '2026-09-27',
    staffMemberId: 'dr-smith',
  });
  assert.equal(res2.ok, false);
  assert.equal(res2.code, 'TOOL_INVALID_ARGS');
});

test('toolEnsureLead rejects non-UUID serviceId with TOOL_INVALID_ARGS', async () => {
  const dummyClient = {} as any;
  const res = await toolEnsureLead(
    dummyClient,
    'org-1',
    'cust-1',
    { serviceId: 'dental_checkup' },
    { conversationId: 'c-1', agentRunId: 'r-1' },
  );
  assert.equal(res.ok, false);
  assert.equal(res.code, 'TOOL_INVALID_ARGS');
});

test('toolGetLead rejects non-UUID leadId or serviceId with TOOL_INVALID_ARGS', async () => {
  const dummyClient = {} as any;
  const res1 = await toolGetLead(dummyClient, 'org-1', 'cust-1', { leadId: 'lead-123' });
  assert.equal(res1.ok, false);
  assert.equal(res1.code, 'TOOL_INVALID_ARGS');

  const res2 = await toolGetLead(dummyClient, 'org-1', 'cust-1', { serviceId: 'checkup' });
  assert.equal(res2.ok, false);
  assert.equal(res2.code, 'TOOL_INVALID_ARGS');
});

test('toolCreateBooking rejects non-UUID leadId with TOOL_INVALID_ARGS', async () => {
  const dummyClient = {} as any;
  const res = await toolCreateBooking(
    dummyClient,
    'org-1',
    'cust-1',
    {
      slotToken: 'dummy-token',
      leadId: 'invalid-lead-id',
    },
    { conversationId: 'c-1', agentRunId: 'r-1', targetIngressSequence: 1 },
  );
  assert.equal(res.ok, false);
  assert.equal(res.code, 'TOOL_INVALID_ARGS');
});

test('toolCreateBooking resolves confirmation message server-side and enforces invariants A-H', async () => {
  const mockMessages: Array<{
    id: string;
    organization_id: string;
    conversation_id: string;
    ingress_sequence: number | null;
    direction: string;
    content_text: string;
  }> = [
    {
      id: 'a0500001-0001-4001-8001-000000000001',
      organization_id: 'org-1',
      conversation_id: 'conv-1',
      ingress_sequence: 4,
      direction: 'INBOUND',
      content_text: 'تمام احجزلي أول موعد',
    },
    {
      id: 'a0500001-0001-4001-8001-000000000002',
      organization_id: 'org-2', // other tenant
      conversation_id: 'conv-1',
      ingress_sequence: 4,
      direction: 'INBOUND',
      content_text: 'تمام احجزلي أول موعد',
    },
    {
      id: 'a0500001-0001-4001-8001-000000000003',
      organization_id: 'org-1',
      conversation_id: 'conv-other', // other conversation
      ingress_sequence: 4,
      direction: 'INBOUND',
      content_text: 'تمام احجزلي أول موعد',
    },
    {
      id: 'a0500001-0001-4001-8001-000000000004',
      organization_id: 'org-1',
      conversation_id: 'conv-1',
      ingress_sequence: 4,
      direction: 'OUTBOUND', // outbound
      content_text: 'تمام احجزلي أول موعد',
    },
    {
      id: 'a0500001-0001-4001-8001-000000000005',
      organization_id: 'org-1',
      conversation_id: 'conv-1',
      ingress_sequence: 3, // wrong sequence
      direction: 'INBOUND',
      content_text: 'تمام احجزلي أول موعد',
    },
  ];

  function createMockClient() {
    return {
      query: async (queryText: string, params: any[]) => {
        if (queryText.includes('FROM messages')) {
          const [org, convId, seq] = params;
          const found = mockMessages.filter(
            (m) =>
              m.organization_id === org &&
              m.conversation_id === convId &&
              m.ingress_sequence === seq &&
              m.direction === 'INBOUND',
          );
          return { rows: found };
        }
        if (queryText.includes('FROM services')) {
          return {
            rows: [
              {
                id: 'a0500001-0001-4001-8001-000000000001',
                active: true,
                archived_at: null,
                booking_enabled: true,
                duration_minutes: 30,
                buffer_before_minutes: 0,
                buffer_after_minutes: 0,
                minimum_lead_minutes: 0,
                maximum_advance_days: 30,
                name: 'Test Service',
              },
            ],
          };
        }
        if (queryText.includes('FROM staff_members')) {
          return { rows: [{ id: 'a0600001-0001-4001-8001-000000000001', location_id: 'a0300001-0001-4001-8001-000000000001', active: true, display_name: 'Dr. Test' }] };
        }
        if (queryText.includes('FROM service_staff')) {
          return { rows: [{ 1: 1 }] };
        }
        if (queryText.includes('FROM locations')) {
          return { rows: [{ id: 'a0300001-0001-4001-8001-000000000001', timezone: 'UTC', active: true }] };
        }
        if (queryText.includes('FROM staff_availability_rules')) {
          return { rows: [{ local_start_time: '00:00:00', local_end_time: '23:59:59' }] };
        }
        if (queryText.includes('FROM staff_availability_exceptions')) {
          return { rows: [] };
        }
        if (queryText.includes('INSERT INTO bookings')) {
          return { rows: [] };
        }
        return { rows: [] };
      },
    } as any;
  }

  process.env.BOOKING_SLOT_TOKEN_SECRET = 'test-booking-slot-token-secret';
  const { signSlotToken } = await import('./slot-token.js');
  const futureStart = new Date(Date.now() + 24 * 3600_000);
  futureStart.setMinutes(0, 0, 0);
  const futureEnd = new Date(futureStart.getTime() + 30 * 60_000);

  const slotToken = signSlotToken(
    {
      organizationId: 'org-1',
      customerId: 'cust-1',
      serviceId: 'a0500001-0001-4001-8001-000000000001',
      locationId: 'a0300001-0001-4001-8001-000000000001',
      staffMemberId: 'a0600001-0001-4001-8001-000000000001',
      startsAt: futureStart.toISOString(),
      endsAt: futureEnd.toISOString(),
    },
    'test-booking-slot-token-secret',
  );

  const mockClient = createMockClient();

  // Test A & B: createBooking with only slotToken succeeds in resolving confirmation message server-side
  const resA = await toolCreateBooking(
    mockClient,
    'org-1',
    'cust-1',
    { slotToken }, // No confirmationMessageId provided!
    { conversationId: 'conv-1', agentRunId: 'r-1', targetIngressSequence: 4 },
  );
  assert.equal(resA.ok, true, 'createBooking should succeed without confirmationMessageId from model');

  // Test D: wrong conversation fails closed
  const resD = await toolCreateBooking(
    mockClient,
    'org-1',
    'cust-1',
    { slotToken },
    { conversationId: 'conv-nonexistent', agentRunId: 'r-1', targetIngressSequence: 4 },
  );
  assert.equal(resD.ok, false);
  assert.equal(resD.code, 'CONFIRMATION_REQUIRED');

  // Test E: wrong organization fails closed
  const resE = await toolCreateBooking(
    mockClient,
    'org-wrong',
    'cust-1',
    { slotToken },
    { conversationId: 'conv-1', agentRunId: 'r-1', targetIngressSequence: 4 },
  );
  assert.equal(resE.ok, false);

  // Test G: missing ingress sequence fails closed
  const resG = await toolCreateBooking(
    mockClient,
    'org-1',
    'cust-1',
    { slotToken },
    { conversationId: 'conv-1', agentRunId: 'r-1', targetIngressSequence: 99 },
  );
  assert.equal(resG.ok, false);
  assert.equal(resG.code, 'CONFIRMATION_REQUIRED');

  // Test H: model-provided fake confirmationMessageId cannot override server resolution
  const resH = await toolCreateBooking(
    mockClient,
    'org-1',
    'cust-1',
    { slotToken, confirmationMessageId: 'a0500009-9999-4999-8999-999999999999' }, // Fake ID ignored
    { conversationId: 'conv-1', agentRunId: 'r-1', targetIngressSequence: 4 },
  );
  assert.equal(resH.ok, true, 'Server resolution must succeed and ignore caller-provided fake ID');
});

test('toolCancelBooking and toolRescheduleBooking reject non-UUID bookingId with TOOL_INVALID_ARGS', async () => {
  const dummyClient = {} as any;
  const res1 = await toolCancelBooking(
    dummyClient,
    'org-1',
    'cust-1',
    { bookingId: 'booking-xyz', expectedVersion: 1 },
    { agentRunId: 'r-1' },
  );
  assert.equal(res1.ok, false);
  assert.equal(res1.code, 'TOOL_INVALID_ARGS');

  const res2 = await toolRescheduleBooking(
    dummyClient,
    'org-1',
    'cust-1',
    { bookingId: 'booking-xyz', expectedVersion: 1, slotToken: 'dummy' },
    { agentRunId: 'r-1' },
  );
  assert.equal(res2.ok, false);
  assert.equal(res2.code, 'TOOL_INVALID_ARGS');
});

test('toolGetAvailableSlots searches forward when startDate is omitted', async () => {
  const mockClient = {
    query: async (sql: string, params: any[]) => {
      if (sql.includes('FROM services')) {
        return {
          rows: [
            {
              id: 'a0500001-0001-4001-8001-000000000001',
              location_id: 'a0333333-3333-4333-8333-333333333333',
              name: 'Checkup',
              duration_minutes: 30,
              buffer_before_minutes: 0,
              buffer_after_minutes: 0,
              booking_enabled: true,
              minimum_lead_minutes: 0,
              maximum_advance_days: 14,
              active: true,
              archived_at: null,
            },
          ],
        };
      }
      if (sql.includes('FROM locations')) {
        return {
          rows: [{ id: 'a0333333-3333-4333-8333-333333333333', timezone: 'UTC', active: true }],
        };
      }
      if (sql.includes('FROM service_staff')) {
        return { rows: [{ staff_id: 'a0600001-0001-4001-8001-000000000001' }] };
      }
      if (sql.includes('FROM staff_members')) {
        return { rows: [{ id: 'a0600001-0001-4001-8001-000000000001', display_name: 'Dr. One' }] };
      }
      if (sql.includes('FROM staff_availability_rules')) {
        return {
          rows: [
            {
              local_start_time: '09:00:00',
              local_end_time: '17:00:00',
              effective_from: null,
              effective_to: null,
            },
          ],
        };
      }
      if (sql.includes('FROM staff_availability_exceptions')) {
        return { rows: [] };
      }
      if (sql.includes('FROM bookings')) {
        return { rows: [] };
      }
      return { rows: [] };
    },
  } as any;

  process.env.BOOKING_SLOT_TOKEN_SECRET = 'test-secret-at-least-32-chars-long-12345';

  const res = await toolGetAvailableSlots(
    mockClient,
    'a0111111-1111-4111-8111-111111111111',
    'a0700001-0001-4001-8001-000000000001',
    {
      serviceId: 'a0500001-0001-4001-8001-000000000001',
      // startDate omitted
    },
  );

  assert.equal(res.ok, true);
  if (res.ok) {
    const data = res.data as { slots: Array<{ slotToken: string }> };
    assert.ok(Array.isArray(data.slots));
    assert.ok(data.slots.length > 0);
    assert.ok(data.slots[0]?.slotToken);
  }
});

