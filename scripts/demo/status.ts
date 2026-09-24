/**
 * demo:status — DB/state inspection only (no API).
 */
import { Pool } from 'pg';
import { requireLocalDemoDb } from './assert-local-demo-db.ts';
import { DEMO_ORG_ID, DEMO_ORG_NAME, DEMO_ORG_SLUG } from './constants.ts';
import { loadDemoCliEnv } from './load-demo-cli-env.ts';
import { assertOrgIdentity } from './residual.ts';

async function count(pool: Pool, sql: string, params: unknown[] = []): Promise<number> {
  const r = await pool.query(sql, params);
  return Number(r.rows[0]?.c ?? 0);
}

async function main() {
  loadDemoCliEnv();
  requireLocalDemoDb();
  const pool = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL });
  try {
    const identity = await assertOrgIdentity(pool, DEMO_ORG_ID, DEMO_ORG_NAME);
    const orgReady = identity === 'match';
    const members = orgReady
      ? await count(
          pool,
          `SELECT count(*)::int AS c FROM organization_members WHERE organization_id=$1::uuid AND status='ACTIVE'`,
          [DEMO_ORG_ID],
        )
      : 0;
    const customers = orgReady
      ? await count(pool, `SELECT count(*)::int AS c FROM customers WHERE organization_id=$1::uuid`, [
          DEMO_ORG_ID,
        ])
      : 0;
    const conversations = orgReady
      ? await count(pool, `SELECT count(*)::int AS c FROM conversations WHERE organization_id=$1::uuid`, [
          DEMO_ORG_ID,
        ])
      : 0;
    const leads = orgReady
      ? await count(pool, `SELECT count(*)::int AS c FROM leads WHERE organization_id=$1::uuid`, [DEMO_ORG_ID])
      : 0;
    const bookings = orgReady
      ? await count(pool, `SELECT count(*)::int AS c FROM bookings WHERE organization_id=$1::uuid`, [
          DEMO_ORG_ID,
        ])
      : 0;
    const followups = orgReady
      ? await count(pool, `SELECT count(*)::int AS c FROM follow_ups WHERE organization_id=$1::uuid`, [
          DEMO_ORG_ID,
        ])
      : 0;
    const knowledgeDocs = orgReady
      ? await count(pool, `SELECT count(*)::int AS c FROM knowledge_documents WHERE organization_id=$1::uuid`, [
          DEMO_ORG_ID,
        ])
      : 0;
    const published = orgReady
      ? await count(
          pool,
          `SELECT count(*)::int AS c FROM knowledge_documents WHERE organization_id=$1::uuid AND active_published_version_id IS NOT NULL`,
          [DEMO_ORG_ID],
        )
      : 0;
    const agentActive = orgReady
      ? await count(
          pool,
          `SELECT count(*)::int AS c FROM agent_configs WHERE organization_id=$1::uuid AND status='ACTIVE'`,
          [DEMO_ORG_ID],
        )
      : 0;
    const openLeads = orgReady
      ? await count(
          pool,
          `SELECT count(*)::int AS c FROM leads WHERE organization_id=$1::uuid AND status IN ('NEW','ENGAGED','QUALIFIED','NURTURE')`,
          [DEMO_ORG_ID],
        )
      : 0;
    const confirmedBookings = orgReady
      ? await count(
          pool,
          `SELECT count(*)::int AS c FROM bookings WHERE organization_id=$1::uuid AND status='CONFIRMED'`,
          [DEMO_ORG_ID],
        )
      : 0;
    const pendingFu = orgReady
      ? await count(
          pool,
          `SELECT count(*)::int AS c FROM follow_ups WHERE organization_id=$1::uuid AND status IN ('SCHEDULED','PROCESSING')`,
          [DEMO_ORG_ID],
        )
      : 0;
    const agentRuns = orgReady
      ? await count(pool, `SELECT count(*)::int AS c FROM agent_runs WHERE organization_id=$1::uuid`, [
          DEMO_ORG_ID,
        ])
      : 0;

    const knowledgeStatus =
      published > 0 ? 'PASS' : knowledgeDocs > 0 ? 'PARTIAL' : orgReady ? 'MISSING' : 'MISSING';
    const dashboardReady =
      orgReady && conversations > 0 && openLeads > 0 && confirmedBookings > 0 && pendingFu > 0;
    const analyticsReady = orgReady && agentRuns > 0 && conversations > 0;

    console.log(
      JSON.stringify(
        {
          DEMO_DB_TARGET: 'LOCAL',
          DEMO_ORG_SLUG,
          ORGANIZATION: orgReady ? 'READY' : identity === 'collision' ? 'COLLISION' : 'MISSING',
          OPERATOR: members > 0 ? 'READY' : 'MISSING',
          CUSTOMERS: customers,
          CONVERSATIONS: conversations,
          LEADS: leads,
          BOOKINGS: bookings,
          FOLLOWUPS: followups,
          KNOWLEDGE: knowledgeStatus,
          KNOWLEDGE_DOCS: knowledgeDocs,
          AGENT_CONFIG: agentActive > 0 ? 'ACTIVE' : 'MISSING',
          DASHBOARD_DATA: dashboardReady ? 'READY' : orgReady ? 'PARTIAL' : 'MISSING',
          ANALYTICS_DATA: analyticsReady ? 'READY' : orgReady ? 'PARTIAL' : 'MISSING',
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
