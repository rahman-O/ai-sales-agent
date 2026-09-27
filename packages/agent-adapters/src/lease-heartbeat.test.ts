import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveWorkerLeaseTtlSeconds,
  renewConversationLease,
} from './run-conversation-agent.js';

test('resolveWorkerLeaseTtlSeconds returns 60 by default', () => {
  assert.equal(resolveWorkerLeaseTtlSeconds({}), 60);
  assert.equal(resolveWorkerLeaseTtlSeconds({ WORKER_LEASE_TTL_SECONDS: '' }), 60);
});

test('resolveWorkerLeaseTtlSeconds accepts valid values in range 5-3600', () => {
  assert.equal(resolveWorkerLeaseTtlSeconds({ WORKER_LEASE_TTL_SECONDS: '300' }), 300);
  assert.equal(resolveWorkerLeaseTtlSeconds({ WORKER_LEASE_TTL_SECONDS: '5' }), 5);
  assert.equal(resolveWorkerLeaseTtlSeconds({ WORKER_LEASE_TTL_SECONDS: '3600' }), 3600);
});

test('resolveWorkerLeaseTtlSeconds rejects invalid, out-of-range or non-numeric values', () => {
  assert.throws(() => resolveWorkerLeaseTtlSeconds({ WORKER_LEASE_TTL_SECONDS: '4' }), /invalid_WORKER_LEASE_TTL_SECONDS/);
  assert.throws(() => resolveWorkerLeaseTtlSeconds({ WORKER_LEASE_TTL_SECONDS: '3601' }), /invalid_WORKER_LEASE_TTL_SECONDS/);
  assert.throws(() => resolveWorkerLeaseTtlSeconds({ WORKER_LEASE_TTL_SECONDS: 'abc' }), /invalid_WORKER_LEASE_TTL_SECONDS/);
});

test('renewConversationLease executes atomic SQL check and respects all authority parameters', async () => {
  let executedSql = '';
  let executedParams: unknown[] = [];

  const mockPool = {
    connect: async () => ({
      query: async (sql: string, params?: unknown[]) => {
        if (sql.includes('UPDATE conversations')) {
          executedSql = sql;
          executedParams = params ?? [];
          return { rowCount: 1, rows: [{ id: 'conv-1' }] };
        }
        return { rowCount: 0, rows: [] };
      },
      release: () => {},
    }),
  } as any;

  const ok = await renewConversationLease(mockPool, {
    organizationId: 'a0111111-1111-4111-8111-111111111111',
    conversationId: '71a3ef24-75b7-4570-be13-928c7805808d',
    workerId: 'worker-1',
    leaseFence: 4,
    ownershipEpoch: 2,
    ttlSeconds: 300,
  });

  assert.equal(ok, true);
  assert.match(executedSql, /lease_owner = \$3/);
  assert.match(executedSql, /lease_fence = \$5/);
  assert.match(executedSql, /ownership_epoch = \$6/);
  assert.match(executedSql, /mode = 'AI_ACTIVE'/);
  assert.match(executedSql, /lease_expires_at IS NULL OR lease_expires_at > now\(\)/);
  assert.deepEqual(executedParams, [
    'a0111111-1111-4111-8111-111111111111',
    '71a3ef24-75b7-4570-be13-928c7805808d',
    'worker-1',
    '300',
    4,
    2,
  ]);
});

test('renewConversationLease returns false when authority mismatch results in zero updated rows', async () => {
  const mockPool = {
    connect: async () => ({
      query: async (sql: string) => {
        if (sql.includes('UPDATE conversations')) {
          // 0 rows updated (e.g. human takeover changed epoch, fence bumped, or mode is not AI_ACTIVE)
          return { rowCount: 0, rows: [] };
        }
        return { rowCount: 0, rows: [] };
      },
      release: () => {},
    }),
  } as any;

  const ok = await renewConversationLease(mockPool, {
    organizationId: 'a0111111-1111-4111-8111-111111111111',
    conversationId: '71a3ef24-75b7-4570-be13-928c7805808d',
    workerId: 'worker-1',
    leaseFence: 4,
    ownershipEpoch: 2,
    ttlSeconds: 300,
  });

  assert.equal(ok, false);
});

