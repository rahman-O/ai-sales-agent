import { z } from 'zod';

export const BUSINESS_POLICY_TYPES = [
  'BOOKING',
  'CANCELLATION',
  'RESCHEDULING',
  'PAYMENT',
  'REFUND',
  'RETURN',
  'DELIVERY',
  'SERVICE_AREA',
  'MINIMUM_ORDER',
  'ADVANCE_NOTICE',
  'QUOTE',
  'HANDOFF',
  'CUSTOM',
] as const;
export const BusinessPolicyTypeSchema = z.enum(BUSINESS_POLICY_TYPES);
export type BusinessPolicyType = z.infer<typeof BusinessPolicyTypeSchema>;

export const BUSINESS_POLICY_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;
export const BusinessPolicyStatusSchema = z.enum(BUSINESS_POLICY_STATUSES);
export type BusinessPolicyStatus = z.infer<typeof BusinessPolicyStatusSchema>;

const currency = z.string().regex(/^[A-Z]{3}$/);
export const CancellationPolicyRulesSchema = z.object({
  cutoffMinutes: z.number().int().min(0).max(525_600),
  allowAfterCutoff: z.boolean().default(false),
  feeAmountMinor: z.number().int().min(0).optional(),
  feeCurrency: currency.optional(),
}).strict().refine((value) => (value.feeAmountMinor === undefined) === (value.feeCurrency === undefined), {
  message: 'feeAmountMinor and feeCurrency must be supplied together',
});

export const ReschedulingPolicyRulesSchema = z.object({
  cutoffMinutes: z.number().int().min(0).max(525_600),
}).strict();

export const AdvanceNoticePolicyRulesSchema = z.object({
  minimumLeadMinutes: z.number().int().min(0).max(525_600),
  maximumAdvanceDays: z.number().int().min(1).max(3_650).optional(),
}).strict();

export const ServiceAreaPolicyRulesSchema = z.object({
  supportedAreas: z.array(z.string().trim().min(1).max(120)).max(100).default([]),
  excludedAreas: z.array(z.string().trim().min(1).max(120)).max(100).default([]),
}).strict();

export const MinimumOrderPolicyRulesSchema = z.object({
  minimumAmountMinor: z.number().int().min(0),
  currency,
}).strict();

export const PaymentPolicyRulesSchema = z.object({
  acceptedMethods: z.array(z.string().trim().min(1).max(80)).min(1).max(30),
}).strict();

const InformationalRulesSchema = z.object({}).strict();

export function parseBusinessPolicyRules(policyType: BusinessPolicyType, rules: unknown): Record<string, unknown> {
  const schema = policyType === 'CANCELLATION'
    ? CancellationPolicyRulesSchema
    : policyType === 'RESCHEDULING'
      ? ReschedulingPolicyRulesSchema
      : policyType === 'ADVANCE_NOTICE'
        ? AdvanceNoticePolicyRulesSchema
        : policyType === 'SERVICE_AREA'
          ? ServiceAreaPolicyRulesSchema
          : policyType === 'MINIMUM_ORDER'
            ? MinimumOrderPolicyRulesSchema
            : policyType === 'PAYMENT'
              ? PaymentPolicyRulesSchema
              : InformationalRulesSchema;
  return schema.parse(rules ?? {}) as Record<string, unknown>;
}

export function isEnforceablePolicyType(type: BusinessPolicyType): boolean {
  return type === 'CANCELLATION' || type === 'RESCHEDULING';
}

export interface BusinessPolicyDto {
  id: string;
  organizationId: string;
  policyType: BusinessPolicyType;
  status: BusinessPolicyStatus;
  title: string;
  summary: string;
  rulesJson: Record<string, unknown>;
  enforcementMode: 'ENFORCEABLE' | 'INFORMATIONAL_ONLY';
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  version: number;
  metadataJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBusinessPolicyRequest {
  policyType: BusinessPolicyType;
  title: string;
  summary: string;
  rulesJson?: Record<string, unknown>;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
  metadataJson?: Record<string, unknown> | null;
}

export type UpdateBusinessPolicyRequest = Partial<Omit<CreateBusinessPolicyRequest, 'policyType'>>;

export interface EffectivePolicyResponse {
  policy: BusinessPolicyDto | null;
  resolvedAt: string;
  precedence: 'HIGHEST_VERSION_THEN_LATEST_EFFECTIVE_FROM';
}

export interface EffectivePolicyCandidate {
  status: string;
  version: number;
  effectiveFrom: Date | string | null;
  effectiveUntil: Date | string | null;
  createdAt: Date | string;
}

/** Authoritative in-memory precedence after tenant-scoped candidate retrieval. */
export function selectEffectivePolicy<T extends EffectivePolicyCandidate>(
  candidates: T[],
  currentTime = new Date(),
): T | null {
  const now = currentTime.getTime();
  return candidates
    .filter((candidate) => candidate.status === 'ACTIVE')
    .filter((candidate) => !candidate.effectiveFrom || new Date(candidate.effectiveFrom).getTime() <= now)
    .filter((candidate) => !candidate.effectiveUntil || new Date(candidate.effectiveUntil).getTime() >= now)
    .sort((a, b) =>
      b.version - a.version ||
      new Date(b.effectiveFrom ?? 0).getTime() - new Date(a.effectiveFrom ?? 0).getTime() ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0] ?? null;
}

export function policyAllowsAction(
  policyType: 'CANCELLATION' | 'RESCHEDULING',
  rulesJson: unknown,
  bookingStartsAt: Date,
  currentTime = new Date(),
): { allowed: boolean; cutoffMinutes: number; minutesBeforeStart: number; feeApplies: boolean } {
  const minutesBeforeStart = Math.floor((bookingStartsAt.getTime() - currentTime.getTime()) / 60_000);
  if (policyType === 'CANCELLATION') {
    const rules = CancellationPolicyRulesSchema.parse(rulesJson);
    return {
      allowed: rules.allowAfterCutoff || minutesBeforeStart >= rules.cutoffMinutes,
      cutoffMinutes: rules.cutoffMinutes,
      minutesBeforeStart,
      feeApplies: minutesBeforeStart < rules.cutoffMinutes && rules.feeAmountMinor !== undefined,
    };
  }
  const rules = ReschedulingPolicyRulesSchema.parse(rulesJson);
  return {
    allowed: minutesBeforeStart >= rules.cutoffMinutes,
    cutoffMinutes: rules.cutoffMinutes,
    minutesBeforeStart,
    feeApplies: false,
  };
}
