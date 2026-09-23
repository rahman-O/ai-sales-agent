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
    const { rows } = await pool.query(`
      SELECT current_user AS cu,
             current_database() AS db,
             (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS rolsuper
    `);
    const cu = String(rows[0].cu);
    const ok = cu === 'postgres' || cu.startsWith('postgres.');
    console.log(
      JSON.stringify(
        {
          MIGRATION_DATABASE_CONNECTIVITY: 'PASS',
          DATABASE_MIGRATION_IDENTITY: ok ? 'VERIFIED' : 'UNEXPECTED',
          currentUserKind:
            cu === 'postgres' ? 'postgres' : cu.startsWith('postgres.') ? 'postgres.projectref' : 'other',
          database: rows[0].db,
          rolsuper: rows[0].rolsuper,
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ MIGRATION_DATABASE_CONNECTIVITY: 'FAIL', error: String(err.message || err) }));
  process.exit(1);
});
