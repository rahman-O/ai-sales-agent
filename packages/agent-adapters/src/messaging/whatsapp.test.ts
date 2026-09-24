import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import {
  canTransitionDelivery,
  evaluateFreeFormWindow,
  mapMetaStatusToDelivery,
  verifyMetaSignature256,
  applyDeliveryTransition,
  MetaWhatsAppChannel,
} from '@ai-sales-agent/agent-adapters';

test('delivery transition table rejects regressions', () => {
  assert.equal(canTransitionDelivery('ACCEPTED', 'DELIVERED'), true);
  assert.equal(canTransitionDelivery('DELIVERED', 'READ'), true);
  assert.equal(canTransitionDelivery('READ', 'DELIVERED'), false);
  assert.equal(canTransitionDelivery('DELIVERED', 'ACCEPTED'), false);
  assert.equal(canTransitionDelivery('READ', 'FAILED'), false);
  assert.equal(canTransitionDelivery('DELIVERED', 'FAILED'), false);
  assert.equal(canTransitionDelivery('ACCEPTED', 'FAILED'), true);
  assert.equal(applyDeliveryTransition('READ', 'DELIVERED').applied, false);
  assert.equal(mapMetaStatusToDelivery('delivered'), 'DELIVERED');
});

test('customer-care window policy', () => {
  const now = new Date('2026-06-01T12:00:00.000Z');
  assert.equal(
    evaluateFreeFormWindow(new Date('2026-06-01T11:00:00.000Z'), now).allowed,
    true,
  );
  assert.equal(
    evaluateFreeFormWindow(new Date('2026-05-30T11:00:00.000Z'), now).allowed,
    false,
  );
  assert.equal(evaluateFreeFormWindow(null, now).allowed, false);
});

test('Meta HMAC signature verify — valid / wrong / missing / tampered', () => {
  const secret = 'test-app-secret';
  const body = Buffer.from('{"object":"whatsapp_business_account"}', 'utf8');
  const sig = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(verifyMetaSignature256(body, sig, secret), true);
  assert.equal(verifyMetaSignature256(body, 'sha256=' + '0'.repeat(64), secret), false);
  assert.equal(verifyMetaSignature256(body, undefined, secret), false);
  assert.equal(verifyMetaSignature256(body, 'not-a-sig', secret), false);
  const tampered = Buffer.from('{"object":"tampered"}', 'utf8');
  assert.equal(verifyMetaSignature256(tampered, sig, secret), false);
});

test('GET verify token is application-scoped', () => {
  const ch = new MetaWhatsAppChannel();
  const env = { META_WHATSAPP_VERIFY_TOKEN: 'verify-me' };
  const ok = ch.verifyWebhookGet(
    { 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-me', 'hub.challenge': '12345' },
    env,
  );
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.challenge, '12345');
  const bad = ch.verifyWebhookGet(
    { 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': '12345' },
    env,
  );
  assert.equal(bad.ok, false);
});

test('ambiguous send classification on timeout', async () => {
  const ch = new MetaWhatsAppChannel();
  const env = {
    META_GRAPH_API_VERSION: 'v25.0',
    META_WHATSAPP_ACCESS_TOKEN: 'token',
  };
  const result = await ch.send(
    {
      organizationId: 'o',
      channelConnectionId: 'c',
      messageId: 'm',
      phoneNumberId: 'pn',
      toE164: '+15551234567',
      text: 'hi',
      credentialRef: null,
    },
    {
      env,
      fetchImpl: async () => {
        const err = new Error('The operation was aborted due to timeout');
        err.name = 'TimeoutError';
        throw err;
      },
    },
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.class, 'AMBIGUOUS_DISPATCH');
});

test('normalize inbound text and status digest', () => {
  const ch = new MetaWhatsAppChannel();
  const batch = ch.normalizeWebhookPayload({
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: '1099', display_phone_number: '+15550001111' },
              messages: [
                {
                  id: 'wamid.ABC',
                  from: '15551234567',
                  timestamp: '1717200000',
                  type: 'text',
                  text: { body: 'hello' },
                },
              ],
              statuses: [
                {
                  id: 'wamid.OUT',
                  status: 'delivered',
                  timestamp: '1717200001',
                  recipient_id: '15551234567',
                },
              ],
            },
          },
        ],
      },
    ],
  });
  assert.ok(batch);
  assert.equal(batch!.phoneNumberId, '1099');
  assert.equal(batch!.inbound.length, 1);
  assert.equal(batch!.inbound[0]!.eventIdentity, 'wamid:wamid.ABC');
  assert.equal(batch!.statuses.length, 1);
  assert.ok(batch!.statuses[0]!.eventIdentity.startsWith('status:'));
});
