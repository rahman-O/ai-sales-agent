import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  TenantContextService,
  type ActorContext,
  type TenantTxClient,
} from '../database/tenant-context.service.js';
import { normalizeContact } from '../domain/value-objects.js';
import { domainEvent } from '../domain/domain-event.js';
import { FakeMessagingChannel, contentDigest, fixtureExternalChannelId } from './fake-channel.js';
import type { NormalizedInboundMessage } from './messaging-channel.js';
import { ConversationEventsHub } from '../conversations/conversation-events.hub.js';

@Injectable()
export class InboundMessagingService {
  private readonly channel = new FakeMessagingChannel();

  constructor(
    private readonly tenants: TenantContextService,
    private readonly events: ConversationEventsHub,
  ) {}

  private async authorize(actor: ActorContext, organizationId: string) {
    const m = await this.tenants.runAsActor(actor, (tx) =>
      tx.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: actor.userId } },
      }),
    );
    if (!m || (m as { status: string }).status !== 'ACTIVE') throw new NotFoundException();
  }

  /** Ensure fixture ChannelConnection exists for provider slug within org. */
  async ensureFixtureConnection(
    tx: TenantTxClient,
    organizationId: string,
    provider: string,
  ) {
    const externalChannelId = fixtureExternalChannelId(organizationId, provider);
    const existing = await tx.channelConnection.findUnique({
      where: { provider_externalChannelId: { provider, externalChannelId } },
    });
    if (existing) {
      if (existing.organizationId !== organizationId) {
        throw new ConflictException('Channel connection bound to another organization');
      }
      return existing;
    }
    return tx.channelConnection.create({
      data: {
        id: randomUUID(),
        organizationId,
        provider,
        externalChannelId,
        status: 'ACTIVE',
      },
    });
  }

  async ingestDevInbound(
    actor: ActorContext,
    organizationId: string,
    body: {
      provider?: string;
      channelConnectionId?: string;
      senderAddress: string;
      providerMessageId: string;
      text: string;
      providerEventAt?: string | null;
    },
  ) {
    await this.authorize(actor, organizationId);
    return this.tenants.runInTenantContext(organizationId, actor, async (tx) => {
      const provider = (body.provider ?? 'whatsapp').toLowerCase();
      let connectionId = body.channelConnectionId;
      if (!connectionId) {
        const conn = await this.ensureFixtureConnection(tx, organizationId, provider);
        connectionId = conn.id;
      }
      const connection = await tx.channelConnection.findUnique({
        where: { organizationId_id: { organizationId, id: connectionId } },
      });
      if (!connection || connection.status !== 'ACTIVE') {
        throw new NotFoundException('Channel connection not found');
      }

      let normalized;
      try {
        normalized = this.channel.normalizeDevInbound({
          organizationId,
          channelConnectionId: connection.id,
          provider: connection.provider,
          senderAddress: body.senderAddress,
          providerMessageId: body.providerMessageId,
          text: body.text,
          providerEventAt: body.providerEventAt,
        });
      } catch (e) {
        throw new BadRequestException((e as Error).message);
      }

      return this.persistInbound(tx, actor, normalized);
    });
  }

  async persistInbound(
    tx: TenantTxClient,
    actor: ActorContext,
    inbound: NormalizedInboundMessage,
  ) {
    const organizationId = inbound.organizationId;

    // Receipt dedup / conflict
    const existingReceipt = await tx.webhookReceipt.findUnique({
      where: {
        channelConnectionId_eventIdentity: {
          channelConnectionId: inbound.channelConnectionId,
          eventIdentity: inbound.eventIdentity,
        },
      },
    });
    if (existingReceipt) {
      if (existingReceipt.payloadDigest !== inbound.payloadDigest) {
        throw new ConflictException('Provider event identity conflict');
      }
      if (existingReceipt.messageId) {
        const msg = await tx.message.findUnique({
          where: { organizationId_id: { organizationId, id: existingReceipt.messageId } },
        });
        return { replay: true as const, message: msg, receipt: existingReceipt };
      }
    }

    if (inbound.providerMessageId) {
      const existingMsg = await tx.message.findFirst({
        where: {
          channelConnectionId: inbound.channelConnectionId,
          providerMessageId: inbound.providerMessageId,
        },
      });
      if (existingMsg) {
        if (existingMsg.contentDigest !== inbound.payloadDigest) {
          throw new ConflictException('Provider message identity conflict');
        }
        return { replay: true as const, message: existingMsg, receipt: existingReceipt };
      }
    }

    let address;
    try {
      address = normalizeContact(
        inbound.provider === 'meta_whatsapp' ? 'whatsapp' : inbound.provider,
        inbound.senderAddress,
      );
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    let identity = await tx.customerIdentity.findUnique({
      where: {
        organizationId_channelConnectionId_externalAddress: {
          organizationId,
          channelConnectionId: inbound.channelConnectionId,
          externalAddress: address.externalAddress,
        },
      },
    });

    if (!identity) {
      const customer = await tx.customer.create({
        data: {
          id: randomUUID(),
          organizationId,
          displayName: address.externalAddress,
        },
      });
      identity = await tx.customerIdentity.create({
        data: {
          id: randomUUID(),
          organizationId,
          customerId: customer.id,
          channelConnectionId: inbound.channelConnectionId,
          channel: address.channel,
          externalAddress: address.externalAddress,
        },
      });
    } else if (identity.revokedAt) {
      throw new ConflictException('Identity revoked');
    }

    // Lock or create conversation
    let conversation = await tx.conversation.findUnique({
      where: {
        organizationId_channelConnectionId_identityId: {
          organizationId,
          channelConnectionId: inbound.channelConnectionId,
          identityId: identity.id,
        },
      },
    });

    if (!conversation) {
      conversation = await tx.conversation.create({
        data: {
          id: randomUUID(),
          organizationId,
          customerId: identity.customerId,
          channelConnectionId: inbound.channelConnectionId,
          identityId: identity.id,
          mode: 'AI_ACTIVE',
          ownershipEpoch: 0,
          nextSequence: 1,
          processedSequence: 0,
          nextTimelineSequence: 1,
          leaseFence: 0,
          version: 1,
        },
      });
    }

    const locked = await tx.$queryRaw<
      Array<{
        id: string;
        mode: string;
        next_sequence: number;
        next_timeline_sequence: number;
        provider_event_watermark_at: Date | null;
        customer_id: string;
      }>
    >`SELECT id, mode, next_sequence, next_timeline_sequence, provider_event_watermark_at, customer_id
      FROM conversations
      WHERE organization_id = ${organizationId}::uuid AND id = ${conversation.id}::uuid
      FOR UPDATE`;

    const row = locked[0];
    if (!row) throw new NotFoundException();

    let mode = row.mode;
    let ownershipEpochBump = false;
    if (mode === 'CLOSED') {
      mode = 'AI_PAUSED';
      ownershipEpochBump = true;
    }

    const ingressSequence = row.next_sequence;
    const timelineSequence = row.next_timeline_sequence;
    const previousWatermark = row.provider_event_watermark_at;
    const providerEventAt = inbound.providerEventAt;
    const lateFlag =
      providerEventAt != null &&
      previousWatermark != null &&
      providerEventAt.getTime() < previousWatermark.getTime();

    let newWatermark = previousWatermark;
    if (providerEventAt != null) {
      if (previousWatermark == null || providerEventAt.getTime() > previousWatermark.getTime()) {
        newWatermark = providerEventAt;
      }
    }

    const messageId = randomUUID();
    const inboundAt = providerEventAt ?? new Date();
    const message = await tx.message.create({
      data: {
        id: messageId,
        organizationId,
        conversationId: conversation.id,
        channelConnectionId: inbound.channelConnectionId,
        direction: 'INBOUND',
        origin: 'CUSTOMER',
        providerMessageId: inbound.providerMessageId,
        ingressSequence,
        timelineSequence,
        lateFlag,
        contentType: inbound.contentType || 'text',
        contentText: inbound.text,
        contentDigest: inbound.payloadDigest,
        providerEventAt,
        receivedAt: new Date(),
        deliveryState: 'ACCEPTED',
      },
    });

    const receipt = await tx.webhookReceipt.create({
      data: {
        id: randomUUID(),
        organizationId,
        channelConnectionId: inbound.channelConnectionId,
        eventIdentity: inbound.eventIdentity,
        payloadDigest: inbound.payloadDigest,
        status: 'ACCEPTED',
        messageId,
      },
    });

    // Projection only — advance on NEW accepted inbound (not replay)
    await tx.conversation.update({
      where: { organizationId_id: { organizationId, id: conversation.id } },
      data: {
        mode,
        ownershipEpoch: ownershipEpochBump ? { increment: 1 } : undefined,
        nextSequence: ingressSequence + 1,
        nextTimelineSequence: timelineSequence + 1,
        lastMessageAt: new Date(),
        lastCustomerInboundAt: inboundAt,
        providerEventWatermarkAt: newWatermark,
        customerId: identity.customerId,
        version: { increment: 1 },
        ...(ownershipEpochBump
          ? {
              pausedAt: new Date(),
              pauseReasonCode: 'OTHER',
              pauseReasonText: 'reopened_from_closed',
              resumedAt: null,
            }
          : {}),
      },
    });

    const event = domainEvent({
      organizationId,
      eventType: 'InboundMessageAccepted',
      aggregateType: 'Conversation',
      aggregateId: conversation.id,
      aggregateVersion: conversation.version + 1,
      actor: { type: 'USER', id: actor.userId },
      correlationId: actor.requestId,
      payload: {
        conversationId: conversation.id,
        messageId,
        ingressSequence,
        timelineSequence,
        lateFlag,
      },
    });
    await this.tenants.writeOutbox(tx, {
      organizationId,
      eventType: event.eventType,
      payloadJson: event,
      eventId: event.eventId,
    });

    await this.tenants.writeAudit(tx, {
      organizationId,
      actorUserId: actor.userId,
      action: 'message.inbound_accepted',
      targetType: 'Message',
      targetId: messageId,
      metadataJson: { conversationId: conversation.id, ingressSequence, lateFlag },
      requestId: actor.requestId,
    });

    this.events.publish(organizationId, {
      type: 'conversation.updated',
      conversationId: conversation.id,
    });

    return { replay: false as const, message, receipt };
  }
}
