import assert from 'node:assert/strict';
import test from 'node:test';
import { assertFinalResponseSafe } from './output-claim.js';
import { buildOperationKey, buildRunKey, hashNormalizedArgs } from './run-key.js';
import { FakeModelProvider, parseAgentDecision } from './fake-provider.js';
import { runAgentOrchestrator } from './orchestrator.js';
import type {
  ConversationSnapshot,
  ModelProvider,
  RunStorePort,
  ToolExecutorPort,
  ToolResult,
} from './ports.js';

test('runKey is stable and independent of random ids', () => {
  const a = buildRunKey({
    organizationId: 'o',
    conversationId: 'c',
    targetIngressSequence: 3,
    ownershipEpoch: 1,
    agentConfigVersionId: 'cfg',
  });
  const b = buildRunKey({
    organizationId: 'o',
    conversationId: 'c',
    targetIngressSequence: 3,
    ownershipEpoch: 1,
    agentConfigVersionId: 'cfg',
  });
  assert.equal(a, b);
  const c = buildRunKey({
    organizationId: 'o',
    conversationId: 'c',
    targetIngressSequence: 4,
    ownershipEpoch: 1,
    agentConfigVersionId: 'cfg',
  });
  assert.notEqual(a, c);
});

test('operationKey uses runKey not random agentRunId', () => {
  const runKey = buildRunKey({
    organizationId: 'o',
    conversationId: 'c',
    targetIngressSequence: 1,
    ownershipEpoch: 0,
    agentConfigVersionId: 'v1',
  });
  const k1 = buildOperationKey({
    runKey,
    toolCallOrdinal: 1,
    toolName: 'createCustomer',
    toolVersion: '1',
    normalizedArgsHash: hashNormalizedArgs({ displayName: 'A' }),
  });
  const k2 = buildOperationKey({
    runKey,
    toolCallOrdinal: 1,
    toolName: 'createCustomer',
    toolVersion: '1',
    normalizedArgsHash: hashNormalizedArgs({ displayName: 'A' }),
  });
  assert.equal(k1, k2);
});

test('parseAgentDecision rejects unknown type', () => {
  assert.throws(() => parseAgentDecision({ type: 'hack', text: 'x' }));
});

test('output claim rejects unevidenced booking language AR/EN', () => {
  assert.equal(assertFinalResponseSafe('Your appointment is booked.', []).ok, false);
  assert.equal(assertFinalResponseSafe('تم تأكيد الحجز', []).ok, false);
  assert.equal(assertFinalResponseSafe('Cleaning is 50 IQD', [{ kind: 'price', evidenceRef: 'p1' }]).ok, true);
});

function memoryStore(): RunStorePort & { newer: boolean; runs: Map<string, string> } {
  const runs = new Map<string, string>();
  const commands = new Map<string, { resultJson: unknown; succeeded: boolean }>();
  return {
    runs,
    newer: false,
    async createOrResumeRun(input) {
      const existing = runs.get(input.runKey);
      if (existing) return { agentRunId: existing, status: 'RUNNING', resumed: true };
      const id = `run-${runs.size + 1}`;
      runs.set(input.runKey, id);
      return { agentRunId: id, status: 'RUNNING', resumed: false };
    },
    async loadAuthority() {
      return {
        mode: 'AI_ACTIVE',
        ownershipEpoch: 0,
        leaseOwner: 'w1',
        leaseFence: 1,
        nextIngressSequence: 2,
        processedSequence: 0,
      };
    },
    async hasNewerInbound() {
      return this.newer;
    },
    async recordToolCall() {},
    async claimCommand(input) {
      const prev = commands.get(input.operationKey);
      if (prev?.succeeded) {
        return { alreadySucceeded: true, resultJson: prev.resultJson, operationId: input.operationKey };
      }
      commands.set(input.operationKey, { resultJson: null, succeeded: false });
      return { alreadySucceeded: false, resultJson: null, operationId: input.operationKey };
    },
    async completeCommand(input) {
      commands.set(input.operationId, { resultJson: input.resultJson, succeeded: true });
    },
    async finalizeSuccess() {
      return { outboundMessageId: 'msg-out' };
    },
    async finalizeHandoff() {
      return { newEpoch: 1 };
    },
    async finalizeTerminal() {},
    async recordUsage() {},
  };
}

test('orchestrator final response with Fake provider', async () => {
  const store = memoryStore();
  const tools: ToolExecutorPort = {
    listTools: () => [],
    execute: async () => ({ ok: false, code: 'NONE' }),
  };
  const snap: ConversationSnapshot = {
    organizationId: 'o',
    conversationId: 'c',
    customerId: 'cu',
    mode: 'AI_ACTIVE',
    ownershipEpoch: 0,
    leaseOwner: 'w1',
    leaseFence: 1,
    nextIngressSequence: 2,
    processedSequence: 0,
    targetIngressSequence: 1,
    messages: [{ id: 'm1', direction: 'INBOUND', ingressSequence: 1, timelineSequence: 1, contentText: 'hello' }],
    summaryText: null,
    summaryWatermark: null,
    agentConfigVersionId: 'cfg',
    promptVersion: 'p1',
    modelProfile: 'fake',
    toolAllowlist: [],
  };
  const result = await runAgentOrchestrator(snap, {
    provider: new FakeModelProvider({ kind: 'final', text: 'مرحبا' }),
    tools,
    store,
    allowFakeProvider: true,
  });
  assert.equal(result.terminal, 'SUCCEEDED');
  assert.equal(result.outboundMessageId, 'msg-out');
});

