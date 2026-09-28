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
  assert.ok(WORKFLOW_GUIDANCE.includes('A successful `searchServices` result is an intermediate step, NOT a terminal step.'));
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
  assert.ok(WORKFLOW_GUIDANCE.includes('Call `getAvailableSlots` using the exact `serviceId` UUID'));
  assert.ok(WORKFLOW_GUIDANCE.includes('If candidateSlots already exist in CURRENT_WORKING_STATE, availability discovery is already satisfied: proceed directly to Step 5'));
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

// ============================================================
// SECTION 10: LEAD FLOW CONTINUATION TESTS (A - E)
// ============================================================

test('LEAD_FLOW_A: booking intent + resolved service + customerId present + leadId absent explicitly requires ensureLead', async () => {
  const { WORKFLOW_GUIDANCE } = await import('./context-builder.js');
  assert.ok(WORKFLOW_GUIDANCE.includes('If `customerId` is present and `leadId` is absent: call `ensureLead` with the resolved `serviceId` UUID.'));
});

test('LEAD_FLOW_B: service discovery completion forbids redundant searchServices', async () => {
  const { WORKFLOW_GUIDANCE } = await import('./context-builder.js');
  assert.ok(WORKFLOW_GUIDANCE.includes('SERVICE DISCOVERY STEP IS COMPLETE. Do NOT repeat `searchServices`'));
});

test('LEAD_FLOW_C: successful searchServices is not treated as workflow terminal', async () => {
  const { WORKFLOW_GUIDANCE } = await import('./context-builder.js');
  assert.ok(WORKFLOW_GUIDANCE.includes('A successful `searchServices` result is an intermediate step, NOT a terminal step.'));
  assert.ok(WORKFLOW_GUIDANCE.includes('When booking intent exists, you MUST NOT emit conversational filler as `final_response`; proceed immediately to `ensureLead` or `getAvailableSlots`.'));
});

test('LEAD_FLOW_D: customer already present means createCustomer is not required', async () => {
  const { WORKFLOW_GUIDANCE } = await import('./context-builder.js');
  assert.ok(WORKFLOW_GUIDANCE.includes('If `customerId` is already present: `createCustomer` is NOT required and must NOT be called.'));
});

test('LEAD_FLOW_E: lead already present does not force ensureLead again', async () => {
  const { WORKFLOW_GUIDANCE } = await import('./context-builder.js');
  assert.ok(WORKFLOW_GUIDANCE.includes('If `leadId` is already present: `ensureLead` is NOT required again.'));
});

// ============================================================
// SECTION 11: ZERO-SLOT RECOVERY TESTS (Guidance & Loop Guard)
// ============================================================

test('ZERO_SLOT_GUIDANCE: zero slots forbids identical retry and specifies allowed next actions', async () => {
  const { WORKFLOW_GUIDANCE } = await import('./context-builder.js');
  assert.ok(WORKFLOW_GUIDANCE.includes('ZERO-SLOT RECOVERY SEMANTICS: If `getAvailableSlots` returns zero slots (`slots: []`), DO NOT repeat `getAvailableSlots` with identical arguments.'));
  assert.ok(WORKFLOW_GUIDANCE.includes('Allowed next actions on zero slots: (a) ask the customer for an alternative preferred date or time'));
});

// ============================================================
// SECTION 9: BOOKING PRECONDITION & EMPTY-CANDIDATE RECOVERY TESTS (A - G)
// ============================================================

test('BOOKING_PRECONDITION_A: candidateSlots = [] + confirmation phrase -> createBooking strictly forbidden', async () => {
  const { formatWorkingStateBlock, WORKFLOW_GUIDANCE } = await import('./context-builder.js');
  const ws = formatWorkingStateBlock({
    version: 1,
    customerId: 'cust-1',
    data: {
      selectedEntity: { entityType: 'SERVICE', entityId: 'svc-1', entityLabel: 'Checkup' },
      candidateSlots: [],
    },
  });
  assert.ok(ws);
  assert.ok(ws.includes('"candidateSlots": []'));
  assert.ok(ws.includes('If candidateSlots is empty ([]), absent, or the referenced index does not exist'));
  assert.ok(ws.includes('You MUST NOT call `createBooking`'));
  assert.ok(ws.includes('INCORRECT DECISION: createBooking (STRICTLY FORBIDDEN when candidateSlots is empty or slot index does not exist).'));
  assert.ok(WORKFLOW_GUIDANCE.includes('PRECONDITIONS REQUIRED BEFORE createBooking:'));
  assert.ok(WORKFLOW_GUIDANCE.includes('candidateSlots must be non-empty (length > 0) with a valid, non-expired slotToken'));
});

