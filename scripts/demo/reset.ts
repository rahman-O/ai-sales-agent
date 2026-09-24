/**
 * demo:reset — delete only the deterministic demo organization data.
 */
import { Pool } from 'pg';
import { requireLocalDemoDb } from './assert-local-demo-db.ts';
import { DEMO_ORG_ID, DEMO_ORG_NAME, DEMO_ORG_SLUG } from './constants.ts';
import { loadDemoCliEnv } from './load-demo-cli-env.ts';
import { assertOrgIdentity, countDemoTenantRows, deleteDemoTenant } from './residual.ts';

async function main() {
  loadDemoCliEnv();
  requireLocalDemoDb(process.env, { requireAllowReset: true });
  console.log(JSON.stringify({ DEMO_ORG: DEMO_ORG_SLUG }));

  const pool = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL });
  try {
    const identity = await assertOrgIdentity(pool, DEMO_ORG_ID, DEMO_ORG_NAME);
    if (identity === 'collision') {
      throw new Error('DEMO_ORG_UUID_collision_name_mismatch');
    }
    if (identity === 'match') {
      await deleteDemoTenant(pool, DEMO_ORG_ID);
    }

    const remaining = await countDemoTenantRows(pool, DEMO_ORG_ID);
    const orgGone = await assertOrgIdentity(pool, DEMO_ORG_ID, DEMO_ORG_NAME);
    const residualPass = remaining === 0 && orgGone === 'absent';

    console.log(
      JSON.stringify({
        DEMO_ORG_ABSENT: orgGone === 'absent' ? 'PASS' : 'FAIL',
        DEMO_ORG_ROWS_REMAINING: remaining > 0 && orgGone !== 'absent' ? remaining : 0,
        DEMO_TENANT_ROWS_REMAINING: remaining,
        POST_RESET_RESIDUAL_CHECK: residualPass ? 'PASS' : 'FAIL',
        SURVIVOR_ORG_PRESERVED: 'N/A',
        DEMO_RESET: residualPass ? 'PASS' : 'FAIL',
      }),
    );
    if (!residualPass) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
