import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { createToolExecutor } from './tool-executor.js';
import { createPreviewToolExecutor } from './preview-tool-executor.js';
import { updateWorkingStateDataWithToolResult } from './conversation-working-state.js';
import { findWorkflowForIntent, getWorkflowDefinition } from '@ai-sales-agent/agent-core';

const fakeCtx = {
  organizationId: '00000000-0000-0000-0000-000000000001',
  conversationId: '00000000-0000-0000-0000-000000000002',
  customerId: '00000000-0000-0000-0000-000000000003',
  runKey: 'run-1',
  agentRunId: '00000000-0000-0000-0000-000000000004',
  leaseOwner: 'owner-1',
  leaseFence: 1,
  ownershipEpoch: 1,
  targetIngressSequence: 1,
  toolCallOrdinal: 1,
  sandbox: false,
};

test('MB-12 Workflow Registry: marks QUOTE and PURCHASE workflows as executable', () => {
  const quoteWorkflow = getWorkflowDefinition('QUOTE');
  assert.equal(quoteWorkflow.isExecutable, true);
  assert.ok(quoteWorkflow.requiredCapabilities.includes('supportsQuotes'));
  assert.ok(quoteWorkflow.allowedTools.includes('createQuote'));
  assert.ok(quoteWorkflow.allowedTools.includes('getQuote'));

  const purchaseWorkflow = getWorkflowDefinition('PURCHASE');
  assert.equal(purchaseWorkflow.isExecutable, true);
  assert.ok(purchaseWorkflow.requiredCapabilities.includes('supportsOrders'));
  assert.ok(purchaseWorkflow.allowedTools.includes('createOrder'));
  assert.ok(purchaseWorkflow.allowedTools.includes('confirmOrder'));
});

test('MB-12 Workflow Registry: resolves QUOTE_INTENT and PURCHASE_INTENT to workflows', () => {
  const quoteWf = findWorkflowForIntent('QUOTE_INTENT');
  assert.equal(quoteWf?.id, 'QUOTE');

  const purchaseWf = findWorkflowForIntent('PURCHASE_INTENT');
  assert.equal(purchaseWf?.id, 'PURCHASE');
});

test('MB-12 Capability Gating: blocks createQuote when supportsQuotes is false', async () => {
  const mockPool: any = {
    connect: async () => ({
      query: async (sql: string) => {
        if (sql.includes('conversations')) {
          return {
            rows: [
              {
                mode: 'AI_ACTIVE',
                ownership_epoch: 1,
                lease_owner: 'owner-1',
                lease_fence: 1,
                next_sequence: 2,
                customer_id: fakeCtx.customerId,
              },
            ],
          };
        }
        if (sql.includes('organization_capabilities')) {
          return {
            rows: [{ supports_quotes: false, supports_orders: false, supports_booking: true }],
          };
        }
        return { rows: [] };
      },
      release: () => {},
    }),
  };

  const mockStore: any = {
    claimCommand: async () => ({ alreadySucceeded: false, resultJson: null, operationId: 'op-1' }),
  };

  const executor = createToolExecutor(mockPool, mockStore);
  const res = await executor.execute(
    'createQuote',
    { items: [{ catalogItemId: '00000000-0000-0000-0000-000000000010', quantity: 1 }] },
    fakeCtx,
  );

  assert.equal(res.ok, false);
  assert.equal(res.code, 'TOOL_NOT_AUTHORIZED');
  assert.equal(res.safeMessage, 'quotes_disabled');
});

test('MB-12 Capability Gating: blocks createOrder when supportsOrders is false', async () => {
  const mockPool: any = {
    connect: async () => ({
      query: async (sql: string) => {
        if (sql.includes('conversations')) {
          return {
            rows: [
              {
                mode: 'AI_ACTIVE',
                ownership_epoch: 1,
                lease_owner: 'owner-1',
                lease_fence: 1,
                next_sequence: 2,
                customer_id: fakeCtx.customerId,
              },
            ],
          };
        }
        if (sql.includes('organization_capabilities')) {
          return {
            rows: [{ supports_quotes: true, supports_orders: false, supports_booking: true }],
          };
        }
        return { rows: [] };
      },
      release: () => {},
    }),
  };

  const mockStore: any = {
    claimCommand: async () => ({ alreadySucceeded: false, resultJson: null, operationId: 'op-1' }),
  };

  const executor = createToolExecutor(mockPool, mockStore);
  const res = await executor.execute(
    'createOrder',
    { items: [{ catalogItemId: '00000000-0000-0000-0000-000000000010', quantity: 1 }] },
    fakeCtx,
  );

  assert.equal(res.ok, false);
  assert.equal(res.code, 'TOOL_NOT_AUTHORIZED');
  assert.equal(res.safeMessage, 'orders_disabled');
});

test('MB-12 Working State: updates working state when createQuote succeeds', () => {
  const result = updateWorkingStateDataWithToolResult(
    {},
    'createQuote',
    { items: [] },
    { ok: true, data: { quote: { id: 'quote-123', totalAmountMinor: '25000' } } },
  );

  assert.equal(result.changed, true);
  assert.equal(result.stateData.draftQuoteId, 'quote-123');
  assert.equal(result.stateData.activeWorkflow?.id, 'QUOTE');
  assert.equal(result.stateData.activeWorkflow?.stage, 'IN_PROGRESS');
});