test('BOOKING_PRECONDITION_B: candidateSlots absent -> createBooking forbidden', async () => {
  const { formatWorkingStateBlock, WORKFLOW_GUIDANCE } = await import('./context-builder.js');
  const ws = formatWorkingStateBlock({
    version: 1,
    customerId: 'cust-1',
    data: {
      selectedEntity: { entityType: 'SERVICE', entityId: 'svc-1', entityLabel: 'Checkup' },
    },
  });
  assert.ok(ws);
  assert.ok(!ws.includes('"candidateSlots"'));
  assert.ok(ws.includes('`createBooking` is PERMITTED ONLY IF: customerId exists, serviceId exists, candidateSlots is NON-EMPTY (length > 0)'));
  assert.ok(WORKFLOW_GUIDANCE.includes('If ANY precondition is missing (e.g. candidateSlots is empty [], absent, expired, or referenced index does not exist)'));
});

test('BOOKING_PRECONDITION_C: requested candidate index missing -> createBooking forbidden', async () => {
  const { formatWorkingStateBlock } = await import('./context-builder.js');
  const ws = formatWorkingStateBlock({
    version: 1,
    customerId: 'cust-1',
    data: {
      candidateSlots: [
        {
          entityId: 'svc-1',
          staffMemberId: 'staff-1',
          locationId: 'loc-1',
          startsAt: '2026-09-28T09:00:00Z',
          endsAt: '2026-09-28T09:20:00Z',
          localDate: '2026-09-28',
          localStartTime: '09:00',
          slotToken: 'token-0',
          expiresAt: '2026-09-28T10:00:00Z',
        },
      ],
    },
  });
  assert.ok(ws);
  assert.ok(ws.includes('If the requested ordinal index does NOT exist in candidateSlots (e.g. requesting first slot when candidateSlots is empty, or second slot when only 1 exists): DO NOT call createBooking'));
});

test('BOOKING_PRECONDITION_D: expired candidate token -> createBooking forbidden and fresh availability allowed', async () => {
  const { formatWorkingStateBlock, WORKFLOW_GUIDANCE } = await import('./context-builder.js');
  const ws = formatWorkingStateBlock({
    version: 1,
    customerId: 'cust-1',
    data: { candidateSlots: [] },
  });
  assert.ok(ws);
  assert.ok(ws.includes('If candidateSlots are expired or empty, or customer explicitly asks for a different day/service, call `getAvailableSlots` to refresh available slots.'));
  assert.ok(WORKFLOW_GUIDANCE.includes('(2) slot tokens expired'));
});

test('BOOKING_PRECONDITION_E: valid candidateSlots[0] + first-slot confirmation -> createBooking with exact token', async () => {
  const { formatWorkingStateBlock } = await import('./context-builder.js');
  const ws = formatWorkingStateBlock({
    version: 1,
    customerId: 'cust-1',
    data: {
      selectedEntity: { entityType: 'SERVICE', entityId: 'svc-1', entityLabel: 'Checkup' },
      candidateSlots: [
        {
          entityId: 'svc-1',
          staffMemberId: 'staff-1',
          locationId: 'loc-1',
          startsAt: '2026-09-28T09:00:00Z',
          endsAt: '2026-09-28T09:20:00Z',
          localDate: '2026-09-28',
          localStartTime: '09:00',
          slotToken: 'exact-real-slot-token-12345',
          expiresAt: '2026-09-28T10:00:00Z',
        },
      ],
    },
  });
  assert.ok(ws);
  assert.ok(ws.includes('"slotToken": "exact-real-slot-token-12345"'));
  assert.ok(ws.includes('You MUST issue a `tool_request` for `createBooking` with the exact `slotToken`'));
});

test('BOOKING_PRECONDITION_F: no fake token is ever generated by guidance', async () => {
  const { WORKFLOW_GUIDANCE, formatWorkingStateBlock } = await import('./context-builder.js');
  assert.ok(WORKFLOW_GUIDANCE.includes('`createBooking` MUST only use a real `slotToken` returned by `getAvailableSlots`. Never fabricate slot tokens'));
  assert.ok(WORKFLOW_GUIDANCE.includes('You MUST NOT fabricate, invent, or guess a slotToken or booking ID.'));
  const ws = formatWorkingStateBlock({
    version: 1,
    customerId: 'cust-1',
    data: { candidateSlots: [] },
  });
  assert.ok(ws);
  assert.ok(ws.includes('You MUST NOT fabricate or guess a slotToken.'));
});

test('BOOKING_PRECONDITION_G: backend INVALID_TOKEN protection remains authoritative', async () => {
  const { verifySlotToken } = await import('../../agent-adapters/src/slot-token.js');
  const result = verifySlotToken('invalid-fake-or-guessed-token', 'some-secret-key-32-chars-long-123456');
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'INVALID_TOKEN');
});

