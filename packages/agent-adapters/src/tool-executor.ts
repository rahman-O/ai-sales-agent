import type { Pool, PoolClient } from 'pg';
import {
  buildOperationKey,
  hashNormalizedArgs,
  type ToolDefinition,
  type ToolExecutionContext,
  type ToolExecutorPort,
  type ToolResult,
} from '@ai-sales-agent/agent-core';
import type { RunStorePort } from '@ai-sales-agent/agent-core';

const TOOL_VERSION = '1';

const DEFS: ToolDefinition[] = [
  {
    name: 'searchServices',
    version: TOOL_VERSION,
    description: 'Search active catalog services',
    classification: 'read',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: { query: { type: 'string' }, limit: { type: 'number' } },
      required: ['query'],
    },
  },
  {
    name: 'getServiceDetails',
    version: TOOL_VERSION,
    description: 'Get service details by id',
    classification: 'read',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: { serviceId: { type: 'string' } },
      required: ['serviceId'],
    },
  },
  {
    name: 'getServicePrice',
    version: TOOL_VERSION,
    description: 'Get current service price',
    classification: 'read',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: { serviceId: { type: 'string' } },
      required: ['serviceId'],
    },
  },
  {
    name: 'getCustomer',
    version: TOOL_VERSION,
    description: 'Get conversation-bound customer profile',
    classification: 'read',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  },
  {
    name: 'createCustomer',
    version: TOOL_VERSION,
    description: 'Ensure/update conversation-bound customer profile',
    classification: 'mutate',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        displayName: { type: 'string' },
        phone: { type: 'string' },
      },
    },
  },
  {
    name: 'handoffToHuman',
    version: TOOL_VERSION,
    description: 'Pause AI and hand off to human',
    classification: 'mutate',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        reasonCode: { type: 'string' },
        summary: { type: 'string' },
      },
      required: ['reasonCode'],
    },
  },
];

async function withTenant<T>(
  pool: Pool,
  organizationId: string,
  fn: (c: PoolClient) => Promise<T>,
): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(`SELECT set_config('app.current_user_id', $1, true)`, [
      '00000000-0000-4000-8000-0000000000a1',
    ]);
    await c.query(`SELECT set_config('app.current_organization_id', $1, true)`, [organizationId]);
    const result = await fn(c);
    await c.query('COMMIT');
    return result;
  } catch (e) {
    try {
      await c.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    c.release();
  }
}

