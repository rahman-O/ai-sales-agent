import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { createMetaSimulator } from './server.js';
import { MetaWhatsAppChannel } from '@ai-sales-agent/agent-adapters';

test('production Meta adapter sends through simulator base URL without semantic fork', async () => {
  const sim = createMetaSimulator({ secret: 'sim-secret' });
  const address = await sim.listen();
  assert.ok(address && typeof address === 'object');
  try {
    const result = await new MetaWhatsAppChannel().send(
      {
        organizationId: 'org', channelConnectionId: 'channel', messageId: 'message',
        phoneNumberId: 'phone-A', toE164: '+15550000001', text: 'hello', credentialRef: null,
      },
      { env: {
        NODE_ENV: 'test', PROVIDER_MODE: 'meta-simulator',
        META_GRAPH_BASE_URL: `http://127.0.0.1:${address.port}`,
        META_GRAPH_API_VERSION: 'v25.0', META_WHATSAPP_ACCESS_TOKEN: 'simulator-token',
      } },
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.match(result.providerMessageId, /^wamid\.SIM_/);
  } finally { await sim.close(); }
});

test('external simulator accepts Meta route, records send, and returns realistic wamid', async () => {
  const sim = createMetaSimulator({ secret: 'sim-secret' });
  const address = await sim.listen();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const response = await fetch(`${base}/v25.0/phone-A/messages`, {
      method: 'POST',
      headers: { authorization: 'Bearer simulator-token', 'content-type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: '15550000001', type: 'text', text: { body: 'hello' } }),
    });
    assert.equal(response.status, 200);
    const result = await response.json() as { messages: Array<{ id: string }> };
    assert.match(result.messages[0]!.id, /^wamid\.SIM_[0-9a-f-]+$/);
    const recorded = await fetch(`${base}/simulator/messages`).then((r) => r.json()) as { messages: unknown[] };
    assert.equal(recorded.messages.length, 1);
  } finally { await sim.close(); }
});

test('simulator deterministically emits rate-limit, auth, and transient failures', async () => {
  const sim = createMetaSimulator({ secret: 'sim-secret' });
  const address = await sim.listen();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  const send = () => fetch(`${base}/v25.0/phone-A/messages`, {
    method: 'POST', headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: '15550000001', type: 'text' }),
  });
  try {
    await fetch(`${base}/simulator/scenario`, { method: 'POST', body: JSON.stringify({ scenario: 'RATE_LIMIT_ONCE' }) });
    assert.equal((await send()).status, 429);
    assert.equal((await send()).status, 200);
    await fetch(`${base}/simulator/scenario`, { method: 'POST', body: JSON.stringify({ scenario: 'AUTH_FAILURE' }) });
    assert.equal((await send()).status, 401);
    await fetch(`${base}/simulator/scenario`, { method: 'POST', body: JSON.stringify({ scenario: 'SERVER_ERROR_ALWAYS' }) });
    assert.equal((await send()).status, 503);
  } finally { await sim.close(); }
});

test('simulator posts exact signed Meta-compatible inbound payload over HTTP', async () => {
  const secret = 'sim-secret';
  let observed = false;
  const receiver = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const raw = Buffer.concat(chunks);
    const expected = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
    const parsed = JSON.parse(raw.toString()) as { object: string; entry: Array<{ changes: Array<{ value: { messages: Array<{ id: string }> } }> }> };
    observed = req.headers['x-hub-signature-256'] === expected && parsed.object === 'whatsapp_business_account' && parsed.entry[0]!.changes[0]!.value.messages[0]!.id === 'wamid.SIM_IN';
    res.writeHead(observed ? 200 : 403); res.end('{}');
  });
  await new Promise<void>((resolve) => receiver.listen(0, '127.0.0.1', resolve));
  const receiverAddress = receiver.address();
  assert.ok(receiverAddress && typeof receiverAddress === 'object');
  const sim = createMetaSimulator({ secret });
  const simAddress = await sim.listen();
  assert.ok(simAddress && typeof simAddress === 'object');
  try {
    const response = await fetch(`http://127.0.0.1:${simAddress.port}/simulator/inbound`, {
      method: 'POST', body: JSON.stringify({
        webhookUrl: `http://127.0.0.1:${receiverAddress.port}/v1/webhooks/whatsapp/meta`,
        phoneNumberId: 'phone-A', from: '15550000001', messageId: 'wamid.SIM_IN', text: 'مرحبا',
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(observed, true);
    for (const signatureMode of ['invalid', 'missing', 'modified']) {
      observed = false;
      const rejectedResponse: Response = await fetch(`http://127.0.0.1:${simAddress.port}/simulator/inbound`, {
        method: 'POST', body: JSON.stringify({
          webhookUrl: `http://127.0.0.1:${receiverAddress.port}/v1/webhooks/whatsapp/meta`,
          phoneNumberId: 'phone-A', from: '15550000001', messageId: `wamid.${signatureMode}`,
          text: 'test', signatureMode,
        }),
      });
      assert.equal(rejectedResponse.status, 403);
    }
  } finally {
    await sim.close();
    await new Promise<void>((resolve) => receiver.close(() => resolve()));
  }
});