test('newer inbound supersedes before final', async () => {
  const store = memoryStore();
  store.newer = true;
  const tools: ToolExecutorPort = {
    listTools: () => [],
    execute: async () => ({ ok: false, code: 'NONE' }),
  };
  const snap: ConversationSnapshot = {
    organizationId: 'o',
    conversationId: 'c',
    customerId: 'cu',
    mode: 'AI_ACTIVE',
    ownershipEpoch: 0,
    leaseOwner: 'w1',
    leaseFence: 1,
    nextIngressSequence: 3,
    processedSequence: 0,
    targetIngressSequence: 1,
    messages: [{ id: 'm1', direction: 'INBOUND', ingressSequence: 1, timelineSequence: 1, contentText: 'hi' }],
    summaryText: null,
    summaryWatermark: null,
    agentConfigVersionId: 'cfg',
    promptVersion: 'p1',
    modelProfile: 'fake',
    toolAllowlist: [],
  };
  const result = await runAgentOrchestrator(snap, {
    provider: new FakeModelProvider({ kind: 'final', text: 'old' }),
    tools,
    store,
    allowFakeProvider: true,
  });
  assert.equal(result.terminal, 'SUPERSEDED');
  assert.equal(result.outboundMessageId, null);
});

test('create-or-resume reuses same runKey and skips terminal replay', async () => {
  const store = memoryStore();
  const statusByRun = new Map<string, string>();
  const origCreate = store.createOrResumeRun.bind(store);
  store.createOrResumeRun = async (input) => {
    const r = await origCreate(input);
    if (statusByRun.has(input.runKey)) {
      return { agentRunId: r.agentRunId, status: statusByRun.get(input.runKey)!, resumed: true };
    }
    statusByRun.set(input.runKey, 'RUNNING');
    return r;
  };
  store.finalizeSuccess = async () => {
    for (const k of statusByRun.keys()) statusByRun.set(k, 'SUCCEEDED');
    return { outboundMessageId: 'msg-out' };
  };
  const tools: ToolExecutorPort = {
    listTools: () => [],
    execute: async () => ({ ok: false, code: 'NONE' } satisfies ToolResult),
  };
  const snap: ConversationSnapshot = {
    organizationId: 'o',
    conversationId: 'c',
    customerId: 'cu',
    mode: 'AI_ACTIVE',
    ownershipEpoch: 0,
    leaseOwner: 'w1',
    leaseFence: 1,
    nextIngressSequence: 2,
    processedSequence: 0,
    targetIngressSequence: 1,
    messages: [{ id: 'm1', direction: 'INBOUND', ingressSequence: 1, timelineSequence: 1, contentText: 'x' }],
    summaryText: null,
    summaryWatermark: null,
    agentConfigVersionId: 'cfg',
    promptVersion: 'p1',
    modelProfile: 'fake',
    toolAllowlist: [],
  };
  const provider: ModelProvider = new FakeModelProvider({ kind: 'final', text: 'a' });
  const first = await runAgentOrchestrator(snap, { provider, tools, store, allowFakeProvider: true });
  assert.equal(first.terminal, 'SUCCEEDED');
  const second = await runAgentOrchestrator(snap, { provider, tools, store, allowFakeProvider: true });
  assert.equal(second.reason, 'already_terminal');
  assert.equal(store.runs.size, 1);
});

test('summary CAS rejects version conflict and watermark ahead', async () => {
  const { evaluateSummaryCas } = await import('./summary-cas.js');
  assert.equal(
    evaluateSummaryCas(
      { expectedVersion: 1, currentVersion: 2, sourceWatermark: 3, maxAllowedWatermark: 5 },
      4,
    ).ok,
    false,
  );
  assert.equal(
    evaluateSummaryCas(
      { expectedVersion: 1, currentVersion: 1, sourceWatermark: 3, maxAllowedWatermark: 5 },
      9,
    ).ok,
    false,
  );
  assert.equal(
    evaluateSummaryCas(
      { expectedVersion: 1, currentVersion: 1, sourceWatermark: 3, maxAllowedWatermark: 5 },
      4,
    ).ok,
    true,
  );
});

test('context builder drops stale summary watermark', async () => {
  const { buildContextMessages } = await import('./context-builder.js');
  const msgs = buildContextMessages({
    organizationId: 'o',
    conversationId: 'c',
    customerId: 'cu',
    mode: 'AI_ACTIVE',
    ownershipEpoch: 0,
    leaseOwner: 'w',
    leaseFence: 1,
    nextIngressSequence: 2,
    processedSequence: 0,
    targetIngressSequence: 1,
    messages: [{ id: 'm', direction: 'INBOUND', ingressSequence: 1, timelineSequence: 1, contentText: 'hi' }],
    summaryText: 'stale summary',
    summaryWatermark: 99,
    agentConfigVersionId: 'cfg',
    promptVersion: 'p',
    modelProfile: 'fake',
    toolAllowlist: [],
  });
  assert.ok(!msgs[0]!.content.includes('stale summary'));
});
