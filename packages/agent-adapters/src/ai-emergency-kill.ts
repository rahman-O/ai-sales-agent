/**
 * P13 AI emergency kill switch — org column and optional global env.
 * Conversation takeover/pause alone is insufficient for fleet-wide stop.
 */

export type AiKillOrgRow = {
  ai_emergency_disabled_at: Date | string | null;
};

export function isGlobalAiEmergencyDisabled(
  env: NodeJS.ProcessEnv | { AI_EMERGENCY_DISABLE_ALL?: boolean | string | undefined },
): boolean {
  const v = (env as { AI_EMERGENCY_DISABLE_ALL?: boolean | string }).AI_EMERGENCY_DISABLE_ALL;
  return v === true || v === 'true';
}

export function isOrgAiEmergencyDisabled(row: AiKillOrgRow | null | undefined): boolean {
  return row?.ai_emergency_disabled_at != null;
}

export function shouldBlockNewAgentRuns(input: {
  env: NodeJS.ProcessEnv | { AI_EMERGENCY_DISABLE_ALL?: boolean | string | undefined };
  org: AiKillOrgRow | null | undefined;
}): { blocked: boolean; reason: 'GLOBAL' | 'ORG' | null } {
  if (isGlobalAiEmergencyDisabled(input.env)) {
    return { blocked: true, reason: 'GLOBAL' };
  }
  if (isOrgAiEmergencyDisabled(input.org)) {
    return { blocked: true, reason: 'ORG' };
  }
  return { blocked: false, reason: null };
}
