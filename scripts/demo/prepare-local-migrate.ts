/**
 * Local/demo Postgres lacks Supabase's rls_auto_enable().
 * Create a no-op stub so P13 revoke migration can apply safely.
 */
import { Pool } from 'pg';

async function main() {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error('MIGRATION_DATABASE_URL required');
  if (/supabase\.(co|com)/i.test(url)) {
    console.log(JSON.stringify({ prepare_local_migrate: 'SKIP_HOSTED' }));
    return;
  }
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await pool.query(`
      CREATE OR REPLACE FUNCTION public.rls_auto_enable()
      RETURNS event_trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        NULL;
      END;
      $$;
    `);
    console.log(JSON.stringify({ prepare_local_migrate: 'STUB_RLS_AUTO_ENABLE' }));
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
