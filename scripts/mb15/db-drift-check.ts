import { loadLocalEnv } from '../load-local-env.ts';
import pg from 'pg';

loadLocalEnv();

if (!process.env.MIGRATION_DATABASE_URL) throw new Error('MIGRATION_DATABASE_URL required');

const pool = new pg.Pool({
  connectionString: process.env.MIGRATION_DATABASE_URL,
  ssl: /supabase\.co|supabase\.com/i.test(process.env.MIGRATION_DATABASE_URL)
    ? { rejectUnauthorized: false }
    : undefined,
});

async function main() {
try {
  const result = await pool.query<{
    working_state: string | null;
    migration_recorded: boolean;
  }>(`
    SELECT
      to_regclass('public.conversation_working_state')::text AS working_state,
      EXISTS (
        SELECT 1
        FROM _prisma_migrations
        WHERE migration_name = '202609262200_pre_p14_conversation_working_state'
          AND finished_at IS NOT NULL
          AND rolled_back_at IS NULL
      ) AS migration_recorded
  `);
  const constraints = await pool.query<{ table_name: string; constraint_name: string }>(`
    SELECT c.conrelid::regclass::text AS table_name, c.conname AS constraint_name
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.conrelid IN (
        'services'::regclass,
        'knowledge_documents'::regclass,
        'leads'::regclass,
        'conversations'::regclass
      )
    ORDER BY 1, 2
  `);
  console.log(
    JSON.stringify({
      conversationWorkingStatePresent: result.rows[0]?.working_state != null,
      migrationRecordedApplied: result.rows[0]?.migration_recorded === true,
      foreignKeys: constraints.rows,
    }),
  );
} finally {
  await pool.end();
}
}

void main();
