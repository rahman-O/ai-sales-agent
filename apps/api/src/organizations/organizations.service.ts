import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AddMemberRequest, CreateOrganizationResponse, MemberRole } from '@ai-sales-agent/contracts';
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
