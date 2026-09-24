import { loadLocalEnv, loadServerEnv } from '@ai-sales-agent/config';
import {
  dispatchOutboundMessage,
  executeFollowUp,
  runConversationAgent,
  shouldBlockNewAgentRuns,
} from '@ai-sales-agent/agent-adapters';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import pg from 'pg';
import { handleKnowledgeOutboxEvent } from './knowledge-jobs.js';

const CONVERSATION_QUEUE = 'conversation-wake';
const CONSUMER_NAME = 'conversation-drain';
const KNOWLEDGE_CONSUMER = 'knowledge-ingest';
const OUTBOUND_CONSUMER = 'outbound-dispatch';
const FOLLOWUP_CONSUMER = 'followup-execute';

type ClaimRow = {
  organization_id: string;
  work_kind: string;
  work_id: string;
  available_at: Date;
};

/**
 * Phase 03 worker: outbox relay + durable sweeper + fenced conversation drain.
 * Cross-tenant discovery uses narrow SECURITY DEFINER claim functions only.
 * Domain mutations run under transaction-local tenant context as app_runtime.
 */
async function main() {
  loadLocalEnv();
  const env = loadServerEnv(process.env);
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: 4,
    ssl: /supabase\.co|supabase\.com/i.test(env.DATABASE_URL)
      ? { rejectUnauthorized: false }
      : undefined,
  });

  // BullMQ and ioredis ship overlapping Redis typings under npm workspaces; runtime is fine.
  const queue = new Queue(CONVERSATION_QUEUE, { connection: connection as never });

  async function claimOutbox(batch = 25): Promise<ClaimRow[]> {
    const { rows } = await pool.query<ClaimRow>(
      `SELECT organization_id, work_kind, work_id, available_at FROM claim_pending_outbox_events($1)`,
      [batch],
    );
    return rows;
  }

  async function markPublished(eventId: string) {
    await pool.query(`SELECT mark_outbox_event_published($1::uuid)`, [eventId]);
  }

  async function relayOnce() {
    const claimed = await claimOutbox(25);
    for (const row of claimed) {
      try {
        await queue.add(
          'wake',
          {
            organizationId: row.organization_id,
            eventId: row.work_id,
            workKind: row.work_kind,
          },
          {
            jobId: row.work_id,
            removeOnComplete: 100,
            removeOnFail: 100,
          },
        );
        await markPublished(row.work_id);
      } catch (err) {
        console.error(
          JSON.stringify({
            msg: 'outbox_relay_failed',
            eventId: row.work_id,
            error: String(err),
          }),
        );
        // Leave event eligible via claimed_until expiry for retry.
      }
    }
    return claimed.length;
  }

  async function sweepDueConversations() {
    const { rows } = await pool.query<ClaimRow>(
      `SELECT organization_id, work_kind, work_id, available_at FROM list_due_conversation_wakeups($1)`,
      [25],
    );
    for (const row of rows) {
      await queue.add(
        'drain',
        { organizationId: row.organization_id, conversationId: row.work_id },
        {
          jobId: `drain:${row.work_id}:${Date.now()}`,
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      );
    }
    await pool.query(`SELECT * FROM reclaim_expired_conversation_leases($1)`, [25]);
    return rows.length;
  }

  /**
   * P04: acquire lease; AI_ACTIVE + ingress backlog → agent orchestrator.
   * Non-AI modes hold processed_sequence (do not auto-advance).
   * Cursor advances only inside agent finalize (success/handoff).
   */
  async function drainConversation(organizationId: string, conversationId: string, workerId: string) {
    const client = await pool.connect();
    let leaseFence = 0;
    let ownershipEpoch = 0;
    let processedSequence = 0;
    let nextSequence = 1;
    let mode = '';
    let aiEligibleAfter = 0;
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.current_organization_id', $1, true)`, [
        organizationId,
      ]);
      await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [workerId]);

      const lease = await client.query<{
        lease_fence: number;
        ownership_epoch: number;
        processed_sequence: number;
        next_sequence: number;
        mode: string;
        ai_eligible_after_sequence: number;
      }>(
        `UPDATE conversations
         SET lease_owner = $3,
             lease_fence = lease_fence + 1,
             lease_expires_at = now() + interval '60 seconds',
             updated_at = now(),
             version = version + 1
         WHERE organization_id = $1::uuid
           AND id = $2::uuid
           AND (lease_expires_at IS NULL OR lease_expires_at <= now() OR lease_owner = $3)
         RETURNING lease_fence, ownership_epoch, processed_sequence, next_sequence, mode,
                   ai_eligible_after_sequence`,
        [organizationId, conversationId, workerId],
      );
      if (!lease.rows[0]) {
        await client.query('ROLLBACK');
        return { skipped: true };
      }
      leaseFence = lease.rows[0].lease_fence;
      ownershipEpoch = lease.rows[0].ownership_epoch;
      processedSequence = lease.rows[0].processed_sequence;
      nextSequence = lease.rows[0].next_sequence;
      mode = lease.rows[0].mode;
      aiEligibleAfter = Number(lease.rows[0].ai_eligible_after_sequence ?? 0);

      if (processedSequence + 1 >= nextSequence) {
        await client.query('COMMIT');
        return { drained: 0 };
      }

      // MODE/CURSOR: non-AI modes must not auto-advance processed_sequence.
      // HUMAN_ACTIVE is legacy and treated as non-AI.
      if (mode !== 'AI_ACTIVE') {
        await client.query('COMMIT');
        return {
          held: true,
          mode,
          pendingIngress: nextSequence - 1 - processedSequence,
          leaseFence,
          ownershipEpoch,
        };
      }

      const targetIngressSequence = nextSequence - 1;
      // P09: paused-period backlog below eligibility cursor must not start AgentRuns.
      if (targetIngressSequence <= aiEligibleAfter) {
        await client.query('COMMIT');
        return {
          drained: 0,
          heldForEligibility: true,
          aiEligibleAfterSequence: aiEligibleAfter,
          targetIngressSequence,
          leaseFence,
          ownershipEpoch,
        };
      }

      await client.query('COMMIT');
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

    const targetIngressSequence = nextSequence - 1;
    if (mode !== 'AI_ACTIVE' || targetIngressSequence <= aiEligibleAfter) {
      // Early returns already handled above; defensive guard.
      return { drained: 0 };
    }

    // P13: org/global emergency AI kill — inbound already durable; do not start AgentRuns.
    const orgKill = await pool.query<{ ai_emergency_disabled_at: Date | null }>(
      `SELECT ai_emergency_disabled_at FROM organizations WHERE id = $1::uuid`,
      [organizationId],
    );
    const kill = shouldBlockNewAgentRuns({
      env: process.env,
      org: orgKill.rows[0] ?? null,
    });
    if (kill.blocked) {
      console.log(
        JSON.stringify({
          msg: 'ai_emergency_kill_block_agent_run',
          organizationId,
          conversationId,
          reason: kill.reason,
        }),
      );
      return {
        drained: 0,
        heldForAiEmergencyKill: true,
        killReason: kill.reason,
        leaseFence,
        ownershipEpoch,
        targetIngressSequence,
      };
    }

    const result = await runConversationAgent({
      pool,
      organizationId,
      conversationId,
      workerId,
      leaseFence,
      ownershipEpoch,
      targetIngressSequence,
    });
    return {
      drained: result.terminal === 'SUCCEEDED' || result.terminal === 'HANDOFF_REQUESTED' ? 1 : 0,
      terminal: result.terminal,
      reason: result.reason,
      leaseFence,
      ownershipEpoch,
      targetIngressSequence,
    };
  }

  const workerId = `worker-${process.pid}`;

  const worker = new Worker(
    CONVERSATION_QUEUE,
    async (job) => {
      const organizationId = job.data?.organizationId as string | undefined;
      if (!organizationId) throw new Error('Tenant-owned job missing organizationId');

      if (job.name === 'wake' && job.data?.eventId) {
        const eventId = String(job.data.eventId);
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(`SELECT set_config('app.current_organization_id', $1, true)`, [
            organizationId,
          ]);
          await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [workerId]);

          const existing = await client.query(
            `SELECT 1 FROM consumer_receipts
             WHERE event_id = $1::uuid
               AND consumer_name IN ($2, $3, $4, $5)`,
            [eventId, CONSUMER_NAME, KNOWLEDGE_CONSUMER, OUTBOUND_CONSUMER, FOLLOWUP_CONSUMER],
          );
          if (existing.rowCount) {
            await client.query('COMMIT');
            return { duplicate: true };
          }

          const payload = await client.query<{
            event_type: string;
            payload_json: Record<string, unknown>;
          }>(
            `SELECT event_type, payload_json FROM outbox_events
             WHERE organization_id = $1::uuid AND id = $2::uuid`,
            [organizationId, eventId],
          );
          const row = payload.rows[0];
          const eventType = row?.event_type ?? '';
          const payloadJson = (row?.payload_json ?? {}) as Record<string, unknown>;
          const nested = payloadJson.payload as
            | {
                conversationId?: string;
                messageId?: string;
                followUpId?: string;
                followUpVersion?: number;
              }
            | undefined;
          const conversationId =
            nested?.conversationId ??
            (payloadJson as { conversationId?: string }).conversationId ??
            (payloadJson as { aggregateId?: string }).aggregateId;
          const outboundMessageId =
            nested?.messageId ?? (payloadJson as { messageId?: string }).messageId;
          const followUpId =
            nested?.followUpId ??
            (eventType === 'FollowUpDue'
              ? (payloadJson as { aggregateId?: string }).aggregateId
              : undefined);
          const followUpVersion = nested?.followUpVersion;

          if (eventType.startsWith('knowledge.')) {
            await client.query('COMMIT');
            const handled = await handleKnowledgeOutboxEvent({
              pool,
              organizationId,
              eventType,
              payload: payloadJson,
              workerUserId: workerId,
            });
            const c2 = await pool.connect();
            try {
              await c2.query('BEGIN');
              await c2.query(`SELECT set_config('app.current_organization_id', $1, true)`, [
                organizationId,
              ]);
              await c2.query(`SELECT set_config('app.current_user_id', $1, true)`, [workerId]);
              await c2.query(
                `INSERT INTO consumer_receipts (organization_id, consumer_name, event_id)
                 VALUES ($1::uuid, $2, $3::uuid)
                 ON CONFLICT (consumer_name, event_id) DO NOTHING`,
                [organizationId, KNOWLEDGE_CONSUMER, eventId],
              );
              await c2.query('COMMIT');
            } catch (e) {
              try {
                await c2.query('ROLLBACK');
              } catch {
                /* ignore */
              }
              throw e;
            } finally {
              c2.release();
            }
            return { ok: true, knowledge: handled };
          }

          if (eventType === 'FollowUpDue' && followUpId) {
            await client.query('COMMIT');
            const executed = await executeFollowUp({
              pool,
              organizationId,
              followUpId: String(followUpId),
              followUpVersion:
                followUpVersion != null ? Number(followUpVersion) : undefined,
              workerId,
            });
            const c2 = await pool.connect();
            try {
              await c2.query('BEGIN');
              await c2.query(`SELECT set_config('app.current_organization_id', $1, true)`, [
                organizationId,
              ]);
              await c2.query(`SELECT set_config('app.current_user_id', $1, true)`, [workerId]);
              await c2.query(
                `INSERT INTO consumer_receipts (organization_id, consumer_name, event_id)
                 VALUES ($1::uuid, $2, $3::uuid)
                 ON CONFLICT (consumer_name, event_id) DO NOTHING`,
                [organizationId, FOLLOWUP_CONSUMER, eventId],
              );
              await c2.query('COMMIT');
            } catch (e) {
              try {
                await c2.query('ROLLBACK');
              } catch {
                /* ignore */
              }
              throw e;
            } finally {
              c2.release();
            }
            return { ok: true, followUp: executed };
          }

          if (eventType === 'OutboundMessageReady' && outboundMessageId) {
            await client.query('COMMIT');
            const c2 = await pool.connect();
            try {
              await c2.query('BEGIN');
              await c2.query(`SELECT set_config('app.current_organization_id', $1, true)`, [
                organizationId,
              ]);
              await c2.query(`SELECT set_config('app.current_user_id', $1, true)`, [workerId]);
              const dispatched = await dispatchOutboundMessage(c2, organizationId, outboundMessageId);
              await c2.query(
                `INSERT INTO consumer_receipts (organization_id, consumer_name, event_id)
                 VALUES ($1::uuid, $2, $3::uuid)
                 ON CONFLICT (consumer_name, event_id) DO NOTHING`,
                [organizationId, OUTBOUND_CONSUMER, eventId],
              );
              await c2.query('COMMIT');
              return { ok: true, outbound: dispatched };
            } catch (e) {
              try {
                await c2.query('ROLLBACK');
              } catch {
                /* ignore */
              }
              throw e;
            } finally {
              c2.release();
            }
          }

          if (conversationId) {
            await client.query('COMMIT');
            await drainConversation(organizationId, conversationId, workerId);
            const c2 = await pool.connect();
            try {
              await c2.query('BEGIN');
              await c2.query(`SELECT set_config('app.current_organization_id', $1, true)`, [
                organizationId,
              ]);
              await c2.query(`SELECT set_config('app.current_user_id', $1, true)`, [workerId]);
              await c2.query(
                `INSERT INTO consumer_receipts (organization_id, consumer_name, event_id)
                 VALUES ($1::uuid, $2, $3::uuid)
                 ON CONFLICT (consumer_name, event_id) DO NOTHING`,
                [organizationId, CONSUMER_NAME, eventId],
              );
              await c2.query('COMMIT');
            } catch (e) {
              try {
                await c2.query('ROLLBACK');
              } catch {
                /* ignore */
              }
              throw e;
            } finally {
              c2.release();
            }
          } else {
            await client.query(
              `INSERT INTO consumer_receipts (organization_id, consumer_name, event_id)
               VALUES ($1::uuid, $2, $3::uuid)
               ON CONFLICT (consumer_name, event_id) DO NOTHING`,
              [organizationId, CONSUMER_NAME, eventId],
            );
            await client.query('COMMIT');
          }
          return { ok: true };
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

      if (job.name === 'drain' && job.data?.conversationId) {
        return drainConversation(organizationId, String(job.data.conversationId), workerId);
      }

      return { ok: true, organizationId };
    },
    { connection: connection as never },
  );

  worker.on('failed', (job, err) => {
    console.error(JSON.stringify({ msg: 'worker_job_failed', jobId: job?.id, error: String(err) }));
  });

  // Relay loop + sweeper + low-frequency PROCESSING lease reclaim.
  let repairTick = 0;
  const tick = async () => {
    try {
      const relayed = await relayOnce();
      const due = await sweepDueConversations();
      repairTick += 1;
      if (repairTick % 12 === 0) {
        try {
          await pool.query(
            `UPDATE follow_ups
             SET status='SCHEDULED', processing_owner=NULL, lease_until=NULL, updated_at=now()
             WHERE status='PROCESSING' AND lease_until IS NOT NULL AND lease_until < now()`,
          );
        } catch {
          /* RLS may block unscoped — ignore */
        }
      }
      if (relayed || due) {
        console.log(JSON.stringify({ msg: 'worker_tick', relayed, due }));
      }
    } catch (err) {
      console.error(JSON.stringify({ msg: 'worker_tick_failed', error: String(err) }));
    }
  };

  let stopping = false;
  await tick();
  const interval = setInterval(() => {
    if (!stopping) void tick();
  }, 5000);

  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    clearInterval(interval);
    console.log(JSON.stringify({ msg: 'worker_shutdown_started', signal }));
    const force = setTimeout(() => process.exit(1), 30_000);
    force.unref();
    try {
      // BullMQ stops fetching new jobs and waits for the current handler.
      await worker.close();
      await queue.close();
      await connection.quit();
      await pool.end();
      console.log(JSON.stringify({ msg: 'worker_shutdown_complete', signal }));
      process.exit(0);
    } catch (error) {
      console.error(JSON.stringify({ msg: 'worker_shutdown_failed', signal, error: String(error) }));
      process.exit(1);
    }
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  console.log(JSON.stringify({ msg: 'worker_ready', queue: CONVERSATION_QUEUE }));
}

main().catch((err) => {
  console.error(JSON.stringify({ msg: 'worker_boot_failed', error: String(err) }));
  process.exit(1);
});
