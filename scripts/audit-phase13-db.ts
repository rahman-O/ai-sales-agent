import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

for (const name of ['.env', '.env.local']) {
  const file = path.resolve(process.cwd(), name);
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^([^#=\s]+)=(.*)$/.exec(line.trim());
    if (match && match[1] !== 'NODE_ENV') process.env[match[1]] = match[2]!.replace(/^['"]|['"]$/g, '');
  }
}

const runtimeUrl = process.env.DATABASE_URL;
const ownerUrl = process.env.MIGRATION_DATABASE_URL;
if (!runtimeUrl || !ownerUrl || runtimeUrl === ownerUrl) throw new Error('runtime_and_owner_urls_required');

const poolOptions = (connectionString: string) => ({
  connectionString: connectionString.replace(/[?&]sslmode=[^&]*/gi, '').replace(/[?&]$/, ''),
  max: 1,
  ssl: /supabase\.co|supabase\.com/i.test(connectionString) ? { rejectUnauthorized: false } : undefined,
});
const runtime = new pg.Pool(poolOptions(runtimeUrl));
const owner = new pg.Pool(poolOptions(ownerUrl));

async function main() {
try {
  const [role, functions, tenantTables] = await Promise.all([
    runtime.query(
      `SELECT current_user, rolsuper, rolbypassrls
       FROM pg_roles WHERE rolname = current_user`,
    ),
    owner.query(
      `SELECT p.proname,
              pg_get_function_identity_arguments(p.oid) AS arguments,
              pg_get_userbyid(p.proowner) AS owner,
              p.proconfig,
              has_function_privilege('public', p.oid, 'EXECUTE') AS public_execute,
              has_function_privilege('app_runtime', p.oid, 'EXECUTE') AS runtime_execute
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.prosecdef
       ORDER BY p.proname`,
    ),
    owner.query(
      `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relkind = 'r'
         AND EXISTS (
           SELECT 1 FROM pg_attribute a
           WHERE a.attrelid = c.oid AND a.attname = 'organization_id' AND NOT a.attisdropped
         )
       ORDER BY c.relname`,
    ),
  ]);

  const workerFunctions = new Set([
    'claim_pending_outbox_events',
    'mark_outbox_event_published',
    'list_due_conversation_wakeups',
    'reclaim_expired_conversation_leases',
  ]);
  const insecureFunctions = functions.rows.filter((row) => {
    const hasFixedPath = row.proconfig?.some((v: string) => v.startsWith('search_path='));
    if (row.public_execute || !hasFixedPath) return true;
    return workerFunctions.has(row.proname) ? !row.runtime_execute : row.runtime_execute;
  });
  const unforcedTenantTables = tenantTables.rows.filter((row) => !row.relrowsecurity || !row.relforcerowsecurity);
  console.log(JSON.stringify({
    PHASE13_DATABASE_AUDIT: insecureFunctions.length || unforcedTenantTables.length ? 'FAIL' : 'PASS',
    runtimeRole: role.rows[0],
    securityDefiner: functions.rows,
    tenantTableCount: tenantTables.rowCount,
    unforcedTenantTables: unforcedTenantTables.map((row) => row.relname),
  }, null, 2));
  if (insecureFunctions.length || unforcedTenantTables.length) process.exitCode = 1;
} finally {
  await Promise.all([runtime.end(), owner.end()]);
}
}

void main().catch((error) => {
  console.error(JSON.stringify({ PHASE13_DATABASE_AUDIT: 'FAIL', error: String(error) }));
  process.exit(1);
});
