import { loadLocalEnv, loadServerEnv } from '@ai-sales-agent/config';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import pg from 'pg';

const CONVERSATION_QUEUE = 'conversation-wake';
const CONSUMER_NAME = 'conversation-drain';

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

  const queue = new Queue(CONVERSATION_QUEUE, { connection });

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

  async function drainConversation(organizationId: string, conversationId: string, workerId: string) {
    const client = await pool.connect();
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
         RETURNING lease_fence, ownership_epoch, processed_sequence, next_sequence`,
        [organizationId, conversationId, workerId],
      );
      if (!lease.rows[0]) {
        await client.query('ROLLBACK');
        return { skipped: true };
      }
      const { lease_fence, ownership_epoch, processed_sequence, next_sequence } = lease.rows[0];
      if (processed_sequence + 1 >= next_sequence) {
        await client.query('COMMIT');
        return { drained: 0 };
      }

      // P03 foundation: mark contiguous pending ingress as processed (no AI).
      const through = next_sequence - 1;
      const updated = await client.query(
        `UPDATE conversations
         SET processed_sequence = $4,
             updated_at = now(),
             version = version + 1
         WHERE organization_id = $1::uuid
           AND id = $2::uuid
           AND lease_owner = $3
           AND lease_fence = $5
           AND ownership_epoch = $6
           AND lease_expires_at > now()
         RETURNING id`,
        [organizationId, conversationId, workerId, through, lease_fence, ownership_epoch],
      );
      if (!updated.rowCount) {
        await client.query('ROLLBACK');
        return { rejected: true };
      }

      // ConsumerReceipt for wake event if present is recorded by job handler when eventId known.
      await client.query('COMMIT');
      return { drained: through - processed_sequence, leaseFence: lease_fence, ownershipEpoch: ownership_epoch };
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
            `SELECT 1 FROM consumer_receipts WHERE consumer_name = $1 AND event_id = $2::uuid`,
            [CONSUMER_NAME, eventId],
          );
          if (existing.rowCount) {
            await client.query('COMMIT');
            return { duplicate: true };
          }

          const payload = await client.query<{ payload_json: { payload?: { conversationId?: string } } }>(
            `SELECT payload_json FROM outbox_events WHERE organization_id = $1::uuid AND id = $2::uuid`,
            [organizationId, eventId],
          );
          const conversationId = payload.rows[0]?.payload_json?.payload?.conversationId
            ?? (payload.rows[0]?.payload_json as { aggregateId?: string } | undefined)?.aggregateId;
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
    { connection },
  );

  worker.on('failed', (job, err) => {
    console.error(JSON.stringify({ msg: 'worker_job_failed', jobId: job?.id, error: String(err) }));
  });

  // Relay loop + sweeper (Redis loss: DB remains source of pending work).
  const tick = async () => {
    try {
      const relayed = await relayOnce();
      const due = await sweepDueConversations();
      if (relayed || due) {
        console.log(JSON.stringify({ msg: 'worker_tick', relayed, due }));
      }
    } catch (err) {
      console.error(JSON.stringify({ msg: 'worker_tick_failed', error: String(err) }));
    }
  };

  await tick();
  setInterval(() => {
    void tick();
  }, 5000);

  console.log(JSON.stringify({ msg: 'worker_ready', queue: CONVERSATION_QUEUE }));
}

main().catch((err) => {
  console.error(JSON.stringify({ msg: 'worker_boot_failed', error: String(err) }));
  process.exit(1);
});