test('MB-12 Working State: updates working state when presentQuote succeeds', () => {
  const result = updateWorkingStateDataWithToolResult(
    { draftQuoteId: 'quote-123' },
    'presentQuote',
    { quoteId: 'quote-123' },
    { ok: true, data: { quote: { id: 'quote-123', totalAmountMinor: '25000', currency: 'IQD' } } },
  );

  assert.equal(result.changed, true);
  assert.equal(result.stateData.activeWorkflow?.stage, 'AWAITING_CONFIRMATION');
  assert.deepEqual(result.stateData.pendingTransactionConfirmation, {
    transactionType: 'QUOTE',
    transactionId: 'quote-123',
    totalAmountMinor: '25000',
    currency: 'IQD',
  });
});

test('MB-12 Working State: completes workflow when acceptQuote succeeds', () => {
  const result = updateWorkingStateDataWithToolResult(
    {
      draftQuoteId: 'quote-123',
      pendingTransactionConfirmation: {
        transactionType: 'QUOTE',
        transactionId: 'quote-123',
        totalAmountMinor: '25000',
        currency: 'IQD',
      },
    },
    'acceptQuote',
    { quoteId: 'quote-123' },
    { ok: true, data: { quote: { id: 'quote-123', status: 'ACCEPTED' } } },
  );

  assert.equal(result.changed, true);
  assert.equal(result.stateData.activeWorkflow?.stage, 'COMPLETED');
  assert.equal(result.stateData.pendingTransactionConfirmation, undefined);
  assert.equal(result.stateData.lastCompletedWorkflow?.id, 'QUOTE');
});

test('MB-12 Working State: updates working state when createOrder succeeds', () => {
  const result = updateWorkingStateDataWithToolResult(
    {},
    'createOrder',
    { items: [] },
    { ok: true, data: { order: { id: 'order-123', totalAmountMinor: '50000', currency: 'IQD' } } },
  );

  assert.equal(result.changed, true);
  assert.equal(result.stateData.draftOrderId, 'order-123');
  assert.equal(result.stateData.activeWorkflow?.id, 'PURCHASE');
  assert.equal(result.stateData.activeWorkflow?.stage, 'AWAITING_CONFIRMATION');
  assert.deepEqual(result.stateData.pendingTransactionConfirmation, {
    transactionType: 'ORDER',
    transactionId: 'order-123',
    totalAmountMinor: '50000',
    currency: 'IQD',
  });
});

test('MB-12 Working State: completes workflow when confirmOrder succeeds', () => {
  const result = updateWorkingStateDataWithToolResult(
    {
      draftOrderId: 'order-123',
      pendingTransactionConfirmation: {
        transactionType: 'ORDER',
        transactionId: 'order-123',
        totalAmountMinor: '50000',
        currency: 'IQD',
      },
    },
    'confirmOrder',
    { orderId: 'order-123' },
    { ok: true, data: { order: { id: 'order-123', status: 'CONFIRMED' } } },
  );

  assert.equal(result.changed, true);
  assert.equal(result.stateData.activeWorkflow?.stage, 'COMPLETED');
  assert.equal(result.stateData.pendingTransactionConfirmation, undefined);
  assert.equal(result.stateData.lastCompletedWorkflow?.id, 'PURCHASE');
});

test('MB-12 Preview: simulates createQuote, presentQuote, and acceptQuote without DB mutations', async () => {
  const traceEvents: any[] = [];
  const mockPool: any = { connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }) };
  const previewExecutor = createPreviewToolExecutor(mockPool, (t) => traceEvents.push(t));

  const createRes = await previewExecutor.execute(
    'createQuote',
    { items: [{ catalogItemId: 'item-1', quantity: 1 }] },
    fakeCtx,
  );

  assert.equal(createRes.ok, true);
  assert.equal((createRes.data as any).simulated, true);
  assert.equal((createRes.data as any).wouldSucceed, true);

  const presentRes = await previewExecutor.execute(
    'presentQuote',
    { quoteId: 'quote-preview-1' },
    fakeCtx,
  );

  assert.equal(presentRes.ok, true);
  assert.equal((presentRes.data as any).simulated, true);

  const acceptRes = await previewExecutor.execute(
    'acceptQuote',
    { quoteId: 'quote-preview-1' },
    fakeCtx,
  );

  assert.equal(acceptRes.ok, true);
  assert.equal((acceptRes.data as any).simulated, true);
  assert.equal(traceEvents.length, 3);
});

test('MB-12 Preview: simulates createOrder and confirmOrder without DB mutations', async () => {
  const mockPool: any = { connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }) };
  const previewExecutor = createPreviewToolExecutor(mockPool);

  const createRes = await previewExecutor.execute(
    'createOrder',
    { items: [{ catalogItemId: 'item-1', quantity: 1 }] },
    fakeCtx,
  );

  assert.equal(createRes.ok, true);
  assert.equal((createRes.data as any).simulated, true);

  const confirmRes = await previewExecutor.execute(
    'confirmOrder',
    { orderId: 'order-preview-1' },
    fakeCtx,
  );

  assert.equal(confirmRes.ok, true);
  assert.equal((confirmRes.data as any).simulated, true);
});
