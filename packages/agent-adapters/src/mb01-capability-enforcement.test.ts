import assert from 'node:assert/strict';
import test from 'node:test';
import { createToolExecutor } from './tool-executor.js';
import type { ToolExecutionContext, ToolResult } from '@ai-sales-agent/agent-core';

// Mock Pool Client for testing capability enforcement
function createMockPool(capabilities: {
  supports_booking?: boolean;
  supports_leads?: boolean;
  lead_required_before_booking?: boolean;
  auto_create_lead_on_intent?: boolean;
}) {
  const caps = {
    supports_booking: true,
    supports_leads: true,
    lead_required_before_booking: false,
    auto_create_lead_on_intent: true,
    supports_offers: false,
    supports_quotes: false,
    supports_orders: false,
    supports_inventory: false,
    supports_staff: true,
    supports_locations: true,
    supports_products: false,
    supports_services: true,
    supports_listings: false,
    ...capabilities,
  };

  const mockClient = {
    query: async (sql: string, params?: unknown[]) => {
      const s = sql.toLowerCase();
      if (s.includes('begin') || s.includes('commit') || s.includes('rollback') || s.includes('set_config')) {
        return { rows: [], rowCount: 0 };
      }
      if (s.includes('from organization_capabilities')) {
        return { rows: [caps], rowCount: 1 };
      }
      if (s.includes('from conversations where organization_id=$1 and id=$2 for update')) {
        return {
          rows: [
            {
              mode: 'AI_ACTIVE',
              ownership_epoch: 1,
              lease_owner: 'worker-1',
              lease_fence: 1,
              next_sequence: 5,
              customer_id: '00000000-0000-0000-0000-000000000001',
            },
          ],
          rowCount: 1,
        };
      }
      if (s.includes('from customers')) {
        return {
          rows: [
            {
              id: '00000000-0000-0000-0000-000000000001',
              display_name: 'Test Customer',
              preferred_locale: 'ar',
              version: 1,
            },
          ],
          rowCount: 1,
        };
      }
      if (s.includes('from leads')) {
        return { rows: [], rowCount: 0 };
      }
      if (s.includes('from bookings')) {
        return { rows: [], rowCount: 0 };
      }
      if (s.includes('from services')) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    },
    release: () => {},
  };

  const mockPool = {
    connect: async () => mockClient,
  };

  const mockStore = {
    claimCommand: async () => ({ alreadySucceeded: false, resultJson: null, operationId: 'op-1' }),
    finalizeHandoff: async () => ({ newEpoch: 2 }),
  };

  return { mockPool: mockPool as any, mockStore: mockStore as any };
}

function makeCtx(overrides?: Partial<ToolExecutionContext>): ToolExecutionContext {
  return {
    organizationId: '11111111-1111-1111-1111-111111111111',
    conversationId: '22222222-2222-2222-2222-222222222222',
    customerId: '00000000-0000-0000-0000-000000000001',
    runKey: 'run-1',
    agentRunId: '33333333-3333-3333-3333-333333333333',
    leaseOwner: 'worker-1',
    leaseFence: 1,
    ownershipEpoch: 1,
    targetIngressSequence: 4,
    toolCallOrdinal: 1,
    sandbox: false,
    ...overrides,
  };
}

test('MB-01 CASE A: LEADS DISABLED (supportsBooking=true, supportsLeads=false)', async () => {
  const { mockPool, mockStore } = createMockPool({
    supports_booking: true,
    supports_leads: false,
  });
  const executor = createToolExecutor(mockPool, mockStore);
  const ctx = makeCtx();

  // ensureLead must be rejected with TOOL_NOT_AUTHORIZED
  const leadRes = await executor.execute('ensureLead', { serviceId: '00000000-0000-0000-0000-000000000010' }, ctx);
  assert.equal(leadRes.ok, false);
  assert.equal(leadRes.code, 'TOOL_NOT_AUTHORIZED');
  assert.equal(leadRes.safeMessage, 'leads_disabled');

  // getLead must be rejected
  const getLeadRes = await executor.execute('getLead', {}, ctx);
  assert.equal(getLeadRes.ok, false);
  assert.equal(getLeadRes.code, 'TOOL_NOT_AUTHORIZED');
  assert.equal(getLeadRes.safeMessage, 'leads_disabled');
});

