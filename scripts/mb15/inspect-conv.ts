import pg from 'pg';
import { loadDemoCliEnv } from '../demo/load-demo-cli-env.ts';

loadDemoCliEnv();

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.MIGRATION_DATABASE_URL });
  const run = await pool.query(
    `SELECT * FROM agent_runs WHERE id = 'e7216fbc-e530-4a40-9050-727d4b46b071'`,
  );
  console.log('AGENT RUN e7216:', JSON.stringify(run.rows, null, 2));

  await pool.end();
}

main().catch(console.error);
