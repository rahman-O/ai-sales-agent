/**
 * Provisions LOGIN credentials for app_runtime outside migrations.
 * Never prints the password. Never writes password into SQL migration files.
 */
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { loadLocalEnv } from './load-local-env.ts';

function percentEncodePassword(password: string): string {
  return encodeURIComponent(password);
}

function parsePgUrl(url: string): URL {
  // Handle postgresql:// specially for URL class
  return new URL(url.replace(/^postgresql:/, 'http:').replace(/^postgres:/, 'http:'));
}

function buildDatabaseUrl(opts: {
  user: string;
  password: string;
  host: string;
  port: string;
  database: string;
  search?: string;
}): string {
  const user = encodeURIComponent(opts.user);
  const pass = percentEncodePassword(opts.password);
  const qs = opts.search ? `?${opts.search.replace(/^\?/, '')}` : '';
  return `postgresql://${user}:${pass}@${opts.host}:${opts.port}/${opts.database}${qs}`;
}

function appendOrReplaceEnvLocal(key: string, value: string, cwd: string): void {
  const file = path.join(cwd, '.env.local');
  let text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(text)) {
    text = text.replace(re, line);
  } else {
    text = text.trimEnd() + (text.trim().length ? '\n' : '') + line + '\n';
  }
  fs.writeFileSync(file, text, { mode: 0o600 });
}

async function main() {
  loadLocalEnv();
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_RUNTIME_ROLE_PROVISION !== 'true') {
    throw new Error('Refusing runtime role provision in production without ALLOW_RUNTIME_ROLE_PROVISION=true');
  }

  const migrationUrl = process.env.MIGRATION_DATABASE_URL;
  if (!migrationUrl) throw new Error('MIGRATION_DATABASE_URL required');
  if (/example\.supabase\.co/i.test(migrationUrl)) {
    throw new Error('MIGRATION_DATABASE_URL looks example-only; refuse provision');
  }

  let password = process.env.APP_RUNTIME_DB_PASSWORD;
  let generated = false;
  if (!password) {
    password = randomBytes(24).toString('base64url');
    generated = true;
  }

  const roleName = 'app_runtime';
  const hosted = /supabase\.com|supabase\.co/i.test(migrationUrl);
  const pool = new Pool({
    connectionString: migrationUrl,
    max: 1,
    ssl: hosted ? { rejectUnauthorized: false } : undefined,
  });
  try {
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
          CREATE ROLE app_runtime NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
        END IF;
      END
      $$;
    `);
    // Hosted Supabase: set password inside one transaction via set_config + format(%L).
    await pool.query(`ALTER ROLE app_runtime WITH LOGIN`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.provision_runtime_password', $1, true)`, [password]);
      await client.query(`
        DO $$
        DECLARE
          pw text := current_setting('app.provision_runtime_password', true);
        BEGIN
          IF pw IS NULL OR pw = '' THEN
            RAISE EXCEPTION 'runtime password not set in transaction';
          END IF;
          EXECUTE format('ALTER ROLE app_runtime PASSWORD %L', pw);
        END
        $$;
      `);
      await client.query('COMMIT');
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* ignore */
      }
      throw err;
    } finally {
      client.release();
    }
    // Hosted Supabase may deny ALTER of NOSUPERUSER/NOBYPASSRLS flags after create;
    // assert the role already matches the required security posture.
    const { rows } = await pool.query(
      `SELECT rolname, rolsuper, rolbypassrls, rolcanlogin
       FROM pg_roles WHERE rolname = 'app_runtime'`,
    );
    if (!rows[0] || rows[0].rolsuper || rows[0].rolbypassrls || !rows[0].rolcanlogin) {
      throw new Error('app_runtime role attributes invalid after provision');
    }
  } finally {
    await pool.end();
  }

  const cwd = process.cwd();
  if (generated || !process.env.APP_RUNTIME_DB_PASSWORD) {
    appendOrReplaceEnvLocal('APP_RUNTIME_DB_PASSWORD', password, cwd);
  }

  // Construct DATABASE_URL when host pieces are available (from Connect / existing migration host).
  const runtimeUser = process.env.APP_RUNTIME_DB_USER ?? roleName;
  const runtimeHost = process.env.APP_RUNTIME_DB_HOST;
  const runtimePort = process.env.APP_RUNTIME_DB_PORT;
  const runtimeDb = process.env.APP_RUNTIME_DB_NAME;
  const runtimeSearch = process.env.APP_RUNTIME_DB_PARAMS; // e.g. sslmode=require

  let databaseUrlWritten = false;
  if (runtimeHost && runtimePort && runtimeDb) {
    const databaseUrl = buildDatabaseUrl({
      user: runtimeUser,
      password,
      host: runtimeHost,
      port: runtimePort,
      database: runtimeDb,
      search: runtimeSearch,
    });
    appendOrReplaceEnvLocal('DATABASE_URL', databaseUrl, cwd);
    databaseUrlWritten = true;
  } else if (process.env.WRITE_DATABASE_URL_FROM_MIGRATION_HOST === 'true') {
    // Local Docker convenience only — same host as migration URL, user app_runtime.
    const u = parsePgUrl(migrationUrl);
    const databaseUrl = buildDatabaseUrl({
      user: runtimeUser,
      password,
      host: u.hostname,
      port: u.port || '5432',
      database: u.pathname.replace(/^\//, '') || 'ai_sales_agent',
      search: u.search.replace(/^\?/, '') || undefined,
    });
    appendOrReplaceEnvLocal('DATABASE_URL', databaseUrl, cwd);
    databaseUrlWritten = true;
  }

  console.log(
    JSON.stringify({
      provisioned: true,
      role: roleName,
      passwordGenerated: generated,
      passwordWrittenToEnvLocal: generated || !process.env.APP_RUNTIME_DB_PASSWORD,
      databaseUrlWrittenToEnvLocal: databaseUrlWritten,
      note: databaseUrlWritten
        ? 'DATABASE_URL updated in .env.local (value not printed)'
        : 'Set APP_RUNTIME_DB_HOST/PORT/NAME (and APP_RUNTIME_DB_USER for pooler) or paste DATABASE_URL from Connect into .env.local',
    }),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : 'provision failed');
  process.exit(1);
});