test('MB-01 CASE B: LEADS OPTIONAL (supportsBooking=true, supportsLeads=true, leadRequiredBeforeBooking=false)', async () => {
  const { mockPool, mockStore } = createMockPool({
    supports_booking: true,
    supports_leads: true,
    lead_required_before_booking: false,
  });
  const executor = createToolExecutor(mockPool, mockStore);
  const ctx = makeCtx();

  // Booking read tools are authorized
  const slotsRes = await executor.execute('getAvailableSlots', { serviceId: 'not-a-uuid' }, ctx);
  // Rejection is due to invalid args, NOT TOOL_NOT_AUTHORIZED
  assert.equal(slotsRes.ok, false);
  assert.notEqual(slotsRes.code, 'TOOL_NOT_AUTHORIZED');
});

test('MB-01 CASE C: LEADS REQUIRED (supportsBooking=true, supportsLeads=true, leadRequiredBeforeBooking=true)', async () => {
  const { mockPool, mockStore } = createMockPool({
    supports_booking: true,
    supports_leads: true,
    lead_required_before_booking: true,
  });
  const executor = createToolExecutor(mockPool, mockStore);
  const ctx = makeCtx();

  // Calling createBooking with non-uuid leadId gets rejected
  const res = await executor.execute('createBooking', { slotToken: 'invalid-token', leadId: 'invalid-uuid' }, ctx);
  assert.equal(res.ok, false);
  assert.equal(res.code, 'TOOL_INVALID_ARGS');
});

test('MB-01 CASE D: BOOKING DISABLED (supportsBooking=false, supportsLeads=true)', async () => {
  const { mockPool, mockStore } = createMockPool({
    supports_booking: false,
    supports_leads: true,
  });
  const executor = createToolExecutor(mockPool, mockStore);
  const ctx = makeCtx();

  // getAvailableSlots is blocked
  const slotsRes = await executor.execute('getAvailableSlots', { serviceId: '00000000-0000-0000-0000-000000000010' }, ctx);
  assert.equal(slotsRes.ok, false);
  assert.equal(slotsRes.code, 'TOOL_NOT_AUTHORIZED');
  assert.equal(slotsRes.safeMessage, 'booking_disabled');

  // createBooking is blocked
  const createRes = await executor.execute('createBooking', { slotToken: 'dummy' }, ctx);
  assert.equal(createRes.ok, false);
  assert.equal(createRes.code, 'TOOL_NOT_AUTHORIZED');
  assert.equal(createRes.safeMessage, 'booking_disabled');

  // cancelBooking is blocked
  const cancelRes = await executor.execute('cancelBooking', { bookingId: '00000000-0000-0000-0000-000000000020', expectedVersion: 1 }, ctx);
  assert.equal(cancelRes.ok, false);
  assert.equal(cancelRes.code, 'TOOL_NOT_AUTHORIZED');
  assert.equal(cancelRes.safeMessage, 'booking_disabled');
});

test('MB-01 CASE E: BACKWARD COMPATIBILITY (default capabilities allow booking & lead discovery)', async () => {
  const { mockPool, mockStore } = createMockPool({}); // Uses default baseline capabilities
  const executor = createToolExecutor(mockPool, mockStore);
  const ctx = makeCtx();

  // getCustomer is authorized
  const custRes = await executor.execute('getCustomer', {}, ctx);
  assert.equal(custRes.ok, true);
  assert.equal((custRes.data as any).id, '00000000-0000-0000-0000-000000000001');
});
