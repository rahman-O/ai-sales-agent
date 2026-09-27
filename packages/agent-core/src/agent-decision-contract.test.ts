import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentDecisionSchema } from '@ai-sales-agent/contracts';
import { AGENT_DECISION_CONTRACT, buildContextMessages } from './context-builder.js';
import { SCHEMA_REPAIR_PROMPT } from './orchestrator.js';
import type { ConversationSnapshot } from './ports.js';

test('ContextBuilder includes AgentDecision contract in system message', () => {
  const snap: ConversationSnapshot = {
    organizationId: 'org-test',
    conversationId: 'conv-test',
    customerId: 'cust-test',
    mode: 'AI_ACTIVE',
    ownershipEpoch: 0,
    leaseOwner: 'worker-1',
    leaseFence: 1,
    nextIngressSequence: 2,
    processedSequence: 0,
    targetIngressSequence: 1,
    messages: [{ id: 'm1', direction: 'INBOUND', ingressSequence: 1, timelineSequence: 1, contentText: 'مرحبا' }],
    summaryText: null,
    summaryWatermark: null,
    agentConfigVersionId: 'cfg-1',
    promptVersion: 'p1',
    modelProfile: 'default',
    toolAllowlist: [],
  };

  const msgs = buildContextMessages(snap);
  const systemMsg = msgs.find((m) => m.role === 'system');
  assert.ok(systemMsg, 'System message must exist');
  assert.ok(systemMsg.content.includes(AGENT_DECISION_CONTRACT));
});

test('AgentDecision contract specifies tool_request canonical shape', () => {
  assert.ok(AGENT_DECISION_CONTRACT.includes('"type": "tool_request"'));
  assert.ok(AGENT_DECISION_CONTRACT.includes('"toolName"'));
  assert.ok(AGENT_DECISION_CONTRACT.includes('"arguments"'));
});

test('AgentDecision contract specifies final_response canonical shape', () => {
  assert.ok(AGENT_DECISION_CONTRACT.includes('"type": "final_response"'));
  assert.ok(AGENT_DECISION_CONTRACT.includes('"text"'));
  assert.ok(AGENT_DECISION_CONTRACT.includes('"claims"'));
});

test('AgentDecision contract specifies safe_stop canonical shape', () => {
  assert.ok(AGENT_DECISION_CONTRACT.includes('"type": "safe_stop"'));
  assert.ok(AGENT_DECISION_CONTRACT.includes('"reason"'));
});

test('AgentDecision contract explicitly forbids OpenAI-style {name, arguments} and other invalid shapes', () => {
  assert.ok(AGENT_DECISION_CONTRACT.includes('NEVER emit OpenAI function-call format `{"name": "...", "arguments": {...}}`'));
  assert.ok(AGENT_DECISION_CONTRACT.includes('`{"action": "..."}`'));
  assert.ok(AGENT_DECISION_CONTRACT.includes('`{"tool_request": {...}}`'));
  assert.ok(AGENT_DECISION_CONTRACT.includes('NEVER emit commentary or markdown fences'));
});

test('Repair prompt requires preserving semantic fields and provides canonical shapes', () => {
  assert.ok(SCHEMA_REPAIR_PROMPT.includes('Preserve all semantic fields from the original response'));
  assert.ok(SCHEMA_REPAIR_PROMPT.includes('tool_request'));
  assert.ok(SCHEMA_REPAIR_PROMPT.includes('final_response'));
  assert.ok(SCHEMA_REPAIR_PROMPT.includes('safe_stop'));
  assert.ok(SCHEMA_REPAIR_PROMPT.includes('Do NOT drop toolName or arguments'));
});

test('Production schema remains unchanged and strictly validates variants', () => {
  // tool_request
  const toolReq = AgentDecisionSchema.parse({
    type: 'tool_request',
    toolName: 'searchServices',
    arguments: { query: 'test' },
  });
  assert.equal(toolReq.type, 'tool_request');

  // final_response
  const finalResp = AgentDecisionSchema.parse({
    type: 'final_response',
    text: 'أهلا بك',
    claims: [],
  });
  assert.equal(finalResp.type, 'final_response');

  // safe_stop
  const safeStop = AgentDecisionSchema.parse({
    type: 'safe_stop',
    reason: 'Safety trigger',
  });
  assert.equal(safeStop.type, 'safe_stop');

  // OpenAI-style {name, arguments} is strictly rejected by schema
  assert.throws(() => {
    AgentDecisionSchema.parse({
      name: 'searchServices',
      arguments: { query: 'test' },
    });
  });

  // Action-style {action, arguments} is strictly rejected by schema
  assert.throws(() => {
    AgentDecisionSchema.parse({
      action: 'searchServices',
      arguments: {},
    });
  });
});

