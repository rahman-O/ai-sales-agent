import assert from 'node:assert/strict';
import test from 'node:test';
import { PacksService } from './packs.service.js';
import {
  CLINIC_PACK,
  SALON_PACK,
} from '@ai-sales-agent/agent-core';
import type { ActorContext } from '../database/tenant-context.service.js';

test('MB-11: PacksService lists all registered packs and gets specific pack by id', () => {
  const fakeTenants: any = {};
  const service = new PacksService(fakeTenants);

  const packs = service.listPacks();
  assert.equal(packs.length, 5);

  const clinic = service.getPack('CLINIC');
  assert.equal(clinic.id, 'CLINIC');
  assert.equal(clinic.name, 'Clinic / Healthcare Practice');

  assert.throws(() => service.getPack('UNKNOWN_PACK'), /not found/i);
});

test('MB-11: PacksService allows MEMBER role to preview pack without mutating database', async () => {
  const actorMember: ActorContext = {
    userId: '22222222-2222-2222-2222-222222222222',
    authSubject: 'sub-member',
    requestId: 'req-2',
  };
  const orgId = '33333333-3333-3333-3333-333333333333';

  let policyCreated = false;
  let docCreated = false;
  let catCreated = false;

  const fakeTx: any = {
    organizationCapabilities: { findUnique: async () => null },
    organizationConversationProfile: { findUnique: async () => null },
    businessPolicy: {
      findMany: async () => [],
      create: async () => { policyCreated = true; return {}; },
    },
    knowledgeDocument: {
      findMany: async () => [],
      create: async () => { docCreated = true; return {}; },
    },
    catalogItem: {
      findMany: async () => [],
      create: async () => { catCreated = true; return {}; },
    },
  };

  const fakeTenants: any = {
    runAsActor: async (_actor: any, fn: any) => fn({
      organizationMember: {
        findUnique: async () => ({
          organizationId: orgId,
          userId: actorMember.userId,
          role: 'MEMBER',
          status: 'ACTIVE',
        }),
      },
    }),
    runInTenantContext: async (_orgId: string, _actor: any, fn: any) => fn(fakeTx),
  };

  const service = new PacksService(fakeTenants);
  const preview = await service.previewPack(actorMember, orgId, 'CLINIC', 'PREVIEW_ONLY');

  assert.equal(preview.packId, 'CLINIC');
  assert.ok(preview.items.length > 0);
  assert.equal(policyCreated, false);
  assert.equal(docCreated, false);
  assert.equal(catCreated, false);
});

test('MB-11: PacksService rejects MEMBER role from applying pack (ForbiddenException)', async () => {
  const actorMember: ActorContext = {
    userId: '22222222-2222-2222-2222-222222222222',
    authSubject: 'sub-member',
    requestId: 'req-2',
  };
  const orgId = '33333333-3333-3333-3333-333333333333';

  const fakeTenants: any = {
    runAsActor: async (_actor: any, fn: any) => fn({
      organizationMember: {
        findUnique: async () => ({
          organizationId: orgId,
          userId: actorMember.userId,
          role: 'MEMBER',
          status: 'ACTIVE',
        }),
      },
    }),
  };

  const service = new PacksService(fakeTenants);
  await assert.rejects(
    () => service.applyPack(actorMember, orgId, 'CLINIC', 'INITIAL_SETUP'),
    /Only OWNER or ADMIN may apply business packs/i,
  );
});

