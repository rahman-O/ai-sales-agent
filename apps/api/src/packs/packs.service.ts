import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  type BusinessPackDefinition,
  type PackApplicationMode,
  type PackApplyResultDto,
  type PackPreviewDto,
  type BusinessPolicyType,
  DEFAULT_ORGANIZATION_CAPABILITIES,
  DEFAULT_CONVERSATION_PROFILE,
} from '@ai-sales-agent/contracts';
import {
  getBusinessPack,
  listBusinessPacks,
  previewBusinessPackApplication,
  type ExistingOrgStateForPreview,
} from '@ai-sales-agent/agent-core';
import {
  TenantContextService,
  type ActorContext,
  type TenantTxClient,
} from '../database/tenant-context.service.js';

@Injectable()
export class PacksService {
  constructor(private readonly tenants: TenantContextService) {}

  listPacks(): BusinessPackDefinition[] {
    return listBusinessPacks();
  }

  getPack(packId: string): BusinessPackDefinition {
    const pack = getBusinessPack(packId);
    if (!pack) {
      throw new NotFoundException(`Business pack '${packId}' not found`);
    }
    return pack;
  }

  private async authorize(actor: ActorContext, organizationId: string, mutate = false) {
    const membership = (await this.tenants.runAsActor(actor, (tx) =>
      tx.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: actor.userId } },
      }),
    )) as { status: string; role: string } | null;

    if (!membership || membership.status !== 'ACTIVE') {
      throw new NotFoundException('Organization membership not found or inactive');
    }
    if (mutate && membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      throw new ForbiddenException('Only OWNER or ADMIN may apply business packs');
    }
    return membership;
  }

  async previewPack(
    actor: ActorContext,
    organizationId: string,
    packId: string,
    mode: PackApplicationMode = 'PREVIEW_ONLY',
  ): Promise<PackPreviewDto> {
    await this.authorize(actor, organizationId, false);
    const pack = this.getPack(packId);

    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const capabilities = await tx.organizationCapabilities.findUnique({
        where: { organizationId },
      });

      const conversationProfile = await tx.organizationConversationProfile.findUnique({
        where: { organizationId },
      });

      const policies = await tx.businessPolicy.findMany({
        where: { organizationId },
        select: {
          id: true,
          policyType: true,
          status: true,
          metadataJson: true,
        },
      });

      const knowledgeDocuments = await tx.knowledgeDocument.findMany({
        where: { organizationId, deletedAt: null },
        select: {
          id: true,
          title: true,
          metadataJson: true,
        },
      });

      const catalogItems = await tx.catalogItem.findMany({
        where: { organizationId, archivedAt: null },
        select: {
          id: true,
          name: true,
          kind: true,
          metadataJson: true,
        },
      });

      const existingState: ExistingOrgStateForPreview = {
        capabilities: capabilities as Record<string, boolean> | null,
        conversationProfile: conversationProfile ? (conversationProfile as unknown as Record<string, unknown>) : null,
        policies: policies.map((p: { policyType: string; status: string; metadataJson: unknown }) => ({
          starterKey: (p.metadataJson as Record<string, unknown> | null)?.starterKey as string | undefined,
          policyType: p.policyType,
          status: p.status,
        })),
        knowledgeDocuments: knowledgeDocuments.map((d: { title: string; metadataJson: unknown }) => ({
          starterKey: (d.metadataJson as Record<string, unknown> | null)?.starterKey as string | undefined,
          title: d.title,
          status: 'DRAFT',
        })),
        catalogItems: catalogItems.map((c: { name: string; kind: string; metadataJson: unknown }) => ({
          starterKey: (c.metadataJson as Record<string, unknown> | null)?.starterKey as string | undefined,
          name: c.name,
          kind: c.kind,
        })),
      };

      return previewBusinessPackApplication(pack, existingState, mode);
    });
  }

  async applyPack(
    actor: ActorContext,
    organizationId: string,
    packId: string,
    mode: PackApplicationMode = 'INITIAL_SETUP',
  ): Promise<PackApplyResultDto> {
    await this.authorize(actor, organizationId, true);
    const pack = this.getPack(packId);

    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      // Advisory lock to serialize pack application for this organization
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pack_apply:${organizationId}`}))`;

      const warnings: string[] = [];
      let createdCapabilitiesCount = 0;
      let createdPoliciesCount = 0;
      let createdKnowledgeCount = 0;
      let createdCatalogCount = 0;
      let createdConversationProfile = false;

      let skippedProfile = false;
      let skippedPoliciesCount = 0;
      let skippedKnowledgeCount = 0;
      let skippedCatalogCount = 0;

      // 1. Capabilities Setup
      const existingCaps = await tx.organizationCapabilities.findUnique({
        where: { organizationId },
      });

      if (!existingCaps) {
        await tx.organizationCapabilities.create({
          data: {
            organizationId,
            ...DEFAULT_ORGANIZATION_CAPABILITIES,
            ...pack.recommendedCapabilities,
          },
        });
        createdCapabilitiesCount = Object.keys(pack.recommendedCapabilities).length;
      } else {
        if (mode === 'INITIAL_SETUP') {
          // Set recommended capabilities
          await tx.organizationCapabilities.update({
            where: { organizationId },
            data: pack.recommendedCapabilities,
          });
          createdCapabilitiesCount = Object.keys(pack.recommendedCapabilities).length;
        } else {
          // MERGE_MISSING: Preserve existing values
          createdCapabilitiesCount = 0;
        }
      }

      // 2. Conversation Profile Setup
      const existingProfile = await tx.organizationConversationProfile.findUnique({
        where: { organizationId },
      });

      if (!existingProfile) {
        await tx.organizationConversationProfile.create({
          data: {
            organizationId,
            ...DEFAULT_CONVERSATION_PROFILE,
            ...(pack.conversationProfileDefaults ?? {}),
          },
        });
        createdConversationProfile = true;
      } else {
        skippedProfile = true;
      }

      // 3. Policy Starters (Always created as DRAFT and non-enforceable by default)
      const existingPolicies = await tx.businessPolicy.findMany({
        where: { organizationId },
      });
      const existingPolicyStarterKeys = new Set(
        existingPolicies
          .map((p: { metadataJson: unknown }) => (p.metadataJson as Record<string, unknown> | null)?.starterKey as string | undefined)
          .filter(Boolean),
      );

      for (const policyTemplate of pack.policyTemplates) {
        if (existingPolicyStarterKeys.has(policyTemplate.starterKey)) {
          skippedPoliciesCount++;
          continue;
        }

        const latest = await tx.businessPolicy.findFirst({
          where: { organizationId, policyType: policyTemplate.policyType },
          orderBy: { version: 'desc' },
        });

        await tx.businessPolicy.create({
          data: {
            id: randomUUID(),
            organizationId,
            policyType: policyTemplate.policyType,
            status: 'DRAFT', // POLICY STARTER RULE: Always DRAFT
            title: policyTemplate.title,
            summary: policyTemplate.summary,
            rulesJson: policyTemplate.rulesJson,
            enforcementMode: policyTemplate.enforcementMode,
            version: (latest?.version ?? 0) + 1,
            metadataJson: {
              starterKey: policyTemplate.starterKey,
              packId: pack.id,
              packVersion: pack.version,
            },
          },
        });
        createdPoliciesCount++;
      }

      // 4. Knowledge Starters (Always created as DRAFT, non-published, non-customer visible)
      const existingDocs = await tx.knowledgeDocument.findMany({
        where: { organizationId, deletedAt: null },
      });
      const existingDocStarterKeys = new Set(
        existingDocs
          .map((d: { metadataJson: unknown }) => (d.metadataJson as Record<string, unknown> | null)?.starterKey as string | undefined)
          .filter(Boolean),
      );

      for (const knowledgeStarter of pack.knowledgeStarters) {
        if (existingDocStarterKeys.has(knowledgeStarter.starterKey)) {
          skippedKnowledgeCount++;
          continue;
        }

        await tx.knowledgeDocument.create({
          data: {
            id: randomUUID(),
            organizationId,
            title: knowledgeStarter.title,
            sourceType: knowledgeStarter.sourceType,
            visibility: knowledgeStarter.visibility,
            metadataJson: {
              starterKey: knowledgeStarter.starterKey,
              packId: pack.id,
              packVersion: pack.version,
              starterContent: knowledgeStarter.content,
              status: 'DRAFT',
            },
          },
        });
        createdKnowledgeCount++;
      }

      // 5. Catalog Starters (Always created as INACTIVE / needsReview)
      const existingCatalog = await tx.catalogItem.findMany({
        where: { organizationId, archivedAt: null },
      });
      const existingCatalogStarterKeys = new Set(
        existingCatalog
          .map((c: { metadataJson: unknown }) => (c.metadataJson as Record<string, unknown> | null)?.starterKey as string | undefined)
          .filter(Boolean),
      );

      for (const catalogStarter of pack.catalogStarters) {
        if (existingCatalogStarterKeys.has(catalogStarter.starterKey)) {
          skippedCatalogCount++;
          continue;
        }

        await tx.catalogItem.create({
          data: {
            id: randomUUID(),
            organizationId,
            kind: catalogStarter.kind,
            name: catalogStarter.name,
            description: catalogStarter.description ?? null,
            status: 'INACTIVE', // CATALOG STARTER RULE: Always INACTIVE / DRAFT
            amountMinor: catalogStarter.amountMinor ? BigInt(catalogStarter.amountMinor) : null,
            currency: catalogStarter.currency ?? 'IQD',
            metadataJson: {
              starterKey: catalogStarter.starterKey,
              packId: pack.id,
              packVersion: pack.version,
              needsReview: true,
            },
          },
        });
        createdCatalogCount++;
      }

      // 6. Record Audit Log & Provenance
      await this.tenants.writeAudit(tx, {
        organizationId,
        actorUserId: actor.userId,
        action: 'pack.applied',
        targetType: 'BusinessPack',
        targetId: pack.id,
        metadataJson: {
          packId: pack.id,
          packVersion: pack.version,
          mode,
          created: {
            capabilities: createdCapabilitiesCount,
            policies: createdPoliciesCount,
            knowledgeSources: createdKnowledgeCount,
            catalogItems: createdCatalogCount,
            conversationProfile: createdConversationProfile,
          },
          skipped: {
            existingProfile: skippedProfile,
            existingPolicies: skippedPoliciesCount,
            existingKnowledge: skippedKnowledgeCount,
            existingCatalog: skippedCatalogCount,
          },
        },
        requestId: actor.requestId,
      });

      const appliedAt = new Date().toISOString();

      return {
        packId: pack.id,
        packVersion: pack.version,
        mode,
        appliedAt,
        created: {
          capabilities: createdCapabilitiesCount,
          policies: createdPoliciesCount,
          knowledgeSources: createdKnowledgeCount,
          catalogItems: createdCatalogCount,
          conversationProfile: createdConversationProfile,
        },
        skipped: {
          existingProfile: skippedProfile,
          existingPolicies: skippedPoliciesCount,
          existingKnowledge: skippedKnowledgeCount,
          existingCatalog: skippedCatalogCount,
        },
        warnings,
      };
    });
  }
}
