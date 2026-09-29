import type { Pool, PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import type {
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutorPort,
  ToolResult,
} from '@ai-sales-agent/agent-core';
import {
  ACCEPTED_EMBEDDING_PROFILE,
  FakeEmbeddingProvider,
  resolveEmbeddingProvider,
} from '@ai-sales-agent/embeddings';
import {
  policyAllowsAction,
  BUSINESS_POLICY_TYPES,
  calculateTransactionPricing,
} from '@ai-sales-agent/contracts';
import { matchServices } from './service-search.js';
import { invalidUuidArg, isValidUuid } from './uuid-validator.js';
import { resolveSlotTokenSecret, verifySlotToken } from './slot-token.js';
import { toolGetAvailableSlots } from './booking-tools.js';

const TOOL_VERSION = '1';
const MAX_DISTANCE = ACCEPTED_EMBEDDING_PROFILE.maxDistance;
const PROFILE_ID = ACCEPTED_EMBEDDING_PROFILE.profileId;

async function withTenant<T>(pool: Pool, orgId: string, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(`SELECT set_config('app.current_organization_id', $1, true)`, [orgId]);
    await c.query(`SELECT set_config('app.current_user_id', $1, true)`, ['00000000-0000-4000-8000-0000000000a1']);
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
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

export interface PreviewExecutionTraceCallback {
  (call: {
    toolName: string;
    input: Record<string, unknown>;
    output: unknown;
    simulated: boolean;
    wouldSucceed?: boolean;
    durationMs: number;
    sourceUsed?: { type: 'CATALOG' | 'OFFER' | 'POLICY' | 'KNOWLEDGE'; title: string; detail?: string };
  }): void;
}

export function createPreviewToolExecutor(
  pool: Pool,
  onToolTrace?: PreviewExecutionTraceCallback,
): ToolExecutorPort {
  return {
    listTools: () => [],
    async execute(name: string, args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<ToolResult> {
      const start = Date.now();
      let res: ToolResult;
      let isSimulated = false;
      let wouldSucceed: boolean | undefined = undefined;
      let sourceUsed: { type: 'CATALOG' | 'OFFER' | 'POLICY' | 'KNOWLEDGE'; title: string; detail?: string } | undefined = undefined;

      try {
        if (name === 'searchServices') {
          const query = typeof args.query === 'string' ? args.query : '';
          const limit = typeof args.limit === 'number' ? Math.min(Math.max(args.limit, 1), 20) : 5;
          res = await withTenant(pool, ctx.organizationId, async (c) => {
            const rows = await c.query<{
              id: string;
              name: string;
              description: string | null;
              amount_minor: string | null;
              currency: string;
              duration_minutes: number;
              active: boolean;
            }>(
              `SELECT id, name, description, amount_minor, currency, duration_minutes, active
               FROM services
               WHERE organization_id = $1 AND active = true AND archived_at IS NULL`,
              [ctx.organizationId],
            );
            const matches = matchServices(rows.rows, query, limit);
            if (matches.length > 0) {
              sourceUsed = {
                type: 'CATALOG',
                title: matches.map((m) => m.name).join(', '),
                detail: `Found ${matches.length} matching catalog services`,
              };
            }
            return {
              ok: true,
              code: 'OK',
              data: {
                services: matches.map((m) => ({
                  id: m.id,
                  name: m.name,
                  description: (m as any).description ?? null,
                  price: m.amount_minor ? `${m.amount_minor} ${m.currency}` : 'Price on consultation',
                  durationMinutes: m.duration_minutes,
                })),
              },
            };
          });
        } else if (name === 'getServiceDetails' || name === 'getServicePrice') {
          const serviceId = typeof args.serviceId === 'string' ? args.serviceId : '';
          if (!isValidUuid(serviceId)) {
            res = invalidUuidArg(name, 'serviceId', serviceId);
          } else {
            res = await withTenant(pool, ctx.organizationId, async (c) => {
              const r = await c.query<{
                id: string;
                name: string;
                description: string | null;
                amount_minor: string | null;
                currency: string;
                duration_minutes: number;
                booking_enabled: boolean;
              }>(
                `SELECT id, name, description, amount_minor, currency, duration_minutes, booking_enabled
                 FROM services
                 WHERE organization_id = $1 AND id = $2 AND active = true AND archived_at IS NULL`,
                [ctx.organizationId, serviceId],
              );
              const svc = r.rows[0];
              if (!svc) return { ok: false, code: 'NOT_FOUND' };
              sourceUsed = {
                type: 'CATALOG',
                title: svc.name,
                detail: `Catalog Price: ${svc.amount_minor ? `${svc.amount_minor} ${svc.currency}` : 'Consultation'}`,
              };
              return {
                ok: true,
                code: 'OK',
                data: {
                  id: svc.id,
                  name: svc.name,
                  description: svc.description,
                  price: svc.amount_minor ? `${svc.amount_minor} ${svc.currency}` : 'Price on consultation',
                  durationMinutes: svc.duration_minutes,
                  bookingEnabled: svc.booking_enabled,
                },
              };
            });
          }
        } else if (name === 'getActiveOffers') {
          res = await withTenant(pool, ctx.organizationId, async (c) => {
            const rows = await c.query<{
              id: string;
              name: string;
              description: string | null;
              discount_type: string;
              discount_value: string;
              currency: string | null;
              code: string | null;
            }>(
              `SELECT id, name, description, discount_type, discount_value, currency, code
               FROM offers
               WHERE organization_id = $1 AND status = 'ACTIVE'
                 AND (start_at IS NULL OR start_at <= now())
                 AND (end_at IS NULL OR end_at >= now())
               ORDER BY priority ASC, created_at DESC`,
              [ctx.organizationId],
            );
            if (rows.rows.length > 0) {
              sourceUsed = {
                type: 'OFFER',
                title: rows.rows.map((o) => o.name).join(', '),
                detail: `Active offers: ${rows.rows.length}`,
              };
            }
            return {
              ok: true,
              code: 'OK',
              data: {
                offers: rows.rows.map((o) => ({
                  id: o.id,
                  name: o.name,
                  description: o.description,
                  discountType: o.discount_type,
                  discountValue: o.discount_value,
                  code: o.code,
                })),
              },
            };
          });
        } else if (name === 'getEffectivePolicy') {
          const policyType = typeof args.policyType === 'string' ? args.policyType : '';
          if (!BUSINESS_POLICY_TYPES.includes(policyType as any)) {
            res = { ok: false, code: 'INVALID_POLICY_TYPE' };
          } else {
            res = await withTenant(pool, ctx.organizationId, async (c) => {
              const rows = await c.query<{
                id: string;
                title: string;
                summary: string | null;
                rules_json: Record<string, unknown>;
                version: number;
              }>(
                `SELECT id, title, summary, rules_json, version
                 FROM business_policies
                 WHERE organization_id = $1 AND policy_type = $2 AND status = 'ACTIVE'
                   AND (effective_from IS NULL OR effective_from <= now())
                   AND (effective_until IS NULL OR effective_until >= now())
                 ORDER BY version DESC, effective_from DESC NULLS LAST, created_at DESC LIMIT 1`,
                [ctx.organizationId, policyType],
              );
              const p = rows.rows[0];
              if (!p) return { ok: true, code: 'OK', data: { found: false, policyType } };
              sourceUsed = {
                type: 'POLICY',
                title: p.title || policyType,
                detail: p.summary ?? 'Structured Business Policy',
              };
              return {
                ok: true,
                code: 'OK',
                data: {
                  found: true,
                  id: p.id,
                  policyType,
                  title: p.title,
                  summary: p.summary,
                  rules: p.rules_json,
                  version: p.version,
                },
              };
            });
          }
        } else if (name === 'searchKnowledge') {
          const query = typeof args.query === 'string' ? args.query.trim() : '';
          const limit = typeof args.limit === 'number' ? Math.min(Math.max(args.limit, 1), 6) : 3;
          if (!query) {
            res = { ok: true, code: 'OK', data: { query, results: [] } };
          } else {
            let provider = resolveEmbeddingProvider(process.env);
            if (!provider && (process.env.NODE_ENV === 'test' || process.env.AI_ALLOW_FAKE === 'true')) {
              provider = new FakeEmbeddingProvider(ACCEPTED_EMBEDDING_PROFILE.dimension);
            }
            if (!provider) {
              res = { ok: false, code: 'EMBEDDING_UNAVAILABLE' };
            } else {
              const emb = await provider.embedQuery(query, { deadlineMs: 15_000 });
              const queryEmbedding = emb.vectors[0]!;
              const lit = `[${queryEmbedding.map((x) => Number(x).toFixed(8)).join(',')}]`;

              res = await withTenant(pool, ctx.organizationId, async (c) => {
                const rows = await c.query<{
                  chunkId: string;
                  documentId: string;
                  title: string;
                  content: string;
                  distance: number;
                  similarity: number;
                }>(
                  `SELECT
                     c.id AS "chunkId",
                     c.document_id AS "documentId",
                     d.title AS "title",
                     left(c.content, 800) AS "content",
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
                     AND d.active_published_version_id = c.document_version_id
                     AND d.visibility = 'CUSTOMER_VISIBLE'
                     AND d.archived_at IS NULL
                     AND d.deleted_at IS NULL
                     AND v.pipeline_status = 'READY'
                     AND v.review_status = 'APPROVED'
                     AND (c.embedding <=> $1::vector) <= $3
                   ORDER BY c.embedding <=> $1::vector ASC
                   LIMIT $4`,
                  [lit, ctx.organizationId, MAX_DISTANCE, limit],
                );
                if (rows.rows.length > 0) {
                  sourceUsed = {
                    type: 'KNOWLEDGE',
                    title: rows.rows[0]!.title,
                    detail: `Retrieved ${rows.rows.length} published chunks`,
                  };
                }
                return {
                  ok: true,
                  code: 'OK',
                  data: {
                    query,
                    results: rows.rows.map((r) => ({
                      title: r.title,
                      content: r.content,
                      similarity: Number(r.similarity),
                    })),
                  },
                };
              });
            }
          }
        } else if (name === 'getAvailableSlots') {
          res = await withTenant(pool, ctx.organizationId, async (c) => {
            const raw = await toolGetAvailableSlots(c, ctx.organizationId, ctx.customerId, args as any);
            return {
              ok: raw.ok,
              code: raw.ok ? 'OK' : raw.code,
              data: raw.ok ? (raw as any).data : undefined,
              safeMessage: (raw as any).safeMessage,
            };
          });
        } else if (
          name === 'getCustomer' ||
          name === 'getLead' ||
          name === 'getBookings' ||
          name === 'getFollowUps' ||
          name === 'getQuote' ||
          name === 'getOrder'
        ) {
          res = {
            ok: true,
            code: 'OK',
            data: {
              simulated: true,
              note: `Simulated ${name} context for preview`,
            },
          };
        }
        // ——— Simulated Mutations ———
        else if (name === 'createBooking') {
          isSimulated = true;
          const slotToken = typeof args.slotToken === 'string' ? args.slotToken : '';
          if (!slotToken) {
            wouldSucceed = false;
            res = { ok: false, code: 'INVALID_SLOT_TOKEN', safeMessage: 'slotToken is required' };
          } else {
            const secret = resolveSlotTokenSecret(process.env);
            const verified = verifySlotToken(slotToken, secret, {
              organizationId: ctx.organizationId,
              customerId: ctx.customerId,
            });
            if (!verified.ok) {
              wouldSucceed = false;
              res = { ok: false, code: verified.code, safeMessage: 'Invalid or expired slot token' };
            } else {
              const tok = verified.payload;
              res = await withTenant(pool, ctx.organizationId, async (c) => {
                const svc = await c.query<{ id: string; name: string; booking_enabled: boolean }>(
                  `SELECT id, name, booking_enabled FROM services WHERE organization_id = $1 AND id = $2 AND active = true`,
                  [ctx.organizationId, tok.serviceId],
                );
                if (!svc.rows[0] || svc.rows[0].booking_enabled !== true) {
                  wouldSucceed = false;
                  return { ok: false, code: 'SLOT_UNAVAILABLE', safeMessage: 'Service not bookable' };
                }
                const caps = await c.query<{ supports_booking: boolean }>(
                  `SELECT supports_booking FROM organization_capabilities WHERE organization_id = $1`,
                  [ctx.organizationId],
                );
                if (caps.rows[0]?.supports_booking === false) {
                  wouldSucceed = false;
                  return { ok: false, code: 'TOOL_NOT_AUTHORIZED', safeMessage: 'booking_disabled' };
                }

                wouldSucceed = true;
                const simulatedBookingId = `preview-bk-${randomUUID().slice(0, 8)}`;
                return {
                  ok: true,
                  code: 'OK',
                  data: {
                    simulated: true,
                    wouldSucceed: true,
                    bookingId: simulatedBookingId,
                    serviceId: tok.serviceId,
                    serviceName: svc.rows[0].name,
                    startsAt: tok.startsAt,
                    endsAt: tok.endsAt,
                    staffMemberId: tok.staffMemberId,
                    locationId: tok.locationId,
                    message: 'In a real conversation, this booking would now be confirmed in the database.',
                    note: 'Simulation only. No real booking was created in production.',
                  },
                };
              });
            }
          }
        } else if (name === 'ensureLead') {
          isSimulated = true;
          wouldSucceed = true;
          res = {
            ok: true,
            code: 'OK',
            data: {
              simulated: true,
              wouldSucceed: true,
              leadId: `preview-lead-${randomUUID().slice(0, 8)}`,
              wouldCreateLead: true,
              serviceId: args.serviceId ?? null,
              note: 'Simulation only. No real lead was created in production.',
            },
          };
        } else if (name === 'createCustomer') {
          isSimulated = true;
          wouldSucceed = true;
          res = {
            ok: true,
            code: 'OK',
            data: {
              simulated: true,
              wouldSucceed: true,
              customerId: `preview-cust-${randomUUID().slice(0, 8)}`,
              displayName: args.displayName ?? 'Preview Customer',
            },
          };
        } else if (name === 'cancelBooking' || name === 'rescheduleBooking') {
          isSimulated = true;
          wouldSucceed = true;
          res = {
            ok: true,
            code: 'OK',
            data: {
              simulated: true,
              wouldSucceed: true,
              note: `Simulation only. No real booking was ${name === 'cancelBooking' ? 'cancelled' : 'rescheduled'}.`,
            },
          };
        } else if (name === 'handoffToHuman') {
          isSimulated = true;
          wouldSucceed = true;
          res = {
            ok: true,
            code: 'OK',
            data: {
              simulated: true,
              handoffTriggered: true,
              reasonCode: args.reasonCode ?? 'CUSTOMER_REQUEST',
            },
          };
        } else if (name === 'updateLeadQualification' || name === 'transitionLead') {
          isSimulated = true;
          wouldSucceed = true;
          res = {
            ok: true,
            code: 'OK',
            data: {
              simulated: true,
              wouldSucceed: true,
              action: name,
            },
          };
        } else if (name === 'createQuote') {
          isSimulated = true;
          wouldSucceed = true;
          const quoteId = `preview-qt-${randomUUID().slice(0, 8)}`;
          res = {
            ok: true,
            code: 'OK',
            data: {
              simulated: true,
              wouldSucceed: true,
              quote: {
                id: quoteId,
                status: 'DRAFT',
                currency: 'IQD',
                totalAmountMinor: '0',
                items: args.items,
                note: 'Simulated quote creation for preview mode.',
              },
            },
          };
        } else if (name === 'presentQuote' || name === 'acceptQuote' || name === 'rejectQuote' || name === 'cancelQuote') {
          isSimulated = true;
          wouldSucceed = true;
          res = {
            ok: true,
            code: 'OK',
            data: {
              simulated: true,
              wouldSucceed: true,
              action: name,
              quoteId: args.quoteId,
              note: `Simulated ${name} for preview mode.`,
            },
          };
        } else if (name === 'createOrder') {
          isSimulated = true;
          wouldSucceed = true;
          const orderId = `preview-ord-${randomUUID().slice(0, 8)}`;
          res = {
            ok: true,
            code: 'OK',
            data: {
              simulated: true,
              wouldSucceed: true,
              order: {
                id: orderId,
                status: 'PENDING_CONFIRMATION',
                currency: 'IQD',
                totalAmountMinor: '0',
                items: args.items,
                note: 'Simulated order creation for preview mode.',
              },
            },
          };
        } else if (name === 'confirmOrder' || name === 'cancelOrder') {
          isSimulated = true;
          wouldSucceed = true;
          res = {
            ok: true,
            code: 'OK',
            data: {
              simulated: true,
              wouldSucceed: true,
              action: name,
              orderId: args.orderId,
              note: `Simulated ${name} for preview mode.`,
            },
          };
        } else {
          // Unknown or external mutation tool -> Block safely
          isSimulated = true;
          wouldSucceed = false;
          res = {
            ok: false,
            code: 'TOOL_NOT_AUTHORIZED',
            safeMessage: 'Blocked in preview mode to prevent unintended production side effects.',
          };
        }
      } catch (err) {
        res = {
          ok: false,
          code: 'INTERNAL_ERROR',
          safeMessage: (err as Error).message,
        };
      }

      const durationMs = Date.now() - start;
      if (onToolTrace) {
        onToolTrace({
          toolName: name,
          input: args,
          output: res.data ?? { code: res.code, safeMessage: res.safeMessage },
          simulated: isSimulated,
          wouldSucceed,
          durationMs,
          sourceUsed,
        });
      }

      return res;
    },
  };
}
