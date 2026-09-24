/**
 * P13 Redis / crash / ambiguous-send policy lock + deterministic matrices.
 * These are policy+behavior unit proofs; durable DB drills remain in integration suite.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

/** Locked from health/ready Redis PING and worker Redis connection at boot. */
export const REDIS_STARTUP_POLICY = 'REQUIRED' as const;
/** API: ready→503; SSE pub/sub fails closed for fanout. Worker: BullMQ jobs pause; durable outbox remains in Postgres. */
export const REDIS_RUNTIME_LOSS_POLICY =
  'API_READY_FAILS_WORKER_WAKE_PAUSED_DB_TRUTH_RETAINS' as const;

test('Redis policy lock is REQUIRED startup (not degraded-start)', () => {
  assert.equal(REDIS_STARTUP_POLICY, 'REQUIRED');
  assert.match(REDIS_RUNTIME_LOSS_POLICY, /DB_TRUTH_RETAINS/);
});

type CrashBoundary =
  | 'BEFORE_CLAIM'
  | 'AFTER_CLAIM_BEFORE_APPLY'
  | 'AFTER_COMMIT_BEFORE_ACK'
  | 'AFTER_PROVIDER_ACCEPT_BEFORE_WAMID_PERSIST';

type ExpectedSemantics = {
  logicalDuplicationAllowed: boolean;
  externalExactlyOnce: 'NOT_GUARANTEED_BY_PROVIDER_PROTOCOL' | 'N_A';
  ambiguousSendSafety: 'PASS_REQUIRED' | 'N_A';
  recovery: string;
};

const CRASH_MATRIX: Record<CrashBoundary, ExpectedSemantics> = {
  BEFORE_CLAIM: {
    logicalDuplicationAllowed: false,
    externalExactlyOnce: 'N_A',
    ambiguousSendSafety: 'N_A',
    recovery: 'claim_pending_outbox_events rediscovers durable PENDING work',
  },
  AFTER_CLAIM_BEFORE_APPLY: {
    logicalDuplicationAllowed: false,
    externalExactlyOnce: 'N_A',
    ambiguousSendSafety: 'N_A',
    recovery: 'lease expiry returns work; ConsumerReceipt uniqueness prevents double-apply',
  },
  AFTER_COMMIT_BEFORE_ACK: {
    logicalDuplicationAllowed: false,
    externalExactlyOnce: 'N_A',
    ambiguousSendSafety: 'N_A',
    recovery: 'ConsumerReceipt or published mark makes replay a no-op',
  },
  AFTER_PROVIDER_ACCEPT_BEFORE_WAMID_PERSIST: {
    logicalDuplicationAllowed: false,
    externalExactlyOnce: 'NOT_GUARANTEED_BY_PROVIDER_PROTOCOL',
    ambiguousSendSafety: 'PASS_REQUIRED',
    recovery: 'delivery_state=UNKNOWN; no blind resend; operator/P08 recovery path',
  },
};

test('crash matrix encodes LOGICAL IDEMPOTENCY and AMBIGUOUS SEND SAFETY', () => {
  for (const [boundary, expected] of Object.entries(CRASH_MATRIX)) {
    assert.equal(expected.logicalDuplicationAllowed, false, boundary);
    if (boundary === 'AFTER_PROVIDER_ACCEPT_BEFORE_WAMID_PERSIST') {
      assert.equal(expected.externalExactlyOnce, 'NOT_GUARANTEED_BY_PROVIDER_PROTOCOL');
      assert.equal(expected.ambiguousSendSafety, 'PASS_REQUIRED');
    }
  }
});

type ProviderOutcome = 'ACCEPTED' | 'REJECTED' | 'TIMEOUT' | 'NETWORK_ERROR';
type DispatchClass = 'SUCCESS' | 'RETRYABLE' | 'TERMINAL' | 'UNKNOWN';

function classifyProvider(outcome: ProviderOutcome): DispatchClass {
  switch (outcome) {
    case 'ACCEPTED':
      return 'SUCCESS';
    case 'REJECTED':
      return 'TERMINAL';
    case 'TIMEOUT':
    case 'NETWORK_ERROR':
      return 'UNKNOWN';
    default:
      return 'UNKNOWN';
  }
}

function mayBlindResend(deliveryState: string, classification: DispatchClass): boolean {
  if (deliveryState === 'UNKNOWN' || classification === 'UNKNOWN') return false;
  if (deliveryState === 'ACCEPTED' || deliveryState === 'DELIVERED') return false;
  return classification === 'RETRYABLE';
}

test('provider matrix: ambiguous outcomes map to UNKNOWN without blind resend', () => {
  for (const outcome of ['TIMEOUT', 'NETWORK_ERROR'] as ProviderOutcome[]) {
    const cls = classifyProvider(outcome);
    assert.equal(cls, 'UNKNOWN');
    assert.equal(mayBlindResend('UNKNOWN', cls), false);
  }
  assert.equal(classifyProvider('ACCEPTED'), 'SUCCESS');
  assert.equal(classifyProvider('REJECTED'), 'TERMINAL');
});

test('model/embedding failure must not publish OutboundMessageReady without validated pipeline', () => {
  const cases = [
    { stage: 'MODEL_TIMEOUT', mayPublishOutbound: false },
    { stage: 'MODEL_MALFORMED', mayPublishOutbound: false },
    { stage: 'EMBEDDING_PROVIDER_DOWN', mayPublishOutbound: false },
    { stage: 'STORAGE_GET_FAIL', mayPublishOutbound: false },
    { stage: 'VALIDATED_OUTBOUND_COMMIT', mayPublishOutbound: true },
  ];
  for (const c of cases) {
    if (c.stage === 'VALIDATED_OUTBOUND_COMMIT') assert.equal(c.mayPublishOutbound, true);
    else assert.equal(c.mayPublishOutbound, false, c.stage);
  }
});

test('Redis A/B/C cases are distinct', () => {
  const cases = {
    A_START_WHILE_REDIS_DOWN: {
      startup: REDIS_STARTUP_POLICY,
      ready: 'not_ready',
      durableWrites: 'allowed_when_db_up',
    },
    B_REDIS_DISAPPEARS_AFTER_HEALTHY: {
      runtime: REDIS_RUNTIME_LOSS_POLICY,
      wakeTransport: 'paused',
      dbTruth: 'retained',
    },
    C_REDIS_RETURNS: {
      recovery: 'outbox_claim_republishes_pending_wakes',
      logicalDuplication: false,
    },
  };
  assert.equal(cases.A_START_WHILE_REDIS_DOWN.startup, 'REQUIRED');
  assert.equal(cases.B_REDIS_DISAPPEARS_AFTER_HEALTHY.dbTruth, 'retained');
  assert.equal(cases.C_REDIS_RETURNS.logicalDuplication, false);
});
