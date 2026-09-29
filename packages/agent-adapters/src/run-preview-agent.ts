import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import {
  type ConversationWorkingStateData,
  type RunStorePort,
  type ConversationSnapshot,
  type ModelProvider,
  resolveAiProvider,
  resolveProviderLimits,
  runAgentOrchestrator,
  FakeModelProvider,
  resolveWorkflow,
} from '@ai-sales-agent/agent-core';
import {
  ALL_REGISTERED_TOOL_NAMES,
  type AgentDecision,
  type AgentIntent,
  type PreviewMessageDto,
  type PreviewTraceDto,
  type PreviewToolCallTraceDto,
  type PreviewSourceTraceDto,
  type SimulatedCustomerContextDto,
} from '@ai-sales-agent/contracts';
import { createPreviewToolExecutor } from './preview-tool-executor.js';
import {
  applyWorkflowIntentTransition,
  updateWorkingStateDataWithToolResult,
} from './conversation-working-state.js';

async function withTenant<T>(pool: Pool, orgId: string, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(`SELECT set_config('app.current_organization_id', $1, true)`, [orgId]);
    await c.query(`SELECT set_config('app.current_user_id', $1, true)`, ['00000000-0000-4000-8000-0000000000a1']);
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    try {
      await c.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    c.release();
  }
}

