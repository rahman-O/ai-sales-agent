import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import {
  FakeModelProvider,
  resolveAiProvider,
  resolveLocalDemoLimits,
  resolveProductionProvider,
  resolveProviderLimits,
  runAgentOrchestrator,
  tryCreateZeroCostDemoProvider,
  type ConversationSnapshot,
} from '@ai-sales-agent/agent-core';
import { createPgRunStore } from './pg-run-store.js';
import { createToolExecutor } from './tool-executor.js';
import { loadWorkingState } from './conversation-working-state.js';

export function resolveWorkerLeaseTtlSeconds(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.WORKER_LEASE_TTL_SECONDS?.trim();
  if (!raw) return 60;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n < 5 || n > 3600) {
    throw new Error(`invalid_WORKER_LEASE_TTL_SECONDS:${raw} (expected integer 5-3600)`);
  }
  return n;
}

export async function renewConversationLease(
  pool: Pool,
  input: {
    organizationId: string;
    conversationId: string;
    workerId: string;
    leaseFence: number;
    ownershipEpoch: number;
    ttlSeconds: number;
  },
): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_organization_id', $1, true)`, [
      input.organizationId,
    ]);
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [input.workerId]);
    const r = await client.query<{ id: string }>(
      `UPDATE conversations
       SET lease_expires_at = now() + ($4::text || ' seconds')::interval,
           updated_at = now()
       WHERE organization_id = $1::uuid
         AND id = $2::uuid
         AND lease_owner = $3
         AND lease_fence = $5
         AND ownership_epoch = $6
         AND mode = 'AI_ACTIVE'
         AND (lease_expires_at IS NULL OR lease_expires_at > now())
       RETURNING id`,
      [
        input.organizationId,
        input.conversationId,
        input.workerId,
        String(input.ttlSeconds),
        input.leaseFence,
        input.ownershipEpoch,
      ],
    );
    await client.query('COMMIT');
    return (r.rowCount ?? 0) > 0;
  } catch {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    return false;
  } finally {
    client.release();
  }
}

export async function ensureActiveAgentConfig(
  pool: Pool,
  organizationId: string,
): Promise<{ id: string; promptVersion: string; modelProfile: string; toolAllowlist: string[] }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_organization_id', $1, true)`, [organizationId]);
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [
      '00000000-0000-4000-8000-0000000000a1',
    ]);
    const existing = await client.query<{
      id: string;
      prompt_version: string;
      model_profile: string;
      tool_allowlist: string[];
    }>(
      `SELECT id, prompt_version, model_profile, tool_allowlist
       FROM agent_configs WHERE organization_id=$1 AND status='ACTIVE' LIMIT 1`,
      [organizationId],
    );
    if (existing.rows[0]) {
      await client.query('COMMIT');
      const row = existing.rows[0];
      return {
        id: row.id,
        promptVersion: row.prompt_version,
        modelProfile: row.model_profile,
        toolAllowlist: Array.isArray(row.tool_allowlist) ? row.tool_allowlist : [],
      };
    }
    const id = randomUUID();
    const allowlist = [
      'searchServices',
      'getServiceDetails',
      'getServicePrice',
      'getCustomer',
      'createCustomer',
      'handoffToHuman',
    ];
    await client.query(
      `INSERT INTO agent_configs(
         id, organization_id, version, status, prompt_version, model_profile,
         tool_allowlist, budgets_json, activated_at
       ) VALUES ($1,$2,1,'ACTIVE','p04-v1','fake',$3::jsonb,$4::jsonb,now())`,
      [
        id,
        organizationId,
        JSON.stringify(allowlist),
        JSON.stringify({ maxModelCalls: 5, maxToolCalls: 8 }),
      ],
    );
    await client.query('COMMIT');
    return {
      id,
      promptVersion: 'p04-v1',
      modelProfile: 'fake',
      toolAllowlist: allowlist,
    };
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

