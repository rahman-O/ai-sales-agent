import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractSlotTokenExpiry,
  loadWorkingState,
  upsertWorkingStateCAS,
  applySelectiveToolWriteBack,
} from './conversation-working-state.js';
import type { ConversationWorkingStateData } from '@ai-sales-agent/agent-core';

test('extractSlotTokenExpiry extracts ISO timestamp from base64url payload or expiresAt field', () => {
  const payload = { exp: '2026-09-27T12:00:00.000Z', serviceId: 'srv-1' };
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const token = `v1.${b64}.dummyhmacsignature`;

  assert.equal(extractSlotTokenExpiry(token), '2026-09-27T12:00:00.000Z');
  assert.equal(extractSlotTokenExpiry('invalid.token'), null);
});

test('loadWorkingState filters out expired candidate slots logically', async () => {
  const futureDate = new Date(Date.now() + 3600_000).toISOString();
  const pastDate = new Date(Date.now() - 3600_000).toISOString();

  const stateData: ConversationWorkingStateData = {
    selectedEntity: {
      entityType: 'SERVICE',
      entityId: 'srv-123',
      entityLabel: 'Dental Cleaning',
    },
    candidateSlots: [
      {
        entityId: 'srv-123',
        staffMemberId: 'staff-1',
        locationId: 'loc-1',
        startsAt: '2026-09-27T10:00:00Z',
        endsAt: '2026-09-27T10:30:00Z',
        localDate: '2026-09-27',
        localStartTime: '10:00',
        slotToken: 'valid-token',
        expiresAt: futureDate,
      },
      {
        entityId: 'srv-123',
        staffMemberId: 'staff-1',
        locationId: 'loc-1',
        startsAt: '2026-09-27T11:00:00Z',
        endsAt: '2026-09-27T11:30:00Z',
        localDate: '2026-09-27',
        localStartTime: '11:00',
        slotToken: 'expired-token',
        expiresAt: pastDate,
      },
    ],
  };

  const mockClient = {
    query: async () => ({
      rows: [
        {
          version: 1,
          customer_id: null,
          lead_id: 'lead-1',
          state_json: stateData,
          updated_at: new Date(),
          last_agent_run_id: 'run-1',
          last_tool_call_id: null,
        },
      ],
    }),
  } as any;

  const result = await loadWorkingState(mockClient, {
    organizationId: 'org-1',
    conversationId: 'conv-1',
  });

  assert.ok(result);
  assert.equal(result.customerId, null);
  assert.equal(result.leadId, 'lead-1');
  assert.equal(result.stateData.candidateSlots?.length, 1);
  assert.equal(result.stateData.candidateSlots?.[0]?.slotToken, 'valid-token');
});

test('upsertWorkingStateCAS enforces lease fence, ownership epoch, and optimistic versioning', async () => {
  let queryCount = 0;
  const mockClient = {
    query: async (sql: string) => {
      queryCount++;
      if (sql.includes('SELECT mode, ownership_epoch')) {
        return {
          rows: [
            {
              mode: 'AI_ACTIVE',
              ownership_epoch: 2,
              lease_fence: 3,
            },
          ],
        };
      }
      if (sql.includes('UPDATE conversation_working_state') || sql.includes('INSERT INTO conversation_working_state')) {
        return {
          rowCount: 1,
          rows: [{ version: 2 }],
        };
      }
      return { rows: [] };
    },
  } as any;

  const res = await upsertWorkingStateCAS(mockClient, {
    organizationId: 'org-1',
    conversationId: 'conv-1',
    expectedVersion: 1,
    leaseFence: 3,
    ownershipEpoch: 2,
    agentRunId: 'run-1',
    stateData: {
      selectedEntity: { entityType: 'SERVICE', entityId: 's-1' },
    },
  });

  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.version, 2);
  }
});

test('upsertWorkingStateCAS fails cleanly if mode is HUMAN_ACTIVE (takeover)', async () => {
  const mockClient = {
    query: async (sql: string) => {
      if (sql.includes('SELECT mode, ownership_epoch')) {
        return {
          rows: [
            {
              mode: 'HUMAN_ACTIVE',
              ownership_epoch: 2,
              lease_fence: 3,
            },
          ],
        };
      }
      return { rows: [] };
    },
  } as any;

  const res = await upsertWorkingStateCAS(mockClient, {
    organizationId: 'org-1',
    conversationId: 'conv-1',
    expectedVersion: 1,
    leaseFence: 3,
    ownershipEpoch: 2,
    agentRunId: 'run-1',
    stateData: {},
  });

  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.reason, 'AUTHORITY_LOST');
  }
});

