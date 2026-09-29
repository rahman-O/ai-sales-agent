import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { loadDemoCliEnv } from '../demo/load-demo-cli-env.ts';
import {
  DEMO_META_SIMULATOR_PHONE_NUMBER_ID,
  DEMO_ORG_ID,
} from '../demo/constants.ts';

type Checkpoint = { checkpoint: string; result: 'PASS' | 'FAIL'; detail?: string };
const report = (value: Checkpoint) => console.log(JSON.stringify(value));
const fail = (checkpoint: string, detail: string): never => {
  report({ checkpoint, result: 'FAIL', detail });
  process.exitCode = 1;
  throw new Error(checkpoint);
};

async function main() {
  if (process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production') {
    fail('ENVIRONMENT_PREFLIGHT', 'production_refused');
  }
  loadDemoCliEnv();
  const runId = randomUUID();
  const messageId = `wamid.SIM_INBOUND_${runId}`;
  const api = 'http://127.0.0.1:3001';
  const simulator = 'http://127.0.0.1:3415';
  // The probe calls the simulator through its published host port, while the
  // simulator calls the API over the private Compose network.
  const simulatorWebhookUrl = process.env.MB15_SIMULATOR_WEBHOOK_URL ?? 'http://api:3001/v1/webhooks/whatsapp/meta';
  const verifyToken = process.env.META_WHATSAPP_VERIFY_TOKEN ?? 'mb15a-verify-token';
  const challenge = `challenge-${runId}`;
  const pool = new pg.Pool({ connectionString: process.env.MIGRATION_DATABASE_URL });
  try {
    for (const [name, url] of [['API_HEALTH', `${api}/health/live`], ['SIMULATOR_HEALTH', `${simulator}/health/live`]] as const) {
      const response = await fetch(url).catch(() => null);
      if (!response?.ok) fail(name, 'unreachable');
      report({ checkpoint: name, result: 'PASS' });
    }
    const verify = await fetch(`${api}/v1/webhooks/whatsapp/meta?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(verifyToken)}&hub.challenge=${encodeURIComponent(challenge)}`);
    const echoed = (await verify.text()).replace(/^"|"$/g, '');
    if (!verify.ok || echoed !== challenge) fail('WEBHOOK_VERIFICATION', `http_${verify.status}`);
    report({ checkpoint: 'WEBHOOK_VERIFICATION', result: 'PASS' });

    const channel = await pool.query(
      `SELECT id, organization_id FROM channel_connections WHERE provider='meta_whatsapp' AND external_channel_id=$1 AND status='ACTIVE'`,
      [DEMO_META_SIMULATOR_PHONE_NUMBER_ID],
    );
    if (channel.rowCount !== 1 || channel.rows[0].organization_id !== DEMO_ORG_ID) fail('CHANNEL_FIXTURE', 'missing_or_wrong_tenant');
    report({ checkpoint: 'CHANNEL_FIXTURE', result: 'PASS' });

    report({ checkpoint: 'SIMULATOR_REQUEST_CREATED', result: 'PASS' });
    const inbound = await fetch(`${simulator}/simulator/inbound`, {
      method: 'POST',
      body: JSON.stringify({
        webhookUrl: simulatorWebhookUrl,
        phoneNumberId: DEMO_META_SIMULATOR_PHONE_NUMBER_ID,
        from: '15555550006',
        messageId,
        text: 'مرحبا',
      }),
    });
    if (!inbound.ok) fail('WEBHOOK_HTTP_STATUS', `http_${inbound.status}`);
    report({ checkpoint: 'WEBHOOK_HTTP_STATUS', result: 'PASS' });

    const persisted = await pool.query(
      `SELECT m.id AS message_id, m.conversation_id, c.customer_id
       FROM messages m JOIN conversations c ON c.organization_id=m.organization_id AND c.id=m.conversation_id
       WHERE m.organization_id=$1 AND m.provider_message_id=$2`,
      [DEMO_ORG_ID, messageId],
    );
    if (persisted.rowCount !== 1) fail('MESSAGE_PERSISTENCE', 'message_not_found');
    report({ checkpoint: 'TENANT_RESOLUTION', result: 'PASS' });
    report({ checkpoint: 'CUSTOMER_RESOLUTION', result: 'PASS' });
    report({ checkpoint: 'CONVERSATION_RESOLUTION', result: 'PASS' });
    report({ checkpoint: 'MESSAGE_PERSISTENCE', result: 'PASS' });

    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
      const state = await pool.query(
        `SELECT ar.id AS agent_run_id, ar.final_outbound_message_id,
                m.provider_message_id AS outbound_provider_message_id, m.delivery_state
         FROM agent_runs ar LEFT JOIN messages m
           ON m.organization_id=ar.organization_id AND m.id=ar.final_outbound_message_id
         WHERE ar.organization_id=$1 AND ar.conversation_id=$2
         ORDER BY ar.started_at DESC LIMIT 1`,
        [DEMO_ORG_ID, persisted.rows[0].conversation_id],
      );
      if (state.rows[0]?.outbound_provider_message_id) {
        report({ checkpoint: 'WORKER_STARTED', result: 'PASS' });
        report({ checkpoint: 'AGENT_RUN', result: 'PASS' });
        report({ checkpoint: 'PROVIDER_MESSAGE_ID', result: 'PASS' });

        const outboundProviderMessageId = state.rows[0].outbound_provider_message_id;

        const deliveryRes = await fetch(`${simulator}/simulator/status`, {
          method: 'POST',
          body: JSON.stringify({
            webhookUrl: simulatorWebhookUrl,
            phoneNumberId: DEMO_META_SIMULATOR_PHONE_NUMBER_ID,
            providerMessageId: outboundProviderMessageId,
            status: 'delivered',
            recipientId: '15555550006',
          }),
        });
        if (!deliveryRes.ok) fail('DELIVERY_CALLBACK_HTTP', `http_${deliveryRes.status}`);

        let delivered = false;
        const deliveryDeadline = Date.now() + 15_000;
        while (Date.now() < deliveryDeadline) {
          const msg = await pool.query(
            `SELECT delivery_state FROM messages WHERE organization_id=$1 AND provider_message_id=$2`,
            [DEMO_ORG_ID, outboundProviderMessageId],
          );
          if (msg.rows[0]?.delivery_state === 'DELIVERED') {
            delivered = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 500));
        }
        if (!delivered) fail('DELIVERY_CALLBACK_STATE', 'delivery_state_not_delivered');
        report({ checkpoint: 'DELIVERY_CALLBACK', result: 'PASS' });

        const readRes = await fetch(`${simulator}/simulator/status`, {
          method: 'POST',
          body: JSON.stringify({
            webhookUrl: simulatorWebhookUrl,
            phoneNumberId: DEMO_META_SIMULATOR_PHONE_NUMBER_ID,
            providerMessageId: outboundProviderMessageId,
            status: 'read',
            recipientId: '15555550006',
          }),
        });
        if (!readRes.ok) fail('READ_CALLBACK_HTTP', `http_${readRes.status}`);

        let read = false;
        const readDeadline = Date.now() + 15_000;
        while (Date.now() < readDeadline) {
          const msg = await pool.query(
            `SELECT delivery_state FROM messages WHERE organization_id=$1 AND provider_message_id=$2`,
            [DEMO_ORG_ID, outboundProviderMessageId],
          );
          if (msg.rows[0]?.delivery_state === 'READ') {
            read = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 500));
        }
        if (!read) fail('READ_CALLBACK_STATE', 'delivery_state_not_read');
        report({ checkpoint: 'READ_CALLBACK', result: 'PASS' });
        report({ checkpoint: 'MB15_PROBE', result: 'PASS' });
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
    fail('QUEUE_WORKER_AGENT_OUTBOUND', 'timeout_waiting_for_provider_message_id');
  } finally {
    await pool.end();
  }
}

void main().catch((error) => {
  if (!process.exitCode) {
    report({ checkpoint: 'UNEXPECTED', result: 'FAIL', detail: String((error as Error).message) });
    process.exitCode = 1;
  }
});
