import { z } from 'zod';

export const AgentDecisionType = z.enum(['final_response', 'tool_request', 'safe_stop']);

export const FinalResponseDecision = z
  .object({
    type: z.literal('final_response'),
    text: z.string().min(1).max(8000),
    claims: z
      .array(
        z.object({
          kind: z.enum(['price', 'availability', 'booking', 'generic']),
          evidenceRef: z.string().max(200).optional(),
        }),
      )
      .max(20)
      .default([]),
  })
  .strict();

export const ToolRequestDecision = z
  .object({
    type: z.literal('tool_request'),
    toolName: z.string().min(1).max(64),
    arguments: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export const SafeStopDecision = z
  .object({
    type: z.literal('safe_stop'),
    reason: z.string().min(1).max(500),
  })
  .strict();

export const AgentDecisionSchema = z.discriminatedUnion('type', [
  FinalResponseDecision,
  ToolRequestDecision,
  SafeStopDecision,
]);

export type AgentDecision = z.infer<typeof AgentDecisionSchema>;

export const P04_TOOL_NAMES = [
  'searchServices',
  'getServiceDetails',
  'getServicePrice',
  'getCustomer',
  'createCustomer',
  'handoffToHuman',
] as const;

export type P04ToolName = (typeof P04_TOOL_NAMES)[number];

/** P05 tools — opt-in via new AgentConfig allowlist; never silently granted to old ACTIVE configs. */
export const P05_TOOL_NAMES = ['searchKnowledge'] as const;

export type P05ToolName = (typeof P05_TOOL_NAMES)[number];

/** P06 tools — opt-in via new AgentConfig allowlist; never silently granted to old ACTIVE configs. */
export const P06_TOOL_NAMES = [
  'ensureLead',
  'updateLeadQualification',
  'getLead',
  'transitionLead',
] as const;

export type P06ToolName = (typeof P06_TOOL_NAMES)[number];

/** P07 tools — opt-in via new AgentConfig allowlist; never silently granted to old ACTIVE configs. */
export const P07_TOOL_NAMES = [
  'getAvailableSlots',
  'createBooking',
  'getBookings',
  'cancelBooking',
  'rescheduleBooking',
] as const;

export type P07ToolName = (typeof P07_TOOL_NAMES)[number];

export const ALL_REGISTERED_TOOL_NAMES = [
  ...P04_TOOL_NAMES,
  ...P05_TOOL_NAMES,
  ...P06_TOOL_NAMES,
  ...P07_TOOL_NAMES,
] as const;

export type RegisteredToolName = (typeof ALL_REGISTERED_TOOL_NAMES)[number];

export const AgentRunTerminalStatus = z.enum([
  'SUCCEEDED',
  'FAILED',
  'TIMED_OUT',
  'CANCELLED',
  'STALE',
  'SUPERSEDED',
  'BUDGET_EXCEEDED',
  'HANDOFF_REQUESTED',
]);

export type AgentRunTerminalStatus = z.infer<typeof AgentRunTerminalStatus>;
