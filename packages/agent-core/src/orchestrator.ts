import { ALL_REGISTERED_TOOL_NAMES, type AgentDecision, type AgentRunTerminalStatus } from '@ai-sales-agent/contracts';
import { buildContextMessages } from './context-builder.js';
import { parseAgentDecision } from './fake-provider.js';
import { assertFinalResponseSafe } from './output-claim.js';
import {
  DEFAULT_LIMITS,
  type AgentLimits,
  type ConversationSnapshot,
  type OrchestratorDeps,
  type OrchestratorResult,
} from './ports.js';
import { buildOperationKey, buildRunKey, hashNormalizedArgs } from './run-key.js';

function isRetryableProviderError(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && (err as { retryable?: boolean }).retryable);
}

export const SCHEMA_REPAIR_PROMPT = [
  'Previous output failed schema validation.',
  'Preserve all semantic fields from the original response while rewriting it into one complete valid AgentDecision JSON object.',
  'Return ONLY a single raw JSON object matching one of these canonical shapes:',
  '- Tool request: {"type": "tool_request", "toolName": "<toolName>", "arguments": {<args>}}',
  '- Final response: {"type": "final_response", "text": "<arabic message>", "claims": []}',
  '- Safe stop: {"type": "safe_stop", "reason": "<reason>"}',
  'Claim kind must be price, availability, booking, or generic. Policy/offer/knowledge claims use generic. A claim may have evidenceRef; booking/availability require backend evidence. Do not add unknown fields to canonical decisions.',
  'Do NOT drop toolName or arguments. Do NOT use {"name": "...", "arguments": {...}} format. Do NOT use markdown fences.',
].join(' ');

