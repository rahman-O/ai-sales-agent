import { createHmac, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

export type SimulatorScenario =
  | 'SUCCESS' | 'RATE_LIMIT_ONCE' | 'RATE_LIMIT_ALWAYS' | 'AUTH_FAILURE'
  | 'SERVER_ERROR_ONCE' | 'SERVER_ERROR_ALWAYS' | 'TIMEOUT_BEFORE_ACCEPT'
  | 'TIMEOUT_AFTER_ACCEPT';

type RecordedSend = { providerMessageId: string; phoneNumberId: string; body: unknown; accepted: boolean };

async function body(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(value));
}

export function createMetaSimulator(options: { secret: string; host?: string; port?: number; allowContainerBind?: boolean }) {
  const host = options.host ?? '127.0.0.1';
  if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !(options.allowContainerBind && host === '0.0.0.0')) {
    throw new Error('simulator_loopback_only');
  }
  let scenario: SimulatorScenario = 'SUCCESS';
  let scenarioHits = 0;
  const sends: RecordedSend[] = [];

  const postWebhook = async (url: string, payload: unknown, signatureMode = 'valid') => {
    const raw = Buffer.from(JSON.stringify(payload));
    const signed = signatureMode === 'modified' ? Buffer.concat([raw, Buffer.from(' ')]) : raw;
    const signature = `sha256=${createHmac('sha256', options.secret).update(raw).digest('hex')}`;
    return fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(signatureMode === 'missing' ? {} : { 'x-hub-signature-256': signatureMode === 'invalid' ? `sha256=${'0'.repeat(64)}` : signature }),
      },
      body: signed,
    });
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/health/live')) return json(res, 200, { ok: true });
    if (req.method === 'GET' && url.pathname === '/simulator/messages') return json(res, 200, { messages: sends });
    if (req.method === 'POST' && url.pathname === '/simulator/reset') {
      sends.length = 0; scenario = 'SUCCESS'; scenarioHits = 0; return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/simulator/scenario') {
      const input = JSON.parse((await body(req)).toString()) as { scenario: SimulatorScenario };
      scenario = input.scenario; scenarioHits = 0; return json(res, 200, { ok: true, scenario });
    }
    if (req.method === 'POST' && url.pathname === '/simulator/inbound') {
      const input = JSON.parse((await body(req)).toString()) as Record<string, string>;
      const payload = {
        object: 'whatsapp_business_account',
        entry: [{ id: input.wabaId ?? 'sim-waba', changes: [{ field: 'messages', value: {
          messaging_product: 'whatsapp', metadata: { phone_number_id: input.phoneNumberId },
          contacts: [{ wa_id: input.from, profile: { name: 'Simulator Customer' } }],
          messages: [{ id: input.messageId, from: input.from, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: input.text } }],
        } }] }],
      };
      const response = await postWebhook(input.webhookUrl, payload, input.signatureMode);
      return json(res, response.status, { ok: response.ok, webhookStatus: response.status });
    }
    if (req.method === 'POST' && url.pathname === '/simulator/status') {
      const input = JSON.parse((await body(req)).toString()) as Record<string, string>;
      const payload = { object: 'whatsapp_business_account', entry: [{ id: 'sim-waba', changes: [{ field: 'messages', value: {
        messaging_product: 'whatsapp', metadata: { phone_number_id: input.phoneNumberId },
        statuses: [{ id: input.providerMessageId, status: input.status, timestamp: String(Math.floor(Date.now() / 1000)), recipient_id: input.recipientId }],
      } }] }] };
      const response = await postWebhook(input.webhookUrl, payload);
      return json(res, response.status, { ok: response.ok, webhookStatus: response.status });
    }
    const match = /^\/v\d+\.\d+\/([^/]+)\/messages$/.exec(url.pathname);
    if (req.method === 'POST' && match) {
      if (!req.headers.authorization?.startsWith('Bearer ')) return json(res, 401, { error: { message: 'missing_token' } });
      const parsed = JSON.parse((await body(req)).toString()) as Record<string, unknown>;
      if (parsed.messaging_product !== 'whatsapp' || !parsed.to || !parsed.type) return json(res, 400, { error: { message: 'invalid_payload' } });
      scenarioHits += 1;
      const once = scenarioHits === 1;
      if (scenario === 'AUTH_FAILURE') return json(res, 401, { error: { message: 'invalid_token' } });
      if (scenario === 'RATE_LIMIT_ALWAYS' || (scenario === 'RATE_LIMIT_ONCE' && once)) {
        res.setHeader('retry-after', '1'); return json(res, 429, { error: { message: 'rate_limited' } });
      }
      if (scenario === 'SERVER_ERROR_ALWAYS' || (scenario === 'SERVER_ERROR_ONCE' && once)) return json(res, 503, { error: { message: 'unavailable' } });
      if (scenario === 'TIMEOUT_BEFORE_ACCEPT') return;
      const providerMessageId = `wamid.SIM_${randomUUID()}`;
      sends.push({ providerMessageId, phoneNumberId: decodeURIComponent(match[1]!), body: parsed, accepted: true });
      if (scenario === 'TIMEOUT_AFTER_ACCEPT') return;
      return json(res, 200, { messaging_product: 'whatsapp', contacts: [{ input: parsed.to, wa_id: parsed.to }], messages: [{ id: providerMessageId }] });
    }
    json(res, 404, { error: 'not_found' });
  });

  return {
    server,
    async listen() { await new Promise<void>((resolve) => server.listen(options.port ?? 0, host, resolve)); return server.address(); },
    async close() { await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve())); },
  };
}
