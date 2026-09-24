import {
  ATTENTION_DERIVATIVE_CAP_WHEN_CHANNEL_UNHEALTHY,
  ATTENTION_GLOBAL_CAP,
  ATTENTION_PER_TYPE_CAP,
  HANDOFF_PAUSE_REASONS,
  PAUSED_UNASSIGNED_REASONS,
  REVIEW_REQUIRED_SUPPRESSION_REASONS,
  SEVERITY_RANK,
  type AttentionSeverity,
  type AttentionType,
  type DashboardAttentionItem,
} from './dashboard.types.js';

const DERIVATIVE_TYPES: ReadonlySet<AttentionType> = new Set([
  'FOLLOWUP_FAILED',
  'FAILED_OUTBOUND_MESSAGE',
  'UNKNOWN_OUTBOUND_MESSAGE',
  'FOLLOWUP_SUPPRESSED_REVIEW',
]);

export function isHandoffPauseReason(code: string | null | undefined): boolean {
  return (
    !!code && (HANDOFF_PAUSE_REASONS as readonly string[]).includes(code)
  );
}

export function isPausedUnassignedReason(code: string | null | undefined): boolean {
  if (code == null) return true;
  return (PAUSED_UNASSIGNED_REASONS as readonly string[]).includes(code);
}

export function isReviewRequiredSuppression(code: string | null | undefined): boolean {
  return (
    !!code &&
    (REVIEW_REQUIRED_SUPPRESSION_REASONS as readonly string[]).includes(code)
  );
}

export function attentionIdentity(
  type: AttentionType,
  entityId: string,
): string {
  switch (type) {
    case 'HUMAN_HANDOFF_UNASSIGNED':
      return `conversation:${entityId}:handoff_unassigned`;
    case 'PAUSED_CONVERSATION_UNASSIGNED':
      return `conversation:${entityId}:paused_unassigned`;
    case 'HUMAN_CONVERSATION_WAITING':
      return `conversation:${entityId}:waiting`;
    case 'FAILED_OUTBOUND_MESSAGE':
      return `message:${entityId}:delivery_failed`;
    case 'UNKNOWN_OUTBOUND_MESSAGE':
      return `message:${entityId}:delivery_unknown`;
    case 'FOLLOWUP_FAILED':
      return `followup:${entityId}:failed`;
    case 'FOLLOWUP_SUPPRESSED_REVIEW':
      return `followup:${entityId}:suppressed`;
    case 'BOOKING_SOON':
      return `booking:${entityId}:soon`;
    case 'CHANNEL_AUTH_FAILED':
      return `channel:${entityId}:auth_failed`;
    case 'CHANNEL_MISCONFIGURED':
      return `channel:${entityId}:misconfigured`;
    case 'KNOWLEDGE_PROCESSING_FAILED':
      return `knowledge_version:${entityId}:failed`;
    case 'LEAD_NEEDS_QUALIFICATION':
      return `lead:${entityId}:needs_qualification`;
    default: {
      const _exhaustive: never = type;
      return String(_exhaustive);
    }
  }
}

export function makeAttentionItem(input: {
  type: AttentionType;
  entityType: string;
  entityId: string;
  organizationId: string;
  severity: AttentionSeverity;
  occurredAt?: Date | string | null;
  dueAt?: Date | string | null;
  title: string;
  description: string;
  actionRoute: string;
}): DashboardAttentionItem {
  const toIso = (v: Date | string | null | undefined): string | null => {
    if (v == null) return null;
    return v instanceof Date ? v.toISOString() : v;
  };
  return {
    id: attentionIdentity(input.type, input.entityId),
    type: input.type,
    entityType: input.entityType,
    entityId: input.entityId,
    organizationId: input.organizationId,
    severity: input.severity,
    occurredAt: toIso(input.occurredAt),
    dueAt: toIso(input.dueAt),
    title: input.title,
    description: input.description,
    actionRoute: input.actionRoute,
  };
}

function sortKeyTime(item: DashboardAttentionItem): number {
  const raw = item.dueAt ?? item.occurredAt;
  if (!raw) return Number.MAX_SAFE_INTEGER;
  return new Date(raw).getTime();
}

/** Severity ASC rank (CRITICAL first), then due/occurred ASC, then id ASC. */
export function sortAttentionItems(
  items: DashboardAttentionItem[],
): DashboardAttentionItem[] {
  return [...items].sort((a, b) => {
    const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (sev !== 0) return sev;
    const t = sortKeyTime(a) - sortKeyTime(b);
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Dedup by identity, sort, apply per-type + root-cause + global caps.
 */
export function finalizeAttentionFeed(
  items: DashboardAttentionItem[],
  opts?: { globalCap?: number; perTypeCap?: number; derivativeCap?: number },
): DashboardAttentionItem[] {
  const globalCap = opts?.globalCap ?? ATTENTION_GLOBAL_CAP;
  const perTypeCap = opts?.perTypeCap ?? ATTENTION_PER_TYPE_CAP;
  const derivativeCap =
    opts?.derivativeCap ?? ATTENTION_DERIVATIVE_CAP_WHEN_CHANNEL_UNHEALTHY;

  const byId = new Map<string, DashboardAttentionItem>();
  for (const item of items) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }

  const sorted = sortAttentionItems([...byId.values()]);
  const channelUnhealthy = sorted.some(
    (i) => i.type === 'CHANNEL_AUTH_FAILED' || i.type === 'CHANNEL_MISCONFIGURED',
  );

  const typeCounts = new Map<AttentionType, number>();
  const out: DashboardAttentionItem[] = [];

  for (const item of sorted) {
    if (out.length >= globalCap) break;

    const typeCount = typeCounts.get(item.type) ?? 0;
    if (typeCount >= perTypeCap) continue;

    if (channelUnhealthy && DERIVATIVE_TYPES.has(item.type) && typeCount >= derivativeCap) {
      continue;
    }

    typeCounts.set(item.type, typeCount + 1);
    out.push(item);
  }

  return out;
}

/** Pure: customer inbound max seq > operator outbound max seq. */
export function isConversationWaitingForHuman(input: {
  maxCustomerInboundSeq: number | null;
  maxOperatorOutboundSeq: number | null;
}): boolean {
  if (input.maxCustomerInboundSeq == null) return false;
  const op = input.maxOperatorOutboundSeq ?? -1;
  return input.maxCustomerInboundSeq > op;
}
