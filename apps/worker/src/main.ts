import { loadServerEnv } from '@ai-sales-agent/config';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

/**
 * Phase 01 worker foundation only: Redis/BullMQ connection.
 * No product queues (follow-ups, AI, WhatsApp). Future tenant jobs MUST carry organizationId
 * and reconstruct tenant context per job — never rely on pooled DB connection residue.
 */
async function main() {
  const env = loadServerEnv(process.env);
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

  const foundationQueueName = 'foundation-heartbeat';
  const queue = new Queue(foundationQueueName, { connection });

  const worker = new Worker(
    foundationQueueName,
    async (job) => {
      const organizationId = job.data?.organizationId;
      if (!organizationId) {
        throw new Error('Tenant-owned job missing organizationId');
      }
      // No DB work in P01 foundation heartbeat — invariant proof only.
      return { ok: true, organizationId };
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    console.error(JSON.stringify({ msg: 'worker_job_failed', jobId: job?.id, error: String(err) }));
  });

  await queue.add(
    'ping',
    { organizationId: '00000000-0000-4000-8000-0000000000aa' },
    { removeOnComplete: 10, removeOnFail: 10 },
  );

  console.log(JSON.stringify({ msg: 'worker_ready', queue: foundationQueueName }));
}

main().catch((err) => {
  console.error(JSON.stringify({ msg: 'worker_boot_failed', error: String(err) }));
  process.exit(1);
});