export function createToolExecutor(pool: Pool, store: RunStorePort, sandbox = false): ToolExecutorPort {
  return {
    listTools: () => DEFS,
    async execute(name, args, ctx: ToolExecutionContext): Promise<ToolResult> {
      if (ctx.sandbox || sandbox) {
        if (name === 'createCustomer' || name === 'handoffToHuman') {
          return { ok: false, code: 'TOOL_NOT_AUTHORIZED', safeMessage: 'sandbox_blocks_mutate' };
        }
      }
      const def = DEFS.find((d) => d.name === name);
      if (!def) return { ok: false, code: 'TOOL_NOT_FOUND' };

      if (def.classification === 'mutate') {
        const argsHash = hashNormalizedArgs(args);
        const operationKey = buildOperationKey({
          runKey: ctx.runKey,
          toolCallOrdinal: ctx.toolCallOrdinal,
          toolName: name,
          toolVersion: TOOL_VERSION,
          normalizedArgsHash: argsHash,
        });
        const claim = await store.claimCommand({
          organizationId: ctx.organizationId,
          operationKey,
          agentRunId: ctx.agentRunId,
        });
        if (claim.alreadySucceeded) {
          return {
            ok: true,
            code: 'OK',
            data: claim.resultJson,
            operationId: claim.operationId,
          };
        }

        // ActionGate: revalidate authority immediately before mutation.
        if (name === 'handoffToHuman') {
          const reasonCode =
            typeof args.reasonCode === 'string' ? args.reasonCode.slice(0, 64) : 'CUSTOMER_REQUEST';
          const summary = typeof args.summary === 'string' ? args.summary.slice(0, 500) : null;
          const handoff = await store.finalizeHandoff({
            organizationId: ctx.organizationId,
            conversationId: ctx.conversationId,
            agentRunId: ctx.agentRunId,
            targetIngressSequence: ctx.targetIngressSequence,
            leaseOwner: ctx.leaseOwner,
            leaseFence: ctx.leaseFence,
            ownershipEpoch: ctx.ownershipEpoch,
            reasonCode,
            summary,
            operationId: claim.operationId,
          });
          return {
            ok: true,
            code: 'OK',
            data: handoff,
            operationId: claim.operationId,
          };
        }

        return withTenant(pool, ctx.organizationId, async (c) => {
          const auth = await c.query<{
            mode: string;
            ownership_epoch: number;
            lease_owner: string | null;
            lease_fence: number;
            next_sequence: number;
            customer_id: string;
          }>(
            `SELECT mode, ownership_epoch, lease_owner, lease_fence, next_sequence, customer_id
             FROM conversations WHERE organization_id=$1 AND id=$2 FOR UPDATE`,
            [ctx.organizationId, ctx.conversationId],
          );
          const row = auth.rows[0];
          if (!row) return { ok: false, code: 'NOT_FOUND' };
          if (row.mode !== 'AI_ACTIVE') return { ok: false, code: 'TOOL_NOT_AUTHORIZED' };
          if (row.ownership_epoch !== ctx.ownershipEpoch) return { ok: false, code: 'TOOL_NOT_AUTHORIZED' };
          if (row.lease_owner !== ctx.leaseOwner || row.lease_fence !== ctx.leaseFence) {
            return { ok: false, code: 'TOOL_NOT_AUTHORIZED' };
          }
          if (row.next_sequence - 1 > ctx.targetIngressSequence) {
            return { ok: false, code: 'TOOL_NOT_AUTHORIZED' };
          }
          if (row.customer_id !== ctx.customerId) {
            return { ok: false, code: 'TOOL_NOT_AUTHORIZED' };
          }

          if (name === 'createCustomer') {
            const displayName =
              typeof args.displayName === 'string' ? args.displayName.slice(0, 200) : null;
            await c.query(
              `UPDATE customers SET
                 display_name = COALESCE($3, display_name),
                 version = version + 1,
                 updated_at = now()
               WHERE organization_id=$1 AND id=$2`,
              [ctx.organizationId, ctx.customerId, displayName],
            );
            const data = { customerId: ctx.customerId, updated: true };
            await c.query(
              `UPDATE command_operations SET status='SUCCEEDED', result_json=$3::jsonb, completed_at=now()
               WHERE organization_id=$1 AND id=$2`,
              [ctx.organizationId, claim.operationId, JSON.stringify(data)],
            );
            return { ok: true, code: 'OK', data, operationId: claim.operationId };
          }

          return { ok: false, code: 'TOOL_NOT_FOUND' };
        });
      }

      // Read tools
      return withTenant(pool, ctx.organizationId, async (c) => {
        if (name === 'getCustomer') {
          const r = await c.query(
            `SELECT id, display_name, preferred_locale, version FROM customers
             WHERE organization_id=$1 AND id=$2`,
            [ctx.organizationId, ctx.customerId],
          );
          if (!r.rows[0]) return { ok: false, code: 'NOT_FOUND' };
          return { ok: true, code: 'OK', data: r.rows[0] };
        }
        if (name === 'searchServices') {
          const q = typeof args.query === 'string' ? args.query : '';
          const limit = Math.min(Number(args.limit) || 10, 20);
          const r = await c.query(
            `SELECT id, name FROM services
             WHERE organization_id=$1 AND active = true AND archived_at IS NULL
               AND name ILIKE $2
             LIMIT $3`,
            [ctx.organizationId, `%${q}%`, limit],
          );
          return { ok: true, code: 'OK', data: { services: r.rows } };
        }
        if (name === 'getServiceDetails' || name === 'getServicePrice') {
          const serviceId = typeof args.serviceId === 'string' ? args.serviceId : '';
          const r = await c.query(
            `SELECT id, name, duration_minutes, amount_minor, currency, pricing_version, active
             FROM services WHERE organization_id=$1 AND id=$2 AND archived_at IS NULL`,
            [ctx.organizationId, serviceId],
          );
          if (!r.rows[0] || r.rows[0].active !== true) return { ok: false, code: 'NOT_FOUND' };
          if (name === 'getServicePrice') {
            const s = r.rows[0];
            return {
              ok: true,
              code: 'OK',
              data: {
                serviceId: s.id,
                amountMinor: String(s.amount_minor ?? ''),
                currency: s.currency,
                pricingVersion: s.pricing_version,
              },
            };
          }
          return { ok: true, code: 'OK', data: r.rows[0] };
        }
        return { ok: false, code: 'TOOL_NOT_FOUND' };
      });
    },
  };
}
