import {
  META_WHATSAPP_PROVIDER,
  contentDigest,
  evaluateFreeFormWindow,
  resolveAccessToken,
  resolveAppSecret,
  resolveAppVerifyToken,
  resolveMetaGraphApiVersion,
  statusEventDigest,
  verifyMetaSignature256,
  type NormalizedInboundMessage,
  type NormalizedStatusEvent,
  type OutboundSendIntent,
  type SendPolicyResult,
  type SendResult,
  type TransportOutcomeClass,
} from './messaging-channel.js';

type MetaWebhookBody = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: { display_phone_number?: string; phone_number_id?: string };
        contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
        messages?: Array<Record<string, unknown>>;
        statuses?: Array<Record<string, unknown>>;
      };
    }>;
  }>;
};

export type MetaNormalizedBatch = {
  phoneNumberId: string;
  displayPhoneNumber?: string;
  inbound: Array<Omit<NormalizedInboundMessage, 'organizationId' | 'channelConnectionId'>>;
  statuses: Array<Omit<NormalizedStatusEvent, 'organizationId' | 'channelConnectionId'>>;
  unsupportedCount: number;
};

/**
 * Meta WhatsApp Cloud API adapter.
 * Does not invent Idempotency-Key (not proven for Messages API).
 */
export class MetaWhatsAppChannel {
  readonly provider = META_WHATSAPP_PROVIDER;

  verifyWebhookGet(
    query: Record<string, string | undefined>,
    env: NodeJS.ProcessEnv = process.env,
  ): { ok: true; challenge: string } | { ok: false } {
    let expected: string;
    try {
      expected = resolveAppVerifyToken(env);
    } catch {
      return { ok: false };
    }
    if (query['hub.mode'] !== 'subscribe') return { ok: false };
    if (query['hub.verify_token'] !== expected) return { ok: false };
    const challenge = query['hub.challenge'];
    if (!challenge) return { ok: false };
    return { ok: true, challenge };
  }

  verifyWebhookPost(
    rawBody: Buffer,
    headers: Record<string, string | undefined>,
    env: NodeJS.ProcessEnv = process.env,
  ): boolean {
    let secret: string;
    try {
      secret = resolveAppSecret(env);
    } catch {
      return false;
    }
    const sig =
      headers['x-hub-signature-256'] ??
      headers['X-Hub-Signature-256'] ??
      headers['x-hub-signature-256'.toLowerCase()];
    return verifyMetaSignature256(rawBody, sig, secret);
  }