export async function runConversationAgent(opts: {
  pool: Pool;
  organizationId: string;
  conversationId: string;
  workerId: string;
  leaseFence: number;
  ownershipEpoch: number;
  targetIngressSequence: number;
}): Promise<{ terminal: string; reason: string }> {
  const store = createPgRunStore(opts.pool);
  const tools = createToolExecutor(opts.pool, store, false);

  const client = await opts.pool.connect();
  let snap: ConversationSnapshot;
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_organization_id', $1, true)`, [
      opts.organizationId,
    ]);
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [opts.workerId]);
    const conv = await client.query<{
      customer_id: string;
      mode: string;
      ownership_epoch: number;
      lease_owner: string | null;
      lease_fence: number;
      next_sequence: number;
      processed_sequence: number;
    }>(
      `SELECT customer_id, mode, ownership_epoch, lease_owner, lease_fence, next_sequence, processed_sequence
       FROM conversations WHERE organization_id=$1 AND id=$2`,
      [opts.organizationId, opts.conversationId],
    );
    const c = conv.rows[0];
    if (!c) throw new Error('conversation_not_found');
    if (c.mode !== 'AI_ACTIVE') {
      await client.query('COMMIT');
      return { terminal: 'SKIPPED', reason: `mode_${c.mode}` };
    }

    const messages = await client.query<{
      id: string;
      direction: string;
      ingress_sequence: number | null;
      timeline_sequence: number;
      content_text: string;
    }>(
      `SELECT id, direction, ingress_sequence, timeline_sequence, content_text
       FROM messages
       WHERE organization_id=$1 AND conversation_id=$2
         AND (ingress_sequence IS NULL OR ingress_sequence <= $3)
       ORDER BY timeline_sequence ASC
       LIMIT 50`,
      [opts.organizationId, opts.conversationId, opts.targetIngressSequence],
    );
    const summary = await client.query<{
      summary_text: string;
      source_watermark: number;
    }>(
      `SELECT summary_text, source_watermark FROM conversation_summaries
       WHERE organization_id=$1 AND conversation_id=$2
       ORDER BY version DESC LIMIT 1`,
      [opts.organizationId, opts.conversationId],
    );
    const ws = await loadWorkingState(client, opts.organizationId, opts.conversationId);
    await client.query('COMMIT');

    const cfg = await ensureActiveAgentConfig(opts.pool, opts.organizationId);
    snap = {
      organizationId: opts.organizationId,
      conversationId: opts.conversationId,
      customerId: c.customer_id,
      mode: c.mode,
      ownershipEpoch: opts.ownershipEpoch,
      leaseOwner: opts.workerId,
      leaseFence: opts.leaseFence,
      nextIngressSequence: c.next_sequence,
      processedSequence: c.processed_sequence,
      targetIngressSequence: opts.targetIngressSequence,
      messages: messages.rows.map((m) => ({
        id: m.id,
        direction: m.direction,
        ingressSequence: m.ingress_sequence,
        timelineSequence: m.timeline_sequence,
        contentText: m.content_text,
      })),
      summaryText: summary.rows[0]?.summary_text ?? null,
      summaryWatermark: summary.rows[0]?.source_watermark ?? null,
      workingState: ws
        ? {
            version: ws.version,
            customerId: ws.customerId ?? c.customer_id,
            leadId: ws.leadId,
            data: ws.stateData,
          }
        : null,
      agentConfigVersionId: cfg.id,
      promptVersion: cfg.promptVersion,
      modelProfile: cfg.modelProfile,
      toolAllowlist: cfg.toolAllowlist,
    };
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }

  const prod = resolveProductionProvider(process.env);
  const allowFake = process.env.NODE_ENV !== 'production' || process.env.AI_ALLOW_FAKE === 'true';
  const targetInbound = snap.messages.find(
    (m) => m.direction === 'INBOUND' && m.ingressSequence === snap.targetIngressSequence,
  );
  const wantsDemo = process.env.ZERO_COST_DEMO === '1';
  const demoProvider = tryCreateZeroCostDemoProvider({
    confirmationMessageId: targetInbound?.id ?? null,
    serviceId: process.env.DEMO_SERVICE_ID?.trim() || null,
    inboundText: targetInbound?.contentText ?? '',
  });

  let provider = prod;
  if (!provider && wantsDemo) {
    if (!demoProvider) {
      return { terminal: 'FAILED', reason: 'scripted_demo_provider_unavailable' };
    }
    provider = demoProvider;
  } else if (!provider && allowFake) {
    provider = new FakeModelProvider({
      kind: 'final',
      text: 'شكرًا على رسالتك. كيف يمكنني مساعدتك؟',
    });
  }
  if (!provider) {
    return { terminal: 'FAILED', reason: 'no_production_provider' };
  }
  const providerLimits = resolveProviderLimits(process.env);

  const ttlSeconds = resolveWorkerLeaseTtlSeconds(process.env);
  const heartbeatIntervalMs = Math.min(15_000, Math.max(1000, Math.floor((ttlSeconds * 1000) / 3)));
  let authorityRevoked = false;
  let heartbeatTimer: NodeJS.Timeout | null = null;

  const startHeartbeat = () => {
    heartbeatTimer = setInterval(async () => {
      if (authorityRevoked) return;
      const ok = await renewConversationLease(opts.pool, {
        organizationId: opts.organizationId,
        conversationId: opts.conversationId,
        workerId: opts.workerId,
        leaseFence: opts.leaseFence,
        ownershipEpoch: opts.ownershipEpoch,
        ttlSeconds,
      });
      if (!ok) {
        authorityRevoked = true;
        if (heartbeatTimer) clearInterval(heartbeatTimer);
      }
    }, heartbeatIntervalMs);
    heartbeatTimer.unref();
  };

  const baseLoadAuthority = store.loadAuthority.bind(store);
  const wrappedStore: typeof store = {
    ...store,
    async loadAuthority(orgId, convId) {
      if (authorityRevoked) {
        return {
          mode: 'REVOKED',
          ownershipEpoch: -1,
          leaseOwner: null,
          leaseFence: -1,
          nextIngressSequence: 0,
          processedSequence: 0,
        };
      }
      return baseLoadAuthority(orgId, convId);
    },
  };

  try {
    startHeartbeat();
    const result = await runAgentOrchestrator(snap, {
      provider,
      tools,
      store: wrappedStore,
      allowFakeProvider: allowFake && provider.id === 'fake',
      ...(providerLimits ? { limits: providerLimits } : {}),
    });
    return { terminal: result.terminal, reason: result.reason };
  } finally {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
  }
}

