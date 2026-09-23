import { loadLocalEnv } from './load-local-env.ts';
import { createPgPool } from './pg-pool.ts';

loadLocalEnv();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');
  const normalized = url.replace(/^postgresql:/, 'http:').replace(/^postgres:/, 'http:');
  const parsed = new URL(normalized);
  const user = decodeURIComponent(parsed.username);
  const host = parsed.hostname;
  const port = parsed.port;

  const pool = createPgPool(url);
  try {
    const { rows } = await pool.query(`
      SELECT current_user AS cu,
             session_user AS su,
             (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS rolsuper,
             (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS rolbypassrls,
             (SELECT rolcanlogin FROM pg_roles WHERE rolname = current_user) AS rolcanlogin
    `);
    const cu = String(rows[0].cu);
    const ok =
      cu === 'app_runtime' &&
      rows[0].rolsuper === false &&
      rows[0].rolbypassrls === false &&
      rows[0].rolcanlogin === true;
    console.log(
      JSON.stringify(
        {
          RUNTIME_DATABASE_CONNECTIVITY: 'PASS',
          DATABASE_RUNTIME_IDENTITY: ok ? 'VERIFIED_APP_RUNTIME' : 'INVALID',
          current_user: cu,
          session_user: rows[0].su,
          rolsuper: rows[0].rolsuper,
          rolbypassrls: rows[0].rolbypassrls,
          CONNECTION_MODE: port === '5432' && host.includes('pooler') ? 'SESSION_POOLER' : 'UNRESOLVED',
          poolerUserMatchesExpected: user === 'app_runtime.cpeelvqtlykxybtwbhex',
          hostMatchesExpected: host === 'aws-0-ap-northeast-2.pooler.supabase.com',
          port,
        },
        null,
        2,
      ),
    );
    if (!ok) process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(
    JSON.stringify({
      RUNTIME_DATABASE_CONNECTIVITY: 'FAIL',
      error: String((e as Error).message),
    }),
  );
  process.exit(1);
});