export async function runAgentOrchestrator(
  snap: ConversationSnapshot,
  deps: OrchestratorDeps,
): Promise<OrchestratorResult> {
  const limits: AgentLimits = { ...DEFAULT_LIMITS, ...deps.limits };
  const now = deps.now ?? Date.now;
  const started = now();
  const decisionTrace: AgentDecision[] = [];

  if (deps.provider.id === 'fake' && !deps.allowFakeProvider) {
    throw new Error('FakeModelProvider forbidden when allowFakeProvider=false');
  }

  if (snap.mode !== 'AI_ACTIVE') {
    throw new Error(`orchestrator_requires_AI_ACTIVE got ${snap.mode}`);
  }

  const runKey = buildRunKey({
    organizationId: snap.organizationId,
    conversationId: snap.conversationId,
    targetIngressSequence: snap.targetIngressSequence,
    ownershipEpoch: snap.ownershipEpoch,
    agentConfigVersionId: snap.agentConfigVersionId,
  });

  const run = await deps.store.createOrResumeRun({
    runKey,
    organizationId: snap.organizationId,
    conversationId: snap.conversationId,
    targetIngressSequence: snap.targetIngressSequence,
    ownershipEpoch: snap.ownershipEpoch,
    leaseFence: snap.leaseFence,
    agentConfigVersionId: snap.agentConfigVersionId,
    promptVersion: snap.promptVersion,
    modelProfile: snap.modelProfile,
  });

  // Create-or-resume: terminal runs are idempotent no-ops (crash/replay safe).
  if (run.resumed && run.status !== 'RUNNING') {
    return {
      terminal: run.status as AgentRunTerminalStatus,
      reason: 'already_terminal',
      agentRunId: run.agentRunId,
      runKey,
      outboundMessageId: null,
      decisionTrace,
    };
  }

  const end = async (
    status: AgentRunTerminalStatus,
    reason: string,
    advanceCursor: boolean,
    outboundMessageId: string | null = null,
  ): Promise<OrchestratorResult> => {
    if (status !== 'SUCCEEDED' && status !== 'HANDOFF_REQUESTED') {
      await deps.store.finalizeTerminal({
        organizationId: snap.organizationId,
        agentRunId: run.agentRunId,
        status,
        reason,
        advanceCursor,
        conversationId: snap.conversationId,
        targetIngressSequence: snap.targetIngressSequence,
        leaseOwner: snap.leaseOwner ?? '',
        leaseFence: snap.leaseFence,
        ownershipEpoch: snap.ownershipEpoch,
      });
    }
    return {
      terminal: status,
      reason,
      agentRunId: run.agentRunId,
      runKey,
      outboundMessageId,
      decisionTrace,
    };
  };

  const allow = new Set(
    snap.toolAllowlist.length
      ? snap.toolAllowlist.filter((n) => (ALL_REGISTERED_TOOL_NAMES as readonly string[]).includes(n))
      : [...ALL_REGISTERED_TOOL_NAMES].filter((n) => n !== 'searchKnowledge'),
  );
  const toolDefs = deps.tools.listTools().filter((t) => allow.has(t.name));

  let modelCalls = run.priorModelCalls ?? 0;
  let toolCalls = run.priorToolCalls ?? 0;
  const currentInbound = snap.messages.find(m => m.direction === 'INBOUND' && m.ingressSequence === snap.targetIngressSequence)?.contentText ?? '';
  const offersInquiry = /(?:شنو\s+عروض|عندكم\s+(?:عروض|خصم)|عدكم\s+(?:عروض|خصم)|أكو\s+خصم|شوف\s+العرض)/u.test(currentInbound);
  const locationInquiry = /(?:وين\s+موقع|أين\s+(?:موقع|العيادة)|موقعكم|مواعيد\s+العمل|ساعات\s+العمل)/u.test(currentInbound);
  const requiredInquiryTool = offersInquiry ? 'getActiveOffers' : locationInquiry ? 'searchKnowledge' : null;
  let inquiryEvidenceRetrieved = false;
  let missingOffersRetryUsed = false;
  let schemaRepairs = 0;
  let finalizationReserveUsed = false;
  let lastToolSucceeded = false;
  let successfulBookingResult: Record<string, unknown> | null = run.successfulBookingResult ?? null;
  let postToolModelOutputInvalid = false;
  let postMutationStructuredRetryUsed = false;
  const seenToolFingerprints = new Map<string, number>((run.priorToolFingerprints ?? []).map(f=>[`${f.toolName}:${f.argsHash}`,f.count]));
  const messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string }> = [
    ...buildContextMessages(snap),
  ];

  const finalizeSuccessfulBookingFallback = async (): Promise<OrchestratorResult> => {
    const bookingId =
      typeof successfulBookingResult?.bookingId === 'string'
        ? successfulBookingResult.bookingId
        : null;
    if (!bookingId) {
      return end('FAILED', 'post_mutation_result_missing', false);
    }
    const decision: AgentDecision = {
      type: 'final_response',
      text: 'تم تأكيد حجزك بنجاح.',
      claims: [{ kind: 'booking', evidenceRef: bookingId }],
    };
    const safe = assertFinalResponseSafe(decision.text, decision.claims);
    if (!safe.ok) return end('FAILED', safe.reason, false);
    decisionTrace.push(decision);
    const finalization = {
      source: 'AUTHORITATIVE_TOOL_RESULT' as const,
      postToolModelOutputInvalid: true,
      structuredRetryUsed: postMutationStructuredRetryUsed,
      structuredRetryRecovered: false,
      fallbackUsed: true,
      mutationToolName: 'createBooking',
    };
    const fin = await deps.store.finalizeSuccess({
      organizationId: snap.organizationId,
      conversationId: snap.conversationId,
      agentRunId: run.agentRunId,
      runKey,
      targetIngressSequence: snap.targetIngressSequence,
      leaseOwner: snap.leaseOwner ?? '',
      leaseFence: snap.leaseFence,
      ownershipEpoch: snap.ownershipEpoch,
      outboundText: decision.text,
      modelCalls,
      toolCalls,
      finalization,
    });
    return {
      terminal: 'SUCCEEDED',
      reason: 'final_response',
      agentRunId: run.agentRunId,
      runKey,
      outboundMessageId: fin.outboundMessageId,
      decisionTrace,
      finalization,
    };
  };

  while (true) {
    // A durable successful booking cannot be replayed after worker loss.
    if (run.resumed && successfulBookingResult) return finalizeSuccessfulBookingFallback();
    if (now() - started > limits.runDeadlineMs) {
      return end('TIMED_OUT', 'run_deadline', false);
    }
    const finalizationOnly = modelCalls >= limits.maxModelCalls;
    if (finalizationOnly && (finalizationReserveUsed || !lastToolSucceeded)) {
      if (successfulBookingResult && postToolModelOutputInvalid) {
        return finalizeSuccessfulBookingFallback();
      }
      return end('BUDGET_EXCEEDED', 'max_model_calls', false);
    }

    if (await deps.store.hasNewerInbound(snap.organizationId, snap.conversationId, snap.targetIngressSequence)) {
      return end('SUPERSEDED', 'newer_inbound_ingress', false);
    }

    const auth = await deps.store.loadAuthority(snap.organizationId, snap.conversationId);
    if (
      auth.mode !== 'AI_ACTIVE' ||
      auth.ownershipEpoch !== snap.ownershipEpoch ||
      auth.leaseFence !== snap.leaseFence ||
      auth.leaseOwner !== snap.leaseOwner
    ) {
      return end('STALE', 'authority_lost', false);
    }

    if (finalizationOnly) {
      finalizationReserveUsed = true;
      messages.push({ role: 'system', content: 'Operational model-call budget is exhausted. This is the single finalization-only reserve. Return final_response using only successful backend evidence already present, or safe_stop if evidence is insufficient. No tools or mutations are permitted. Never invent missing prices, discounts, slots or booking success.' });
    }
    modelCalls += 1;
    await deps.store.recordModelAttempt?.(snap.organizationId,run.agentRunId);
    let raw: unknown;
    try {
      const gen = await deps.provider.generate({
        messages,
        tools: (finalizationOnly ? [] : toolDefs).map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        })),
        responseSchemaHint: 'AgentDecision',
        budget: {},
        deadlineMs: limits.modelTimeoutMs,
        traceContext: { runKey, agentRunId: run.agentRunId },
      });
      await deps.store.recordUsage({
        organizationId: snap.organizationId,
        agentRunId: run.agentRunId,
        provider: deps.provider.id,
        model: gen.model,
        inputTokens: gen.usage.inputTokens ?? null,
        outputTokens: gen.usage.outputTokens ?? null,
        estimated: gen.usage.estimated,
        latencyMs: 0,
      });
      raw = gen.decision;
    } catch (err) {
      if (isRetryableProviderError(err) && modelCalls < limits.maxModelCalls) {
        continue;
      }
      return end(
        isRetryableProviderError(err) ? 'TIMED_OUT' : 'FAILED',
        isRetryableProviderError(err) ? 'transient_provider' : 'permanent_provider',
        false,
      );
    }

    let decision: AgentDecision;
    try {
      decision = parseAgentDecision(raw);
    } catch (error) {
      // Schema diagnostics contain only known schema paths/codes, never provider values.
      const issues = error && typeof error === 'object' && 'issues' in error && Array.isArray(error.issues)
        ? error.issues.map((issue: { code?: unknown; path?: unknown[] }) => ({
          code: typeof issue.code === 'string' && /^[a-z_]+$/.test(issue.code) ? issue.code : 'schema_error',
          path: (issue.path ?? []).map(part => typeof part === 'number' ? part :
            ['type', 'text', 'claims', 'kind', 'evidenceRef', 'toolName', 'arguments', 'reason'].includes(String(part)) ? part : '<field>'),
        })) : [];
      console.warn(JSON.stringify({ event: 'agent_decision_schema_invalid', agentRunId: run.agentRunId, issues }));
      if (successfulBookingResult) {
        postToolModelOutputInvalid = true;
        if (!postMutationStructuredRetryUsed) {
          postMutationStructuredRetryUsed = true;
          schemaRepairs += 1;
          messages.push({ role: 'user', content: SCHEMA_REPAIR_PROMPT });
          continue;
        }
        return finalizeSuccessfulBookingFallback();
      }
      if (schemaRepairs < limits.maxSchemaRepairs) {
        schemaRepairs += 1;
        messages.push({
          role: 'user',
          content: SCHEMA_REPAIR_PROMPT,
        });
        continue;
      }
      return end('FAILED', 'model_output_invalid', false);
    }
    decisionTrace.push(decision);

    if (decision.type === 'safe_stop') {
      if (successfulBookingResult && decision.reason === 'unparseable_provider_json') {
        postToolModelOutputInvalid = true;
        postMutationStructuredRetryUsed = true;
        return finalizeSuccessfulBookingFallback();
      }
      return end('FAILED', decision.reason, false);
    }

    if (decision.type === 'final_response') {
      if (requiredInquiryTool && allow.has(requiredInquiryTool) && !inquiryEvidenceRetrieved) {
        if (missingOffersRetryUsed || finalizationOnly) return end('FAILED', requiredInquiryTool === 'getActiveOffers' ? 'required_offers_evidence_missing' : 'required_knowledge_evidence_missing', false);
        missingOffersRetryUsed = true;
        messages.push({ role: 'system', content: `The current inbound contains an explicit factual inquiry requiring ${requiredInquiryTool}. No successful ${requiredInquiryTool} evidence exists for this turn. Retrieve it before final_response. Preserve booking candidates during this detour; do not request selection or create a booking. For offers, use the actual catalogItemId returned by backend service lookup, or omit it for organization-wide offers. For location or hours, retrieve published knowledge. This correction uses the remaining existing budget.` });
        continue;
      }
      const safe = assertFinalResponseSafe(decision.text, decision.claims);
      if (!safe.ok) {
        return end('FAILED', safe.reason, false);
      }
      if (await deps.store.hasNewerInbound(snap.organizationId, snap.conversationId, snap.targetIngressSequence)) {
        return end('SUPERSEDED', 'newer_inbound_before_commit', false);
      }
      const fin = await deps.store.finalizeSuccess({
        organizationId: snap.organizationId,
        conversationId: snap.conversationId,
        agentRunId: run.agentRunId,
        runKey,
        targetIngressSequence: snap.targetIngressSequence,
        leaseOwner: snap.leaseOwner ?? '',
        leaseFence: snap.leaseFence,
        ownershipEpoch: snap.ownershipEpoch,
        outboundText: decision.text,
        modelCalls,
        toolCalls,
        finalization: {
          source: 'MODEL',
          postToolModelOutputInvalid,
          structuredRetryUsed: postMutationStructuredRetryUsed,
          structuredRetryRecovered: postMutationStructuredRetryUsed,
          fallbackUsed: false,
          ...(successfulBookingResult ? { mutationToolName: 'createBooking' } : {}),
        },
      });
      const finalization = {
        source: 'MODEL' as const,
        postToolModelOutputInvalid,
        structuredRetryUsed: postMutationStructuredRetryUsed,
        structuredRetryRecovered: postMutationStructuredRetryUsed,
        fallbackUsed: false,
        ...(successfulBookingResult ? { mutationToolName: 'createBooking' } : {}),
      };
      return {
        terminal: 'SUCCEEDED',
        reason: 'final_response',
        agentRunId: run.agentRunId,
        runKey,
        outboundMessageId: fin.outboundMessageId,
        decisionTrace,
        finalization,
      };
    }

    // The one reserve call can never extend operational work or execute a mutation.
    if (finalizationOnly) {
      if (successfulBookingResult) {
        postToolModelOutputInvalid = true;
        return finalizeSuccessfulBookingFallback();
      }
      return end('BUDGET_EXCEEDED', 'finalization_reserve_tool_request', false);
    }

    // tool_request
    if (successfulBookingResult) {
      postToolModelOutputInvalid = true;
      if (!postMutationStructuredRetryUsed) {
        postMutationStructuredRetryUsed = true;
        schemaRepairs += 1;
        messages.push({ role: 'user', content: SCHEMA_REPAIR_PROMPT });
        continue;
      }
      return finalizeSuccessfulBookingFallback();
    }

    if (toolCalls >= limits.maxToolCalls) {
      return end('BUDGET_EXCEEDED', 'max_tool_calls', false);
    }
    const def = toolDefs.find((t) => t.name === decision.toolName);
    if (!def || !allow.has(decision.toolName)) {
      await deps.store.recordToolCall({
        organizationId: snap.organizationId,
        agentRunId: run.agentRunId,
        ordinal: toolCalls + 1,
        toolName: decision.toolName,
        toolVersion: '0',
        argsHash: hashNormalizedArgs(decision.arguments),
        authzResult: 'DENIED_UNKNOWN',
        operationId: null,
        resultCode: 'TOOL_NOT_FOUND',
        durationMs: 0,
      });
      return end('FAILED', 'tool_not_found', false);
    }

    const argsHash = hashNormalizedArgs(decision.arguments);
    const fp = `${decision.toolName}:${argsHash}`;
    seenToolFingerprints.set(fp, (seenToolFingerprints.get(fp) ?? 0) + 1);
    if ((seenToolFingerprints.get(fp) ?? 0) >= 3) {
      return end('BUDGET_EXCEEDED', 'repeated_identical_tool', false);
    }

    toolCalls += 1;
    const ordinal = toolCalls;
    const t0 = now();
    const result = await deps.tools.execute(decision.toolName, decision.arguments, {
      organizationId: snap.organizationId,
      conversationId: snap.conversationId,
      customerId: snap.customerId,
      runKey,
      agentRunId: run.agentRunId,
      leaseOwner: snap.leaseOwner ?? '',
      leaseFence: snap.leaseFence,
      ownershipEpoch: snap.ownershipEpoch,
      targetIngressSequence: snap.targetIngressSequence,
      toolCallOrdinal: ordinal,
      sandbox: false,
    });
    await deps.store.recordToolCall({
      organizationId: snap.organizationId,
      agentRunId: run.agentRunId,
      ordinal,
      toolName: def.name,
      toolVersion: def.version,
      argsHash,
      authzResult: result.ok ? 'ALLOWED' : 'DENIED_OR_FAILED',
      operationId: result.operationId ?? null,
      resultCode: result.code,
      durationMs: now() - t0,
    });

    lastToolSucceeded = result.ok;

    if (
      decision.toolName === 'createBooking' &&
      result.ok &&
      result.data &&
      typeof result.data === 'object' &&
      typeof (result.data as Record<string, unknown>).bookingId === 'string'
    ) {
      successfulBookingResult = result.data as Record<string, unknown>;
    }

    if (decision.toolName === 'handoffToHuman' && result.ok) {
      return {
        terminal: 'HANDOFF_REQUESTED',
        reason: 'handoff',
        agentRunId: run.agentRunId,
        runKey,
        outboundMessageId: null,
        decisionTrace,
      };
    }

    if (!result.ok && result.code === 'TOOL_NOT_AUTHORIZED') {
      return end('FAILED', 'tool_not_authorized', false);
    }

    messages.push({
      role: 'assistant',
      content: JSON.stringify(decision),
    });
    messages.push({
      role: 'tool',
      content: JSON.stringify({ ok: result.ok, code: result.code, data: result.data }),
    });
    if (result.ok) {
      if (decision.toolName === requiredInquiryTool) inquiryEvidenceRetrieved = true;
      messages.push({ role: 'system', content: `The ${decision.toolName} call above succeeded with the exact arguments shown. Its result is authoritative for this turn. Consume it; do not repeat a successful lookup for the same entity or input. ${Math.max(0, limits.maxModelCalls - modelCalls)} operational model calls remain before the single finalization-only reserve. Prioritize any still-unhandled intent, then finalize from retrieved evidence.` });
    }
  }
}

export { buildOperationKey, buildRunKey, hashNormalizedArgs };
