import { createHash } from 'node:crypto';
import {
  contentDigest,
  fixtureExternalChannelId,
  type NormalizedInboundMessage,
} from './messaging-channel.js';

export { contentDigest, fixtureExternalChannelId };
export type { NormalizedInboundMessage };

/**
 * Provider-neutral fake channel for P03 development ingress.
 * Does not call Meta / WhatsApp APIs.
 */
export class FakeMessagingChannel {
  normalizeDevInbound(input: {
    organizationId: string;
    channelConnectionId: string;
    provider: string;
    senderAddress: string;
    providerMessageId: string;
    text: string;
    providerEventAt?: string | null;
  }): NormalizedInboundMessage {
    const text = input.text?.trim();
    if (!text || text.length > 8000) throw new Error('Invalid text');
    if (!input.providerMessageId?.trim()) throw new Error('providerMessageId required');
    if (!input.senderAddress?.trim()) throw new Error('senderAddress required');
    const digest = contentDigest(
      JSON.stringify({
        providerMessageId: input.providerMessageId.trim(),
        text,
        sender: input.senderAddress.trim(),
      }),
    );
    return {
      organizationId: input.organizationId,
      channelConnectionId: input.channelConnectionId,
      provider: input.provider,
      senderAddress: input.senderAddress.trim(),
      providerMessageId: input.providerMessageId.trim(),
      eventIdentity: `msg:${input.providerMessageId.trim()}`,
      text,
      contentType: 'text',
      providerEventAt: input.providerEventAt ? new Date(input.providerEventAt) : null,
      payloadDigest: digest,
    };
  }
}

// keep createHash import used via contentDigest re-export path
void createHash;
