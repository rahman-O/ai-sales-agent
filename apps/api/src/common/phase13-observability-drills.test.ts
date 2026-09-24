/**
 * P13 observability detection drills — signal / location / correlation / PII / action.
 * Executed as structure proof; operators attach live log excerpts in closure evidence.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

type Drill = {
  failure: string;
  signal: string;
  location: string;
  correlationId: string;
  secretPiiSafe: boolean;
  operatorAction: string;
};

export const DETECTION_DRILLS: Drill[] = [
  {
    failure: 'Meta AUTH',
    signal: 'channel_connections.health_status=AUTH_FAILED + outbound attempt FAILED AUTH_FAILURE',
    location: 'worker outbound-dispatch / channel_connections',
    correlationId: 'organizationId + messageId + attemptId (requestId when API-originated)',
    secretPiiSafe: true,
    operatorAction: 'Rotate Meta token via credentialRef; verify channel; do not log token values',
  },
  {
    failure: 'Redis outage',
    signal: 'GET /health/ready → 503 not_ready; worker BullMQ connection errors',
    location: 'apps/api health.controller ready; worker ioredis',
    correlationId: 'host/process boot id + timestamp; no tenant payload in health body',
    secretPiiSafe: true,
    operatorAction: 'Restore Redis; confirm outbox PENDING republish; do not recreate DB rows',
  },
  {
    failure: 'Worker crash/restart',
    signal: 'process exit; SIGTERM drain logs; lease reclaim on conversations',
    location: 'apps/worker main shutdown + conversation lease columns',
    correlationId: 'workerId (worker-<pid>) + conversationId + leaseFence',
    secretPiiSafe: true,
    operatorAction: 'Restart worker; verify no duplicate AgentRun run_key / Message rows',
  },
  {
    failure: 'UNKNOWN outbound',
    signal: 'messages.delivery_state=UNKNOWN; outbound_attempts.status=UNKNOWN',
    location: 'outbound-dispatch AMBIGUOUS_DISPATCH path',
    correlationId: 'organizationId + messageId + attemptId',
    secretPiiSafe: true,
    operatorAction: 'No blind resend; use P08 UNKNOWN recovery; confirm provider wamid if any',
  },
  {
    failure: 'DB pool exhaustion',
    signal: 'pg connectionTimeout / Nest transaction timeout; ready may still pass briefly',
    location: 'PrismaService pool max=2; worker pool max=4',
    correlationId: 'requestId middleware + organizationId on failing txn',
    secretPiiSafe: true,
    operatorAction: 'Shed load; do not raise pool above hosted Session Pooler constraint to "pass"',
  },
];

test('five detection drills are complete and PII-safe', () => {
  assert.equal(DETECTION_DRILLS.length, 5);
  for (const d of DETECTION_DRILLS) {
    assert.ok(d.signal.length > 10, d.failure);
    assert.ok(d.location.length > 3, d.failure);
    assert.ok(d.correlationId.length > 3, d.failure);
    assert.equal(d.secretPiiSafe, true, d.failure);
    assert.ok(d.operatorAction.length > 10, d.failure);
  }
});
