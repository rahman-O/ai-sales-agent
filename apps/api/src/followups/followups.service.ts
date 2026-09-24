import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  TenantContextService,
  hashRequest,
  type ActorContext,
} from '../database/tenant-context.service.js';
import { ConversationEventsHub } from '../conversations/conversation-events.hub.js';
import { computeNextEligibleAt } from '@ai-sales-agent/agent-adapters';

@Injectable()
export class FollowUpsService {
  constructor(
    private readonly tenants: TenantContextService,
    private readonly events: ConversationEventsHub,
  ) {}

  private async requireMember(actor: ActorContext, organizationId: string) {
    const m = await this.tenants.runAsActor(actor, (tx) =>
      tx.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: actor.userId } },
      }),
    );
    if (!m || (m as { status: string }).status !== 'ACTIVE') throw new NotFoundException();
    return m as { role: string };
  }

  private isAdmin(role: string) {
    return role === 'OWNER' || role === 'ADMIN';
  }

  async list(actor: ActorContext, organizationId: string, status?: string) {
    await this.requireMember(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      return tx.followUp.findMany({
        where: { organizationId, ...(status ? { status } : {}) },
        orderBy: [{ nextEligibleAt: 'asc' }, { createdAt: 'desc' }],
        take: 100,
      });
    });
  }

  async getPolicy(actor: ActorContext, organizationId: string) {
    await this.requireMember(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      let policy = await tx.organizationFollowUpPolicy.findUnique({
        where: { organizationId },
      });
      if (!policy) {
        policy = await tx.organizationFollowUpPolicy.create({
          data: { organizationId },
        });
      }
      return policy;
    });
  }

  async updatePolicy(
    actor: ActorContext,
    organizationId: string,
    body: {
      followUpEnabled?: boolean;
      defaultNoResponseDelayMinutes?: number;
      maxPendingPerCustomer?: number;
      quietHoursStartMinute?: number;
      quietHoursEndMinute?: number;
      timezone?: string;
    },
  ) {
    const member = await this.requireMember(actor, organizationId);
    if (!this.isAdmin(member.role)) throw new ForbiddenException();
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const policy = await tx.organizationFollowUpPolicy.upsert({
        where: { organizationId },
        create: {
          organizationId,
          followUpEnabled: body.followUpEnabled ?? false,
          defaultNoResponseDelayMinutes: body.defaultNoResponseDelayMinutes ?? 1440,
          maxPendingPerCustomer: body.maxPendingPerCustomer ?? 3,
          quietHoursStartMinute: body.quietHoursStartMinute ?? 1200,
          quietHoursEndMinute: body.quietHoursEndMinute ?? 540,
          timezone: body.timezone ?? 'Asia/Baghdad',
        },
        update: {
          ...(body.followUpEnabled != null ? { followUpEnabled: body.followUpEnabled } : {}),
          ...(body.defaultNoResponseDelayMinutes != null
            ? { defaultNoResponseDelayMinutes: body.defaultNoResponseDelayMinutes }
            : {}),
          ...(body.maxPendingPerCustomer != null
            ? { maxPendingPerCustomer: body.maxPendingPerCustomer }
            : {}),
          ...(body.quietHoursStartMinute != null
            ? { quietHoursStartMinute: body.quietHoursStartMinute }
            : {}),
          ...(body.quietHoursEndMinute != null
            ? { quietHoursEndMinute: body.quietHoursEndMinute }
            : {}),
          ...(body.timezone ? { timezone: body.timezone } : {}),
        },
      });
      await this.tenants.writeAudit(tx, {
        organizationId,
        actorUserId: actor.userId,
        action: 'follow_up.policy_updated',
        targetType: 'OrganizationFollowUpPolicy',
        targetId: organizationId,
        requestId: actor.requestId,
      });
      return policy;
    });
  }

  /**
   * Manual / API schedule. Emits FollowUpDue outbox with available_at = nextEligibleAt.
   */
  async schedule(
    actor: ActorContext,
    organizationId: string,
    body: {
      customerId: string;
      conversationId?: string;
      leadId?: string;
      bookingId?: string;
      triggerType: 'LEAD_NO_RESPONSE' | 'MANUAL_SCHEDULED' | 'BOOKING_REMINDER';
      outreachBasis:
        | 'CUSTOMER_INITIATED_CONVERSATION'
        | 'TRANSACTIONAL_BOOKING'
        | 'EXPLICIT_OPT_IN'
        | 'OPERATOR_SCHEDULED';
      scheduledFor: string;
      timezone?: string;
      templateVersionId?: string;
      sendMode?: 'FREE_FORM' | 'TEMPLATE';
      text?: string;
      params?: Record<string, string>;
      originKind?: 'AUTOMATED' | 'OPERATOR_SCHEDULED';
    },
    idempotencyKey?: string,
  ) {
    const member = await this.requireMember(actor, organizationId);
    if (!body.customerId) throw new BadRequestException('customerId_required');
    if (!body.scheduledFor) throw new BadRequestException('scheduledFor_required');

    const operation = 'follow_up.schedule';
    const requestHash = hashRequest(body);
    if (idempotencyKey?.trim()) {
      const existing = await this.tenants.runAsActor(actor, (tx) =>
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
      if (existing) {
        const rec = existing as {
          requestHash: string;
          status: string;
          responseJson: unknown;
        };
        if (rec.requestHash !== requestHash) {
          throw new ConflictException('IDEMPOTENCY_PAYLOAD_CONFLICT');
        }
        if (rec.status === 'COMPLETED' && rec.responseJson) return rec.responseJson as object;
      }
    }

    const originKind = body.originKind ?? 'OPERATOR_SCHEDULED';
    if (originKind === 'OPERATOR_SCHEDULED' && body.outreachBasis !== 'OPERATOR_SCHEDULED') {
      // allow OPERATOR_SCHEDULED basis for manual
    }
    if (body.triggerType === 'LEAD_NO_RESPONSE' && body.outreachBasis === 'OPERATOR_SCHEDULED') {
      throw new BadRequestException('invalid_outreach_basis');
    }

    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      if (idempotencyKey?.trim()) {
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
            organizationId,
          },
          update: { status: 'IN_PROGRESS', requestHash, organizationId },
        });
      }

      let policy = await tx.organizationFollowUpPolicy.findUnique({ where: { organizationId } });
      if (!policy) {
        policy = await tx.organizationFollowUpPolicy.create({ data: { organizationId } });
      }

      const customer = await tx.customer.findUnique({
        where: { organizationId_id: { organizationId, id: body.customerId } },
      });
      if (!customer || customer.archivedAt) throw new BadRequestException('customer_invalid');

      let conversation: {
        id: string;
        ownershipEpoch: number;
        nextSequence: number;
        channelConnectionId: string;
        mode: string;
        ownerMemberId: string | null;
        lastCustomerInboundAt: Date | null;
      } | null = null;

      if (body.conversationId) {
        conversation = await tx.conversation.findUnique({
          where: { organizationId_id: { organizationId, id: body.conversationId } },
        });
        if (!conversation) throw new BadRequestException('conversation_invalid');
        if (
          originKind === 'OPERATOR_SCHEDULED' &&
          !this.isAdmin(member.role) &&
          conversation.ownerMemberId !== actor.userId
        ) {
          throw new ForbiddenException('not_assignee');
        }
      }

      const timezone = body.timezone ?? policy.timezone;
      const scheduledFor = new Date(body.scheduledFor);
      if (Number.isNaN(scheduledFor.getTime())) throw new BadRequestException('invalid_scheduledFor');

      const nextEligibleAt = computeNextEligibleAt({
        scheduledFor,
        timezone,
        quietStartMinute: policy.quietHoursStartMinute,
        quietEndMinute: policy.quietHoursEndMinute,
      });

      const pendingCount = await tx.followUp.count({
        where: {
          organizationId,
          customerId: body.customerId,
          status: { in: ['SCHEDULED', 'PROCESSING'] },
        },
      });
      if (pendingCount >= policy.maxPendingPerCustomer) {
        throw new ConflictException('MAX_PENDING_FOLLOW_UPS');
      }

      const sendMode = body.sendMode ?? (body.templateVersionId ? 'TEMPLATE' : 'FREE_FORM');
      if (sendMode === 'TEMPLATE' && !body.templateVersionId) {
        throw new BadRequestException('templateVersionId_required');
      }

      let expectedBookingStartsAt: Date | null = null;
      let expectedBookingVersion: number | null = null;
      if (body.bookingId) {
        const booking = await tx.booking.findUnique({
          where: { organizationId_id: { organizationId, id: body.bookingId } },
        });
        if (!booking) throw new BadRequestException('booking_invalid');
        expectedBookingStartsAt = booking.startsAt;
        expectedBookingVersion = booking.version;
        if (nextEligibleAt.getTime() >= booking.startsAt.getTime()) {
          throw new BadRequestException('MISSED_ALLOWED_WINDOW');
        }
      }

      const dedupKey = [
        body.triggerType,
        body.leadId ?? '',
        body.bookingId ?? '',
        body.conversationId ?? '',
        conversation ? String(conversation.nextSequence - 1) : '',
      ].join(':');

      const id = randomUUID();
      const operationKey = `followup:${id}`;
      const baselineInbound =
        conversation != null ? Math.max(0, conversation.nextSequence - 1) : null;
      const baselineEpoch =
        originKind === 'AUTOMATED' && conversation != null ? conversation.ownershipEpoch : null;

      const created = await tx.followUp.create({
        data: {
          id,
          organizationId,
          customerId: body.customerId,
          leadId: body.leadId ?? null,
          conversationId: body.conversationId ?? null,
          bookingId: body.bookingId ?? null,
          channelConnectionId: conversation?.channelConnectionId ?? null,
          templateVersionId: body.templateVersionId ?? null,
          status: 'SCHEDULED',
          triggerType: body.triggerType,
          originKind,
          outreachBasis: body.outreachBasis,
          sendMode,
          scheduledFor,
          nextEligibleAt,
          timezone,
          dedupKey,
          operationKey,
          baselineInboundSequence: baselineInbound,
          baselineLastCustomerInboundAt: conversation?.lastCustomerInboundAt ?? null,
          baselineOwnershipEpoch: baselineEpoch,
          expectedBookingStartsAt,
          expectedBookingVersion,
          payloadData: {
            ...(body.text ? { text: body.text } : {}),
            ...(body.params ? { params: body.params } : {}),
          },
          createdByType: 'USER',
          createdByUserId: actor.userId,
        },
      });

      const eventId = randomUUID();
      await this.tenants.writeOutbox(tx, {
        organizationId,
        eventType: 'FollowUpDue',
        eventId,
        payloadJson: {
          eventId,
          eventType: 'FollowUpDue',
          organizationId,
          aggregateType: 'FollowUp',
          aggregateId: id,
          payload: { followUpId: id, followUpVersion: created.version },
        },
        availableAt: nextEligibleAt,
      });

      await this.tenants.writeAudit(tx, {
        organizationId,
        actorUserId: actor.userId,
        action: 'follow_up.scheduled',
        targetType: 'FollowUp',
        targetId: id,
        metadataJson: { triggerType: body.triggerType, nextEligibleAt },
        requestId: actor.requestId,
      });

      if (idempotencyKey?.trim()) {
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
            responseJson: created as object,
            completedAt: new Date(),
            organizationId,
          },
        });
      }

      this.events.publish(organizationId, {
        type: 'followup.updated',
        conversationId: body.conversationId,
      });
      return created;
    });
  }

  async cancel(
    actor: ActorContext,
    organizationId: string,
    followUpId: string,
    expectedVersion: number,
  ) {
    const member = await this.requireMember(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ id: string; status: string; version: number; origin_kind: string }>
      >`
        SELECT id, status, version, origin_kind FROM follow_ups
        WHERE organization_id=${organizationId}::uuid AND id=${followUpId}::uuid
        FOR UPDATE`;
      const row = rows[0];
      if (!row) throw new NotFoundException();
      if (Number(row.version) !== Number(expectedVersion)) {
        throw new ConflictException('VERSION_CONFLICT');
      }
      if (!['SCHEDULED', 'PROCESSING'].includes(row.status)) {
        throw new ConflictException('not_cancellable');
      }
      if (!this.isAdmin(member.role) && row.origin_kind === 'AUTOMATED') {
        // members may cancel operator-scheduled; admins cancel any
      }

      const updated = await tx.followUp.update({
        where: { organizationId_id: { organizationId, id: followUpId } },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          resultReasonCode: 'MANUAL_CANCEL',
          version: { increment: 1 },
        },
      });

      await this.tenants.writeAudit(tx, {
        organizationId,
        actorUserId: actor.userId,
        action: 'follow_up.cancelled',
        targetType: 'FollowUp',
        targetId: followUpId,
        requestId: actor.requestId,
      });
      this.events.publish(organizationId, { type: 'followup.updated' });
      return updated;
    });
  }
}