test('upsertWorkingStateCAS fails cleanly if lease fence is stale', async () => {
  const mockClient = {
    query: async (sql: string) => {
      if (sql.includes('SELECT mode, ownership_epoch')) {
        return {
          rows: [
            {
              mode: 'AI_ACTIVE',
              ownership_epoch: 2,
              lease_fence: 4, // Stale!
            },
          ],
        };
      }
      return { rows: [] };
    },
  } as any;

  const res = await upsertWorkingStateCAS(mockClient, {
    organizationId: 'org-1',
    conversationId: 'conv-1',
    expectedVersion: 1,
    leaseFence: 3, // Expected was 3
    ownershipEpoch: 2,
    agentRunId: 'run-1',
    stateData: {},
  });

  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.reason, 'AUTHORITY_LOST');
  }
});

test('applySelectiveToolWriteBack handles searchServices with single unambiguous match', async () => {
  let savedState: any = null;
  let savedCustomerId: string | null = null;
  const mockClient = {
    query: async (sql: string, params: any[]) => {
      if (sql.includes('SELECT version, customer_id')) {
        return { rows: [] };
      }
      if (sql.includes('SELECT mode, ownership_epoch')) {
        return { rows: [{ mode: 'AI_ACTIVE', ownership_epoch: 1, lease_fence: 1 }] };
      }
      if (sql.includes('INSERT INTO conversation_working_state')) {
        savedCustomerId = params[2];
        savedState = JSON.parse(params[4]);
        return { rowCount: 1, rows: [{ version: 1 }] };
      }
      return { rows: [] };
    },
  } as any;

  await applySelectiveToolWriteBack(mockClient, {
    organizationId: 'org-1',
    conversationId: 'conv-1',
    customerId: 'cust-authoritative',
    agentRunId: 'run-1',
    toolCallId: 'call-1',
    toolName: 'searchServices',
    toolArgs: { query: 'dental' },
    toolResult: {
      ok: true,
      code: 'OK',
      data: {
        services: [{ id: 'srv-dental', name: 'Dental Check-up' }],
      },
    },
    leaseFence: 1,
    ownershipEpoch: 1,
  });

  assert.ok(savedState);
  assert.equal(savedCustomerId, 'cust-authoritative');
  assert.equal(savedState.selectedEntity?.entityId, 'srv-dental');
  assert.equal(savedState.selectedEntity?.entityLabel, 'Dental Check-up');
});

test('applySelectiveToolWriteBack preserves an existing authoritative customer', async () => {
  let savedCustomerId: string | null = null;
  const mockClient = {
    query: async (sql: string, params: any[]) => {
      if (sql.includes('FROM conversation_working_state')) {
        return { rows: [{ version: 4, customer_id: 'cust-same', lead_id: null, state_json: {}, updated_at: new Date() }] };
      }
      if (sql.includes('SELECT mode, ownership_epoch')) {
        return { rows: [{ mode: 'AI_ACTIVE', ownership_epoch: 1, lease_fence: 1 }] };
      }
      if (sql.includes('UPDATE conversation_working_state')) {
        savedCustomerId = params[2];
        return { rows: [{ version: 5 }] };
      }
      return { rows: [] };
    },
  } as any;

  await applySelectiveToolWriteBack(mockClient, {
    organizationId: 'org-1', conversationId: 'conv-1', customerId: 'cust-same', agentRunId: 'run-1',
    toolName: 'searchServices', toolArgs: { query: 'dental' },
    toolResult: { ok: true, data: { services: [{ id: 'srv-1', name: 'Dental' }] } },
    leaseFence: 1, ownershipEpoch: 1,
  });
  assert.equal(savedCustomerId, 'cust-same');
});

