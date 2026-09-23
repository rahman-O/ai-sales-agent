/**
 * ConversationSummary compare-and-swap helpers (pure).
 * Adapters persist; summaries never authorize mutations.
 */

export interface SummaryCasInput {
  expectedVersion: number | null;
  currentVersion: number | null;
  sourceWatermark: number;
  /** Must be ingress watermark only. */
  maxAllowedWatermark: number;
}

export type SummaryCasReject =
  | 'VERSION_CONFLICT'
  | 'WATERMARK_AHEAD'
  | 'WATERMARK_REGRESSION';

export function evaluateSummaryCas(
  input: SummaryCasInput,
  proposedWatermark: number,
): { ok: true; nextVersion: number } | { ok: false; reason: SummaryCasReject } {
  if (proposedWatermark > input.maxAllowedWatermark) {
    return { ok: false, reason: 'WATERMARK_AHEAD' };
  }
  if (proposedWatermark < input.sourceWatermark && input.currentVersion != null) {
    return { ok: false, reason: 'WATERMARK_REGRESSION' };
  }
  if (input.expectedVersion == null) {
    if (input.currentVersion != null) {
      return { ok: false, reason: 'VERSION_CONFLICT' };
    }
    return { ok: true, nextVersion: 1 };
  }
  if (input.currentVersion !== input.expectedVersion) {
    return { ok: false, reason: 'VERSION_CONFLICT' };
  }
  return { ok: true, nextVersion: input.expectedVersion + 1 };
}
