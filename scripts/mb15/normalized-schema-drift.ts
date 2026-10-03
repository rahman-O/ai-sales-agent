/** Read-only catalog gate against a fresh SQL-migration replay; names are not invariants. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import pg from 'pg';
import { loadDemoCliEnv } from '../demo/load-demo-cli-env.ts';
import { requireLocalDemoDb } from '../demo/assert-local-demo-db.ts';
loadDemoCliEnv();
requireLocalDemoDb();
const reference = process.env.MB15_SCHEMA_REFERENCE_CONTAINER ?? '';
if (!reference) throw new Error('MB15_SCHEMA_REFERENCE_CONTAINER required (fresh migration replay)');
if (execFileSync('docker',['inspect','--format','{{.HostConfig.NetworkMode}}',reference],{encoding:'utf8'}).trim() !== 'none')
  throw new Error('schema_reference_must_be_isolated_without_network');
const queries: Record<string, string> = {
  tables: `SELECT c.relname AS object, jsonb_build_object('kind',c.relkind,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'owner',pg_get_userbyid(c.relowner)) AS state FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m') AND c.relname<>'_prisma_migrations'`,
  columns: `SELECT c.relname||'.'||a.attname AS object,jsonb_build_object('type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity,'generated',a.attgenerated) AS state FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped AND c.relname<>'_prisma_migrations'`,
  constraints: `SELECT c.relname||':'||pg_get_constraintdef(x.oid,true) AS object,jsonb_build_object('type',x.contype,'validated',x.convalidated,'deferrable',x.condeferrable,'deferred',x.condeferred) AS state FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname<>'_prisma_migrations'`,
  indexes: `SELECT t.relname||':'||regexp_replace(pg_get_indexdef(i.indexrelid),'^(CREATE (UNIQUE )?INDEX) [^ ]+ ON ','\\1 ON ') AS object,jsonb_build_object('valid',i.indisvalid,'ready',i.indisready) AS state FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND t.relname<>'_prisma_migrations'`,
  policies: `SELECT tablename||'.'||policyname AS object,jsonb_build_object('permissive',permissive,'roles',roles,'cmd',cmd,'using',qual,'check',with_check) AS state FROM pg_policies WHERE schemaname='public'`,
  functions: `SELECT p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' AS object,jsonb_build_object('definition',pg_get_functiondef(p.oid),'acl',p.proacl::text,'owner',pg_get_userbyid(p.proowner)) AS state FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')`,
  triggers: `SELECT c.relname||'.'||t.tgname AS object,jsonb_build_object('definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled) AS state FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal`,
  grants: `SELECT table_name||':'||grantee||':'||privilege_type AS object,jsonb_build_object('grantable',is_grantable) AS state FROM information_schema.table_privileges WHERE table_schema='public' AND table_name<>'_prisma_migrations'`,
  extensions: `SELECT extname AS object,jsonb_build_object('version',extversion) AS state FROM pg_extension`,
  enums: `SELECT t.typname AS object,jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) AS state FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' GROUP BY t.typname`,
  runtimeMemberships: `SELECT r.rolname AS object,jsonb_build_object('admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) AS state FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid JOIN pg_roles member ON member.oid=m.member WHERE member.rolname='app_runtime'`,
  runtimeRole: `SELECT rolname AS object,jsonb_build_object('super',rolsuper,'bypassRls',rolbypassrls,'createDb',rolcreatedb,'createRole',rolcreaterole,'inherit',rolinherit) AS state FROM pg_roles WHERE rolname='app_runtime'`,
};
const pool = new pg.Pool({ connectionString: process.env.MIGRATION_DATABASE_URL });
const canonical = (value: unknown): string => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))) : v);
const differences: unknown[] = [];
const snapshots: Record<string, unknown> = {};
async function main() {
try {
  await pool.query('BEGIN READ ONLY');
  for (const [kind, sql] of Object.entries(queries)) {
    const actual = (await pool.query(sql)).rows;
    const expected = JSON.parse(execFileSync('docker', ['exec',reference,'psql','-U','postgres','-At','-c',`SELECT coalesce(json_agg(q),'[]'::json) FROM (${sql}) q`],{encoding:'utf8'})) as Array<{object:string;state:unknown}>;
    // Preserve multiplicity, so duplicate constraints/indexes cannot disappear in normalization.
    const entries = (rows: typeof expected) => rows.map(r=>canonical(r)).sort();
    const a = entries(actual), e = entries(expected);
    snapshots[kind] = { expected, actual };
    if (canonical(a)!==canonical(e)) {
      const remaining=[...a];
      for (const item of e) { const i=remaining.indexOf(item); if(i>=0)remaining.splice(i,1); else differences.push({kind,expected:JSON.parse(item),actual:'MISSING_OR_DIFFERENT'}); }
      for (const item of remaining) differences.push({kind,expected:'ABSENT',actual:JSON.parse(item)});
    }
  }
  const history=(await pool.query(`SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations`)).rows;
  for (const name of fs.readdirSync('prisma/migrations').filter(n=>fs.existsSync(`prisma/migrations/${n}/migration.sql`))) {
    const checksum=createHash('sha256').update(fs.readFileSync(`prisma/migrations/${name}/migration.sql`)).digest('hex');
    if (!history.some(r=>r.migration_name===name && r.checksum===checksum && r.finished_at && !r.rolled_back_at)) differences.push({kind:'migrationHistory',object:name,expected:'applied_with_matching_checksum',actual:'missing_or_checksum_mismatch'});
  }
  await pool.query('ROLLBACK');
  const report={normalizedSchemaDrift:differences.length?'FOUND':'NONE',differenceCount:differences.length,differences,snapshots};
  fs.writeFileSync('/tmp/mb15-normalized-schema.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({NORMALIZED_SCHEMA_DRIFT:report.normalizedSchemaDrift,differenceCount:differences.length,evidence:'/tmp/mb15-normalized-schema.json'}));
  if(differences.length)process.exitCode=1;
} finally { await pool.end(); }

}
void main().catch(() => { console.error("normalized_schema_check_failed"); process.exitCode=1; });
