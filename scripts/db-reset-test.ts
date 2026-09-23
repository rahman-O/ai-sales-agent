/**
 * Resets synthetic test data using migration owner, then leaves runtime role for app tests.
 * Refuses production.
 */
import { Pool } from 'pg';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing db:reset:test in production');
  }
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error('MIGRATION_DATABASE_URL required');
  if (!url.includes('ai_sales_agent')) {
    throw new Error('Safety check: database name must include ai_sales_agent');
  }

  const pool = new Pool({ connectionString: url });
  await pool.query(`
    TRUNCATE idempotency_records, outbox_events, audit_logs, organization_members, organizations, users CASCADE
  `);
  console.log(JSON.stringify({ reset: true }));
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
