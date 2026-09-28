import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  type AddMemberRequest,
  type CompleteOnboardingResponse,
  type CreateOrganizationResponse,
  type MemberRole,
  type OnboardingReadinessDto,
  type OnboardingStateResponse,
  type OrganizationCapabilitiesDto,
  type OrganizationOnboardingDto,
  type OrganizationProfileDto,
  type ReadinessItem,
  type UpdateOnboardingProgressRequest,
  type UpdateOrganizationCapabilitiesRequest,
  type UpdateOrganizationProfileRequest,
  DEFAULT_ORGANIZATION_CAPABILITIES,
  ONBOARDING_STEPS,
  UpdateOnboardingProgressSchema,
  UpdateOrganizationCapabilitiesSchema,
  UpdateOrganizationProfileSchema,
  validateCapabilitiesCombination,
} from '@ai-sales-agent/contracts';
import { TenantContextService, hashRequest, type ActorContext } from '../database/tenant-context.service.js';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly tenants: TenantContextService,
    private readonly prisma: PrismaService,
  ) {}

  async createOrganization(
    actor: ActorContext,
    name: string,
    idempotencyKey: string,
  ): Promise<CreateOrganizationResponse> {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException('Idempotency-Key required');
    }
    const operation = 'organization.create';
    const requestHash = hashRequest({ name });

    // Durable idempotency before org exists — actor-scoped, not tenant-scoped.
    const existing = await this.tenants.runAsActor(actor, async (tx) => {
      return tx.idempotencyRecord.findUnique({
        where: {
          actorUserId_operation_idempotencyKey: {
            actorUserId: actor.userId,
            operation,
            idempotencyKey,
          },
        },
      });
    });

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ConflictException('Idempotency-Key reused with different payload');
      }
      if (existing.status === 'COMPLETED' && existing.responseJson) {
        return existing.responseJson as unknown as CreateOrganizationResponse;
      }
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_user_id', ${actor.userId}, true)`;
        await tx.$executeRaw`SELECT set_config('app.current_organization_id', '', true)`;

        await tx.idempotencyRecord.upsert({
          where: {
            actorUserId_operation_idempotencyKey: {
              actorUserId: actor.userId,
              operation,
              idempotencyKey,
            },
          },
          create: {
            id: randomUUID(),
            actorUserId: actor.userId,
            operation,
            idempotencyKey,
            requestHash,
            status: 'IN_PROGRESS',
          },
          update: {
            status: 'IN_PROGRESS',
            requestHash,
          },
        });

        // INSERT without RETURNING: org RLS USING requires membership (or tenant), so Prisma
        // create()+RETURNING fails before the OWNER row exists. Bootstrap via raw insert.
        const orgId = randomUUID();
        await tx.$executeRaw`
          INSERT INTO organizations (id, name, created_at, updated_at)
          VALUES (${orgId}::uuid, ${name}, NOW(), NOW())
        `;

        await tx.$executeRaw`SELECT set_config('app.current_organization_id', ${orgId}, true)`;

        await tx.organizationMember.create({
          data: {
            organizationId: orgId,
            userId: actor.userId,
            role: 'OWNER',
            status: 'ACTIVE',
          },
        });

        await tx.organizationProfile.create({
          data: {
            organizationId: orgId,
            displayName: name,
            country: 'IQ',
            timezone: 'Asia/Baghdad',
            defaultLanguage: 'ar',
            defaultCurrency: 'IQD',
          },
        });

        await tx.organizationCapabilities.create({
          data: {
            organizationId: orgId,
            ...DEFAULT_ORGANIZATION_CAPABILITIES,
          },
        });

        await tx.organizationOnboarding.create({
          data: {
            organizationId: orgId,
            status: 'NOT_STARTED',
            currentStep: 'IDENTITY',
            completedSteps: [],
            startedAt: new Date(),
          },
        });

        const org = await tx.organization.findUniqueOrThrow({ where: { id: orgId } });

        await this.tenants.writeAudit(tx as never, {
          organizationId: org.id,
          actorUserId: actor.userId,
          action: 'organization.created',
          targetType: 'Organization',
          targetId: org.id,
          requestId: actor.requestId,
        });

        await this.tenants.writeOutbox(tx as never, {
          organizationId: org.id,
          eventType: 'OrganizationCreated',
          payloadJson: { organizationId: org.id, name },
        });

        const response: CreateOrganizationResponse = {
          organizationId: org.id,
          name: org.name,
          role: 'OWNER',
        };

        await tx.idempotencyRecord.update({
          where: {
            actorUserId_operation_idempotencyKey: {
              actorUserId: actor.userId,
              operation,
              idempotencyKey,
            },
          },
          data: {
            status: 'COMPLETED',
            responseJson: response as object,
            organizationId: org.id,
            completedAt: new Date(),
          },
        });

        return response;
      });
      return result;
    } catch (error) {
      // Unique violation on concurrent idempotency insert — replay winner.
      if (String(error).includes('Unique constraint') || (error as { code?: string }).code === 'P2002') {
        const again = await this.tenants.runAsActor(actor, async (tx) =>
          tx.idempotencyRecord.findUnique({
            where: {
              actorUserId_operation_idempotencyKey: {
                actorUserId: actor.userId,
                operation,
                idempotencyKey,
              },
            },
          }),
        );
        if (again?.status === 'COMPLETED' && again.responseJson) {
          return again.responseJson as unknown as CreateOrganizationResponse;
        }
      }
      throw error;
    }
  }

  async getOrganization(actor: ActorContext, organizationId: string) {
    await this.requireActive(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const org = await tx.organization.findUnique({ where: { id: organizationId } });
      if (!org) throw new NotFoundException();
      return org;
    });
  }

  async listMembers(actor: ActorContext, organizationId: string) {
    await this.requireActive(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      return tx.organizationMember.findMany({ where: { organizationId } });
    });
  }

  async addMember(actor: ActorContext, organizationId: string, input: AddMemberRequest) {
    const actorMembership = await this.requireActive(actor, organizationId);
    if (actorMembership.role !== 'OWNER' && actorMembership.role !== 'ADMIN') {
      throw new ForbiddenException();
    }
    if (input.role === ('OWNER' as never)) {
      throw new BadRequestException('Cannot add OWNER via add-member');
    }

    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const user = await tx.user.findUnique({ where: { id: input.userId } });
      if (!user) throw new NotFoundException('User not found');

      const created = await tx.organizationMember.create({
        data: {
          organizationId,
          userId: input.userId,
          role: input.role,
          status: 'ACTIVE',
        },
      });

      await this.tenants.writeAudit(tx, {
        organizationId,
        actorUserId: actor.userId,
        action: 'member.added',
        targetType: 'OrganizationMember',
        targetId: input.userId,
        metadataJson: { role: input.role },
        requestId: actor.requestId,
      });

      return created;
    });
  }

  async updateMemberRole(
    actor: ActorContext,
    organizationId: string,
    memberUserId: string,
    role: MemberRole,
  ) {
    const actorMembership = await this.requireActive(actor, organizationId);
    if (actorMembership.role !== 'OWNER') {
      throw new ForbiddenException('Only OWNER may change roles');
    }

    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      if (role !== 'OWNER') {
        const owners = await tx.organizationMember.count({
          where: { organizationId, role: 'OWNER', status: 'ACTIVE' },
        });
        const target = await tx.organizationMember.findUnique({
          where: { organizationId_userId: { organizationId, userId: memberUserId } },
        });
        if (!target) throw new NotFoundException();
        if (target.role === 'OWNER' && owners <= 1) {
          throw new ForbiddenException('Cannot demote the last OWNER');
        }
      }

      const updated = await tx.organizationMember.update({
        where: { organizationId_userId: { organizationId, userId: memberUserId } },
        data: { role },
      });

      await this.tenants.writeAudit(tx, {
        organizationId,
        actorUserId: actor.userId,
        action: 'member.role_changed',
        targetType: 'OrganizationMember',
        targetId: memberUserId,
        metadataJson: { role },
        requestId: actor.requestId,
      });

      return updated;
    });
  }

  async revokeMember(actor: ActorContext, organizationId: string, memberUserId: string) {
    const actorMembership = await this.requireActive(actor, organizationId);
    if (actorMembership.role !== 'OWNER' && actorMembership.role !== 'ADMIN') {
      throw new ForbiddenException();
    }

    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const target = await tx.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: memberUserId } },
      });
      if (!target) throw new NotFoundException();
      if (target.role === 'OWNER') {
        const owners = await tx.organizationMember.count({
          where: { organizationId, role: 'OWNER', status: 'ACTIVE' },
        });
        if (owners <= 1) {
          throw new ForbiddenException('Cannot revoke the last OWNER');
        }
      }

      const updated = await tx.organizationMember.update({
        where: { organizationId_userId: { organizationId, userId: memberUserId } },
        data: { status: 'REVOKED' },
      });

      await this.tenants.writeAudit(tx, {
        organizationId,
        actorUserId: actor.userId,
        action: 'member.revoked',
        targetType: 'OrganizationMember',
        targetId: memberUserId,
        requestId: actor.requestId,
      });

      return updated;
    });
  }

  /**
   * P13 emergency AI kill (org-scoped).
   * Disable: set timestamp; worker refuses new AgentRuns.
   * Enable: clear flag and advance ai_eligible_after_sequence so backlog is not unsafe-replayed.
   */
  async setAiEmergencyDisable(
    actor: ActorContext,
    organizationId: string,
    disabled: boolean,
    reason?: string,
  ) {
    const actorMembership = await this.requireActive(actor, organizationId);
    if (actorMembership.role !== 'OWNER' && actorMembership.role !== 'ADMIN') {
      throw new ForbiddenException();
    }

    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      if (disabled) {
        const org = await tx.organization.update({
          where: { id: organizationId },
          data: {
            aiEmergencyDisabledAt: new Date(),
            aiEmergencyDisabledReason: reason?.slice(0, 500) ?? 'operator_emergency',
            aiEmergencyDisabledByUserId: actor.userId,
          },
        });
        await this.tenants.writeAudit(tx, {
          organizationId,
          actorUserId: actor.userId,
          action: 'ai.emergency_disabled',
          targetType: 'Organization',
          targetId: organizationId,
          metadataJson: { reason: org.aiEmergencyDisabledReason },
          requestId: actor.requestId,
        });
        return {
          organizationId,
          aiEmergencyDisabled: true,
          aiEmergencyDisabledAt: org.aiEmergencyDisabledAt,
          reason: org.aiEmergencyDisabledReason,
        };
      }

      // Re-enable: fence backlog so paused-period ingress does not auto-start AgentRuns.
      await tx.$executeRaw`
        UPDATE conversations
        SET ai_eligible_after_sequence = GREATEST(
              ai_eligible_after_sequence,
              GREATEST(next_sequence - 1, 0)
            ),
            updated_at = NOW()
        WHERE organization_id = ${organizationId}::uuid
          AND mode = 'AI_ACTIVE'
      `;

      const org = await tx.organization.update({
        where: { id: organizationId },
        data: {
          aiEmergencyDisabledAt: null,
          aiEmergencyDisabledReason: null,
          aiEmergencyDisabledByUserId: null,
        },
      });
      await this.tenants.writeAudit(tx, {
        organizationId,
        actorUserId: actor.userId,
        action: 'ai.emergency_enabled',
        targetType: 'Organization',
        targetId: organizationId,
        requestId: actor.requestId,
      });
      return {
        organizationId,
        aiEmergencyDisabled: false,
        aiEmergencyDisabledAt: org.aiEmergencyDisabledAt,
        backlogFenced: true,
      };
    });
  }

  async getProfile(actor: ActorContext, organizationId: string): Promise<OrganizationProfileDto> {
    await this.requireActive(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      let profile = await tx.organizationProfile.findUnique({ where: { organizationId } });
      if (!profile) {
        const org = await tx.organization.findUniqueOrThrow({ where: { id: organizationId } });
        profile = await tx.organizationProfile.create({
          data: {
            organizationId,
            displayName: org.name,
            country: 'IQ',
            timezone: 'Asia/Baghdad',
            defaultLanguage: 'ar',
            defaultCurrency: 'IQD',
          },
        });
      }
      return {
        organizationId: profile.organizationId,
        displayName: profile.displayName,
        businessType: profile.businessType,
        description: profile.description,
        country: profile.country,
        timezone: profile.timezone,
        defaultLanguage: profile.defaultLanguage,
        defaultCurrency: profile.defaultCurrency,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
      };
    });
  }

  async updateProfile(
    actor: ActorContext,
    organizationId: string,
    input: UpdateOrganizationProfileRequest,
  ): Promise<OrganizationProfileDto> {
    const actorMembership = await this.requireActive(actor, organizationId);
    if (actorMembership.role !== 'OWNER' && actorMembership.role !== 'ADMIN') {
      throw new ForbiddenException('Only OWNER or ADMIN may update organization profile');
    }
    const parsed = UpdateOrganizationProfileSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.message);
    }

    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const updated = await tx.organizationProfile.upsert({
        where: { organizationId },
        create: {
          organizationId,
          displayName: input.displayName ?? null,
          businessType: input.businessType ?? null,
          description: input.description ?? null,
          country: input.country ?? 'IQ',
          timezone: input.timezone ?? 'Asia/Baghdad',
          defaultLanguage: input.defaultLanguage ?? 'ar',
          defaultCurrency: input.defaultCurrency ?? 'IQD',
        },
        update: {
          ...(input.displayName !== undefined && { displayName: input.displayName }),
          ...(input.businessType !== undefined && { businessType: input.businessType }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.country !== undefined && { country: input.country }),
          ...(input.timezone !== undefined && { timezone: input.timezone }),
          ...(input.defaultLanguage !== undefined && { defaultLanguage: input.defaultLanguage }),
          ...(input.defaultCurrency !== undefined && { defaultCurrency: input.defaultCurrency }),
        },
      });

      await this.tenants.writeAudit(tx, {
        organizationId,
        actorUserId: actor.userId,
        action: 'organization.profile_updated',
        targetType: 'OrganizationProfile',
        targetId: organizationId,
        metadataJson: input as Record<string, unknown>,
        requestId: actor.requestId,
      });

      return {
        organizationId: updated.organizationId,
        displayName: updated.displayName,
        businessType: updated.businessType,
        description: updated.description,
        country: updated.country,
        timezone: updated.timezone,
        defaultLanguage: updated.defaultLanguage,
        defaultCurrency: updated.defaultCurrency,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    });
  }

  async getCapabilities(actor: ActorContext, organizationId: string): Promise<OrganizationCapabilitiesDto> {
    await this.requireActive(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      let caps = await tx.organizationCapabilities.findUnique({ where: { organizationId } });
      if (!caps) {
        caps = await tx.organizationCapabilities.create({
          data: {
            organizationId,
            ...DEFAULT_ORGANIZATION_CAPABILITIES,
          },
        });
      }
      return {
        organizationId: caps.organizationId,
        supportsLeads: caps.supportsLeads,
        leadRequiredBeforeBooking: caps.leadRequiredBeforeBooking,
        autoCreateLeadOnIntent: caps.autoCreateLeadOnIntent,
        supportsBooking: caps.supportsBooking,
        supportsOffers: caps.supportsOffers,
        supportsQuotes: caps.supportsQuotes,
        supportsOrders: caps.supportsOrders,
        supportsInventory: caps.supportsInventory,
        supportsStaff: caps.supportsStaff,
        supportsLocations: caps.supportsLocations,
        supportsProducts: caps.supportsProducts,
        supportsServices: caps.supportsServices,
        supportsListings: caps.supportsListings,
        createdAt: caps.createdAt.toISOString(),
        updatedAt: caps.updatedAt.toISOString(),
      };
    });
  }

  async updateCapabilities(
    actor: ActorContext,
    organizationId: string,
    input: UpdateOrganizationCapabilitiesRequest,
  ): Promise<OrganizationCapabilitiesDto> {
    const actorMembership = await this.requireActive(actor, organizationId);
    if (actorMembership.role !== 'OWNER' && actorMembership.role !== 'ADMIN') {
      throw new ForbiddenException('Only OWNER or ADMIN may update capabilities');
    }
    const parsed = UpdateOrganizationCapabilitiesSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.message);
    }

    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      let current = await tx.organizationCapabilities.findUnique({ where: { organizationId } });
      if (!current) {
        current = await tx.organizationCapabilities.create({
          data: {
            organizationId,
            ...DEFAULT_ORGANIZATION_CAPABILITIES,
          },
        });
      }

      const validation = validateCapabilitiesCombination(current, input);
      if (!validation.valid) {
        throw new BadRequestException(`Invalid capability combination: ${validation.errors.join(', ')}`);
      }

      const updated = await tx.organizationCapabilities.update({
        where: { organizationId },
        data: {
          ...(input.supportsLeads !== undefined && { supportsLeads: input.supportsLeads }),
          ...(input.leadRequiredBeforeBooking !== undefined && {
            leadRequiredBeforeBooking: input.leadRequiredBeforeBooking,
          }),
          ...(input.autoCreateLeadOnIntent !== undefined && {
            autoCreateLeadOnIntent: input.autoCreateLeadOnIntent,
          }),
          ...(input.supportsBooking !== undefined && { supportsBooking: input.supportsBooking }),
          ...(input.supportsOffers !== undefined && { supportsOffers: input.supportsOffers }),
          ...(input.supportsQuotes !== undefined && { supportsQuotes: input.supportsQuotes }),
          ...(input.supportsOrders !== undefined && { supportsOrders: input.supportsOrders }),
          ...(input.supportsInventory !== undefined && { supportsInventory: input.supportsInventory }),
          ...(input.supportsStaff !== undefined && { supportsStaff: input.supportsStaff }),
          ...(input.supportsLocations !== undefined && { supportsLocations: input.supportsLocations }),
          ...(input.supportsProducts !== undefined && { supportsProducts: input.supportsProducts }),
          ...(input.supportsServices !== undefined && { supportsServices: input.supportsServices }),
          ...(input.supportsListings !== undefined && { supportsListings: input.supportsListings }),
        },
      });

      await this.tenants.writeAudit(tx, {
        organizationId,
        actorUserId: actor.userId,
        action: 'organization.capabilities_updated',
        targetType: 'OrganizationCapabilities',
        targetId: organizationId,
        metadataJson: input as Record<string, unknown>,
        requestId: actor.requestId,
      });

      return {
        organizationId: updated.organizationId,
        supportsLeads: updated.supportsLeads,
        leadRequiredBeforeBooking: updated.leadRequiredBeforeBooking,
        autoCreateLeadOnIntent: updated.autoCreateLeadOnIntent,
        supportsBooking: updated.supportsBooking,
        supportsOffers: updated.supportsOffers,
        supportsQuotes: updated.supportsQuotes,
        supportsOrders: updated.supportsOrders,
        supportsInventory: updated.supportsInventory,
        supportsStaff: updated.supportsStaff,
        supportsLocations: updated.supportsLocations,
        supportsProducts: updated.supportsProducts,
        supportsServices: updated.supportsServices,
        supportsListings: updated.supportsListings,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    });
  }

  async getOnboardingState(
    actor: ActorContext,
    organizationId: string,
  ): Promise<OnboardingStateResponse> {
    await this.requireActive(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      let onboarding = await tx.organizationOnboarding.findUnique({ where: { organizationId } });
      if (!onboarding) {
        onboarding = await tx.organizationOnboarding.create({
          data: {
            organizationId,
            status: 'NOT_STARTED',
            currentStep: 'IDENTITY',
            completedSteps: [],
            startedAt: new Date(),
          },
        });
      }

      let profile = await tx.organizationProfile.findUnique({ where: { organizationId } });
      let capabilities = await tx.organizationCapabilities.findUnique({ where: { organizationId } });
      if (!capabilities) {
        capabilities = await tx.organizationCapabilities.create({
          data: {
            organizationId,
            ...DEFAULT_ORGANIZATION_CAPABILITIES,
          },
        });
      }

      const readiness = await this.computeReadiness(tx, organizationId, profile, capabilities);

      return {
        onboarding: {
          organizationId: onboarding.organizationId,
          status: onboarding.status as any,
          currentStep: onboarding.currentStep,
          completedSteps: Array.isArray(onboarding.completedSteps)
            ? (onboarding.completedSteps as string[])
            : [],
          startedAt: onboarding.startedAt ? onboarding.startedAt.toISOString() : null,
          completedAt: onboarding.completedAt ? onboarding.completedAt.toISOString() : null,
          createdAt: onboarding.createdAt.toISOString(),
          updatedAt: onboarding.updatedAt.toISOString(),
        },
        profile: profile
          ? {
              organizationId: profile.organizationId,
              displayName: profile.displayName,
              businessType: profile.businessType,
              description: profile.description,
              country: profile.country,
              timezone: profile.timezone,
              defaultLanguage: profile.defaultLanguage,
              defaultCurrency: profile.defaultCurrency,
              createdAt: profile.createdAt.toISOString(),
              updatedAt: profile.updatedAt.toISOString(),
            }
          : null,
        capabilities: {
          organizationId: capabilities.organizationId,
          supportsLeads: capabilities.supportsLeads,
          leadRequiredBeforeBooking: capabilities.leadRequiredBeforeBooking,
          autoCreateLeadOnIntent: capabilities.autoCreateLeadOnIntent,
          supportsBooking: capabilities.supportsBooking,
          supportsOffers: capabilities.supportsOffers,
          supportsQuotes: capabilities.supportsQuotes,
          supportsOrders: capabilities.supportsOrders,
          supportsInventory: capabilities.supportsInventory,
          supportsStaff: capabilities.supportsStaff,
          supportsLocations: capabilities.supportsLocations,
          supportsProducts: capabilities.supportsProducts,
          supportsServices: capabilities.supportsServices,
          supportsListings: capabilities.supportsListings,
          createdAt: capabilities.createdAt.toISOString(),
          updatedAt: capabilities.updatedAt.toISOString(),
        },
        readiness,
      };
    });
  }

  async updateOnboardingProgress(
    actor: ActorContext,
    organizationId: string,
    input: UpdateOnboardingProgressRequest,
  ): Promise<OrganizationOnboardingDto> {
    const actorMembership = await this.requireActive(actor, organizationId);
    if (actorMembership.role !== 'OWNER' && actorMembership.role !== 'ADMIN') {
      throw new ForbiddenException('Only OWNER or ADMIN may update onboarding progress');
    }
    const parsed = UpdateOnboardingProgressSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.message);
    }

    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      let existing = await tx.organizationOnboarding.findUnique({ where: { organizationId } });
      if (!existing) {
        existing = await tx.organizationOnboarding.create({
          data: {
            organizationId,
            status: 'IN_PROGRESS',
            currentStep: input.currentStep ?? 'IDENTITY',
            completedSteps: input.completedSteps ?? [],
            startedAt: new Date(),
          },
        });
      }

      const statusToSet =
        input.status ??
        (existing.status === 'NOT_STARTED' && (input.currentStep || input.completedSteps)
          ? 'IN_PROGRESS'
          : existing.status);

      const updated = await tx.organizationOnboarding.update({
        where: { organizationId },
        data: {
          ...(input.currentStep !== undefined && { currentStep: input.currentStep }),
          ...(input.completedSteps !== undefined && { completedSteps: input.completedSteps }),
          status: statusToSet,
          startedAt: existing.startedAt ?? new Date(),
        },
      });

      await this.tenants.writeAudit(tx, {
        organizationId,
        actorUserId: actor.userId,
        action: 'organization.onboarding_progress_updated',
        targetType: 'OrganizationOnboarding',
        targetId: organizationId,
        metadataJson: input as Record<string, unknown>,
        requestId: actor.requestId,
      });

      return {
        organizationId: updated.organizationId,
        status: updated.status as any,
        currentStep: updated.currentStep,
        completedSteps: Array.isArray(updated.completedSteps)
          ? (updated.completedSteps as string[])
          : [],
        startedAt: updated.startedAt ? updated.startedAt.toISOString() : null,
        completedAt: updated.completedAt ? updated.completedAt.toISOString() : null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    });
  }

  async completeOnboarding(
    actor: ActorContext,
    organizationId: string,
  ): Promise<CompleteOnboardingResponse> {
    const actorMembership = await this.requireActive(actor, organizationId);
    if (actorMembership.role !== 'OWNER' && actorMembership.role !== 'ADMIN') {
      throw new ForbiddenException('Only OWNER or ADMIN may complete onboarding');
    }

    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const profile = await tx.organizationProfile.findUnique({ where: { organizationId } });
      const capabilities = await tx.organizationCapabilities.findUnique({ where: { organizationId } });
      if (!capabilities) {
        throw new BadRequestException('Organization capabilities are not initialized');
      }

      const readiness = await this.computeReadiness(tx, organizationId, profile, capabilities);
      if (!readiness.overallReady) {
        const incomplete = readiness.items
          .filter((i) => i.status === 'INCOMPLETE')
          .map((i) => i.label);
        throw new BadRequestException(
          `Cannot complete onboarding: required setup is incomplete (${incomplete.join(', ')})`,
        );
      }

      const updated = await tx.organizationOnboarding.upsert({
        where: { organizationId },
        create: {
          organizationId,
          status: 'COMPLETED',
          currentStep: 'REVIEW',
          completedSteps: ONBOARDING_STEPS,
          startedAt: new Date(),
          completedAt: new Date(),
        },
        update: {
          status: 'COMPLETED',
          currentStep: 'REVIEW',
          completedSteps: ONBOARDING_STEPS,
          completedAt: new Date(),
        },
      });

      await this.tenants.writeAudit(tx, {
        organizationId,
        actorUserId: actor.userId,
        action: 'organization.onboarding_completed',
        targetType: 'OrganizationOnboarding',
        targetId: organizationId,
        requestId: actor.requestId,
      });

      return {
        onboarding: {
          organizationId: updated.organizationId,
          status: 'COMPLETED',
          currentStep: updated.currentStep,
          completedSteps: Array.isArray(updated.completedSteps)
            ? (updated.completedSteps as string[])
            : ONBOARDING_STEPS,
          startedAt: updated.startedAt ? updated.startedAt.toISOString() : null,
          completedAt: updated.completedAt ? updated.completedAt.toISOString() : null,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        },
        readiness,
      };
    });
  }

  private async computeReadiness(
    tx: any,
    organizationId: string,
    profile: any,
    capabilities: any,
  ): Promise<OnboardingReadinessDto> {
    const items: ReadinessItem[] = [];

    // 1. Profile readiness
    if (profile?.displayName && profile.displayName.trim().length > 0) {
      items.push({
        key: 'PROFILE_READY',
        label: 'Business Identity',
        status: 'READY',
        detail: `Configured as "${profile.displayName}"`,
      });
    } else {
      items.push({
        key: 'PROFILE_READY',
        label: 'Business Identity',
        status: 'INCOMPLETE',
        detail: 'Business display name is required',
      });
    }

    // 2. Capabilities combination readiness
    const capsValidation = validateCapabilitiesCombination(
      capabilities ?? DEFAULT_ORGANIZATION_CAPABILITIES,
      {},
    );
    if (capsValidation.valid) {
      items.push({
        key: 'CAPABILITIES_READY',
        label: 'AI Capabilities',
        status: 'READY',
        detail: 'Valid capability configuration',
      });
    } else {
      items.push({
        key: 'CAPABILITIES_READY',
        label: 'AI Capabilities',
        status: 'INCOMPLETE',
        detail: capsValidation.errors.join(', '),
      });
    }

    // 3. Booking setup readiness
    if (capabilities?.supportsBooking) {
      const locCount = await tx.location.count({
        where: { organizationId, archivedAt: null },
      });
      items.push({
        key: 'BOOKING_SETUP_READY',
        label: 'Booking Setup',
        status: 'READY',
        detail: locCount > 0 ? `${locCount} location(s) active` : 'Ready to accept appointments',
      });
    } else {
      items.push({
        key: 'BOOKING_SETUP_READY',
        label: 'Booking Setup',
        status: 'NOT_APPLICABLE',
        detail: 'Booking capability disabled',
      });
    }

    // 4. Service setup readiness
    if (capabilities?.supportsServices) {
      const svcCount = await tx.service.count({
        where: { organizationId, archivedAt: null },
      });
      items.push({
        key: 'SERVICE_SETUP_READY',
        label: 'Services Setup',
        status: svcCount > 0 ? 'READY' : 'OPTIONAL',
        detail: svcCount > 0 ? `${svcCount} service(s) configured` : 'Services can be configured anytime',
      });
    } else {
      items.push({
        key: 'SERVICE_SETUP_READY',
        label: 'Services Setup',
        status: 'NOT_APPLICABLE',
        detail: 'Services capability disabled',
      });
    }

    // 5. Staff setup readiness
    if (capabilities?.supportsStaff) {
      const staffCount = await tx.staffMember.count({
        where: { organizationId, archivedAt: null },
      });
      items.push({
        key: 'STAFF_SETUP_READY',
        label: 'Staff Setup',
        status: staffCount > 0 ? 'READY' : 'OPTIONAL',
        detail: staffCount > 0 ? `${staffCount} staff member(s)` : 'Staff can be assigned anytime',
      });
    } else {
      items.push({
        key: 'STAFF_SETUP_READY',
        label: 'Staff Setup',
        status: 'NOT_APPLICABLE',
        detail: 'Staff capability disabled',
      });
    }

    // 6. Location setup readiness
    if (capabilities?.supportsLocations) {
      const locCount = await tx.location.count({
        where: { organizationId, archivedAt: null },
      });
      items.push({
        key: 'LOCATION_SETUP_READY',
        label: 'Locations Setup',
        status: locCount > 0 ? 'READY' : 'OPTIONAL',
        detail: locCount > 0 ? `${locCount} location(s)` : 'Locations can be configured anytime',
      });
    } else {
      items.push({
        key: 'LOCATION_SETUP_READY',
        label: 'Locations Setup',
        status: 'NOT_APPLICABLE',
        detail: 'Multiple locations disabled',
      });
    }

    const overallReady = items.every((i) => i.status !== 'INCOMPLETE');
    return { overallReady, items };
  }

  private async requireActive(actor: ActorContext, organizationId: string) {
    const membership = await this.tenants.runAsActor(actor, async (tx) =>
      tx.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: actor.userId } },
      }),
    );
    if (!membership || membership.status !== 'ACTIVE') {
      // Do not leak existence of other tenants.
      throw new NotFoundException();
    }
    return membership;
  }
}

