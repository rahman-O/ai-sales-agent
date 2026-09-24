import { createHmac, timingSafeEqual } from 'node:crypto';

export const SLOT_TOKEN_TTL_MS = 10 * 60_000;
export const SLOT_TOKEN_MAX_LEN = 4096;

export type SlotTokenPayloadV1 = {
  v: 1;
  organizationId: string;
  customerId: string;
  serviceId: string;
  locationId: string;
  staffMemberId: string;
  startsAt: string;
  endsAt: string;
  issuedAt: string;
  expiresAt: string;
};

function canonicalJson(payload: SlotTokenPayloadV1): string {
  // Stable key order
  return JSON.stringify({
    v: payload.v,
    organizationId: payload.organizationId,
    customerId: payload.customerId,
    serviceId: payload.serviceId,
    locationId: payload.locationId,
    staffMemberId: payload.staffMemberId,
    startsAt: payload.startsAt,
    endsAt: payload.endsAt,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  });
}

function b64url(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, 'utf8');
  return b.toString('base64url');
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s, 'base64url');
}

export function resolveSlotTokenSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.BOOKING_SLOT_TOKEN_SECRET?.trim();
  if (secret) return secret;
  if (env.NODE_ENV === 'production') {
    throw new Error('BOOKING_SLOT_TOKEN_SECRET required in production');
  }
  // Dev/test fail-open only with explicit allow
  if (env.NODE_ENV === 'test' || env.AI_ALLOW_FAKE === 'true') {
    return env.BOOKING_SLOT_TOKEN_SECRET_DEV ?? 'test-booking-slot-token-secret';
  }
  throw new Error('BOOKING_SLOT_TOKEN_SECRET required');
}

export function signSlotToken(
  payload: Omit<SlotTokenPayloadV1, 'v' | 'issuedAt' | 'expiresAt'> & {
    issuedAt?: Date;
    ttlMs?: number;
  },
  secret: string,
): string {
  const issuedAt = payload.issuedAt ?? new Date();
  const ttlMs = payload.ttlMs ?? SLOT_TOKEN_TTL_MS;
  const full: SlotTokenPayloadV1 = {
    v: 1,
    organizationId: payload.organizationId,
    customerId: payload.customerId,
    serviceId: payload.serviceId,
    locationId: payload.locationId,
    staffMemberId: payload.staffMemberId,
    startsAt: payload.startsAt,
    endsAt: payload.endsAt,
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(issuedAt.getTime() + ttlMs).toISOString(),
  };
  const body = canonicalJson(full);
  const sig = createHmac('sha256', secret).update(body, 'utf8').digest();
  const token = `${b64url(body)}.${b64url(sig)}`;
  if (token.length > SLOT_TOKEN_MAX_LEN) throw new Error('slot_token_too_large');
  return token;
}

export type SlotTokenVerifyResult =
  | { ok: true; payload: SlotTokenPayloadV1 }
  | { ok: false; code: string };

export function verifySlotToken(
  token: string,
  secret: string,
  expect: { organizationId: string; customerId: string; now?: Date },
): SlotTokenVerifyResult {
  if (!token || token.length > SLOT_TOKEN_MAX_LEN) return { ok: false, code: 'INVALID_TOKEN' };
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, code: 'INVALID_TOKEN' };
  const [bodyB64, sigB64] = parts;
  if (!bodyB64 || !sigB64) return { ok: false, code: 'INVALID_TOKEN' };
  let body: string;
  let payload: SlotTokenPayloadV1;
  try {
    body = fromB64url(bodyB64).toString('utf8');
    payload = JSON.parse(body) as SlotTokenPayloadV1;
  } catch {
    return { ok: false, code: 'INVALID_TOKEN' };
  }
  if (payload.v !== 1) return { ok: false, code: 'INVALID_TOKEN' };
  const expectedBody = canonicalJson(payload);
  if (expectedBody !== body) return { ok: false, code: 'INVALID_TOKEN' };
  const expectedSig = createHmac('sha256', secret).update(expectedBody, 'utf8').digest();
  let provided: Buffer;
  try {
    provided = fromB64url(sigB64);
  } catch {
    return { ok: false, code: 'INVALID_TOKEN' };
  }
  if (provided.length !== expectedSig.length || !timingSafeEqual(provided, expectedSig)) {
    return { ok: false, code: 'INVALID_TOKEN' };
  }
  if (payload.organizationId !== expect.organizationId) return { ok: false, code: 'TENANT_MISMATCH' };
  if (payload.customerId !== expect.customerId) return { ok: false, code: 'CUSTOMER_MISMATCH' };
  const now = expect.now ?? new Date();
  if (new Date(payload.expiresAt).getTime() <= now.getTime()) {
    return { ok: false, code: 'TOKEN_EXPIRED' };
  }
  return { ok: true, payload };
}
