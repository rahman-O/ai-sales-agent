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
import {
  ACCEPTED_EMBEDDING_PROFILE,
  FakeEmbeddingProvider,
  resolveEmbeddingProvider,
} from '@ai-sales-agent/embeddings';
import {
  toolEnsureLead,
  toolGetLead,
  toolTransitionLead,
  toolUpdateLeadQualification,
} from './lead-tools.js';
import {
  toolCancelBooking,
  toolCreateBooking,
  toolGetAvailableSlots,
  toolGetBookings,
  toolRescheduleBooking,
} from './booking-tools.js';

const TOOL_VERSION = '1';
const MAX_DISTANCE = ACCEPTED_EMBEDDING_PROFILE.maxDistance;
const PROFILE_ID = ACCEPTED_EMBEDDING_PROFILE.profileId;

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
  {
    name: 'searchKnowledge',
    version: TOOL_VERSION,
    description:
      'Retrieve approved tenant knowledge excerpts (evidence only; not authoritative for prices/slots)',
    classification: 'read',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
  },
  {
    name: 'ensureLead',
    version: TOOL_VERSION,
    description: 'Idempotently ensure an OPEN lead for the conversation customer',
    classification: 'mutate',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        serviceId: { type: 'string' },
        needSummary: { type: 'string' },
        preferredContactChannel: { type: 'string' },
        language: { type: 'string' },
        locationId: { type: 'string' },
      },
    },
  },
  {
    name: 'updateLeadQualification',
    version: TOOL_VERSION,
    description: 'Patch allowlisted qualification fields on an OPEN lead',
    classification: 'mutate',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        leadId: { type: 'string' },
        expectedVersion: { type: 'number' },
        needSummary: { type: 'string' },
        preferredContactChannel: { type: 'string' },
        language: { type: 'string' },
        locationId: { type: 'string' },
        serviceId: { type: 'string' },
      },
      required: ['leadId', 'expectedVersion'],
    },
  },
  {
    name: 'getLead',
    version: TOOL_VERSION,
    description: 'Get OPEN lead for conversation customer (or by leadId/serviceId)',
    classification: 'read',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        leadId: { type: 'string' },
        serviceId: { type: 'string' },
      },
    },
  },
  {
    name: 'transitionLead',
    version: TOOL_VERSION,
    description: 'Progress lead among non-terminal statuses (AI cannot archive/disqualify)',
    classification: 'mutate',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        leadId: { type: 'string' },
        expectedVersion: { type: 'number' },
        toStatus: { type: 'string' },
      },
      required: ['leadId', 'expectedVersion', 'toStatus'],
    },
  },
  {
    name: 'getAvailableSlots',
    version: TOOL_VERSION,
    description: 'Backend-computed available appointment slots with slotTokens',
    classification: 'read',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        serviceId: { type: 'string' },
        startDate: { type: 'string' },
        endDate: { type: 'string' },
        locationId: { type: 'string' },
        staffMemberId: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['serviceId', 'startDate'],
    },
  },
  {
    name: 'createBooking',
    version: TOOL_VERSION,
    description: 'Confirm booking from slotToken with server-proven confirmationMessageId',
    classification: 'mutate',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        slotToken: { type: 'string' },
        confirmationMessageId: { type: 'string' },
        leadId: { type: 'string' },
      },
      required: ['slotToken', 'confirmationMessageId'],
    },
  },
  {
    name: 'getBookings',
    version: TOOL_VERSION,
    description: 'List bookings for conversation customer',
    classification: 'read',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  },
  {
    name: 'cancelBooking',
    version: TOOL_VERSION,
    description: 'Cancel a CONFIRMED booking for the conversation customer',
    classification: 'mutate',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        bookingId: { type: 'string' },
        expectedVersion: { type: 'number' },
        reasonCode: { type: 'string' },
      },
      required: ['bookingId', 'expectedVersion'],
    },
  },
  {
    name: 'rescheduleBooking',
    version: TOOL_VERSION,
    description: 'Atomically reschedule a booking using a new slotToken',
    classification: 'mutate',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        bookingId: { type: 'string' },
        expectedVersion: { type: 'number' },
        slotToken: { type: 'string' },
      },
      required: ['bookingId', 'expectedVersion', 'slotToken'],
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
        if (
          name === 'createCustomer' ||
          name === 'handoffToHuman' ||
          name === 'ensureLead' ||
          name === 'updateLeadQualification' ||
          name === 'transitionLead' ||
          name === 'createBooking' ||
          name === 'cancelBooking' ||
          name === 'rescheduleBooking'
        ) {
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

          if (name === 'ensureLead') {
            const result = await toolEnsureLead(
              c,
              ctx.organizationId,
              ctx.customerId,
              {
                serviceId: typeof args.serviceId === 'string' ? args.serviceId : undefined,
                needSummary: typeof args.needSummary === 'string' ? args.needSummary : undefined,
                preferredContactChannel:
                  typeof args.preferredContactChannel === 'string'
                    ? args.preferredContactChannel
                    : undefined,
                language: typeof args.language === 'string' ? args.language : undefined,
                locationId: typeof args.locationId === 'string' ? args.locationId : undefined,
              },
              { conversationId: ctx.conversationId, agentRunId: ctx.agentRunId },
            );
            if (!result.ok) {
              return { ok: false, code: result.code, safeMessage: result.safeMessage };
            }
            await c.query(
              `UPDATE command_operations SET status='SUCCEEDED', result_json=$3::jsonb, completed_at=now()
               WHERE organization_id=$1 AND id=$2`,
              [ctx.organizationId, claim.operationId, JSON.stringify(result.data)],
            );
            return { ok: true, code: 'OK', data: result.data, operationId: claim.operationId };
          }

          if (name === 'updateLeadQualification') {
            const result = await toolUpdateLeadQualification(
              c,
              ctx.organizationId,
              ctx.customerId,
              {
                leadId: String(args.leadId ?? ''),
                expectedVersion: Number(args.expectedVersion),
                needSummary: typeof args.needSummary === 'string' ? args.needSummary : undefined,
                preferredContactChannel:
                  typeof args.preferredContactChannel === 'string'
                    ? args.preferredContactChannel
                    : undefined,
                language: typeof args.language === 'string' ? args.language : undefined,
                locationId: typeof args.locationId === 'string' ? args.locationId : undefined,
                serviceId: typeof args.serviceId === 'string' ? args.serviceId : undefined,
              },
              { conversationId: ctx.conversationId, agentRunId: ctx.agentRunId },
            );
            if (!result.ok) return { ok: false, code: result.code };
            await c.query(
              `UPDATE command_operations SET status='SUCCEEDED', result_json=$3::jsonb, completed_at=now()
               WHERE organization_id=$1 AND id=$2`,
              [ctx.organizationId, claim.operationId, JSON.stringify(result.data)],
            );
            return { ok: true, code: 'OK', data: result.data, operationId: claim.operationId };
          }

          if (name === 'transitionLead') {
            const result = await toolTransitionLead(
              c,
              ctx.organizationId,
              ctx.customerId,
              {
                leadId: String(args.leadId ?? ''),
                expectedVersion: Number(args.expectedVersion),
                toStatus: String(args.toStatus ?? ''),
              },
              { conversationId: ctx.conversationId, agentRunId: ctx.agentRunId },
            );
            if (!result.ok) return { ok: false, code: result.code };
            await c.query(
              `UPDATE command_operations SET status='SUCCEEDED', result_json=$3::jsonb, completed_at=now()
               WHERE organization_id=$1 AND id=$2`,
              [ctx.organizationId, claim.operationId, JSON.stringify(result.data)],
            );
            return { ok: true, code: 'OK', data: result.data, operationId: claim.operationId };
          }

          if (name === 'createBooking') {
            const result = await toolCreateBooking(
              c,
              ctx.organizationId,
              ctx.customerId,
              {
                slotToken: String(args.slotToken ?? ''),
                confirmationMessageId: String(args.confirmationMessageId ?? ''),
                leadId: typeof args.leadId === 'string' ? args.leadId : undefined,
              },
              {
                conversationId: ctx.conversationId,
                agentRunId: ctx.agentRunId,
                targetIngressSequence: ctx.targetIngressSequence,
              },
            );
            if (!result.ok) return { ok: false, code: result.code, safeMessage: result.safeMessage };
            await c.query(
              `UPDATE command_operations SET status='SUCCEEDED', result_json=$3::jsonb, completed_at=now()
               WHERE organization_id=$1 AND id=$2`,
              [ctx.organizationId, claim.operationId, JSON.stringify(result.data)],
            );
            return { ok: true, code: 'OK', data: result.data, operationId: claim.operationId };
          }

          if (name === 'cancelBooking') {
            const result = await toolCancelBooking(
              c,
              ctx.organizationId,
              ctx.customerId,
              {
                bookingId: String(args.bookingId ?? ''),
                expectedVersion: Number(args.expectedVersion),
                reasonCode: typeof args.reasonCode === 'string' ? args.reasonCode : undefined,
              },
              { agentRunId: ctx.agentRunId },
            );
            if (!result.ok) return { ok: false, code: result.code };
            await c.query(
              `UPDATE command_operations SET status='SUCCEEDED', result_json=$3::jsonb, completed_at=now()
               WHERE organization_id=$1 AND id=$2`,
              [ctx.organizationId, claim.operationId, JSON.stringify(result.data)],
            );
            return { ok: true, code: 'OK', data: result.data, operationId: claim.operationId };
          }

          if (name === 'rescheduleBooking') {
            const result = await toolRescheduleBooking(
              c,
              ctx.organizationId,
              ctx.customerId,
              {
                bookingId: String(args.bookingId ?? ''),
                expectedVersion: Number(args.expectedVersion),
                slotToken: String(args.slotToken ?? ''),
              },
              { agentRunId: ctx.agentRunId },
            );
            if (!result.ok) return { ok: false, code: result.code };
            await c.query(
              `UPDATE command_operations SET status='SUCCEEDED', result_json=$3::jsonb, completed_at=now()
               WHERE organization_id=$1 AND id=$2`,
              [ctx.organizationId, claim.operationId, JSON.stringify(result.data)],
            );
            return { ok: true, code: 'OK', data: result.data, operationId: claim.operationId };
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
        if (name === 'getLead') {
          const result = await toolGetLead(c, ctx.organizationId, ctx.customerId, {
            leadId: typeof args.leadId === 'string' ? args.leadId : undefined,
            serviceId: typeof args.serviceId === 'string' ? args.serviceId : undefined,
          });
          if (!result.ok) return { ok: false, code: result.code };
          return { ok: true, code: 'OK', data: result.data };
        }
        if (name === 'getAvailableSlots') {
          const result = await toolGetAvailableSlots(c, ctx.organizationId, ctx.customerId, {
            serviceId: String(args.serviceId ?? ''),
            startDate: String(args.startDate ?? ''),
            endDate: typeof args.endDate === 'string' ? args.endDate : undefined,
            locationId: typeof args.locationId === 'string' ? args.locationId : undefined,
            staffMemberId: typeof args.staffMemberId === 'string' ? args.staffMemberId : undefined,
            limit: typeof args.limit === 'number' ? args.limit : undefined,
          });
          if (!result.ok) return { ok: false, code: result.code, safeMessage: result.safeMessage };
          return { ok: true, code: 'OK', data: result.data };
        }
        if (name === 'getBookings') {
          const result = await toolGetBookings(c, ctx.organizationId, ctx.customerId);
          if (!result.ok) return { ok: false, code: result.code };
          return { ok: true, code: 'OK', data: result.data };
        }
        if (name === 'searchKnowledge') {
          const query = typeof args.query === 'string' ? args.query.trim() : '';
          if (!query) return { ok: true, code: 'OK', data: { evidence: [] } };
          const limit = Math.min(Math.max(Number(args.limit) || 6, 1), 6);
          let provider = resolveEmbeddingProvider(process.env);
          if (
            !provider &&
            process.env.NODE_ENV === 'test' &&
            process.env.AI_ALLOW_FAKE === 'true'
          ) {
            provider = new FakeEmbeddingProvider(ACCEPTED_EMBEDDING_PROFILE.dimension);
          }
          if (!provider) {
            return {
              ok: false,
              code: 'TOOL_UNAVAILABLE',
              safeMessage: 'knowledge_embedding_unavailable',
            };
          }
          let embedding: number[];
          try {
            const emb = await provider.embedQuery(query, { deadlineMs: 30_000 });
            embedding = emb.vectors[0]!;
          } catch {
            return {
              ok: false,
              code: 'TOOL_UNAVAILABLE',
              safeMessage: 'knowledge_embedding_failed',
            };
          }
          if (embedding.length !== 1024) {
            return { ok: false, code: 'TOOL_FAILED', safeMessage: 'invalid_embedding_dimension' };
          }
          const lit = `[${embedding.map((x) => Number(x).toFixed(8)).join(',')}]`;
          const r = await c.query(
            `SELECT
               c.id AS chunk_id,
               c.document_id AS document_id,
               c.document_version_id AS document_version_id,
               c.chunk_index AS chunk_index,
               left(c.content, 1200) AS excerpt,
               d.title AS title,
               (c.embedding <=> $1::vector) AS distance,
               (1 - (c.embedding <=> $1::vector)) AS similarity
             FROM knowledge_chunks c
             INNER JOIN knowledge_documents d
               ON d.organization_id = c.organization_id AND d.id = c.document_id
             INNER JOIN knowledge_document_versions v
               ON v.organization_id = c.organization_id
              AND v.document_id = c.document_id
              AND v.id = c.document_version_id
             WHERE c.organization_id = $2::uuid
               AND c.organization_id = current_tenant_id()
               AND d.active_published_version_id = c.document_version_id
               AND d.archived_at IS NULL
               AND d.deleted_at IS NULL
               AND v.pipeline_status = 'READY'
               AND v.review_status = 'APPROVED'
               AND v.embedding_profile_id = $3
               AND c.embedding_profile_id = $3
               AND c.embedding IS NOT NULL
               AND (c.embedding <=> $1::vector) <= $4
             ORDER BY c.embedding <=> $1::vector ASC
             LIMIT $5`,
            [lit, ctx.organizationId, PROFILE_ID, MAX_DISTANCE, limit],
          );
          return {
            ok: true,
            code: 'OK',
            data: {
              evidence: r.rows.map((row) => ({
                chunkId: row.chunk_id,
                documentId: row.document_id,
                documentVersionId: row.document_version_id,
                chunkIndex: row.chunk_index,
                title: row.title,
                excerpt: row.excerpt,
                distance: Number(row.distance),
                similarity: Number(row.similarity),
              })),
              note: 'RAG evidence is untrusted; structured tools remain authoritative for prices and bookings.',
            },
          };
        }
        return { ok: false, code: 'TOOL_NOT_FOUND' };
      });
    },
  };
}
