/** P06 lead domain — pure functions shared by API, tools, UI DTOs, tests. */

export const OPEN_LEAD_STATUSES = ['NEW', 'ENGAGED', 'QUALIFIED', 'NURTURE'] as const;
export type OpenLeadStatus = (typeof OPEN_LEAD_STATUSES)[number];

export const LEAD_STATUSES = [
  ...OPEN_LEAD_STATUSES,
  'DISQUALIFIED',
  'ARCHIVED',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const DISQUALIFIED_REASON_CODES = [
  'NOT_INTERESTED',
  'OUT_OF_SCOPE',
  'INVALID_CONTACT',
  'DUPLICATE_REQUEST',
  'OTHER',
] as const;
export type DisqualifiedReasonCode = (typeof DISQUALIFIED_REASON_CODES)[number];

export const ARCHIVED_REASON_CODES = [
  'MANUAL_ARCHIVE',
  'MERGED_AFTER_CUSTOMER_MERGE',
  'MERGED_DUPLICATE_OPEN_LEAD',
] as const;
export type ArchivedReasonCode = (typeof ARCHIVED_REASON_CODES)[number];

export const AI_ALLOWED_TRANSITIONS: ReadonlyArray<readonly [LeadStatus, LeadStatus]> = [
  ['NEW', 'ENGAGED'],
  ['NEW', 'NURTURE'],
  ['ENGAGED', 'QUALIFIED'],
  ['ENGAGED', 'NURTURE'],
  ['QUALIFIED', 'NURTURE'],
  ['NURTURE', 'ENGAGED'],
  ['NURTURE', 'QUALIFIED'],
];

export const HUMAN_ALLOWED_TRANSITIONS: ReadonlyArray<readonly [LeadStatus, LeadStatus]> = [
  ...AI_ALLOWED_TRANSITIONS,
  ['NEW', 'DISQUALIFIED'],
  ['NEW', 'ARCHIVED'],
  ['ENGAGED', 'DISQUALIFIED'],
  ['ENGAGED', 'ARCHIVED'],
  ['QUALIFIED', 'DISQUALIFIED'],
  ['QUALIFIED', 'ARCHIVED'],
  ['NURTURE', 'DISQUALIFIED'],
  ['NURTURE', 'ARCHIVED'],
  ['DISQUALIFIED', 'ARCHIVED'],
];

export function isOpenStatus(status: string): status is OpenLeadStatus {
  return (OPEN_LEAD_STATUSES as readonly string[]).includes(status);
}

export function isValidTransition(
  from: LeadStatus,
  to: LeadStatus,
  actor: 'AI' | 'HUMAN',
): boolean {
  const table = actor === 'AI' ? AI_ALLOWED_TRANSITIONS : HUMAN_ALLOWED_TRANSITIONS;
  return table.some(([a, b]) => a === from && b === to);
}

export function isDisqualifiedReason(code: string): code is DisqualifiedReasonCode {
  return (DISQUALIFIED_REASON_CODES as readonly string[]).includes(code);
}

export function isArchivedReason(code: string): code is ArchivedReasonCode {
  return (ARCHIVED_REASON_CODES as readonly string[]).includes(code);
}

export type QualificationState = 'INCOMPLETE' | 'SUFFICIENT';

export interface QualificationLeadInput {
  primaryServiceId: string | null;
  locationId: string | null;
  needSummary: string | null;
  preferredContactChannel: string | null;
}

export interface OrgLocationContext {
  /** Count of active, non-archived locations in the tenant. */
  activeLocationCount: number;
}

/**
 * Canonical derived qualification — never persisted.
 * SUFFICIENT when: service known; location known if org has >1 active location;
 * needSummary present; preferredContactChannel present.
 */
export function deriveQualificationState(
  lead: QualificationLeadInput,
  orgLocationContext: OrgLocationContext,
): QualificationState {
  if (!lead.primaryServiceId) return 'INCOMPLETE';
  if (orgLocationContext.activeLocationCount > 1 && !lead.locationId) return 'INCOMPLETE';
  if (!lead.needSummary?.trim()) return 'INCOMPLETE';
  if (!lead.preferredContactChannel?.trim()) return 'INCOMPLETE';
  return 'SUFFICIENT';
}

export interface MergeQualificationFields {
  primaryServiceId: string | null;
  locationId: string | null;
  needSummary: string | null;
  preferredContactChannel: string | null;
  language: string | null;
  urgency: string | null;
}

/** Merge only missing (null) qualification fields from loser into winner. */
export function mergeMissingQualification(
  winner: MergeQualificationFields,
  loser: MergeQualificationFields,
): MergeQualificationFields {
  return {
    primaryServiceId: winner.primaryServiceId ?? loser.primaryServiceId,
    locationId: winner.locationId ?? loser.locationId,
    needSummary: winner.needSummary ?? loser.needSummary,
    preferredContactChannel: winner.preferredContactChannel ?? loser.preferredContactChannel,
    language: winner.language ?? loser.language,
    urgency: winner.urgency ?? loser.urgency,
  };
}

export function openKey(customerId: string, primaryServiceId: string | null): string {
  return primaryServiceId ? `${customerId}:${primaryServiceId}` : `${customerId}:generic`;
}
