/** P11 dashboard DTOs — intentionally small; never Prisma models. */

export type AttentionSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export type AttentionType =
  | 'HUMAN_HANDOFF_UNASSIGNED'
  | 'PAUSED_CONVERSATION_UNASSIGNED'
  | 'HUMAN_CONVERSATION_WAITING'
  | 'FAILED_OUTBOUND_MESSAGE'
  | 'UNKNOWN_OUTBOUND_MESSAGE'
  | 'FOLLOWUP_FAILED'
  | 'FOLLOWUP_SUPPRESSED_REVIEW'
  | 'BOOKING_SOON'
  | 'CHANNEL_AUTH_FAILED'
  | 'CHANNEL_MISCONFIGURED'
  | 'KNOWLEDGE_PROCESSING_FAILED'
  | 'LEAD_NEEDS_QUALIFICATION';

export interface DashboardAttentionItem {
  id: string;
  type: AttentionType;
  entityType: string;
  entityId: string;
  organizationId: string;
  severity: AttentionSeverity;
  occurredAt: string | null;
  dueAt: string | null;
  title: string;
  description: string;
  actionRoute: string;
}

export interface DashboardSummary {
  unassignedHandoffs: number;
  unassignedPaused: number;
  myActiveConversations: number;
  openLeads: number;
  qualifiedLeads: number;
  leadsNeedingQualification: number;
  leadStatusCounts: {
    NEW: number;
    ENGAGED: number;
    QUALIFIED: number;
    NURTURE: number;
  };
  todaysBookings: number;
  pendingFollowUps: number;
  failedFollowUps: number;
  suppressedFollowUps: number;
  scheduledSoonFollowUps: number;
  processingFollowUps: number;
  dispatchedFollowUps: number;
  channelHealthy: number;
  channelUnhealthy: number;
  channelDisabled: number;
  /** Diagnostic only — not a product metric card. */
  legacyHumanActiveObserved: number;
}

export interface DashboardBookingItem {
  id: string;
  customerDisplayName: string | null;
  serviceName: string;
  staffDisplayName: string;
  locationName: string;
  startsAt: string;
  localStartsAt: string;
  timezone: string;
  status: string;
  leadId: string | null;
}

export interface DashboardFollowUpItem {
  id: string;
  status: string;
  triggerType: string;
  nextEligibleAt: string;
  timezone: string;
  resultReasonCode: string | null;
  messageDeliveryState: string | null;
  customerId: string;
  leadId: string | null;
}

export interface DashboardChannelHealth {
  id: string;
  provider: string;
  healthStatus: string;
  status: string;
  displayPhoneNumber: string | null;
  lastVerifiedAt: string | null;
}

export interface DashboardKnowledgeHealth {
  awaitingReview: number;
  processing: number;
  failed: number;
  publishedDocuments: number;
}

export interface DashboardResponse {
  asOf: string;
  attention: DashboardAttentionItem[];
  summary: DashboardSummary;
  upcomingBookings: DashboardBookingItem[];
  recentFollowUps: DashboardFollowUpItem[];
  channelHealth: DashboardChannelHealth[];
  /** null when role-omitted (MEMBER) or query failed (see sectionErrors). */
  knowledgeHealth: DashboardKnowledgeHealth | null;
  sectionErrors: Record<string, string>;
}

export const HANDOFF_PAUSE_REASONS = [
  'CUSTOMER_REQUESTED_HUMAN',
  'AI_UNCERTAIN',
  'POLICY_REQUIRES_HUMAN',
  'BOOKING_EXCEPTION',
] as const;

export const PAUSED_UNASSIGNED_REASONS = ['OPERATOR_MANUAL_TAKEOVER', 'OTHER'] as const;

export const REVIEW_REQUIRED_SUPPRESSION_REASONS = [
  'TEMPLATE_DISABLED',
  'CHANNEL_DISABLED',
  'OUTSIDE_POLICY_WINDOW',
  'MISSING_CONVERSATION',
  'CONVERSATION_MISSING',
] as const;

export const ATTENTION_GLOBAL_CAP = 25;
export const ATTENTION_PER_TYPE_CAP = 8;
export const ATTENTION_DERIVATIVE_CAP_WHEN_CHANNEL_UNHEALTHY = 3;

export const SEVERITY_RANK: Record<AttentionSeverity, number> = {
  CRITICAL: 0,
  WARNING: 1,
  INFO: 2,
};