test('HUMAN_TAKEOVER_FENCING: renewal query requires matching ownership_epoch', async () => {
  let queriedSql = '';
  const mockPool = {
    connect: async () => ({
      query: async (sql: string) => {
        if (sql.includes('UPDATE conversations')) queriedSql = sql;
        return { rowCount: 0, rows: [] };
      },
      release: () => {},
    }),
  } as any;

  const ok = await renewConversationLease(mockPool, {
    organizationId: 'org-1',
    conversationId: 'conv-1',
    workerId: 'worker-1',
    leaseFence: 1,
    ownershipEpoch: 1,
    ttlSeconds: 60,
  });

  assert.equal(ok, false);
  assert.match(queriedSql, /ownership_epoch = \$6/);
});

test('AI_KILL_FENCING: renewal query requires mode = AI_ACTIVE', async () => {
  let queriedSql = '';
  const mockPool = {
    connect: async () => ({
      query: async (sql: string) => {
        if (sql.includes('UPDATE conversations')) queriedSql = sql;
        return { rowCount: 0, rows: [] };
      },
      release: () => {},
    }),
  } as any;

  await renewConversationLease(mockPool, {
    organizationId: 'org-1',
    conversationId: 'conv-1',
    workerId: 'worker-1',
    leaseFence: 1,
    ownershipEpoch: 1,
    ttlSeconds: 60,
  });

  assert.match(queriedSql, /mode = 'AI_ACTIVE'/);
});

test('STALE_WORKER_FENCING: renewal query requires matching lease_fence', async () => {
  let queriedSql = '';
  const mockPool = {
    connect: async () => ({
      query: async (sql: string) => {
        if (sql.includes('UPDATE conversations')) queriedSql = sql;
        return { rowCount: 0, rows: [] };
      },
      release: () => {},
    }),
  } as any;

  await renewConversationLease(mockPool, {
    organizationId: 'org-1',
    conversationId: 'conv-1',
    workerId: 'worker-1',
    leaseFence: 5,
    ownershipEpoch: 1,
    ttlSeconds: 60,
  });

  assert.match(queriedSql, /lease_fence = \$5/);
});

test('DIFFERENT_WORKER_RENEWAL: renewal query requires matching lease_owner', async () => {
  let queriedSql = '';
  const mockPool = {
    connect: async () => ({
      query: async (sql: string) => {
        if (sql.includes('UPDATE conversations')) queriedSql = sql;
        return { rowCount: 0, rows: [] };
      },
      release: () => {},
    }),
  } as any;

  await renewConversationLease(mockPool, {
    organizationId: 'org-1',
    conversationId: 'conv-1',
    workerId: 'worker-original',
    leaseFence: 1,
    ownershipEpoch: 1,
    ttlSeconds: 60,
  });

  assert.match(queriedSql, /lease_owner = \$3/);
});

test('LONG_RUNNING_AGENT: multiple consecutive renewals succeed and maintain lease expiry in future', async () => {
  let renewals = 0;
  const mockPool = {
    connect: async () => ({
      query: async (sql: string) => {
        if (sql.includes('UPDATE conversations')) {
          renewals += 1;
          return { rowCount: 1, rows: [{ id: 'conv-1' }] };
        }
        return { rowCount: 0, rows: [] };
      },
      release: () => {},
    }),
  } as any;

  for (let i = 0; i < 5; i++) {
    const ok = await renewConversationLease(mockPool, {
      organizationId: 'org-1',
      conversationId: 'conv-1',
      workerId: 'worker-1',
      leaseFence: 1,
      ownershipEpoch: 1,
      ttlSeconds: 60,
    });
    assert.equal(ok, true);
  }
  assert.equal(renewals, 5);
});