test('applySelectiveToolWriteBack ignores a conflicting customer id from tool results', async () => {
  let savedCustomerId: string | null = null;
  const mockClient = {
    query: async (sql: string, params: any[]) => {
      if (sql.includes('FROM conversation_working_state')) return { rows: [] };
      if (sql.includes('SELECT mode, ownership_epoch')) return { rows: [{ mode: 'AI_ACTIVE', ownership_epoch: 1, lease_fence: 1 }] };
      if (sql.includes('INSERT INTO conversation_working_state')) {
        savedCustomerId = params[2];
        return { rows: [{ version: 1 }] };
      }
      return { rows: [] };
    },
  } as any;

  await applySelectiveToolWriteBack(mockClient, {
    organizationId: 'org-1', conversationId: 'conv-1', customerId: 'cust-authoritative', agentRunId: 'run-1',
    toolName: 'createCustomer', toolArgs: {},
    toolResult: { ok: true, data: { customerId: 'cust-untrusted' } },
    leaseFence: 1, ownershipEpoch: 1,
  });
  assert.equal(savedCustomerId, 'cust-authoritative');
});

test('applySelectiveToolWriteBack keeps createCustomer result support without trusted context', async () => {
  let savedCustomerId: string | null = null;
  const mockClient = {
    query: async (sql: string, params: any[]) => {
      if (sql.includes('FROM conversation_working_state')) return { rows: [] };
      if (sql.includes('SELECT mode, ownership_epoch')) return { rows: [{ mode: 'AI_ACTIVE', ownership_epoch: 1, lease_fence: 1 }] };
      if (sql.includes('INSERT INTO conversation_working_state')) {
        savedCustomerId = params[2];
        return { rows: [{ version: 1 }] };
      }
      return { rows: [] };
    },
  } as any;

  await applySelectiveToolWriteBack(mockClient, {
    organizationId: 'org-1', conversationId: 'conv-1', agentRunId: 'run-1',
    toolName: 'createCustomer', toolArgs: {}, toolResult: { ok: true, data: { customerId: 'cust-created' } },
    leaseFence: 1, ownershipEpoch: 1,
  });
  assert.equal(savedCustomerId, 'cust-created');
});

test('applySelectiveToolWriteBack handles getAvailableSlots capping candidates at 3', async () => {
  let savedState: any = null;
  const future = new Date(Date.now() + 1800_000).toISOString();
  const mockClient = {
    query: async (sql: string, params: any[]) => {
      if (sql.includes('FROM conversation_working_state')) {
        return {
          rows: [
            {
              version: 1,
              customer_id: 'cust-1',
              lead_id: 'lead-1',
              state_json: { selectedEntity: { entityType: 'SERVICE', entityId: 'srv-dental' } },
              updated_at: new Date(),
            },
          ],
        };
      }
      if (sql.includes('SELECT mode, ownership_epoch')) {
        return { rows: [{ mode: 'AI_ACTIVE', ownership_epoch: 1, lease_fence: 1 }] };
      }
      if (sql.includes('UPDATE conversation_working_state') || sql.includes('INSERT INTO conversation_working_state')) {
        savedState = JSON.parse(params[4]);
        return { rowCount: 1, rows: [{ version: 2 }] };
      }
      return { rows: [] };
    },
  } as any;

  await applySelectiveToolWriteBack(mockClient, {
    organizationId: 'org-1',
    conversationId: 'conv-1',
    agentRunId: 'run-1',
    toolCallId: 'call-2',
    toolName: 'getAvailableSlots',
    toolArgs: { serviceId: 'srv-dental' },
    toolResult: {
      ok: true,
      code: 'OK',
      data: {
        slots: [
          {
            staffMemberId: 'staff-1',
            locationId: 'loc-1',
            startsAt: '2026-09-27T09:00:00Z',
            endsAt: '2026-09-27T09:30:00Z',
            localDate: '2026-09-27',
            localStartTime: '09:00',
            slotToken: 'token-1',
            expiresAt: future,
          },
          {
            staffMemberId: 'staff-1',
            locationId: 'loc-1',
            startsAt: '2026-09-27T10:00:00Z',
            endsAt: '2026-09-27T10:30:00Z',
            localDate: '2026-09-27',
            localStartTime: '10:00',
            slotToken: 'token-2',
            expiresAt: future,
          },
          {
            staffMemberId: 'staff-1',
            locationId: 'loc-1',
            startsAt: '2026-09-27T11:00:00Z',
            endsAt: '2026-09-27T11:30:00Z',
            localDate: '2026-09-27',
            localStartTime: '11:00',
            slotToken: 'token-3',
            expiresAt: future,
          },
          {
            staffMemberId: 'staff-1',
            locationId: 'loc-1',
            startsAt: '2026-09-27T12:00:00Z',
            endsAt: '2026-09-27T12:30:00Z',
            localDate: '2026-09-27',
            localStartTime: '12:00',
            slotToken: 'token-4',
            expiresAt: future,
          },
        ],
      },
    },
    leaseFence: 1,
    ownershipEpoch: 1,
  });

  assert.ok(savedState);
  assert.equal(savedState.candidateSlots?.length, 3);
  assert.equal(savedState.candidateSlots?.[0]?.slotToken, 'token-1');
  assert.equal(savedState.candidateSlots?.[2]?.slotToken, 'token-3');
});

