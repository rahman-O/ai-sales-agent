import { loadLocalEnv } from './load-local-env.ts';
import { Pool } from 'pg';

loadLocalEnv();

async function main() {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error('MIGRATION_DATABASE_URL missing');
  const pool = new Pool({
    connectionString: url,
    max: 1,
    ssl: { rejectUnauthorized: false },
  });
  try {
    const tables = await pool.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('users','organizations','organization_members','audit_logs','outbox_events','idempotency_records')
      ORDER BY tablename
    `);
    const ext = await pool.query(`SELECT extname FROM pg_extension WHERE extname IN ('vector','pgcrypto') ORDER BY 1`);
    // Ensure vector if missing
    let vectorCreated = false;
    if (!ext.rows.some((r) => r.extname === 'vector')) {
      try {
        await pool.query(`CREATE EXTENSION IF NOT EXISTS vector`);
        vectorCreated = true;
      } catch (e) {
        /* reported below */
      }
    }
    const ext2 = await pool.query(`SELECT extname FROM pg_extension WHERE extname IN ('vector','pgcrypto') ORDER BY 1`);
    const rls = await pool.query(`
      SELECT c.relname AS table, c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN ('users','organizations','organization_members','audit_logs','outbox_events','idempotency_records')
      ORDER BY 1
    `);
    const role = await pool.query(`
      SELECT rolname, rolcanlogin, rolsuper, rolbypassrls
      FROM pg_roles WHERE rolname = 'app_runtime'
    `);
    const policies = await pool.query(`
      SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY 1,2
    `);
    console.log(
      JSON.stringify(
        {
          tables: tables.rows.map((r) => r.tablename),
          extensions: ext2.rows.map((r) => r.extname),
          vectorCreated,
          HOSTED_PGVECTOR: ext2.rows.some((r) => r.extname === 'vector') ? 'PASS' : 'FAIL',
          rls: rls.rows,
          app_runtime_before_provision: role.rows[0] ?? null,
          policyCount: policies.rowCount,
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
  console.error(String(e.message || e));
  process.exit(1);
});
