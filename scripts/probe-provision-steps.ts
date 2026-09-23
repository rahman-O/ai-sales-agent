import { loadLocalEnv } from './load-local-env.ts';
import { Pool } from 'pg';

loadLocalEnv();

async function main() {
  const url = process.env.MIGRATION_DATABASE_URL!;
  const password = process.env.APP_RUNTIME_DB_PASSWORD;
  if (!password) throw new Error('APP_RUNTIME_DB_PASSWORD missing');
  const pool = new Pool({
    connectionString: url,
    max: 1,
    ssl: { rejectUnauthorized: false },
  });
  const steps: Array<{ step: string; ok: boolean; error?: string }> = [];
  async function step(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      steps.push({ step: name, ok: true });
    } catch (e) {
      steps.push({ step: name, ok: false, error: String((e as Error).message) });
    }
  }
  try {
    await step('alter_login', async () => {
      await pool.query(`ALTER ROLE app_runtime WITH LOGIN`);
    });
    await step('alter_password_tx', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SELECT set_config('app.provision_runtime_password', $1, true)`, [password]);
        await client.query(`
          DO $$
          DECLARE
            pw text := current_setting('app.provision_runtime_password', true);
          BEGIN
            EXECUTE format('ALTER ROLE app_runtime PASSWORD %L', pw);
          END
          $$;
        `);
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
    });
    await step('alter_attrs', async () => {
      await pool.query(
        `ALTER ROLE app_runtime WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`,
      );
    });
    const { rows } = await pool.query(
      `SELECT rolcanlogin, rolsuper, rolbypassrls FROM pg_roles WHERE rolname='app_runtime'`,
    );
    console.log(JSON.stringify({ steps, role: rows[0] }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(String((e as Error).message));
  process.exit(1);
});
