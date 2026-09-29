import type { AgentDecision, AgentRunTerminalStatus } from '@ai-sales-agent/contracts';

export const DEFAULT_LIMITS = {
  maxToolRounds: 4,
  maxToolCalls: 8,
  maxModelCalls: 5,
  maxSummaryModelCalls: 1,
  runDeadlineMs: 45_000,
  modelTimeoutMs: 15_000,
  toolTimeoutMs: 5_000,
  maxSchemaRepairs: 1,
} as const;

export type AgentLimits = typeof DEFAULT_LIMITS;

export interface ModelGenerateInput {
  messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string }>;
  tools: Array<{ name: string; description: string; parameters: Record<string, unknown> }>;
  responseSchemaHint: string;
  budget: { maxTokens?: number };
  deadlineMs: number;
  traceContext: Record<string, string>;
}

export interface ModelGenerateResult {
  decision: unknown;
  finishReason: string;
  usage: { inputTokens?: number; outputTokens?: number; estimated: boolean };
  providerRequestId: string;
  model: string;
}

export interface ModelProvider {
  readonly id: string;
  generate(input: ModelGenerateInput): Promise<ModelGenerateResult>;
}

export type ToolClass = 'read' | 'mutate';

export interface ToolDefinition {
  name: string;
  version: string;
  description: string;
  classification: ToolClass;
  inputSchema: Record<string, unknown>;
}

export interface ToolExecutionContext {
  organizationId: string;
  conversationId: string;
  customerId: string;
  runKey: string;
  agentRunId: string;
  leaseOwner: string;
  leaseFence: number;
  ownershipEpoch: number;
  targetIngressSequence: number;
  toolCallOrdinal: number;
  sandbox: boolean;
}

export interface ToolResult {
  ok: boolean;
  code: string;
  data?: unknown;
  retryable?: boolean;
  operationId?: string;
  safeMessage?: string;
}

export interface ToolExecutorPort {
  listTools(): ToolDefinition[];
  execute(name: string, args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult>;
}

export interface CandidateSlotData {
  index?: number;
  entityId: string;
  staffMemberId: string;
  locationId: string;
  startsAt: string;
  endsAt: string;
  localDate: string;
  localStartTime: string;
  slotToken: string;
  expiresAt: string;
}

export interface ConversationWorkingStateData {
  activeIntent?: {
    type: string;
    secondary?: string[];
    confidence?: number;
    updatedAt: string;
  } | null;
  activeWorkflow?: {
    id: string;
    stage: string;
    startedAt: string;
    updatedAt: string;
  } | null;
  suspendedWorkflow?: {
    id: string;
    stage: string;
    suspendedAt: string;
  } | null;
  lastCompletedWorkflow?: {
    id: string;
    completedAt: string;
  } | null;
  selectedEntity?: {
    entityType: string;
    entityId: string;
    entityLabel?: string | null;
  } | null;
  candidateSlots?: CandidateSlotData[];
  selectedCandidateIndex?: number | null;
  lastConfirmedBookingId?: string | null;
  draftQuoteId?: string | null;
  draftOrderId?: string | null;
  pendingTransactionConfirmation?: {
    transactionType: 'QUOTE' | 'ORDER';
    transactionId: string;
    totalAmountMinor: string;
    currency: string;
    itemsFingerprint?: string;
  } | null;
}

export interface OrganizationProfileSnapshot {
  displayName?: string | null;
  businessType?: string | null;
  description?: string | null;
  country?: string | null;
  timezone?: string;
  defaultLanguage?: string;
  defaultCurrency?: string;
}

export interface OrganizationCapabilitiesSnapshot {
  supportsLeads?: boolean;
  leadRequiredBeforeBooking?: boolean;
  autoCreateLeadOnIntent?: boolean;
  supportsBooking?: boolean;
  supportsOffers?: boolean;
  supportsQuotes?: boolean;
  supportsOrders?: boolean;
  supportsInventory?: boolean;
  supportsStaff?: boolean;
  supportsLocations?: boolean;
  supportsProducts?: boolean;
  supportsServices?: boolean;
  supportsListings?: boolean;
}

export interface ConversationProfileSnapshot {
  assistantName?: string | null;
  primaryLanguage: string;
  dialect: string;
  tone: string;
  formality: string;
  responseLength: string;
  salesStyle: string;
  emojiUsage: string;
  customerNameUsage: string;
  questionsPerTurn: number;
  greetingStyle: string;
  handoffStyle: string;
  customInstructions?: string | null;
}

export interface ConversationSnapshot {
  organizationId: string;
  conversationId: string;
  customerId: string;
  mode: string;
  ownershipEpoch: number;
  leaseOwner: string | null;
  leaseFence: number;
  /** Ingress high-water: next inbound sequence to allocate (= max ingress + 1). */
  nextIngressSequence: number;
  processedSequence: number;
  targetIngressSequence: number;
  messages: Array<{
    id: string;
    direction: string;
    ingressSequence: number | null;
    timelineSequence: number;
    contentText: string;
  }>;
  summaryText: string | null;
  summaryWatermark: number | null;
  workingState?: {
    version: number;
    customerId?: string | null;
    leadId?: string | null;
    data: ConversationWorkingStateData;
  } | null;
  organizationProfile?: OrganizationProfileSnapshot | null;
  organizationCapabilities?: OrganizationCapabilitiesSnapshot | null;
  conversationProfile?: ConversationProfileSnapshot | null;
  agentConfigVersionId: string;
  promptVersion: string;
  modelProfile: string;
  toolAllowlist: string[];
}

export interface RunStorePort {
  createOrResumeRun(input: {
    runKey: string;
    organizationId: string;
    conversationId: string;
    targetIngressSequence: number;
    ownershipEpoch: number;
    leaseFence: number;
    agentConfigVersionId: string;
    promptVersion: string;
    modelProfile: string;
  }): Promise<{ agentRunId: string; status: string; resumed: boolean }>;

