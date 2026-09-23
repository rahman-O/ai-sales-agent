import { P04_TOOL_NAMES, type AgentDecision, type AgentRunTerminalStatus } from '@ai-sales-agent/contracts';
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
      ? snap.toolAllowlist.filter((n) => (P04_TOOL_NAMES as readonly string[]).includes(n))
      : [...P04_TOOL_NAMES],
  );
  const toolDefs = deps.tools.listTools().filter((t) => allow.has(t.name));

  let modelCalls = 0;
  let toolCalls = 0;
  let schemaRepairs = 0;
  const seenToolFingerprints = new Map<string, number>();
  const messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string }> = [
    ...buildContextMessages(snap),
  ];

  while (true) {
    if (now() - started > limits.runDeadlineMs) {
      return end('TIMED_OUT', 'run_deadline', false);
    }
    if (modelCalls >= limits.maxModelCalls) {
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

    modelCalls += 1;
    let raw: unknown;
    try {
      const gen = await deps.provider.generate({
        messages,
        tools: toolDefs.map((t) => ({
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
    } catch {
      if (schemaRepairs < limits.maxSchemaRepairs) {
        schemaRepairs += 1;
        messages.push({
          role: 'user',
          content: 'Previous output failed schema validation. Return a valid AgentDecision JSON only.',
        });
        continue;
      }
      return end('FAILED', 'model_output_invalid', false);
    }
    decisionTrace.push(decision);

    if (decision.type === 'safe_stop') {
      return end('FAILED', decision.reason, false);
    }

    if (decision.type === 'final_response') {
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
      });
      return {
        terminal: 'SUCCEEDED',
        reason: 'final_response',
        agentRunId: run.agentRunId,
        runKey,
        outboundMessageId: fin.outboundMessageId,
        decisionTrace,
      };
    }

    // tool_request
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
      content: JSON.stringify({ type: 'tool_request', toolName: decision.toolName }),
    });
    messages.push({
      role: 'tool',
      content: JSON.stringify({ ok: result.ok, code: result.code, data: result.data }),
    });
  }
}

export { buildOperationKey, buildRunKey, hashNormalizedArgs };
