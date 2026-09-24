/**
 * P13 load dataset + profile lock. Sources tagged per amendment.
 * Do not silently promote docs/ai-sales-agent/09-testing/load-tests.md to proven capacity.
 */
export type AssumptionTag =
  | 'MEASURED_CONFIG'
  | 'EXISTING_PROPOSED_ENVELOPE'
  | 'PILOT_ASSUMPTION'
  | 'MEASURED_BASELINE';

export type LoadDatasetProfile = {
  orgs: { value: number; tag: AssumptionTag };
  membersPerOrg: { value: number; tag: AssumptionTag };
  customersPerOrg: { value: number; tag: AssumptionTag };
  conversationsPerOrg: { value: number; tag: AssumptionTag };
  messagesPerConversation: { value: number; tag: AssumptionTag };
  leadsPerOrg: { value: number; tag: AssumptionTag };
  bookingsPerOrg: { value: number; tag: AssumptionTag };
  followUpsPerOrg: { value: number; tag: AssumptionTag };
  templatesPerOrg: { value: number; tag: AssumptionTag };
  knowledgeDocsPerOrg: { value: number; tag: AssumptionTag };
  knowledgeChunksPerDoc: { value: number; tag: AssumptionTag };
  agentRunsPerConversation: { value: number; tag: AssumptionTag };
};

/** Locked before mixed-load execution. */
export const LOAD_DATASET_PROFILE: LoadDatasetProfile = {
  orgs: { value: 5, tag: 'EXISTING_PROPOSED_ENVELOPE' },
  membersPerOrg: { value: 3, tag: 'PILOT_ASSUMPTION' },
  customersPerOrg: { value: 40, tag: 'PILOT_ASSUMPTION' },
  conversationsPerOrg: { value: 10, tag: 'EXISTING_PROPOSED_ENVELOPE' }, // 5*10=50 active
  messagesPerConversation: { value: 12, tag: 'PILOT_ASSUMPTION' },
  leadsPerOrg: { value: 20, tag: 'PILOT_ASSUMPTION' },
  bookingsPerOrg: { value: 15, tag: 'PILOT_ASSUMPTION' },
  followUpsPerOrg: { value: 10, tag: 'PILOT_ASSUMPTION' },
  templatesPerOrg: { value: 5, tag: 'PILOT_ASSUMPTION' },
  knowledgeDocsPerOrg: { value: 4, tag: 'PILOT_ASSUMPTION' },
  knowledgeChunksPerDoc: { value: 20, tag: 'PILOT_ASSUMPTION' },
  agentRunsPerConversation: { value: 2, tag: 'PILOT_ASSUMPTION' },
};

export const LOAD_TRAFFIC_PROFILE = {
  sustainedInboundPerSec: { value: 5, tag: 'EXISTING_PROPOSED_ENVELOPE' as AssumptionTag },
  burstInboundPerSec: { value: 25, tag: 'EXISTING_PROPOSED_ENVELOPE' as AssumptionTag },
  burstDurationSec: { value: 30, tag: 'EXISTING_PROPOSED_ENVELOPE' as AssumptionTag },
  durationMin: { value: 30, tag: 'EXISTING_PROPOSED_ENVELOPE' as AssumptionTag },
  hotTenantTrafficShare: { value: 0.8, tag: 'EXISTING_PROPOSED_ENVELOPE' as AssumptionTag },
};

/** Measured from code (PrismaService / worker Pool). */
export const DB_POOL_PROFILE = {
  apiMax: { value: 2, tag: 'MEASURED_CONFIG' as AssumptionTag, source: 'apps/api/src/database/prisma.service.ts' },
  workerMax: { value: 4, tag: 'MEASURED_CONFIG' as AssumptionTag, source: 'apps/worker/src/main.ts' },
  combinedTheoretical: { value: 6, tag: 'MEASURED_CONFIG' as AssumptionTag },
  /** Shared Supabase Session Pooler default ceiling for pilot project — do not raise to pass. */
  hostedSessionPoolerConstraint: {
    value: 15,
    tag: 'PILOT_ASSUMPTION' as AssumptionTag,
    note: 'Treat as hosted constraint envelope; measure peak under load without increasing app pool caps',
  },
};

export function summarizeLoadLock(): string {
  return [
    'LOAD_DATASET_PROFILE locked',
    `orgs=${LOAD_DATASET_PROFILE.orgs.value}(${LOAD_DATASET_PROFILE.orgs.tag})`,
    `conversations_total=${LOAD_DATASET_PROFILE.orgs.value * LOAD_DATASET_PROFILE.conversationsPerOrg.value}`,
    `api_pool_max=${DB_POOL_PROFILE.apiMax.value}`,
    `worker_pool_max=${DB_POOL_PROFILE.workerMax.value}`,
    `combined_theoretical=${DB_POOL_PROFILE.combinedTheoretical.value}`,
    `hosted_session_pooler_constraint=${DB_POOL_PROFILE.hostedSessionPoolerConstraint.value}`,
    'SLO_STATUS=MEASURED_BASELINE_PENDING_OR_DEFER_P14',
  ].join(' ');
}
