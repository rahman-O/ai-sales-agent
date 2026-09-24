import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const META_WHATSAPP_PROVIDER = 'meta_whatsapp';

export type SendPolicyResult =
  | { allowed: true; mode: 'FREE_FORM' }
  | { allowed: false; code: 'POLICY_REJECTED' | 'CHANNEL_UNHEALTHY' | 'MISCONFIGURED' };

export type TransportOutcomeClass =
  | 'DEFINITE_TRANSIENT_FAILURE'
  | 'PERMANENT_FAILURE'
  | 'AUTH_FAILURE'
  | 'RATE_LIMITED'
  | 'AMBIGUOUS_DISPATCH'
  | 'SUCCESS';

export type DeliveryState =
  | 'DRAFT'
  | 'PENDING'
  | 'DISPATCHING'
  | 'ACCEPTED'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | 'SUPPRESSED'
  | 'UNKNOWN';

/** Explicit allowed transitions — not numeric rank. */
const ALLOWED: Record<string, ReadonlySet<DeliveryState>> = {
  PENDING: new Set(['DISPATCHING', 'FAILED', 'SUPPRESSED']),
  DISPATCHING: new Set(['ACCEPTED', 'FAILED', 'UNKNOWN', 'SUPPRESSED']),
  ACCEPTED: new Set(['DELIVERED', 'FAILED', 'READ']),
  DELIVERED: new Set(['READ']),
  READ: new Set(),
  FAILED: new Set(),
  SUPPRESSED: new Set(),
  UNKNOWN: new Set(['ACCEPTED', 'FAILED']), // reconcile may clarify
  DRAFT: new Set(['PENDING', 'FAILED']),
};

export function canTransitionDelivery(from: string, to: DeliveryState): boolean {
  const allowed = ALLOWED[from];
  if (!allowed) return false;
  if (from === to) return true;
  return allowed.has(to);
}

export function mapMetaStatusToDelivery(status: string): DeliveryState | null {
  switch (status) {
    case 'sent':
    case 'accepted':
      return 'ACCEPTED';
    case 'delivered':
      return 'DELIVERED';
    case 'read':
      return 'READ';
    case 'failed':
      return 'FAILED';
    default:
      return null;
  }
}

export interface NormalizedInboundMessage {
  organizationId: string;
  channelConnectionId: string;
  provider: string;
  senderAddress: string;
  providerMessageId: string;
  eventIdentity: string;
  text: string;
  contentType: string;
  providerEventAt: Date | null;
  payloadDigest: string;
  unsupported?: boolean;
  mediaMeta?: { providerMediaId?: string; mimeType?: string; caption?: string };
}

export interface NormalizedStatusEvent {
  organizationId: string;
  channelConnectionId: string;
  providerMessageId: string;
  status: string;
  providerTimestamp: Date | null;
  metaStatusId: string | null;
  eventIdentity: string;
  payloadDigest: string;
  recipientId?: string;
}

export interface OutboundSendIntent {
  organizationId: string;
  channelConnectionId: string;
  messageId: string;
  phoneNumberId: string;
  toE164: string;
  text: string;
  credentialRef: string | null;
  sendMode?: 'FREE_FORM' | 'TEMPLATE';
  template?: {
    name: string;
    languageCode: string;
    components: Array<{ type: string; parameters: Array<{ type: string; text: string }> }>;
  };
}

export type SendResult =
  | { ok: true; providerMessageId: string; class: 'SUCCESS' }
  | {
      ok: false;
      class: Exclude<TransportOutcomeClass, 'SUCCESS'>;
      httpStatus?: number;
      safeMessage?: string;
      retryAfterMs?: number;
    };

export function contentDigest(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function fixtureExternalChannelId(organizationId: string, provider: string): string {
  return `fixture:${organizationId}:${provider}`;
}

export function verifyMetaSignature256(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  appSecret: string,
): boolean {
  if (!signatureHeader || !appSecret) return false;
  const match = /^sha256=([a-f0-9]{64})$/i.exec(signatureHeader.trim());
  if (!match) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest();
  const provided = Buffer.from(match[1]!, 'hex');
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

export function resolveMetaGraphApiVersion(env: NodeJS.ProcessEnv = process.env): string {
  const v = env.META_GRAPH_API_VERSION?.trim();
  if (!v || v === 'latest' || !/^v\d+\.\d+$/.test(v)) {
    if (env.NODE_ENV === 'production') {
      throw new Error('META_GRAPH_API_VERSION required and must be pinned (e.g. v25.0)');
    }
    // Dev/test: require explicit pin too when Meta path is used; callers may catch
    throw new Error('META_GRAPH_API_VERSION required and must be pinned (e.g. v25.0)');
  }
  return v;
}

export function resolveAppVerifyToken(env: NodeJS.ProcessEnv = process.env): string {
  const t = env.META_WHATSAPP_VERIFY_TOKEN?.trim();
  if (!t) {
    if (env.NODE_ENV === 'production') throw new Error('META_WHATSAPP_VERIFY_TOKEN required');
    throw new Error('META_WHATSAPP_VERIFY_TOKEN required');
  }
  return t;
}

export function resolveAppSecret(env: NodeJS.ProcessEnv = process.env): string {
  const s = env.META_WHATSAPP_APP_SECRET?.trim();
  if (!s) {
    if (env.NODE_ENV === 'production') throw new Error('META_WHATSAPP_APP_SECRET required');
    throw new Error('META_WHATSAPP_APP_SECRET required');
  }
  return s;
}

/** Resolve send credential: credentialRef env key, else MVP global token. */
export function resolveAccessToken(
  credentialRef: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (credentialRef?.trim()) {
    const fromRef = env[credentialRef.trim()]?.trim();
    if (fromRef) return fromRef;
    throw new Error('credential_ref_unresolved');
  }
  const global = env.META_WHATSAPP_ACCESS_TOKEN?.trim();
  if (global) return global;
  throw new Error('access_token_missing');
}

export function statusEventDigest(fields: {
  providerMessageId: string;
  status: string;
  providerTimestampMs: number | null;
  metaStatusId: string | null;
}): string {
  return contentDigest(
    JSON.stringify({
      providerMessageId: fields.providerMessageId,
      status: fields.status,
      providerTimestampMs: fields.providerTimestampMs,
      metaStatusId: fields.metaStatusId,
    }),
  );
}

export function evaluateFreeFormWindow(
  lastCustomerInboundAt: Date | null,
  now: Date = new Date(),
  windowMs = 24 * 60 * 60 * 1000,
): SendPolicyResult {
  if (!lastCustomerInboundAt) return { allowed: false, code: 'POLICY_REJECTED' };
  if (now.getTime() - lastCustomerInboundAt.getTime() > windowMs) {
    return { allowed: false, code: 'POLICY_REJECTED' };
  }
  return { allowed: true, mode: 'FREE_FORM' };
}

export interface MessagingChannel {
  verifyWebhookGet?(query: Record<string, string | undefined>): { ok: true; challenge: string } | { ok: false };
  verifyWebhookPost?(rawBody: Buffer, headers: Record<string, string | undefined>): boolean;
}