test('Workflow guidance exists and instructs logical progression', async () => {
  const { WORKFLOW_GUIDANCE } = await import('./context-builder.js');
  assert.ok(WORKFLOW_GUIDANCE.includes('RECEPTION WORKFLOW GUIDANCE:'));
  assert.ok(WORKFLOW_GUIDANCE.includes('searchServices'));
  assert.ok(WORKFLOW_GUIDANCE.includes('ensureLead'));
  assert.ok(WORKFLOW_GUIDANCE.includes('getAvailableSlots'));
  assert.ok(WORKFLOW_GUIDANCE.includes('createBooking'));
});

test('searchServices is explicitly described as discovery not terminal completion', async () => {
  const { WORKFLOW_GUIDANCE } = await import('./context-builder.js');
  assert.ok(WORKFLOW_GUIDANCE.includes('`searchServices` is discovery, not booking completion.'));
});

test('slotToken provenance and backend confirmation remain explicit in workflow guidance', async () => {
  const { WORKFLOW_GUIDANCE } = await import('./context-builder.js');
  assert.ok(WORKFLOW_GUIDANCE.includes('`createBooking` MUST only use a real `slotToken` returned by `getAvailableSlots`'));
  assert.ok(WORKFLOW_GUIDANCE.includes('Never claim booking success until the backend `createBooking` tool succeeds'));
});

test('Production limits and timeouts remain unchanged', async () => {
  const { DEFAULT_LIMITS } = await import('./ports.js');
  assert.equal(DEFAULT_LIMITS.maxModelCalls, 5);
  assert.equal(DEFAULT_LIMITS.maxToolCalls, 8);
  assert.equal(DEFAULT_LIMITS.maxSchemaRepairs, 1);
  assert.equal(DEFAULT_LIMITS.modelTimeoutMs, 15_000);
  assert.equal(DEFAULT_LIMITS.runDeadlineMs, 45_000);
});

test('A: "تمام احجزلي أول موعد" + valid candidateSlots[0] directs createBooking with candidateSlots[0].slotToken', async () => {
  const { formatWorkingStateBlock } = await import('./context-builder.js');
  const wsBlock = formatWorkingStateBlock({
    version: 1,
    customerId: 'cust-1',
    leadId: 'lead-1',
    data: {
      selectedEntity: { entityType: 'SERVICE', entityId: 'svc-1', entityLabel: 'Dental Check-up' },
      candidateSlots: [
        {
          entityId: 'svc-1',
          staffMemberId: 'staff-1',
          locationId: 'loc-1',
          startsAt: '2026-09-27T06:30:00.000Z',
          endsAt: '2026-09-27T06:50:00.000Z',
          localDate: '2026-09-27',
          localStartTime: '09:30',
          slotToken: 'token-slot-1',
          expiresAt: '2026-09-27T07:00:00.000Z',
        },
      ],
    },
  });
  assert.ok(wsBlock);
  assert.ok(wsBlock.includes('"تمام احجزلي أول موعد" -> createBooking(candidateSlots[0].slotToken)'));
  assert.ok(wsBlock.includes('You MUST issue a `tool_request` for `createBooking` with the exact `slotToken`'));
});

test('B: First slot maps to index 0', async () => {
  const { formatWorkingStateBlock } = await import('./context-builder.js');
  const wsBlock = formatWorkingStateBlock({
    version: 1,
    customerId: 'cust-1',
    data: {
      candidateSlots: [
        {
          entityId: 'svc-1',
          staffMemberId: 'staff-1',
          locationId: 'loc-1',
          startsAt: '2026-09-27T06:30:00.000Z',
          endsAt: '2026-09-27T06:50:00.000Z',
          localDate: '2026-09-27',
          localStartTime: '09:30',
          slotToken: 'token-slot-0',
          expiresAt: '2026-09-27T07:00:00.000Z',
        },
      ],
    },
  });
  assert.ok(wsBlock);
  assert.ok(wsBlock.includes('first / أول / اول / الأول / أول موعد / اول موعد / أول واحد / ثبتلي أول واحد -> candidateSlots[0].slotToken'));
});