  loadAuthority(organizationId: string, conversationId: string): Promise<{
    mode: string;
    ownershipEpoch: number;
    leaseOwner: string | null;
    leaseFence: number;
    /** Ingress high-water only (P03 next_sequence). */
    nextIngressSequence: number;
    processedSequence: number;
  }>;

  /** True when a newer INBOUND exists than target (ingress only — not timeline). */
  hasNewerInbound(organizationId: string, conversationId: string, targetIngressSequence: number): Promise<boolean>;

  recordToolCall(input: {
    organizationId: string;
    agentRunId: string;
    ordinal: number;
    toolName: string;
    toolVersion: string;
    argsHash: string;
    authzResult: string;
    operationId: string | null;
    resultCode: string;
    durationMs: number;
  }): Promise<void>;

  claimCommand(input: {
    organizationId: string;
    operationKey: string;
    agentRunId: string;
  }): Promise<{ alreadySucceeded: boolean; resultJson: unknown | null; operationId: string }>;

  completeCommand(input: {
    organizationId: string;
    operationId: string;
    resultJson: unknown;
  }): Promise<void>;

  finalizeSuccess(input: {
    organizationId: string;
    conversationId: string;
    agentRunId: string;
    runKey: string;
    targetIngressSequence: number;
    leaseOwner: string;
    leaseFence: number;
    ownershipEpoch: number;
    outboundText: string;
    modelCalls: number;
    toolCalls: number;
    finalization?: {
      source: 'MODEL' | 'AUTHORITATIVE_TOOL_RESULT';
      postToolModelOutputInvalid: boolean;
      structuredRetryUsed: boolean;
      structuredRetryRecovered: boolean;
      fallbackUsed: boolean;
      mutationToolName?: string;
    };
  }): Promise<{ outboundMessageId: string }>;

  finalizeHandoff(input: {
    organizationId: string;
    conversationId: string;
    agentRunId: string;
    targetIngressSequence: number;
    leaseOwner: string;
    leaseFence: number;
    ownershipEpoch: number;
    reasonCode: string;
    summary: string | null;
    operationId: string;
  }): Promise<{ newEpoch: number }>;

  finalizeTerminal(input: {
    organizationId: string;
    agentRunId: string;
    status: AgentRunTerminalStatus;
    reason: string;
    advanceCursor: boolean;
    conversationId: string;
    targetIngressSequence: number;
    leaseOwner: string;
    leaseFence: number;
    ownershipEpoch: number;
  }): Promise<void>;

  recordUsage(input: {
    organizationId: string;
    agentRunId: string;
    provider: string;
    model: string;
    inputTokens: number | null;
    outputTokens: number | null;
    estimated: boolean;
    latencyMs: number;
  }): Promise<void>;
}

export interface OrchestratorDeps {
  provider: ModelProvider;
  tools: ToolExecutorPort;
  store: RunStorePort;
  limits?: Partial<AgentLimits>;
  /** Production must not use Fake; adapters enforce fail-closed. */
  allowFakeProvider: boolean;
  now?: () => number;
}

export interface OrchestratorResult {
  terminal: AgentRunTerminalStatus;
  reason: string;
  agentRunId: string;
  runKey: string;
  outboundMessageId: string | null;
  decisionTrace: AgentDecision[];
  finalization?: {
    source: 'MODEL' | 'AUTHORITATIVE_TOOL_RESULT';
    postToolModelOutputInvalid: boolean;
    structuredRetryUsed: boolean;
    structuredRetryRecovered: boolean;
    fallbackUsed: boolean;
    mutationToolName?: string;
  };
}