export async function runPreviewAgentTurn(
  pool: Pool,
  input: {
    organizationId: string;
    sessionId: string;
    userMessage: string;
    history: PreviewMessageDto[];
    workingState: ConversationWorkingStateData;
    simulatedCustomer?: SimulatedCustomerContextDto | null;
  },
): Promise<{
  assistantMessage: string;
  updatedWorkingState: ConversationWorkingStateData;
  trace: PreviewTraceDto;
  configSnapshot?: {
    organizationName?: string;
    capabilities?: Record<string, boolean>;
    conversationProfile?: Record<string, unknown>;
    activePoliciesCount?: number;
    activeOffersCount?: number;
    publishedKnowledgeCount?: number;
  };
}> {
  const startTurn = Date.now();
  const { organizationId, sessionId, userMessage, history, workingState, simulatedCustomer } = input;

  // 1. Fetch organization context & config snapshot
  const config = await withTenant(pool, organizationId, async (c) => {
    const orgRes = await c.query<{ name: string }>(`SELECT name FROM organizations WHERE id = $1`, [organizationId]);
    const profileRes = await c.query<{
      display_name: string | null;
      business_type: string | null;
      description: string | null;
      default_timezone: string;
      default_currency: string;
    }>(`SELECT display_name, business_type, description, default_timezone, default_currency FROM organization_profiles WHERE organization_id = $1`, [organizationId]);

    const capsRes = await c.query<{
      supports_booking: boolean;
      supports_leads: boolean;
      lead_required_before_booking: boolean;
      supports_offers: boolean;
      supports_orders: boolean;
      supports_quotes: boolean;
      supports_services: boolean;
      supports_products: boolean;
    }>(`SELECT supports_booking, supports_leads, lead_required_before_booking, supports_offers, supports_orders, supports_quotes, supports_services, supports_products FROM organization_capabilities WHERE organization_id = $1`, [organizationId]);

    const convProfRes = await c.query<{
      assistant_name: string | null;
      primary_language: string;
      dialect: string;
      tone: string;
      formality: string;
      response_length: string;
      sales_style: string;
      emoji_usage: string;
      customer_name_usage: string;
      questions_per_turn: number;
      greeting_style: string;
      handoff_style: string;
      custom_instructions: string | null;
    }>(`SELECT assistant_name, primary_language, dialect, tone, formality, response_length, sales_style, emoji_usage, customer_name_usage, questions_per_turn, greeting_style, handoff_style, custom_instructions FROM organization_conversation_profiles WHERE organization_id = $1`, [organizationId]);

    const polCountRes = await c.query<{ count: string }>(`SELECT count(*) FROM business_policies WHERE organization_id = $1 AND status = 'ACTIVE'`, [organizationId]);
    const offCountRes = await c.query<{ count: string }>(`SELECT count(*) FROM offers WHERE organization_id = $1 AND status = 'ACTIVE'`, [organizationId]);
    const knwCountRes = await c.query<{ count: string }>(`SELECT count(*) FROM knowledge_documents WHERE organization_id = $1 AND active_published_version_id IS NOT NULL AND archived_at IS NULL AND deleted_at IS NULL`, [organizationId]);

    const profile = profileRes.rows[0];
    const caps = capsRes.rows[0];
    const convProf = convProfRes.rows[0];

    return {
      orgName: orgRes.rows[0]?.name ?? 'Preview Organization',
      organizationProfile: profile
        ? {
            displayName: profile.display_name ?? undefined,
            businessType: profile.business_type ?? undefined,
            description: profile.description ?? undefined,
            timezone: profile.default_timezone,
            defaultCurrency: profile.default_currency,
          }
        : null,
      organizationCapabilities: caps
        ? {
            supportsBooking: caps.supports_booking,
            supportsLeads: caps.supports_leads,
            leadRequiredBeforeBooking: caps.lead_required_before_booking,
            supportsOffers: caps.supports_offers,
            supportsOrders: caps.supports_orders,
            supportsQuotes: caps.supports_quotes,
            supportsServices: caps.supports_services,
            supportsProducts: caps.supports_products,
          }
        : null,
      conversationProfile: convProf
        ? {
            assistantName: convProf.assistant_name,
            primaryLanguage: convProf.primary_language,
            dialect: convProf.dialect,
            tone: convProf.tone,
            formality: convProf.formality,
            responseLength: convProf.response_length,
            salesStyle: convProf.sales_style,
            emojiUsage: convProf.emoji_usage,
            customerNameUsage: convProf.customer_name_usage,
            questionsPerTurn: convProf.questions_per_turn,
            greetingStyle: convProf.greeting_style,
            handoffStyle: convProf.handoff_style,
            customInstructions: convProf.custom_instructions,
          }
        : null,
      activePoliciesCount: parseInt(polCountRes.rows[0]?.count ?? '0', 10),
      activeOffersCount: parseInt(offCountRes.rows[0]?.count ?? '0', 10),
      publishedKnowledgeCount: parseInt(knwCountRes.rows[0]?.count ?? '0', 10),
    };
  });

  // 2. Build Inbound Messages Timeline
  const messages: ConversationSnapshot['messages'] = [];
  let seq = 1;
  for (const m of history) {
    messages.push({
      id: m.id || randomUUID(),
      direction: m.role === 'user' ? 'INBOUND' : 'OUTBOUND',
      ingressSequence: m.role === 'user' ? seq : null,
      timelineSequence: seq,
      contentText: m.content,
    });
    seq++;
  }
  const targetIngressSequence = seq;
  messages.push({
    id: randomUUID(),
    direction: 'INBOUND',
    ingressSequence: targetIngressSequence,
    timelineSequence: seq,
    contentText: userMessage,
  });

  // 2. Classify intent and apply workflow transition
  let detectedIntent: AgentIntent = 'GENERAL_INQUIRY';
  const lowerMsg = userMessage.toLowerCase();
  if (lowerMsg.includes('احجز') || lowerMsg.includes('حجز') || lowerMsg.includes('موعد') || lowerMsg.includes('book') || lowerMsg.includes('appointment')) {
    detectedIntent = 'BOOKING_INTENT';
  } else if (lowerMsg.includes('الغاء') || lowerMsg.includes('الغي') || lowerMsg.includes('cancel')) {
    detectedIntent = 'BOOKING_CANCEL_INTENT';
  } else if (lowerMsg.includes('تاجيل') || lowerMsg.includes('تأجيل') || lowerMsg.includes('تغيير الموعد') || lowerMsg.includes('reschedule')) {
    detectedIntent = 'BOOKING_RESCHEDULE_INTENT';
  } else if (lowerMsg.includes('عرض') || lowerMsg.includes('عروض') || lowerMsg.includes('خصم') || lowerMsg.includes('تخفيض') || lowerMsg.includes('offer') || lowerMsg.includes('discount')) {
    detectedIntent = 'OFFER_INQUIRY';
  } else if (lowerMsg.includes('سياسة') || lowerMsg.includes('شروط') || lowerMsg.includes('قوانين') || lowerMsg.includes('policy') || lowerMsg.includes('terms')) {
    detectedIntent = 'POLICY_INQUIRY';
  } else if (lowerMsg.includes('سعر') || lowerMsg.includes('شكد') || lowerMsg.includes('بكم') || lowerMsg.includes('تكلفة') || lowerMsg.includes('price') || lowerMsg.includes('cost')) {
    detectedIntent = 'PRICE_INQUIRY';
  } else if (lowerMsg.includes('موظف') || lowerMsg.includes('انسان') || lowerMsg.includes('حولني') || lowerMsg.includes('human') || lowerMsg.includes('operator')) {
    detectedIntent = 'HANDOFF_REQUEST';
  } else if (lowerMsg.includes('عرض سعر') || lowerMsg.includes('كوتيشن') || lowerMsg.includes('quote')) {
    detectedIntent = 'QUOTE_INTENT';
  } else if (lowerMsg.includes('شراء') || lowerMsg.includes('اشتري') || lowerMsg.includes('طلب') || lowerMsg.includes('اطلب') || lowerMsg.includes('buy') || lowerMsg.includes('order')) {
    detectedIntent = 'PURCHASE_INTENT';
  }

  const intentTransition = applyWorkflowIntentTransition(workingState, {
    primary: detectedIntent,
    secondary: [],
    confidence: 1.0,
  });
  let currentWorkingState: ConversationWorkingStateData = intentTransition.stateData;

  const resolved = resolveWorkflow({
    capabilities: config.organizationCapabilities,
    intent: { primary: detectedIntent, secondary: [], confidence: 1.0 },
    workingState: currentWorkingState,
    executionMode: 'PREVIEW',
    configuredToolAllowlist: ALL_REGISTERED_TOOL_NAMES,
  });

  // 3. Build ConversationSnapshot
  const snapshot: ConversationSnapshot = {
    organizationId,
    conversationId: sessionId,
    customerId: simulatedCustomer?.displayName ? `preview-${simulatedCustomer.displayName}` : 'preview-customer',
    mode: 'AI_ACTIVE',
    ownershipEpoch: 1,
    leaseOwner: 'preview-session',
    leaseFence: 1,
    nextIngressSequence: targetIngressSequence + 1,
    processedSequence: targetIngressSequence - 1,
    targetIngressSequence,
    messages,
    summaryText: null,
    summaryWatermark: null,
    workingState: {
      version: 1,
      customerId: 'preview-customer',
      data: currentWorkingState,
    },
    organizationProfile: config.organizationProfile,
    organizationCapabilities: config.organizationCapabilities,
    conversationProfile: config.conversationProfile,
    agentConfigVersionId: 'preview-v1',
    promptVersion: 'p01',
    modelProfile: 'preview',
    toolAllowlist: [...ALL_REGISTERED_TOOL_NAMES],
  };

  // 4. Trace Collectors
  const toolCallTraces: PreviewToolCallTraceDto[] = [];
  const sourcesUsed: PreviewSourceTraceDto[] = [];
  const simulatedMutations: Array<{
    toolName: string;
    wouldSucceed: boolean;
    proposedChanges: Record<string, unknown>;
    note: string;
  }> = [];

  const toolExecutor = createPreviewToolExecutor(pool, (t) => {
    toolCallTraces.push({
      toolName: t.toolName,
      policy: t.simulated ? 'SIMULATED' : 'READ_ONLY',
      input: t.input,
      output: t.output,
      simulated: t.simulated,
      wouldSucceed: t.wouldSucceed,
      durationMs: t.durationMs,
      note: t.simulated ? 'Simulation only. No real data created.' : undefined,
    });

    if (t.sourceUsed) {
      sourcesUsed.push(t.sourceUsed);
    }

    if (t.simulated && t.wouldSucceed) {
      simulatedMutations.push({
        toolName: t.toolName,
        wouldSucceed: true,
        proposedChanges: (t.output as Record<string, unknown>) ?? {},
        note: 'Simulated mutation completed without real database row creation.',
      });
    }

    // Apply tool write-back to preview working state
    const res = updateWorkingStateDataWithToolResult(
      currentWorkingState,
      t.toolName,
      t.input,
      { ok: true, data: t.output },
    );
    currentWorkingState = res.stateData;
  });

  // 5. Ephemeral In-Memory RunStore
  const inMemoryStore: RunStorePort = {
    async createOrResumeRun() {
      return { agentRunId: `preview-run-${randomUUID()}`, status: 'RUNNING', resumed: false };
    },
    async loadAuthority() {
      return {
        mode: 'AI_ACTIVE',
        ownershipEpoch: 1,
        leaseOwner: 'preview-session',
        leaseFence: 1,
        nextIngressSequence: targetIngressSequence + 1,
        processedSequence: targetIngressSequence - 1,
      };
    },
    async hasNewerInbound() {
      return false;
    },
    async recordToolCall() {},
    async claimCommand() {
      return { alreadySucceeded: false, resultJson: null, operationId: randomUUID() };
    },
    async completeCommand() {},
    async finalizeSuccess() {
      return { outboundMessageId: `preview-msg-${randomUUID()}` };
    },
    async finalizeTerminal() {},
    async finalizeHandoff() {
      return { newEpoch: 2 };
    },
    async recordUsage() {},
  };

  // 6. Resolve Model Provider
  const ai = resolveAiProvider(process.env);
  let provider: ModelProvider | null = ai ? ai.provider : null;
  if (!provider && (process.env.NODE_ENV === 'test' || process.env.AI_ALLOW_FAKE === 'true')) {
    provider = new FakeModelProvider({ kind: 'final', text: 'أهلاً بك، كيف أقدر أساعدك اليوم؟' });
  }
  if (!provider) {
    throw new Error('AI provider unavailable for preview');
  }

  const limits = resolveProviderLimits(process.env);

  // 7. Run Orchestrator
  const orchestratorResult = await runAgentOrchestrator(snapshot, {
    store: inMemoryStore,
    provider,
    tools: toolExecutor,
    limits,
    allowFakeProvider: true,
  });

  // Extract final text from orchestrator result or decision trace
  let assistantMessage = 'عذراً، لم أتمكن من معالجة الطلب.';
  if (orchestratorResult.decisionTrace && orchestratorResult.decisionTrace.length > 0) {
    const finalDec = orchestratorResult.decisionTrace.find((d) => d.type === 'final_response') as
      | { type: 'final_response'; text: string }
      | undefined;
    if (finalDec?.text) {
      assistantMessage = finalDec.text;
    }
  }

  const totalDurationMs = Date.now() - startTurn;

  const trace: PreviewTraceDto = {
    executionMode: 'PREVIEW',
    detectedIntent,
    resolvedWorkflowId: resolved.workflowId ?? undefined,
    workflowStage: resolved.stage,
    allowedTools: resolved.allowedTools,
    blockedMutationTools: resolved.blockedMutationTools,
    decisions: orchestratorResult.decisionTrace.map((d) => ({
      type: d.type,
      toolName: d.type === 'tool_request' ? d.toolName : undefined,
      arguments: d.type === 'tool_request' ? d.arguments : undefined,
      text: d.type === 'final_response' ? d.text : undefined,
      claims: d.type === 'final_response' ? d.claims : undefined,
    })),
    toolCalls: toolCallTraces,
    sourcesUsed,
    simulatedMutations,
    totalDurationMs,
  };

  return {
    assistantMessage,
    updatedWorkingState: currentWorkingState,
    trace,
    configSnapshot: {
      organizationName: config.orgName,
      capabilities: config.organizationCapabilities as unknown as Record<string, boolean>,
      conversationProfile: config.conversationProfile as unknown as Record<string, unknown>,
      activePoliciesCount: config.activePoliciesCount,
      activeOffersCount: config.activeOffersCount,
      publishedKnowledgeCount: config.publishedKnowledgeCount,
    },
  };
}
