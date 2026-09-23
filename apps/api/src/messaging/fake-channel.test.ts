import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeMessagingChannel, contentDigest } from './fake-channel.js';

test('FakeMessagingChannel normalizes and digests', () => {
  const ch = new FakeMessagingChannel();
  const n = ch.normalizeDevInbound({
    organizationId: '00000000-0000-4000-8000-000000000001',
    channelConnectionId: '00000000-0000-4000-8000-000000000002',
    provider: 'whatsapp',
    senderAddress: '+9647700000001',
    providerMessageId: 'pm-1',
    text: 'hello',
  });
  assert.equal(n.eventIdentity, 'msg:pm-1');
  assert.equal(n.payloadDigest, contentDigest(JSON.stringify({
    providerMessageId: 'pm-1',
    text: 'hello',
    sender: '+9647700000001',
  })));
});

test('FakeMessagingChannel rejects empty text', () => {
  const ch = new FakeMessagingChannel();
  assert.throws(() =>
    ch.normalizeDevInbound({
      organizationId: '00000000-0000-4000-8000-000000000001',
      channelConnectionId: '00000000-0000-4000-8000-000000000002',
      provider: 'whatsapp',
      senderAddress: '+9647700000001',
      providerMessageId: 'pm-1',
      text: '  ',
    }),
  );
});