test('MB-11: PacksService applies pack transactionally for OWNER, creating draft policies, draft knowledge, inactive catalog items, and audit log', async () => {
  const actorOwner: ActorContext = {
    userId: '11111111-1111-1111-1111-111111111111',
    authSubject: 'sub-owner',
    requestId: 'req-1',
  };
  const orgId = '33333333-3333-3333-3333-333333333333';

  const createdPolicies: any[] = [];
  const createdKnowledge: any[] = [];
  const createdCatalog: any[] = [];
  let auditedAction = '';

  const fakeTx: any = {
    $executeRaw: async () => undefined,
    organizationCapabilities: {
      findUnique: async () => null,
      create: async () => ({ organizationId: orgId }),
      update: async () => ({ organizationId: orgId }),
    },
    organizationConversationProfile: {
      findUnique: async () => null,
      create: async () => ({ organizationId: orgId }),
    },
    businessPolicy: {
      findMany: async () => [],
      findFirst: async () => null,
      create: async ({ data }: any) => {
        createdPolicies.push(data);
        return { id: 'pol-1', ...data };
      },
    },
    knowledgeDocument: {
      findMany: async () => [],
      create: async ({ data }: any) => {
        createdKnowledge.push(data);
        return { id: 'doc-1', ...data };
      },
    },
    catalogItem: {
      findMany: async () => [],
      create: async ({ data }: any) => {
        createdCatalog.push(data);
        return { id: 'cat-1', ...data };
      },
    },
  };

  const fakeTenants: any = {
    runAsActor: async (_actor: any, fn: any) => fn({
      organizationMember: {
        findUnique: async () => ({
          organizationId: orgId,
          userId: actorOwner.userId,
          role: 'OWNER',
          status: 'ACTIVE',
        }),
      },
    }),
    runInTenantContext: async (_orgId: string, _actor: any, fn: any) => fn(fakeTx),
    writeAudit: async (_tx: any, audit: any) => {
      auditedAction = audit.action;
    },
  };

  const service = new PacksService(fakeTenants);
  const result = await service.applyPack(actorOwner, orgId, 'CLINIC', 'INITIAL_SETUP');

  assert.equal(result.packId, 'CLINIC');
  assert.equal(result.created.policies, CLINIC_PACK.policyTemplates.length);
  assert.equal(result.created.knowledgeSources, CLINIC_PACK.knowledgeStarters.length);
  assert.equal(result.created.catalogItems, CLINIC_PACK.catalogStarters.length);
  assert.equal(result.created.conversationProfile, true);

  // Verify all created policies are DRAFT
  assert.equal(createdPolicies.length, CLINIC_PACK.policyTemplates.length);
  for (const pol of createdPolicies) {
    assert.equal(pol.status, 'DRAFT');
  }

  // Verify all created catalog items are INACTIVE with null price
  assert.equal(createdCatalog.length, CLINIC_PACK.catalogStarters.length);
  for (const cat of createdCatalog) {
    assert.equal(cat.status, 'INACTIVE');
    assert.equal(cat.amountMinor, null);
  }

  // Verify audit log written
  assert.equal(auditedAction, 'pack.applied');
});

test('MB-11: PacksService is idempotent on re-apply: does NOT duplicate starter policies, knowledge, or catalog items', async () => {
  const actorOwner: ActorContext = {
    userId: '11111111-1111-1111-1111-111111111111',
    authSubject: 'sub-owner',
    requestId: 'req-1',
  };
  const orgId = '33333333-3333-3333-3333-333333333333';

  let policyCreateCount = 0;
  let docCreateCount = 0;
  let catCreateCount = 0;

  const fakeTx: any = {
    $executeRaw: async () => undefined,
    organizationConversationProfile: {
      findUnique: async () => ({ organizationId: orgId, tone: 'PROFESSIONAL' }),
    },
    organizationCapabilities: {
      findUnique: async () => ({ organizationId: orgId, supportsBooking: true }),
      update: async () => ({ organizationId: orgId }),
    },
    businessPolicy: {
      findMany: async () => CLINIC_PACK.policyTemplates.map((p) => ({
        id: 'pol-existing',
        policyType: p.policyType,
        metadataJson: { starterKey: p.starterKey },
      })),
      create: async () => { policyCreateCount++; return {}; },
    },
    knowledgeDocument: {
      findMany: async () => CLINIC_PACK.knowledgeStarters.map((k) => ({
        id: 'doc-existing',
        title: k.title,
        metadataJson: { starterKey: k.starterKey },
      })),
      create: async () => { docCreateCount++; return {}; },
    },
    catalogItem: {
      findMany: async () => CLINIC_PACK.catalogStarters.map((c) => ({
        id: 'cat-existing',
        name: c.name,
        metadataJson: { starterKey: c.starterKey },
      })),
      create: async () => { catCreateCount++; return {}; },
    },
  };

  const fakeTenants: any = {
    runAsActor: async (_actor: any, fn: any) => fn({
      organizationMember: {
        findUnique: async () => ({
          organizationId: orgId,
          userId: actorOwner.userId,
          role: 'OWNER',
          status: 'ACTIVE',
        }),
      },
    }),
    runInTenantContext: async (_orgId: string, _actor: any, fn: any) => fn(fakeTx),
    writeAudit: async () => undefined,
  };

  const service = new PacksService(fakeTenants);
  const result = await service.applyPack(actorOwner, orgId, 'CLINIC', 'INITIAL_SETUP');

  assert.equal(result.created.policies, 0);
  assert.equal(result.created.knowledgeSources, 0);
  assert.equal(result.created.catalogItems, 0);
  assert.equal(result.created.conversationProfile, false);

  assert.equal(result.skipped.existingPolicies, CLINIC_PACK.policyTemplates.length);
  assert.equal(result.skipped.existingKnowledge, CLINIC_PACK.knowledgeStarters.length);
  assert.equal(result.skipped.existingCatalog, CLINIC_PACK.catalogStarters.length);
  assert.equal(result.skipped.existingProfile, true);

  assert.equal(policyCreateCount, 0);
  assert.equal(docCreateCount, 0);
  assert.equal(catCreateCount, 0);
});
