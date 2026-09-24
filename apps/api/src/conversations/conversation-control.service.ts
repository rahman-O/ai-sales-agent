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
import { ConversationEventsHub } from './conversation-events.hub.js';

export const PAUSE_REASON_CODES = [
  'CUSTOMER_REQUESTED_HUMAN',
  'AI_UNCERTAIN',
  'POLICY_REQUIRES_HUMAN',
  'BOOKING_EXCEPTION',
  'OPERATOR_MANUAL_TAKEOVER',
  'OTHER',
] as const;

export type PauseReasonCode = (typeof PAUSE_REASON_CODES)[number];

type MemberRow = { role: string; status: string; userId: string };

function ownershipChanged(): never {
  throw new ConflictException({ code: 'OWNERSHIP_CHANGED', message: 'ownership epoch mismatch' });
}

@Injectable()
export class ConversationControlService {
  constructor(
    private readonly tenants: TenantContextService,
    private readonly events: ConversationEventsHub,
  ) {}

  private async requireMember(actor: ActorContext, organizationId: string): Promise<MemberRow> {
    const m = await this.tenants.runAsActor(actor, (tx) =>
      tx.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: actor.userId } },
      }),
    );
    if (!m || (m as MemberRow).status !== 'ACTIVE') throw new NotFoundException();
    if (!['OWNER', 'ADMIN', 'MEMBER'].includes((m as MemberRow).role)) {
      throw new ForbiddenException();
    }
    return m as MemberRow;
  }

  private isAdmin(role: string) {
    return role === 'OWNER' || role === 'ADMIN';
  }

  private normalizeReason(
    reasonCode?: string | null,
    reasonText?: string | null,
    fallback: PauseReasonCode = 'OPERATOR_MANUAL_TAKEOVER',
  ): { code: PauseReasonCode; text: string | null } {
    const code = (reasonCode?.trim() || fallback) as PauseReasonCode;
    if (!PAUSE_REASON_CODES.includes(code)) {
      throw new BadRequestException('invalid_pause_reason_code');
    }
    const text = reasonText?.trim() ? reasonText.trim().slice(0, 500) : null;
    return { code, text };
  }

  private async suppressPendingAi(
    tx: { $executeRaw: Function },
    organizationId: string,
    conversationId: string,
  ) {
    await tx.$executeRaw`
      UPDATE messages
      SET delivery_state = 'SUPPRESSED'
      WHERE organization_id = ${organizationId}::uuid
        AND conversation_id = ${conversationId}::uuid
        AND origin = 'AI'
        AND delivery_state = 'PENDING'`;
  }

  private publish(organizationId: string, conversationId: string) {
    this.events.publish(organizationId, { type: 'conversation.updated', conversationId });
  }

  async takeover(
    actor: ActorContext,
    organizationId: string,
    conversationId: string,
    expectedOwnershipEpoch: number,
    reasonCode?: string,
    reasonText?: string,
  ) {
    const member = await this.requireMember(actor, organizationId);
    const reason = this.normalizeReason(reasonCode, reasonText, 'OPERATOR_MANUAL_TAKEOVER');

    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{
          id: string;
          mode: string;
          ownership_epoch: number;
          owner_member_id: string | null;
        }>
      >`
        SELECT id, mode, ownership_epoch, owner_member_id
        FROM conversations
        WHERE organization_id = ${organizationId}::uuid AND id = ${conversationId}::uuid
        FOR UPDATE`;
      const conv = rows[0];
      if (!conv) throw new NotFoundException();
      if (conv.ownership_epoch !== expectedOwnershipEpoch) ownershipChanged();
      if (conv.mode === 'CLOSED') throw new ConflictException('conversation_closed');
      if (conv.mode === 'HUMAN_ACTIVE') {
        throw new ConflictException('legacy_human_active_unsupported');
      }

      // Already owned by self — idempotent-ish return
      if (
        conv.mode === 'AI_PAUSED' &&
        conv.owner_member_id === actor.userId
      ) {
        return tx.conversation.findUniqueOrThrow({
          where: { organizationId_id: { organizationId, id: conversationId } },
        });
      }

      // Forced takeover of another owner's pause requires admin
      if (
        conv.mode === 'AI_PAUSED' &&
        conv.owner_member_id &&
        conv.owner_member_id !== actor.userId &&
        !this.isAdmin(member.role)
      ) {
        throw new ForbiddenException('not_owner');
      }

      await this.suppressPendingAi(tx, organizationId, conversationId);

      const updated = await tx.$queryRaw<Array<Record<string, unknown>>>`
        UPDATE conversations SET
          mode = 'AI_PAUSED',
          owner_member_id = ${actor.userId}::uuid,
          ownership_epoch = ownership_epoch + 1,
          version = version + 1,
          paused_at = COALESCE(paused_at, now()),
          pause_reason_code = ${reason.code},
          pause_reason_text = ${reason.text},
          resumed_at = NULL,
          updated_at = now()
        WHERE organization_id = ${organizationId}::uuid
          AND id = ${conversationId}::uuid
          AND ownership_epoch = ${expectedOwnershipEpoch}
        RETURNING *`;
      if (!updated[0]) ownershipChanged();

      await this.tenants.writeAudit(tx, {
        organizationId,
        actorUserId: actor.userId,
        action: 'conversation.takeover',
        targetType: 'Conversation',
        targetId: conversationId,
        metadataJson: {
          reasonCode: reason.code,
          ownershipEpoch: Number(updated[0].ownership_epoch),
        },
        requestId: actor.requestId,
      });

      this.publish(organizationId, conversationId);
      return tx.conversation.findUniqueOrThrow({
        where: { organizationId_id: { organizationId, id: conversationId } },
      });
    });
  }

  async claim(
    actor: ActorContext,
    organizationId: string,
    conversationId: string,
    expectedOwnershipEpoch: number,
  ) {
    await this.requireMember(actor, organizationId);

    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ mode: string; ownership_epoch: number; owner_member_id: string | null }>
      >`
        SELECT mode, ownership_epoch, owner_member_id
        FROM conversations
        WHERE organization_id = ${organizationId}::uuid AND id = ${conversationId}::uuid
        FOR UPDATE`;
      const conv = rows[0];
      if (!conv) throw new NotFoundException();
      if (conv.ownership_epoch !== expectedOwnershipEpoch) ownershipChanged();
      if (conv.mode !== 'AI_PAUSED') throw new ConflictException('not_paused');
      if (conv.owner_member_id) {
        if (conv.owner_member_id === actor.userId) {
          return tx.conversation.findUniqueOrThrow({
            where: { organizationId_id: { organizationId, id: conversationId } },
          });
        }
        ownershipChanged();
      }

      await this.suppressPendingAi(tx, organizationId, conversationId);

      const updated = await tx.$queryRaw<Array<{ ownership_epoch: number }>>`
        UPDATE conversations SET
          owner_member_id = ${actor.userId}::uuid,
          ownership_epoch = ownership_epoch + 1,
          version = version + 1,
          paused_at = COALESCE(paused_at, now()),
          updated_at = now()
        WHERE organization_id = ${organizationId}::uuid
          AND id = ${conversationId}::uuid
          AND ownership_epoch = ${expectedOwnershipEpoch}
          AND mode = 'AI_PAUSED'
          AND owner_member_id IS NULL
        RETURNING ownership_epoch`;
      if (!updated[0]) ownershipChanged();

      await this.tenants.writeAudit(tx, {
        organizationId,
        actorUserId: actor.userId,
        action: 'conversation.claim',
        targetType: 'Conversation',
        targetId: conversationId,
        metadataJson: { ownershipEpoch: updated[0].ownership_epoch },
        requestId: actor.requestId,
      });

      this.publish(organizationId, conversationId);
      return tx.conversation.findUniqueOrThrow({
        where: { organizationId_id: { organizationId, id: conversationId } },
      });
    });
  }

  async reassign(
    actor: ActorContext,
    organizationId: string,
    conversationId: string,
    expectedOwnershipEpoch: number,
    ownerUserId: string,
  ) {
    const member = await this.requireMember(actor, organizationId);
    if (!this.isAdmin(member.role)) throw new ForbiddenException();
    if (!ownerUserId?.trim()) throw new BadRequestException('ownerUserId_required');

    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const target = await tx.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: ownerUserId } },
      });
      if (!target || target.status !== 'ACTIVE') {
        throw new BadRequestException('target_member_invalid');
      }

      const rows = await tx.$queryRaw<
        Array<{ mode: string; ownership_epoch: number; owner_member_id: string | null }>
      >`
        SELECT mode, ownership_epoch, owner_member_id
        FROM conversations
        WHERE organization_id = ${organizationId}::uuid AND id = ${conversationId}::uuid
        FOR UPDATE`;
      const conv = rows[0];
      if (!conv) throw new NotFoundException();
      if (conv.ownership_epoch !== expectedOwnershipEpoch) ownershipChanged();
      if (conv.mode !== 'AI_PAUSED') throw new ConflictException('not_paused');

      const previousOwner = conv.owner_member_id;
      await this.suppressPendingAi(tx, organizationId, conversationId);

      const updated = await tx.$queryRaw<Array<{ ownership_epoch: number }>>`
        UPDATE conversations SET
          owner_member_id = ${ownerUserId}::uuid,
          ownership_epoch = ownership_epoch + 1,
          version = version + 1,
          paused_at = COALESCE(paused_at, now()),
          updated_at = now()
        WHERE organization_id = ${organizationId}::uuid
          AND id = ${conversationId}::uuid
          AND ownership_epoch = ${expectedOwnershipEpoch}
          AND mode = 'AI_PAUSED'
        RETURNING ownership_epoch`;
      if (!updated[0]) ownershipChanged();

      await this.tenants.writeAudit(tx, {
        organizationId,
        actorUserId: actor.userId,
        action: 'conversation.reassign',
        targetType: 'Conversation',
        targetId: conversationId,
        metadataJson: {
          from: previousOwner,
          to: ownerUserId,
          ownershipEpoch: updated[0].ownership_epoch,
        },
        requestId: actor.requestId,
      });

      this.publish(organizationId, conversationId);
      return tx.conversation.findUniqueOrThrow({
        where: { organizationId_id: { organizationId, id: conversationId } },
      });
    });
  }

  async release(
    actor: ActorContext,
    organizationId: string,
    conversationId: string,
    expectedOwnershipEpoch: number,
  ) {
    const member = await this.requireMember(actor, organizationId);

    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ mode: string; ownership_epoch: number; owner_member_id: string | null }>
      >`
        SELECT mode, ownership_epoch, owner_member_id
        FROM conversations
        WHERE organization_id = ${organizationId}::uuid AND id = ${conversationId}::uuid
        FOR UPDATE`;
      const conv = rows[0];
      if (!conv) throw new NotFoundException();
      if (conv.ownership_epoch !== expectedOwnershipEpoch) ownershipChanged();
      if (conv.mode !== 'AI_PAUSED') throw new ConflictException('not_paused');
      if (!conv.owner_member_id) throw new ConflictException('already_unassigned');
      if (conv.owner_member_id !== actor.userId && !this.isAdmin(member.role)) {
        throw new ForbiddenException('not_owner');
      }

      const updated = await tx.$queryRaw<Array<{ ownership_epoch: number }>>`
        UPDATE conversations SET
          owner_member_id = NULL,
          ownership_epoch = ownership_epoch + 1,
          version = version + 1,
          updated_at = now()
        WHERE organization_id = ${organizationId}::uuid
          AND id = ${conversationId}::uuid
          AND ownership_epoch = ${expectedOwnershipEpoch}
          AND mode = 'AI_PAUSED'
        RETURNING ownership_epoch`;
      if (!updated[0]) ownershipChanged();

      await this.tenants.writeAudit(tx, {
        organizationId,
        actorUserId: actor.userId,
        action: 'conversation.release',
        targetType: 'Conversation',
        targetId: conversationId,
        metadataJson: {
          previousOwner: conv.owner_member_id,
          ownershipEpoch: updated[0].ownership_epoch,
        },
        requestId: actor.requestId,
      });

      this.publish(organizationId, conversationId);
      return tx.conversation.findUniqueOrThrow({
        where: { organizationId_id: { organizationId, id: conversationId } },
      });
    });
  }

  async resumeAI(
    actor: ActorContext,
    organizationId: string,
    conversationId: string,
    expectedOwnershipEpoch: number,
  ) {
    const member = await this.requireMember(actor, organizationId);
    if (!this.isAdmin(member.role)) throw new ForbiddenException();

    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{
          mode: string;
          ownership_epoch: number;
          next_sequence: number;
        }>
      >`
        SELECT mode, ownership_epoch, next_sequence
        FROM conversations
        WHERE organization_id = ${organizationId}::uuid AND id = ${conversationId}::uuid
        FOR UPDATE`;
      const conv = rows[0];
      if (!conv) throw new NotFoundException();
      if (conv.ownership_epoch !== expectedOwnershipEpoch) ownershipChanged();
      if (conv.mode !== 'AI_PAUSED') throw new ConflictException('not_paused');

      // Eligibility boundary = latest allocated ingress (next_sequence - 1), or 0 if none.
      const eligibleAfter = Math.max(0, Number(conv.next_sequence) - 1);

      await this.suppressPendingAi(tx, organizationId, conversationId);

      const updated = await tx.$queryRaw<Array<{ ownership_epoch: number }>>`
        UPDATE conversations SET
          mode = 'AI_ACTIVE',
          owner_member_id = NULL,
          ownership_epoch = ownership_epoch + 1,
          version = version + 1,
          ai_eligible_after_sequence = ${eligibleAfter},
          paused_at = NULL,
          pause_reason_code = NULL,
          pause_reason_text = NULL,
          resumed_at = now(),
          updated_at = now()
        WHERE organization_id = ${organizationId}::uuid
          AND id = ${conversationId}::uuid
          AND ownership_epoch = ${expectedOwnershipEpoch}
          AND mode = 'AI_PAUSED'
        RETURNING ownership_epoch`;
      if (!updated[0]) ownershipChanged();

      await this.tenants.writeAudit(tx, {
        organizationId,
        actorUserId: actor.userId,
        action: 'conversation.resume_ai',
        targetType: 'Conversation',
        targetId: conversationId,
        metadataJson: {
          aiEligibleAfterSequence: eligibleAfter,
          ownershipEpoch: updated[0].ownership_epoch,
        },
        requestId: actor.requestId,
      });

      this.publish(organizationId, conversationId);
      return tx.conversation.findUniqueOrThrow({
        where: { organizationId_id: { organizationId, id: conversationId } },
      });
    });
  }

  /**
   * Human OPERATOR outbound. Idempotency scoped to org+conversation+actor+operation.
   */
  async humanReply(
    actor: ActorContext,
    organizationId: string,
    conversationId: string,
    text: string,
    expectedOwnershipEpoch: number,
    idempotencyKey: string,
  ) {
    const member = await this.requireMember(actor, organizationId);
    if (!idempotencyKey?.trim()) throw new BadRequestException('Idempotency-Key required');
    const body = text?.trim();
    if (!body) throw new BadRequestException('text_required');
    if (body.length > 4096) throw new BadRequestException('text_too_long');

    const operation = 'conversation.human_reply';
    const requestHash = hashRequest({
      organizationId,
      conversationId,
      text: body,
      expectedOwnershipEpoch,
    });

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
      const rec = existing as {
        requestHash: string;
        organizationId: string | null;
        status: string;
        responseJson: unknown;
      };
      if (rec.requestHash !== requestHash) {
        throw new ConflictException('IDEMPOTENCY_PAYLOAD_CONFLICT');
      }
      if (rec.organizationId && rec.organizationId !== organizationId) {
        throw new ConflictException('IDEMPOTENCY_SCOPE_CONFLICT');
      }
      if (rec.status === 'COMPLETED' && rec.responseJson) {
        return rec.responseJson as object;
      }
    }

    try {
      const response = await this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
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
          update: {
            status: 'IN_PROGRESS',
            requestHash,
            organizationId,
          },
        });

        const rows = await tx.$queryRaw<
          Array<{
            mode: string;
            ownership_epoch: number;
            owner_member_id: string | null;
            channel_connection_id: string;
            next_timeline_sequence: number;
          }>
        >`
          SELECT mode, ownership_epoch, owner_member_id, channel_connection_id, next_timeline_sequence
          FROM conversations
          WHERE organization_id = ${organizationId}::uuid AND id = ${conversationId}::uuid
          FOR UPDATE`;
        const conv = rows[0];
        if (!conv) throw new NotFoundException();
        if (conv.ownership_epoch !== expectedOwnershipEpoch) ownershipChanged();
        if (conv.mode !== 'AI_PAUSED') {
          throw new ConflictException('must_takeover_before_reply');
        }
        if (
          conv.owner_member_id !== actor.userId &&
          !this.isAdmin(member.role)
        ) {
          throw new ForbiddenException('not_assignee');
        }

        const messageId = randomUUID();
        const digest = hashRequest({ text: body });
        const timeline = conv.next_timeline_sequence;
        const epoch = conv.ownership_epoch;

        await tx.$executeRaw`
          INSERT INTO messages(
            id, organization_id, conversation_id, channel_connection_id, direction, origin,
            ingress_sequence, timeline_sequence, content_text, content_digest, delivery_state,
            authority_epoch
          ) VALUES (
            ${messageId}::uuid, ${organizationId}::uuid, ${conversationId}::uuid,
            ${conv.channel_connection_id}::uuid, 'OUTBOUND', 'OPERATOR', NULL,
            ${timeline}, ${body}, ${digest}, 'PENDING', ${epoch}
          )`;

        await tx.$executeRaw`
          UPDATE conversations SET
            next_timeline_sequence = next_timeline_sequence + 1,
            last_message_at = now(),
            updated_at = now(),
            version = version + 1
          WHERE organization_id = ${organizationId}::uuid AND id = ${conversationId}::uuid`;

        const eventId = randomUUID();
        await tx.$executeRaw`
          INSERT INTO outbox_events(id, organization_id, event_type, payload_json)
          VALUES (
            ${eventId}::uuid,
            ${organizationId}::uuid,
            'OutboundMessageReady',
            ${JSON.stringify({
              eventId,
              eventType: 'OutboundMessageReady',
              organizationId,
              aggregateType: 'Message',
              aggregateId: messageId,
              payload: { conversationId, messageId },
            })}::jsonb
          )`;

        await this.tenants.writeAudit(tx, {
          organizationId,
          actorUserId: actor.userId,
          action: 'conversation.human_reply',
          targetType: 'Message',
          targetId: messageId,
          metadataJson: { conversationId, authorityEpoch: epoch },
          requestId: actor.requestId,
        });

        const result = {
          messageId,
          conversationId,
          deliveryState: 'PENDING',
          authorityEpoch: epoch,
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
            responseJson: result,
            completedAt: new Date(),
            organizationId,
          },
        });

        this.publish(organizationId, conversationId);
        return result;
      });
      return response;
    } catch (error) {
      if (
        String(error).includes('Unique constraint') ||
        (error as { code?: string }).code === 'P2002'
      ) {
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
        const againRec = again as {
          requestHash: string;
          status: string;
          responseJson: unknown;
        } | null;
        if (againRec?.requestHash !== requestHash) {
          throw new ConflictException('IDEMPOTENCY_PAYLOAD_CONFLICT');
        }
        if (againRec?.status === 'COMPLETED' && againRec.responseJson) {
          return againRec.responseJson as object;
        }
      }
      throw error;
    }
  }
}