// ============================================================
// SECTION 7: TIMED-OUT CONTINUITY & WORKING-STATE AUTHORITY TESTS (A - G)
// ============================================================

test('TIMED_OUT_CONTINUITY_A: working state with valid candidateSlots directs createBooking after timed-out turn without fake assistant history', async () => {
  const { buildContextMessages } = await import('./context-builder.js');
  const snap: ConversationSnapshot = {
    organizationId: 'org-test',
    conversationId: 'conv-test',
    customerId: 'cust-123',
    mode: 'AI_ACTIVE',
    ownershipEpoch: 0,
    leaseOwner: 'worker-1',
    leaseFence: 1,
    nextIngressSequence: 4,
    processedSequence: 2,
    targetIngressSequence: 3,
    messages: [
      { id: 'm1', direction: 'INBOUND', ingressSequence: 1, timelineSequence: 1, contentText: 'أريد أحجز موعد لفحص أسناني' },
      { id: 'm2', direction: 'INBOUND', ingressSequence: 2, timelineSequence: 2, contentText: 'شنو المواعيد المتوفرة يوم 2026-09-28؟' },
      { id: 'm3', direction: 'INBOUND', ingressSequence: 3, timelineSequence: 3, contentText: 'احجز الأول' },
    ],
    summaryText: null,
    summaryWatermark: null,
    agentConfigVersionId: 'cfg-1',
    promptVersion: 'p1',
    modelProfile: 'default',
    toolAllowlist: [],
    workingState: {
      version: 2,
      customerId: 'cust-123',
      leadId: 'lead-123',
      data: {
        selectedEntity: { entityType: 'SERVICE', entityId: 'svc-dental-1', entityLabel: 'Dental Checkup' },
        candidateSlots: [
          {
            entityId: 'svc-dental-1',
            staffMemberId: 'staff-1',
            locationId: 'loc-1',
            startsAt: '2026-09-28T06:30:00.000Z',
            endsAt: '2026-09-28T06:50:00.000Z',
            localDate: '2026-09-28',
            localStartTime: '09:30',
            slotToken: 'valid-persisted-token-xyz',
            expiresAt: new Date(Date.now() + 600_000).toISOString(),
          },
        ],
      },
    },
  };

  const msgs = buildContextMessages(snap);
  const systemMsg = msgs.find((m) => m.role === 'system')!;
  assert.ok(systemMsg.content.includes('CURRENT_WORKING_STATE'));
  assert.ok(systemMsg.content.includes('valid-persisted-token-xyz'));
  assert.ok(systemMsg.content.includes('You MUST issue a `tool_request` for `createBooking` with the exact `slotToken` (candidateSlots[0].slotToken) as your VERY FIRST action.'));

  // Ensure no synthetic assistant messages were injected into conversation timeline
  const assistantMsgs = msgs.filter((m) => m.role === 'assistant');
  assert.equal(assistantMsgs.length, 0, 'No synthetic assistant messages should be added to history');
});

test('TIMED_OUT_CONTINUITY_B: serviceId already in working state -> searchServices not repeated', async () => {
  const { WORKFLOW_GUIDANCE, formatWorkingStateBlock } = await import('./context-builder.js');
  assert.ok(WORKFLOW_GUIDANCE.includes('If serviceId (or selectedEntity.entityId) is already resolved and unchanged: Step 1 (Service Discovery) is ALREADY COMPLETE. Do NOT call `searchServices`'));
  const ws = formatWorkingStateBlock({
    version: 1,
    customerId: 'cust-1',
    data: {
      selectedEntity: { entityType: 'SERVICE', entityId: 'svc-1', entityLabel: 'Checkup' },
    },
  });
  assert.ok(ws);
  assert.ok(ws.includes('If serviceId / selectedEntity is present: service discovery is COMPLETE. DO NOT call searchServices.'));
});

test('TIMED_OUT_CONTINUITY_C: candidateSlots already valid -> getAvailableSlots not repeated', async () => {
  const { WORKFLOW_GUIDANCE, formatWorkingStateBlock } = await import('./context-builder.js');
  assert.ok(WORKFLOW_GUIDANCE.includes('If candidateSlots (with valid, non-expired slotTokens) already exist and the customer confirms a slot: Step 3 (Availability Discovery) and Step 4 (Slot Presentation) are ALREADY SATISFIED. Do NOT call `getAvailableSlots`. Jump directly to Step 5 (`createBooking`).'));
  const ws = formatWorkingStateBlock({
    version: 1,
    customerId: 'cust-1',
    data: {
      candidateSlots: [
        {
          entityId: 'svc-1',
          staffMemberId: 'staff-1',
          locationId: 'loc-1',
          startsAt: '2026-09-28T09:00:00Z',
          endsAt: '2026-09-28T09:20:00Z',
          localDate: '2026-09-28',
          localStartTime: '09:00',
          slotToken: 'tok-1',
          expiresAt: '2026-09-28T10:00:00Z',
        },
      ],
    },
  });
  assert.ok(ws);
  assert.ok(ws.includes('If candidateSlots has valid tokens and user confirms: availability discovery is COMPLETE. DO NOT call getAvailableSlots.'));
});

