import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { RunStorePort } from '@ai-sales-agent/agent-core';
import { shouldBlockNewAgentRuns } from './ai-emergency-kill.js';

async function withTenant<T>(
  pool: Pool,
  organizationId: string,
  userId: string,
  fn: (c: PoolClient) => Promise<T>,
): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
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

/** System actor UUID for worker agent runs (deterministic). */
export const AGENT_SYSTEM_USER_ID = '00000000-0000-4000-8000-0000000000a1';

export function createPgRunStore(pool: Pool, systemUserId = AGENT_SYSTEM_USER_ID): RunStorePort {
  return {
    async createOrResumeRun(input) {
      return withTenant(pool, input.organizationId, systemUserId, async (c) => {
        const orgKill = await c.query<{ ai_emergency_disabled_at: Date | null }>(
          `SELECT ai_emergency_disabled_at FROM organizations WHERE id=$1`,
          [input.organizationId],
        );
        const kill = shouldBlockNewAgentRuns({
          env: process.env,
          org: orgKill.rows[0] ?? null,
        });
        if (kill.blocked) {
          throw new Error(`ai_emergency_kill:${kill.reason ?? 'ORG'}`);
        }

        const existing = await c.query<{ id: string; status: string }>(
          `SELECT id, status FROM agent_runs WHERE organization_id=$1 AND run_key=$2`,
          [input.organizationId, input.runKey],
        );
        if (existing.rows[0]) {
          return {
            agentRunId: existing.rows[0].id,
            status: existing.rows[0].status,
            resumed: true,
          };
        }
        const id = randomUUID();
        await c.query(
          `INSERT INTO agent_runs(
             id, organization_id, conversation_id, run_key, target_ingress_sequence,
             ownership_epoch, lease_fence, agent_config_id, prompt_version, model_profile, status
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'RUNNING')`,
          [
            id,
            input.organizationId,
            input.conversationId,
            input.runKey,
            input.targetIngressSequence,
            input.ownershipEpoch,
            input.leaseFence,
            input.agentConfigVersionId,
            input.promptVersion,
            input.modelProfile,
          ],
        );
        return { agentRunId: id, status: 'RUNNING', resumed: false };
      });
    },

    async loadAuthority(organizationId, conversationId) {
      return withTenant(pool, organizationId, systemUserId, async (c) => {
        const r = await c.query<{
          mode: string;
          ownership_epoch: number;
          lease_owner: string | null;
          lease_fence: number;
          next_sequence: number;
          processed_sequence: number;
        }>(
          `SELECT mode, ownership_epoch, lease_owner, lease_fence, next_sequence, processed_sequence
           FROM conversations WHERE organization_id=$1 AND id=$2`,
          [organizationId, conversationId],
        );
        const row = r.rows[0];
        if (!row) throw new Error('conversation_not_found');
        return {
          mode: row.mode,
          ownershipEpoch: row.ownership_epoch,
          leaseOwner: row.lease_owner,
          leaseFence: row.lease_fence,
          nextIngressSequence: row.next_sequence,
          processedSequence: row.processed_sequence,
        };
      });
    },

    async hasNewerInbound(organizationId, conversationId, targetIngressSequence) {
      return withTenant(pool, organizationId, systemUserId, async (c) => {
        // Authoritative P03 ingress high-water only (not timeline).
        const r = await c.query<{ next_sequence: number }>(
          `SELECT next_sequence FROM conversations WHERE organization_id=$1 AND id=$2`,
          [organizationId, conversationId],
        );
        const next = r.rows[0]?.next_sequence ?? 1;
        return next - 1 > targetIngressSequence;
      });
    },

    async recordToolCall(input) {
      await withTenant(pool, input.organizationId, systemUserId, async (c) => {
        await c.query(
          `INSERT INTO tool_calls(
             organization_id, agent_run_id, ordinal, tool_name, tool_version,
             args_hash, authz_result, operation_id, result_code, duration_ms
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            input.organizationId,
            input.agentRunId,
            input.ordinal,
            input.toolName,
            input.toolVersion,
            input.argsHash,
            input.authzResult,
            input.operationId,
            input.resultCode,
            input.durationMs,
          ],
        );
      });
    },

    async claimCommand(input) {
      return withTenant(pool, input.organizationId, systemUserId, async (c) => {
        const existing = await c.query<{ id: string; status: string; result_json: unknown }>(
          `SELECT id, status, result_json FROM command_operations
           WHERE organization_id=$1 AND operation_key=$2`,
          [input.organizationId, input.operationKey],
        );
        if (existing.rows[0]?.status === 'SUCCEEDED') {
          return {
            alreadySucceeded: true,
            resultJson: existing.rows[0].result_json,
            operationId: existing.rows[0].id,
          };
        }
        if (existing.rows[0]) {
          return {
            alreadySucceeded: false,
            resultJson: null,
            operationId: existing.rows[0].id,
          };
        }
        const id = randomUUID();
        await c.query(
          `INSERT INTO command_operations(id, organization_id, operation_key, agent_run_id, status)
           VALUES ($1,$2,$3,$4,'IN_PROGRESS')`,
          [id, input.organizationId, input.operationKey, input.agentRunId],
        );
        return { alreadySucceeded: false, resultJson: null, operationId: id };
      });
    },

    async completeCommand(input) {
      await withTenant(pool, input.organizationId, systemUserId, async (c) => {
        await c.query(
          `UPDATE command_operations
           SET status='SUCCEEDED', result_json=$3::jsonb, completed_at=now()
           WHERE organization_id=$1 AND id=$2`,
          [input.organizationId, input.operationId, JSON.stringify(input.resultJson)],
        );
      });
    },

    async finalizeSuccess(input) {
      return withTenant(pool, input.organizationId, systemUserId, async (c) => {
        const existing = await c.query<{ final_outbound_message_id: string | null; status: string }>(
          `SELECT final_outbound_message_id, status FROM agent_runs
           WHERE organization_id=$1 AND id=$2 FOR UPDATE`,
          [input.organizationId, input.agentRunId],
        );
        if (existing.rows[0]?.status === 'SUCCEEDED' && existing.rows[0].final_outbound_message_id) {
          return { outboundMessageId: existing.rows[0].final_outbound_message_id };
        }

        const auth = await c.query<{
          mode: string;
          ownership_epoch: number;
          lease_owner: string | null;
          lease_fence: number;
          next_sequence: number;
          next_timeline_sequence: number;
          channel_connection_id: string;
        }>(
          `SELECT mode, ownership_epoch, lease_owner, lease_fence, next_sequence,
                  next_timeline_sequence, channel_connection_id
           FROM conversations WHERE organization_id=$1 AND id=$2 FOR UPDATE`,
          [input.organizationId, input.conversationId],
        );
        const row = auth.rows[0];
        if (!row) throw new Error('conversation_not_found');
        if (row.mode !== 'AI_ACTIVE') throw new Error('mode_not_ai_active');
        if (row.ownership_epoch !== input.ownershipEpoch) throw new Error('epoch_mismatch');
        if (row.lease_owner !== input.leaseOwner || row.lease_fence !== input.leaseFence) {
          throw new Error('fence_mismatch');
        }
        if (row.next_sequence - 1 > input.targetIngressSequence) {
          throw new Error('newer_inbound');
        }

        const messageId = randomUUID();
        const timeline = row.next_timeline_sequence;
        const digest = createHash('sha256').update(input.outboundText).digest('hex');
        await c.query(
          `INSERT INTO messages(
             id, organization_id, conversation_id, channel_connection_id, direction, origin,
             ingress_sequence, timeline_sequence, content_text, content_digest, delivery_state,
             authority_epoch
           ) VALUES ($1,$2,$3,$4,'OUTBOUND','AI',NULL,$5,$6,$7,'PENDING',$8)`,
          [
            messageId,
            input.organizationId,
            input.conversationId,
            row.channel_connection_id,
            timeline,
            input.outboundText,
            digest,
            row.ownership_epoch,
          ],
        );
        await c.query(
          `UPDATE conversations SET
             next_timeline_sequence = next_timeline_sequence + 1,
             processed_sequence = GREATEST(processed_sequence, $3),
             last_message_at = now(),
             updated_at = now()
           WHERE organization_id=$1 AND id=$2
             AND lease_owner=$4 AND lease_fence=$5 AND ownership_epoch=$6`,
          [
            input.organizationId,
            input.conversationId,
            input.targetIngressSequence,
            input.leaseOwner,
            input.leaseFence,
            input.ownershipEpoch,
          ],
        );
        const eventId = randomUUID();
        await c.query(
          `INSERT INTO outbox_events(id, organization_id, event_type, payload_json)
           VALUES ($1,$2,'OutboundMessageReady',$3::jsonb)`,
          [
            eventId,
            input.organizationId,
            JSON.stringify({
              eventId,
              eventType: 'OutboundMessageReady',
              organizationId: input.organizationId,
              aggregateType: 'Message',
              aggregateId: messageId,
              payload: {
                conversationId: input.conversationId,
                messageId,
                agentRunId: input.agentRunId,
              },
            }),
          ],
        );
        await c.query(
          `UPDATE agent_runs SET
             status='SUCCEEDED', terminal_reason='final_response', finished_at=now(),
             final_outbound_message_id=$3, model_calls=$4, tool_calls=$5
           WHERE organization_id=$1 AND id=$2`,
          [
            input.organizationId,
            input.agentRunId,
            messageId,
            input.modelCalls,
            input.toolCalls,
          ],
        );
        await c.query(
          `INSERT INTO audit_logs(organization_id, actor_user_id, action, target_type, target_id, metadata_json)
           VALUES ($1,NULL,'agent.run_succeeded','AgentRun',$2,$3::jsonb)`,
          [input.organizationId, input.agentRunId, JSON.stringify({ runKey: input.runKey, messageId })],
        );
        return { outboundMessageId: messageId };
      });
    },

    async finalizeHandoff(input) {
      return withTenant(pool, input.organizationId, systemUserId, async (c) => {
        const conv = await c.query<{
          mode: string;
          ownership_epoch: number;
          lease_owner: string | null;
          lease_fence: number;
          channel_connection_id: string;
          next_timeline_sequence: number;
        }>(
          `SELECT mode, ownership_epoch, lease_owner, lease_fence, channel_connection_id, next_timeline_sequence
           FROM conversations WHERE organization_id=$1 AND id=$2 FOR UPDATE`,
          [input.organizationId, input.conversationId],
        );
        const row = conv.rows[0];
        if (!row) throw new Error('conversation_not_found');
        if (row.mode !== 'AI_ACTIVE') throw new Error('mode_not_ai_active');
        if (row.ownership_epoch !== input.ownershipEpoch) throw new Error('epoch_mismatch');
        if (row.lease_owner !== input.leaseOwner || row.lease_fence !== input.leaseFence) {
          throw new Error('fence_mismatch');
        }
        const newEpoch = row.ownership_epoch + 1;
        const pauseCode =
          input.reasonCode &&
          [
            'CUSTOMER_REQUESTED_HUMAN',
            'AI_UNCERTAIN',
            'POLICY_REQUIRES_HUMAN',
            'BOOKING_EXCEPTION',
            'OPERATOR_MANUAL_TAKEOVER',
            'OTHER',
          ].includes(input.reasonCode)
            ? input.reasonCode
            : 'AI_UNCERTAIN';
        await c.query(
          `UPDATE conversations SET
             mode='AI_PAUSED', ownership_epoch=$3, processed_sequence=GREATEST(processed_sequence,$4),
             paused_at=COALESCE(paused_at, now()),
             pause_reason_code=$8,
             pause_reason_text=NULL,
             resumed_at=NULL,
             updated_at=now()
           WHERE organization_id=$1 AND id=$2
             AND lease_owner=$5 AND lease_fence=$6 AND ownership_epoch=$7`,
          [
            input.organizationId,
            input.conversationId,
            newEpoch,
            input.targetIngressSequence,
            input.leaseOwner,
            input.leaseFence,
            input.ownershipEpoch,
            pauseCode,
          ],
        );
        const ackId = randomUUID();
        const ackText = 'سيتم تحويلك إلى موظف قريبًا. / You will be connected to a team member shortly.';
        const digest = createHash('sha256').update(ackText).digest('hex');
        await c.query(
          `INSERT INTO messages(
             id, organization_id, conversation_id, channel_connection_id, direction, origin,
             ingress_sequence, timeline_sequence, content_text, content_digest, delivery_state,
             authority_epoch
           ) VALUES ($1,$2,$3,$4,'OUTBOUND','SYSTEM',NULL,$5,$6,$7,'PENDING',$8)`,
          [
            ackId,
            input.organizationId,
            input.conversationId,
            row.channel_connection_id,
            row.next_timeline_sequence,
            ackText,
            digest,
            newEpoch,
          ],
        );
        await c.query(
          `UPDATE conversations SET next_timeline_sequence = next_timeline_sequence + 1, last_message_at=now()
           WHERE organization_id=$1 AND id=$2`,
          [input.organizationId, input.conversationId],
        );
        const outboundEventId = randomUUID();
        await c.query(
          `INSERT INTO outbox_events(id, organization_id, event_type, payload_json)
           VALUES ($1,$2,'OutboundMessageReady',$3::jsonb)`,
          [
            outboundEventId,
            input.organizationId,
            JSON.stringify({
              eventId: outboundEventId,
              eventType: 'OutboundMessageReady',
              organizationId: input.organizationId,
              aggregateType: 'Message',
              aggregateId: ackId,
              payload: {
                conversationId: input.conversationId,
                messageId: ackId,
                agentRunId: input.agentRunId,
              },
            }),
          ],
        );
        const eventId = randomUUID();
        await c.query(
          `INSERT INTO outbox_events(id, organization_id, event_type, payload_json)
           VALUES ($1,$2,'HandoffRequested',$3::jsonb)`,
          [
            eventId,
            input.organizationId,
            JSON.stringify({
              eventType: 'HandoffRequested',
              organizationId: input.organizationId,
              aggregateId: input.conversationId,
              payload: {
                conversationId: input.conversationId,
                reasonCode: input.reasonCode,
                newEpoch,
              },
            }),
          ],
        );
        await c.query(
          `UPDATE command_operations SET status='SUCCEEDED', result_json=$3::jsonb, completed_at=now()
           WHERE organization_id=$1 AND id=$2`,
          [input.organizationId, input.operationId, JSON.stringify({ newEpoch, ackMessageId: ackId })],
        );
        await c.query(
          `UPDATE agent_runs SET status='HANDOFF_REQUESTED', terminal_reason=$3, finished_at=now()
           WHERE organization_id=$1 AND id=$2`,
          [input.organizationId, input.agentRunId, input.reasonCode],
        );
        await c.query(
          `INSERT INTO audit_logs(organization_id, actor_user_id, action, target_type, target_id, metadata_json)
           VALUES ($1,NULL,'agent.handoff','Conversation',$2,$3::jsonb)`,
          [
            input.organizationId,
            input.conversationId,
            JSON.stringify({ newEpoch, reasonCode: input.reasonCode }),
          ],
        );
        return { newEpoch };
      });
    },

    async finalizeTerminal(input) {
      await withTenant(pool, input.organizationId, systemUserId, async (c) => {
        await c.query(
          `UPDATE agent_runs SET status=$3, terminal_reason=$4, finished_at=now()
           WHERE organization_id=$1 AND id=$2 AND status='RUNNING'`,
          [input.organizationId, input.agentRunId, input.status, input.reason],
        );
        if (input.advanceCursor) {
          await c.query(
            `UPDATE conversations SET processed_sequence=GREATEST(processed_sequence,$3), updated_at=now()
             WHERE organization_id=$1 AND id=$2
               AND lease_owner=$4 AND lease_fence=$5 AND ownership_epoch=$6`,
            [
              input.organizationId,
              input.conversationId,
              input.targetIngressSequence,
              input.leaseOwner,
              input.leaseFence,
              input.ownershipEpoch,
            ],
          );
        }
      });
    },

    async recordUsage(input) {
      await withTenant(pool, input.organizationId, systemUserId, async (c) => {
        await c.query(
          `INSERT INTO usage_events(
             organization_id, agent_run_id, provider, model, input_tokens, output_tokens, estimated, latency_ms
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            input.organizationId,
            input.agentRunId,
            input.provider,
            input.model,
            input.inputTokens,
            input.outputTokens,
            input.estimated,
            input.latencyMs,
          ],
        );
      });
    },
  };
}