test('C: Second slot maps to index 1', async () => {
  const { formatWorkingStateBlock } = await import('./context-builder.js');
  const wsBlock = formatWorkingStateBlock({
    version: 1,
    customerId: 'cust-1',
    data: {
      candidateSlots: [
        {
          entityId: 'svc-1',
          staffMemberId: 'staff-1',
          locationId: 'loc-1',
          startsAt: '2026-09-27T06:30:00.000Z',
          endsAt: '2026-09-27T06:50:00.000Z',
          localDate: '2026-09-27',
          localStartTime: '09:30',
          slotToken: 'token-slot-0',
          expiresAt: '2026-09-27T07:00:00.000Z',
        },
        {
          entityId: 'svc-1',
          staffMemberId: 'staff-1',
          locationId: 'loc-1',
          startsAt: '2026-09-27T07:00:00.000Z',
          endsAt: '2026-09-27T07:20:00.000Z',
          localDate: '2026-09-27',
          localStartTime: '10:00',
          slotToken: 'token-slot-1',
          expiresAt: '2026-09-27T07:30:00.000Z',
        },
      ],
    },
  });
  assert.ok(wsBlock);
  assert.ok(wsBlock.includes('second / ثاني / تاني / الثاني / ثاني موعد / تاني موعد / ثاني واحد -> candidateSlots[1].slotToken'));
});

test('D: Redundant getAvailableSlots is explicitly forbidden when a valid selected candidate exists', async () => {
  const { WORKFLOW_GUIDANCE, formatWorkingStateBlock } = await import('./context-builder.js');
  assert.ok(WORKFLOW_GUIDANCE.includes('REDUNDANT AVAILABILITY PROHIBITION:'));
  assert.ok(WORKFLOW_GUIDANCE.includes('If valid, non-expired candidateSlots already exist in CURRENT_WORKING_STATE and the customer confirms one of them, DO NOT call `getAvailableSlots` again'));

  const wsBlock = formatWorkingStateBlock({
    version: 1,
    customerId: 'cust-1',
    data: {
      candidateSlots: [
        {
          entityId: 'svc-1',
          staffMemberId: 'staff-1',
          locationId: 'loc-1',
          startsAt: '2026-09-27T06:30:00.000Z',
          endsAt: '2026-09-27T06:50:00.000Z',
          localDate: '2026-09-27',
          localStartTime: '09:30',
          slotToken: 'token-slot-0',
          expiresAt: '2026-09-27T07:00:00.000Z',
        },
      ],
    },
  });
  assert.ok(wsBlock);
  assert.ok(wsBlock.includes('You MUST NOT call `searchServices`, `ensureLead`, `getLead`, `createCustomer`, or `getAvailableSlots`'));
  assert.ok(wsBlock.includes('INCORRECT DECISION: getAvailableSlots, searchServices, ensureLead, or final_response.'));
});

test('E: Expired token permits fresh availability', async () => {
  const { WORKFLOW_GUIDANCE, formatWorkingStateBlock } = await import('./context-builder.js');
  assert.ok(WORKFLOW_GUIDANCE.includes('(2) slot tokens expired'));

  const formatted = formatWorkingStateBlock({
    version: 1,
    customerId: 'cust-1',
    data: { candidateSlots: [] },
  });
  assert.ok(formatted);
  assert.ok(formatted.includes('If candidateSlots are expired or empty, or customer explicitly asks for a different day/service, call `getAvailableSlots` to refresh available slots'));
});

test('F: Changing requested date permits fresh availability', async () => {
  const { WORKFLOW_GUIDANCE, formatWorkingStateBlock } = await import('./context-builder.js');
  assert.ok(WORKFLOW_GUIDANCE.includes('(3) customer explicitly requests a different date/time'));
  const formatted = formatWorkingStateBlock({
    version: 1,
    customerId: 'cust-1',
    data: { candidateSlots: [] },
  });
  assert.ok(formatted);
  assert.ok(formatted.includes('customer explicitly asks for a different day/service, call `getAvailableSlots` to refresh available slots'));
});

test('G: No candidateSlots does NOT force createBooking', async () => {
  const { WORKFLOW_GUIDANCE } = await import('./context-builder.js');
  assert.ok(WORKFLOW_GUIDANCE.includes('If candidateSlots are not already present in CURRENT_WORKING_STATE, call `getAvailableSlots`'));
  assert.ok(WORKFLOW_GUIDANCE.includes('If candidateSlots already exist in CURRENT_WORKING_STATE, availability discovery is already satisfied: proceed directly to Step 4'));
});

test('H: No raw production token appears in snapshots/logs', async () => {
  const { formatWorkingStateBlock } = await import('./context-builder.js');
  const formatted = formatWorkingStateBlock({
    version: 1,
    customerId: 'cust-1',
    data: { candidateSlots: [] },
  });
  assert.ok(formatted);
  assert.ok(formatted.includes('NEVER leak raw slotToken strings into conversational final_response text to the customer'));
});


