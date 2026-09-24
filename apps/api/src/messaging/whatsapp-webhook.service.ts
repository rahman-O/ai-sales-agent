import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import {
  TenantContextService,
  type ActorContext,
} from '../database/tenant-context.service.js';
import {
  META_WHATSAPP_PROVIDER,
  applyDeliveryTransition,
  mapMetaStatusToDelivery,
} from '@ai-sales-agent/agent-adapters';
import { MetaWhatsAppChannel } from './meta-whatsapp.channel.js';
import { InboundMessagingService } from './inbound.service.js';
import { ConversationEventsHub } from '../conversations/conversation-events.hub.js';

const SYSTEM_ACTOR: ActorContext = {
  userId: '00000000-0000-4000-8000-0000000000a1',
  authSubject: 'whatsapp-webhook',
};

@Injectable()
export class WhatsAppWebhookService {
  private readonly log = new Logger(WhatsAppWebhookService.name);
  private readonly meta = new MetaWhatsAppChannel();

  constructor(
    private readonly tenants: TenantContextService,
    private readonly inbound: InboundMessagingService,
    private readonly events: ConversationEventsHub,
  ) {}

  verifyGet(query: Record<string, string | undefined>) {
    return this.meta.verifyWebhookGet(query);
  }

  async handlePost(
    rawBody: Buffer,
    headers: Record<string, string | undefined>,
  ): Promise<{ ok: true; processed: number; unknownChannel?: boolean }> {
    if (!this.meta.verifyWebhookPost(rawBody, headers)) {
      return Promise.reject(Object.assign(new Error('invalid_signature'), { status: 403 }));
    }
    if (rawBody.length > 1_000_000) {
      return Promise.reject(Object.assign(new Error('payload_too_large'), { status: 413 }));
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return Promise.reject(Object.assign(new Error('malformed_json'), { status: 400 }));
    }

    const batch = this.meta.normalizeWebhookPayload(parsed as never);
    if (!batch) {
      this.log.warn(JSON.stringify({ msg: 'whatsapp_empty_or_ignored_payload' }));
      return { ok: true, processed: 0 };
    }

    const conn = (await this.tenants.runAsActor(SYSTEM_ACTOR, (tx) =>
      tx.channelConnection.findUnique({
        where: {
          provider_externalChannelId: {
            provider: META_WHATSAPP_PROVIDER,
            externalChannelId: batch.phoneNumberId,
          },
        },
      }),
    )) as {
      id: string;
      organizationId: string;
      status: string;
    } | null;

    if (!conn || conn.status !== 'ACTIVE') {
      this.log.warn(
        JSON.stringify({
          msg: 'whatsapp_unknown_channel',
          phoneNumberId: batch.phoneNumberId,
          reason: 'UNKNOWN_PHONE_NUMBER_ID',
          payloadDigest: createHash('sha256').update(rawBody).digest('hex').slice(0, 16),
        }),
      );
      return { ok: true, processed: 0, unknownChannel: true };
    }

    const organizationId = conn.organizationId;
    let processed = 0;

    await this.tenants.runInTenantContext(organizationId, SYSTEM_ACTOR, async (tx) => {
      for (const ev of batch.inbound) {
        const result = await this.inbound.persistInbound(tx, SYSTEM_ACTOR, {
          ...ev,
          organizationId,
          channelConnectionId: conn.id,
        });
        if (!result.replay) processed += 1;
      }

      for (const st of batch.statuses) {
        const existing = await tx.webhookReceipt.findUnique({
          where: {
            channelConnectionId_eventIdentity: {
              channelConnectionId: conn.id,
              eventIdentity: st.eventIdentity,
            },
          },
        });
        if (existing) continue;

        const target = mapMetaStatusToDelivery(st.status);
        const msg = await tx.message.findFirst({
          where: {
            organizationId,
            channelConnectionId: conn.id,
            providerMessageId: st.providerMessageId,
          },
        });

        await tx.webhookReceipt.create({
          data: {
            id: randomUUID(),
            organizationId,
            channelConnectionId: conn.id,
            eventIdentity: st.eventIdentity,
            payloadDigest: st.payloadDigest,
            status: 'ACCEPTED',
            messageId: msg?.id,
          },
        });

        if (msg && target) {
          const next = applyDeliveryTransition(msg.deliveryState, target);
          if (next.applied) {
            await tx.message.update({
              where: { organizationId_id: { organizationId, id: msg.id } },
              data: { deliveryState: next.state },
            });
            processed += 1;
            this.events.publish(organizationId, {
              type: 'conversation.updated',
              conversationId: msg.conversationId,
            });
          }
        }
      }
    });

    return { ok: true, processed };
  }
}
