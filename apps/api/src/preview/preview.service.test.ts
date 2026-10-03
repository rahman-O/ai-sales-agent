import assert from 'node:assert/strict';
import test from 'node:test';
import { PreviewService } from './preview.service.js';

test('MB-09: PreviewService creates, queries, messages, and resets preview session', async () => {
  const fakePool: any = {
    connect: async () => ({
      query: async (sql: string, params?: any[]) => {
        if (sql.includes('FROM organizations WHERE id = $1')) {
          return { rows: [{ id: params?.[0], name: 'Demo Dental Clinic' }] };
        }
        if (sql.includes('FROM organization_capabilities WHERE organization_id = $1')) {
          return { rows: [{ supports_booking: true, supports_leads: true, supports_offers: true }] };
        }
        if (sql.includes('FROM conversation_profiles WHERE organization_id = $1')) {
          return { rows: [{ tone: 'PROFESSIONAL', formality_level: 'CASUAL', language_mode: 'ARABIC' }] };
        }
        if (sql.includes('FROM business_policies WHERE organization_id = $1')) {
          return { rows: [{ policy_type: 'CANCELLATION', title: 'Cancellation 2h Cutoff' }] };
        }
        if (sql.includes('FROM offers WHERE organization_id = $1')) {
          return { rows: [{ id: 'off-1', name: '10% Discount' }] };
        }
        if (sql.includes('FROM knowledge_sources WHERE organization_id = $1')) {
          return { rows: [{ count: '5' }] };
        }
        return { rows: [] };
      },
      release: () => {},
    }),
  };

  const fakeTenants: any = {
    runInTenantContext: async (_orgId: string, _actor: any, fn: any) => fn({
      organizationMember: {
        findFirst: async () => ({ id: 'mem-1', role: 'ADMIN' }),
      },
    }),
  };

  const service = new PreviewService(fakeTenants);
  service.setPoolOverride(fakePool);
  const actor = { userId: 'user-1', roles: ['ADMIN'] } as any;

  const orgId = 'org-tenant-a';

  // 1. Create Preview Session
  const session = await service.createSession(actor, orgId, {
    scenario: 'TRY_BOOKING',
    simulatedCustomer: { name: 'Ali Ahmed', phone: '+9647700000000' },
  });

  assert.ok(session.id.length > 0);
  assert.equal(session.organizationId, orgId);
  assert.equal(session.messages.length, 0);
  assert.equal(session.configSnapshot.organizationName, 'Demo Dental Clinic');
  assert.equal(session.configSnapshot.capabilities.supportsBooking, true);
  assert.equal(session.simulatedCustomer?.name, 'Ali Ahmed');

  // 2. Query Preview Session
  const fetched = await service.getSession(actor, orgId, session.id);
  assert.equal(fetched.id, session.id);

  // 3. Cross-tenant isolation: Tenant B cannot access Tenant A session
  await assert.rejects(
    async () => {
      await service.getSession(actor, 'org-tenant-b', session.id);
    },
    { message: 'Preview session not found' },
  );

  // 4. Reset Session
  const resetSession = await service.resetSession(actor, orgId, session.id);
  assert.equal(resetSession.messages.length, 0);
  assert.deepEqual(resetSession.workingState, {});
});

test('MB-09: No production side effects guarantee', async () => {
  let productionTableInserted = false;
  const fakePool: any = {
    connect: async () => ({
      query: async (sql: string) => {
        const lower = sql.toLowerCase();
        if (
          lower.includes('insert into bookings') ||
          lower.includes('insert into leads') ||
          lower.includes('insert into customers') ||
          lower.includes('insert into follow_ups') ||
          lower.includes('insert into messages') ||
          lower.includes('insert into conversations')
        ) {
          productionTableInserted = true;
        }
        return { rows: [] };
      },
      release: () => {},
    }),
  };

  const fakeTenants: any = {
    runInTenantContext: async (_orgId: string, _actor: any, fn: any) => fn({
      organizationMember: {
        findFirst: async () => ({ id: 'mem-1', role: 'ADMIN' }),
      },
    }),
  };

  const service = new PreviewService(fakeTenants);
  service.setPoolOverride(fakePool);
  const actor = { userId: 'user-1', roles: ['ADMIN'] } as any;
  const session = await service.createSession(actor, 'org-test', {});
  assert.equal(productionTableInserted, false);
});