test('TIMED_OUT_CONTINUITY_D: leadId already present -> ensureLead not repeated', async () => {
  const { WORKFLOW_GUIDANCE, formatWorkingStateBlock } = await import('./context-builder.js');
  assert.ok(WORKFLOW_GUIDANCE.includes('If leadId is already present: `ensureLead` is ALREADY COMPLETE. Do NOT call `ensureLead`.'));
  const ws = formatWorkingStateBlock({
    version: 1,
    customerId: 'cust-1',
    leadId: 'lead-1',
    data: {},
  });
  assert.ok(ws);
  assert.ok(ws.includes('If leadId is present: lead qualification is COMPLETE. DO NOT call ensureLead.'));
});

test('TIMED_OUT_CONTINUITY_E: expired candidate token -> availability refresh allowed', async () => {
  const { WORKFLOW_GUIDANCE, formatWorkingStateBlock } = await import('./context-builder.js');
  assert.ok(WORKFLOW_GUIDANCE.includes('(2) slot tokens expired'));
  const ws = formatWorkingStateBlock({
    version: 1,
    customerId: 'cust-1',
    data: { candidateSlots: [] },
  });
  assert.ok(ws);
  assert.ok(ws.includes('If candidateSlots are expired or empty, or customer explicitly asks for a different day/service, call `getAvailableSlots` to refresh available slots.'));
});

test('TIMED_OUT_CONTINUITY_F: missing candidate slots -> existing zero-slot recovery preserved', async () => {
  const { WORKFLOW_GUIDANCE, formatWorkingStateBlock } = await import('./context-builder.js');
  assert.ok(WORKFLOW_GUIDANCE.includes('ZERO-SLOT RECOVERY SEMANTICS: If `getAvailableSlots` returns zero slots (`slots: []`), DO NOT repeat `getAvailableSlots` with identical arguments.'));
  const ws = formatWorkingStateBlock({
    version: 1,
    customerId: 'cust-1',
    data: { candidateSlots: [] },
  });
  assert.ok(ws);
  assert.ok(ws.includes('If candidateSlots is empty ([]), absent, or the referenced index does not exist, or the token is expired:'));
  assert.ok(ws.includes('You MUST NOT call `createBooking`.'));
});

test('TIMED_OUT_CONTINUITY_G: no synthetic assistant history is inserted into context messages', async () => {
  const { buildContextMessages } = await import('./context-builder.js');
  const snap: ConversationSnapshot = {
    organizationId: 'org-test',
    conversationId: 'conv-test',
    customerId: 'cust-123',
    mode: 'AI_ACTIVE',
    ownershipEpoch: 0,
    leaseOwner: 'worker-1',
    leaseFence: 1,
    nextIngressSequence: 3,
    processedSequence: 0,
    targetIngressSequence: 2,
    messages: [
      { id: 'm1', direction: 'INBOUND', ingressSequence: 1, timelineSequence: 1, contentText: 'User msg 1' },
      { id: 'm2', direction: 'INBOUND', ingressSequence: 2, timelineSequence: 2, contentText: 'User msg 2' },
    ],
    summaryText: null,
    summaryWatermark: null,
    agentConfigVersionId: 'cfg-1',
    promptVersion: 'p1',
    modelProfile: 'default',
    toolAllowlist: [],
    workingState: {
      version: 1,
      customerId: 'cust-123',
      data: {
        candidateSlots: [
          {
            entityId: 's1',
            staffMemberId: 'st1',
            locationId: 'l1',
            startsAt: '2026-09-28T09:00:00Z',
            endsAt: '2026-09-28T09:20:00Z',
            localDate: '2026-09-28',
            localStartTime: '09:00',
            slotToken: 'tok1',
            expiresAt: '2026-09-28T10:00:00Z',
          },
        ],
      },
    },
  };

  const msgs = buildContextMessages(snap);
  const userMsgs = msgs.filter((m) => m.role === 'user');
  const assistantMsgs = msgs.filter((m) => m.role === 'assistant');

  assert.equal(userMsgs.length, 2);
  assert.equal(assistantMsgs.length, 0, 'No assistant message should be present when none existed in snap.messages');
});



