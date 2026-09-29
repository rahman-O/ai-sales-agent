import { z } from 'zod';

export const AgentIntentEnum = z.enum([
  'DISCOVERY',
  'CATALOG_INQUIRY',
  'PRICE_INQUIRY',
  'OFFER_INQUIRY',
  'POLICY_INQUIRY',
  'KNOWLEDGE_INQUIRY',
  'BOOKING_INTENT',
  'BOOKING_CANCEL_INTENT',
  'BOOKING_RESCHEDULE_INTENT',
  'LEAD_INTENT',
  'QUOTE_INTENT',
  'PURCHASE_INTENT',
  'SUPPORT_REQUEST',
  'HANDOFF_REQUEST',
  'FOLLOW_UP_INTENT',
  'GENERAL_INQUIRY',
  'UNKNOWN',
]);

export type AgentIntent = z.infer<typeof AgentIntentEnum>;
export const ALL_AGENT_INTENTS = AgentIntentEnum.options;

export const IntentClassificationSchema = z
  .object({
    primary: AgentIntentEnum,
    secondary: z.array(AgentIntentEnum).max(3).default([]),
    confidence: z.number().min(0).max(1).default(1.0),
  })
  .strict();

export type IntentClassification = z.infer<typeof IntentClassificationSchema>;

export const WorkflowIdEnum = z.enum([
  'DISCOVERY',
  'LEAD_CAPTURE',
  'BOOKING',
  'BOOKING_CANCELLATION',
  'BOOKING_RESCHEDULING',
  'OFFER_DISCOVERY',
  'POLICY_LOOKUP',
  'KNOWLEDGE_LOOKUP',
  'HUMAN_HANDOFF',
  'GENERAL_SUPPORT',
  'QUOTE',
  'PURCHASE',
]);

export type WorkflowId = z.infer<typeof WorkflowIdEnum>;
export const ALL_WORKFLOW_IDS = WorkflowIdEnum.options;

export const WorkflowStageEnum = z.enum([
  'INITIAL',
  'IN_PROGRESS',
  'AWAITING_INPUT',
  'AWAITING_SLOT_SELECTION',
  'AWAITING_CONFIRMATION',
  'EXECUTING',
  'COMPLETED',
  'ABANDONED',
  'SUSPENDED',
]);

export type WorkflowStage = z.infer<typeof WorkflowStageEnum>;

export interface WorkflowDefinition {
  id: WorkflowId;
  title: string;
  description: string;
  supportedIntents: readonly AgentIntent[];
  requiredCapabilities: readonly string[];
  allowedTools: readonly string[];
  mutationTools: readonly string[];
  isExecutable: boolean;
  interruptible: boolean;
}

export const WorkflowResolutionResultSchema = z
  .object({
    workflowId: WorkflowIdEnum.nullable(),
    supported: z.boolean(),
    executable: z.boolean(),
    reason: z.string().optional(),
    stage: WorkflowStageEnum.default('INITIAL'),
    allowedTools: z.array(z.string()).default([]),
    blockedMutationTools: z.array(z.string()).default([]),
    missingCapabilities: z.array(z.string()).default([]),
    missingPrerequisites: z.array(z.string()).default([]),
  })
  .strict();

export type WorkflowResolutionResult = z.infer<typeof WorkflowResolutionResultSchema>;
