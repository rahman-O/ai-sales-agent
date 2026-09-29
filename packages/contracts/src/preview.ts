import { z } from 'zod';

export const AgentExecutionModeEnum = z.enum(['PRODUCTION', 'PREVIEW']);
export type AgentExecutionMode = z.infer<typeof AgentExecutionModeEnum>;

export const PreviewToolExecutionPolicyEnum = z.enum(['READ_ONLY', 'SIMULATED', 'BLOCKED']);
export type PreviewToolExecutionPolicy = z.infer<typeof PreviewToolExecutionPolicyEnum>;

export interface PreviewToolCallTraceDto {
  toolName: string;
  policy: PreviewToolExecutionPolicy;
  input: Record<string, unknown>;
  output: unknown;
  simulated: boolean;
  wouldSucceed?: boolean;
  durationMs: number;
  note?: string;
}

export interface PreviewSourceTraceDto {
  type: 'CATALOG' | 'OFFER' | 'POLICY' | 'KNOWLEDGE';
  title: string;
  detail?: string;
}

export interface PreviewTraceDto {
  executionMode: 'PREVIEW';
  detectedIntent?: string;
  resolvedWorkflowId?: string;
  workflowStage?: string;
  allowedTools?: string[];
  blockedMutationTools?: string[];
  decisions: Array<{
    type: 'tool_request' | 'final_response' | 'safe_stop';
    toolName?: string;
    arguments?: Record<string, unknown>;
    text?: string;
    claims?: unknown[];
  }>;
  toolCalls: PreviewToolCallTraceDto[];
  sourcesUsed: PreviewSourceTraceDto[];
  simulatedMutations: Array<{
    toolName: string;
    wouldSucceed: boolean;
    proposedChanges: Record<string, unknown>;
    note: string;
  }>;
  totalDurationMs: number;
}

export interface PreviewMessageDto {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  trace?: PreviewTraceDto | null;
}

export interface SimulatedCustomerContextDto {
  displayName?: string | null;
  phone?: string | null;
  language?: string | null;
  isExistingCustomer?: boolean;
  notes?: string | null;
}

export interface PreviewSessionDto {
  id: string;
  organizationId: string;
  createdBy: string;
  scenario?: string | null;
  simulatedCustomer?: SimulatedCustomerContextDto | null;
  workingState: Record<string, unknown>;
  messages: PreviewMessageDto[];
  createdAt: string;
  updatedAt: string;
  configSnapshot?: {
    organizationName?: string;
    capabilities?: Record<string, boolean>;
    conversationProfile?: Record<string, unknown>;
    activePoliciesCount?: number;
    activeOffersCount?: number;
    publishedKnowledgeCount?: number;
  };
}

export const CreatePreviewSessionSchema = z.object({
  scenario: z.string().max(100).optional(),
  simulatedCustomer: z
    .object({
      displayName: z.string().max(100).optional(),
      phone: z.string().max(30).optional(),
      language: z.string().max(10).optional(),
      isExistingCustomer: z.boolean().optional(),
      notes: z.string().max(500).optional(),
    })
    .optional(),
});
export type CreatePreviewSessionRequest = z.infer<typeof CreatePreviewSessionSchema>;

export const SendPreviewMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});
export type SendPreviewMessageRequest = z.infer<typeof SendPreviewMessageSchema>;

export const ResetPreviewSessionSchema = z.object({
  scenario: z.string().max(100).optional(),
  simulatedCustomer: z
    .object({
      displayName: z.string().max(100).optional(),
      phone: z.string().max(30).optional(),
      language: z.string().max(10).optional(),
      isExistingCustomer: z.boolean().optional(),
      notes: z.string().max(500).optional(),
    })
    .optional(),
});
export type ResetPreviewSessionRequest = z.infer<typeof ResetPreviewSessionSchema>;
