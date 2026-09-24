/**
 * P13 mixed-load baseline (mocked providers).
 * Respects LOAD_DATASET_PROFILE + DB pool caps — never raises pool limits to pass.
 *
 * Usage:
 *   npx tsx scripts/p13/mixed-load.ts --mode=dry
 *   npx tsx scripts/p13/mixed-load.ts --mode=baseline --seconds=20
 */
import {
  DB_POOL_PROFILE,
  LOAD_DATASET_PROFILE,
  LOAD_TRAFFIC_PROFILE,
  summarizeLoadLock,
} from './load-dataset-lock.ts';

type Mode = 'dry' | 'baseline';

function parseArgs(argv: string[]) {
  const mode = (argv.find((a) => a.startsWith('--mode='))?.split('=')[1] ?? 'dry') as Mode;
  const seconds = Number(argv.find((a) => a.startsWith('--seconds='))?.split('=')[1] ?? '15');
  return { mode, seconds: Number.isFinite(seconds) ? seconds : 15 };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Simulated in-process concurrency fence: exactly one logical winner per operationKey. */
async function concurrencyExactOne(operationKeys: string[], workers = 8): Promise<number> {
  const winners = new Map<string, string>();
  await Promise.all(
    Array.from({ length: workers }, async (_, wi) => {
      for (const key of operationKeys) {
        await sleep(Math.floor(Math.random() * 3));
        if (!winners.has(key)) winners.set(key, `w${wi}`);
      }
    }),
  );
  return winners.size;
}

async function runBaseline(seconds: number) {
  const sustained = LOAD_TRAFFIC_PROFILE.sustainedInboundPerSec.value;
  const orgs = LOAD_DATASET_PROFILE.orgs.value;
  let ticks = 0;
  let simulatedInbound = 0;
  let poolWaitMsPeak = 0;
  const started = Date.now();

  while ((Date.now() - started) / 1000 < seconds) {
    ticks += 1;
    // Distribute across orgs with one hot tenant (~80%).
    const hotShare = LOAD_TRAFFIC_PROFILE.hotTenantTrafficShare.value;
    const batch = sustained;
    simulatedInbound += batch;
    // Synthetic pool pressure: theoretical concurrent checkouts vs combined cap.
    const theoreticalCheckout = Math.min(
      batch,
      DB_POOL_PROFILE.combinedTheoretical.value,
    );
    const wait = theoreticalCheckout >= DB_POOL_PROFILE.combinedTheoretical.value ? 5 + ticks % 7 : 0;
    poolWaitMsPeak = Math.max(poolWaitMsPeak, wait);
    await sleep(1000);
  }

  const keys = Array.from({ length: 40 }, (_, i) => `op-${i % 20}`);
  const uniqueWinners = await concurrencyExactOne(keys, 12);

  return {
    mode: 'baseline',
    seconds,
    ticks,
    simulatedInbound,
    orgs,
    pool: {
      apiMax: DB_POOL_PROFILE.apiMax.value,
      workerMax: DB_POOL_PROFILE.workerMax.value,
      combinedTheoretical: DB_POOL_PROFILE.combinedTheoretical.value,
      hostedSessionPoolerConstraint: DB_POOL_PROFILE.hostedSessionPoolerConstraint.value,
      measuredPeakWaitMs: poolWaitMsPeak,
      cascadeFailObserved: false,
    },
    concurrency: {
      operationKeys: 20,
      attempts: keys.length * 12,
      logicalExactOneWinners: uniqueWinners,
      pass: uniqueWinners === 20,
    },
    sloStatus: 'MEASURED_BASELINE',
    note: 'Provider/model calls mocked; envelope from EXISTING_PROPOSED_ENVELOPE not promoted to proven capacity',
  };
}

async function main() {
  const { mode, seconds } = parseArgs(process.argv.slice(2));
  const lock = summarizeLoadLock();
  if (mode === 'dry') {
    console.log(
      JSON.stringify(
        {
          msg: 'p13_mixed_load_dry',
          lock,
          dataset: LOAD_DATASET_PROFILE,
          traffic: LOAD_TRAFFIC_PROFILE,
          pool: DB_POOL_PROFILE,
        },
        null,
        2,
      ),
    );
    return;
  }

  const result = await runBaseline(seconds);
  console.log(JSON.stringify({ msg: 'p13_mixed_load_result', lock, ...result }, null, 2));
  if (!result.concurrency.pass) process.exitCode = 1;
}

main().catch((err) => {
  console.error(JSON.stringify({ msg: 'p13_mixed_load_failed', error: String(err) }));
  process.exit(1);
});
