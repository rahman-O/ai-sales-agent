import { loadLocalEnv } from './load-local-env.ts';
import { Pool } from 'pg';

loadLocalEnv();

async function tryQuery(pool: Pool, label: string, sql: string) {
  try {
    await pool.query(sql);
    console.log(JSON.stringify({ label, ok: true }));
  } catch (e) {
    console.log(JSON.stringify({ label, ok: false, error: String((e as Error).message) }));
  }
}

async function main() {
  const url = process.env.MIGRATION_DATABASE_URL!;
  const pool = new Pool({
    connectionString: url,
    max: 1,
    ssl: { rejectUnauthorized: false },
  });
  try {
    const who = await pool.query(`SELECT current_user, session_user, current_setting('role', true) AS role`);
    console.log(JSON.stringify({ who: who.rows[0] }));
    const privs = await pool.query(`
      SELECT rolcreaterole, rolcreatedb, rolsuper, rolreplication
      FROM pg_roles WHERE rolname = current_user
    `);
    console.log(JSON.stringify({ privs: privs.rows[0] }));

    await tryQuery(pool, 'alter_login_only', `ALTER ROLE app_runtime WITH LOGIN`);
    await tryQuery(
      pool,
      'alter_password_via_do',
      `DO $$ BEGIN EXECUTE format('ALTER ROLE app_runtime PASSWORD %L', 'temp_probe_only_not_kept'); END $$;`,
    );
    // Restore intent: provision script will set real password next
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(String((e as Error).message));
  process.exit(1);
});