test('applySelectiveToolWriteBack clears candidateSlots on createBooking success', async () => {
  let savedState: any = null;
  const mockClient = {
    query: async (sql: string, params: any[]) => {
      if (sql.includes('FROM conversation_working_state')) {
        return {
          rows: [
            {
              version: 2,
              customer_id: 'cust-1',
              lead_id: 'lead-1',
              state_json: {
                selectedEntity: { entityType: 'SERVICE', entityId: 'srv-dental' },
                candidateSlots: [{ slotToken: 'token-1' }],
              },
              updated_at: new Date(),
            },
          ],
        };
      }
      if (sql.includes('SELECT mode, ownership_epoch')) {
        return { rows: [{ mode: 'AI_ACTIVE', ownership_epoch: 1, lease_fence: 1 }] };
      }
      if (sql.includes('UPDATE conversation_working_state') || sql.includes('INSERT INTO conversation_working_state')) {
        savedState = JSON.parse(params[4]);
        return { rowCount: 1, rows: [{ version: 3 }] };
      }
      return { rows: [] };
    },
  } as any;

  await applySelectiveToolWriteBack(mockClient, {
    organizationId: 'org-1',
    conversationId: 'conv-1',
    agentRunId: 'run-1',
    toolCallId: 'call-3',
    toolName: 'createBooking',
    toolArgs: { slotToken: 'token-1' },
    toolResult: {
      ok: true,
      code: 'OK',
      data: {
        bookingId: 'bk-999',
        status: 'CONFIRMED',
      },
    },
    leaseFence: 1,
    ownershipEpoch: 1,
  });

  assert.ok(savedState);
  assert.equal(savedState.candidateSlots, undefined);
  assert.equal(savedState.lastConfirmedBookingId, 'bk-999');
});

test('applySelectiveToolWriteBack clears candidateSlots on createBooking conflict while preserving lead & entity', async () => {
  let savedState: any = null;
  const mockClient = {
    query: async (sql: string, params: any[]) => {
      if (sql.includes('FROM conversation_working_state')) {
        return {
          rows: [
            {
              version: 2,
              customer_id: 'cust-1',
              lead_id: 'lead-1',
              state_json: {
                selectedEntity: { entityType: 'SERVICE', entityId: 'srv-dental' },
                candidateSlots: [{ slotToken: 'token-1' }],
              },
              updated_at: new Date(),
            },
          ],
        };
      }
      if (sql.includes('SELECT mode, ownership_epoch')) {
        return { rows: [{ mode: 'AI_ACTIVE', ownership_epoch: 1, lease_fence: 1 }] };
      }
      if (sql.includes('UPDATE conversation_working_state') || sql.includes('INSERT INTO conversation_working_state')) {
        savedState = JSON.parse(params[4]);
        return { rowCount: 1, rows: [{ version: 3 }] };
      }
      return { rows: [] };
    },
  } as any;

  await applySelectiveToolWriteBack(mockClient, {
    organizationId: 'org-1',
    conversationId: 'conv-1',
    agentRunId: 'run-1',
    toolCallId: 'call-4',
    toolName: 'createBooking',
    toolArgs: { slotToken: 'token-1' },
    toolResult: {
      ok: false,
      code: 'CONFLICT',
    },
    leaseFence: 1,
    ownershipEpoch: 1,
  });

  assert.ok(savedState);
  assert.equal(savedState.candidateSlots, undefined);
  assert.equal(savedState.selectedEntity?.entityId, 'srv-dental');
});