  normalizeWebhookPayload(body: MetaWebhookBody): MetaNormalizedBatch | null {
    if (body.object !== 'whatsapp_business_account') return null;
    const inbound: MetaNormalizedBatch['inbound'] = [];
    const statuses: MetaNormalizedBatch['statuses'] = [];
    let phoneNumberId = '';
    let displayPhoneNumber: string | undefined;
    let unsupportedCount = 0;

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue;
        const value = change.value;
        if (!value?.metadata?.phone_number_id) continue;
        phoneNumberId = String(value.metadata.phone_number_id);
        displayPhoneNumber = value.metadata.display_phone_number;

        for (const msg of value.messages ?? []) {
          const id = String(msg.id ?? '');
          const from = String(msg.from ?? '');
          const ts = msg.timestamp ? new Date(Number(msg.timestamp) * 1000) : null;
          const type = String(msg.type ?? 'unknown');
          if (!id || !from) continue;

          if (type === 'text') {
            const textObj = msg.text as { body?: string } | undefined;
            const text = String(textObj?.body ?? '').trim();
            if (!text) continue;
            const digest = contentDigest(
              JSON.stringify({ providerMessageId: id, text, sender: from }),
            );
            inbound.push({
              provider: META_WHATSAPP_PROVIDER,
              senderAddress: from.startsWith('+') ? from : `+${from}`,
              providerMessageId: id,
              eventIdentity: `wamid:${id}`,
              text,
              contentType: 'text',
              providerEventAt: ts && !Number.isNaN(ts.getTime()) ? ts : null,
              payloadDigest: digest,
            });
          } else if (type === 'button' || type === 'interactive') {
            const interactive = msg.interactive as
              | { button_reply?: { title?: string }; list_reply?: { title?: string } }
              | undefined;
            const button = msg.button as { text?: string } | undefined;
            const text =
              interactive?.button_reply?.title ||
              interactive?.list_reply?.title ||
              button?.text ||
              '';
            const bodyText = String(text).trim() || `[${type}]`;
            const digest = contentDigest(
              JSON.stringify({ providerMessageId: id, text: bodyText, sender: from }),
            );
            inbound.push({
              provider: META_WHATSAPP_PROVIDER,
              senderAddress: from.startsWith('+') ? from : `+${from}`,
              providerMessageId: id,
              eventIdentity: `wamid:${id}`,
              text: bodyText,
              contentType: type,
              providerEventAt: ts && !Number.isNaN(ts.getTime()) ? ts : null,
              payloadDigest: digest,
            });
          } else {
            unsupportedCount += 1;
            const media = msg[type] as { id?: string; mime_type?: string; caption?: string } | undefined;
            const caption = media?.caption ? String(media.caption).slice(0, 500) : '';
            const text = caption || `[unsupported:${type}]`;
            const digest = contentDigest(
              JSON.stringify({
                providerMessageId: id,
                text,
                sender: from,
                type,
                mediaId: media?.id ?? null,
              }),
            );
            inbound.push({
              provider: META_WHATSAPP_PROVIDER,
              senderAddress: from.startsWith('+') ? from : `+${from}`,
              providerMessageId: id,
              eventIdentity: `wamid:${id}`,
              text,
              contentType: type,
              providerEventAt: ts && !Number.isNaN(ts.getTime()) ? ts : null,
              payloadDigest: digest,
              unsupported: true,
              mediaMeta: {
                providerMediaId: media?.id,
                mimeType: media?.mime_type,
                caption: caption || undefined,
              },
            });
          }
        }

        for (const st of value.statuses ?? []) {
          const id = String(st.id ?? '');
          const status = String(st.status ?? '');
          if (!id || !status) continue;
          const ts = st.timestamp ? new Date(Number(st.timestamp) * 1000) : null;
          const metaStatusId =
            typeof st.id === 'string' && st.status
              ? `${st.id}:${st.status}:${st.timestamp ?? ''}`
              : null;
          const providerTimestampMs = ts && !Number.isNaN(ts.getTime()) ? ts.getTime() : null;
          const digest = statusEventDigest({
            providerMessageId: id,
            status,
            providerTimestampMs,
            metaStatusId,
          });
          statuses.push({
            providerMessageId: id,
            status,
            providerTimestamp: ts && !Number.isNaN(ts.getTime()) ? ts : null,
            metaStatusId,
            eventIdentity: `status:${digest.slice(0, 32)}`,
            payloadDigest: digest,
            recipientId: st.recipient_id ? String(st.recipient_id) : undefined,
          });
        }
      }
    }

    if (!phoneNumberId) return null;
    return { phoneNumberId, displayPhoneNumber, inbound, statuses, unsupportedCount };
  }

  evaluateSendPolicy(input: {
    healthStatus: string;
    channelStatus: string;
    lastCustomerInboundAt: Date | null;
    now?: Date;
  }): SendPolicyResult {
    if (input.channelStatus !== 'ACTIVE') return { allowed: false, code: 'CHANNEL_UNHEALTHY' };
    if (input.healthStatus === 'AUTH_FAILED' || input.healthStatus === 'MISCONFIGURED') {
      return { allowed: false, code: 'CHANNEL_UNHEALTHY' };
    }
    if (input.healthStatus === 'DISABLED') return { allowed: false, code: 'CHANNEL_UNHEALTHY' };
    return evaluateFreeFormWindow(input.lastCustomerInboundAt, input.now);
  }

  async send(
    intent: OutboundSendIntent,
    opts?: {
      env?: NodeJS.ProcessEnv;
      fetchImpl?: typeof fetch;
      /** Test hook: simulate hang after request accepted by transport layer */
      afterRequestHook?: () => Promise<void>;
    },
  ): Promise<SendResult> {
    const env = opts?.env ?? process.env;
    let version: string;
    let token: string;
    try {
      version = resolveMetaGraphApiVersion(env);
      token = resolveAccessToken(intent.credentialRef, env);
    } catch (e) {
      const msg = String((e as Error).message);
      if (msg.includes('credential_ref') || msg.includes('access_token')) {
        return { ok: false, class: 'AUTH_FAILURE', safeMessage: msg };
      }
      return { ok: false, class: 'PERMANENT_FAILURE', safeMessage: msg };
    }

    const url = `https://graph.facebook.com/${version}/${encodeURIComponent(intent.phoneNumberId)}/messages`;
    const body = JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: intent.toE164.replace(/^\+/, ''),
      type: 'text',
      text: { body: intent.text.slice(0, 4096) },
    });

    const fetchImpl = opts?.fetchImpl ?? fetch;
    let res: Response;
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (e) {
      const name = (e as Error).name ?? '';
      const message = String((e as Error).message ?? e);
      // Timeout / abort after request may have left the client → ambiguous
      if (name === 'TimeoutError' || name === 'AbortError' || /aborted|timeout/i.test(message)) {
        return { ok: false, class: 'AMBIGUOUS_DISPATCH', safeMessage: 'dispatch_timeout' };
      }
      // DNS / connection refused before send → definite transient
      if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|fetch failed/i.test(message)) {
        return { ok: false, class: 'DEFINITE_TRANSIENT_FAILURE', safeMessage: 'network_pre_dispatch' };
      }
      return { ok: false, class: 'AMBIGUOUS_DISPATCH', safeMessage: 'network_unknown' };
    }

    if (opts?.afterRequestHook) await opts.afterRequestHook();

    if (res.status === 401 || res.status === 403) {
      return { ok: false, class: 'AUTH_FAILURE', httpStatus: res.status };
    }
    if (res.status === 429) {
      const ra = res.headers.get('retry-after');
      const retryAfterMs = ra ? Number(ra) * 1000 : 60_000;
      return {
        ok: false,
        class: 'RATE_LIMITED',
        httpStatus: 429,
        retryAfterMs: Number.isFinite(retryAfterMs) ? retryAfterMs : 60_000,
      };
    }
    if (res.status >= 500) {
      return { ok: false, class: 'DEFINITE_TRANSIENT_FAILURE', httpStatus: res.status };
    }
    if (res.status >= 400) {
      return { ok: false, class: 'PERMANENT_FAILURE', httpStatus: res.status };
    }

    let json: { messages?: Array<{ id?: string }> };
    try {
      json = (await res.json()) as { messages?: Array<{ id?: string }> };
    } catch {
      // HTTP success but body unreadable — ambiguous (may have been accepted)
      return { ok: false, class: 'AMBIGUOUS_DISPATCH', safeMessage: 'response_parse_failed' };
    }
    const wamid = json.messages?.[0]?.id;
    if (!wamid) {
      return { ok: false, class: 'AMBIGUOUS_DISPATCH', safeMessage: 'missing_wamid' };
    }
    return { ok: true, providerMessageId: wamid, class: 'SUCCESS' };
  }

  classifyHttpForTests(className: TransportOutcomeClass): TransportOutcomeClass {
    return className;
  }
}
