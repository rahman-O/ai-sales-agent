/**
 * DEVELOPMENT/TEST only — provision synthetic Supabase Auth user via Admin API.
 * Uses SUPABASE_TEST_ADMIN_KEY from .env.local. Never prints secrets.
 * Must never be imported by apps/api, apps/web, or apps/worker runtime.
 */
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadLocalEnv, countEnvLocalKey } from './load-local-env.ts';
import { spawnSync } from 'node:child_process';

const EXPECTED_PROJECT = 'cpeelvqtlykxybtwbhex';
const EXPECTED_EMAIL = 'phase01-test@example.com';
const EXPECTED_URL = `https://${EXPECTED_PROJECT}.supabase.co`;

function refuseProduction() {
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'production') {
    throw new Error('Refusing synthetic Auth provisioning in NODE_ENV=production');
  }
  if (process.env.ALLOW_PRODUCTION_AUTH_PROVISION === 'true') {
    throw new Error('ALLOW_PRODUCTION_AUTH_PROVISION is not supported for this script');
  }
}

function upsertEnvLocal(key: string, value: string, cwd: string): void {
  const file = path.join(cwd, '.env.local');
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const lines = text.split(/\r?\n/);
  const kept: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      kept.push(line);
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq < 0) {
      kept.push(line);
      continue;
    }
    const k = trimmed.slice(0, eq).trim();
    if (k === key) continue; // drop all existing; append one
    kept.push(line);
  }
  while (kept.length && kept[kept.length - 1] === '') kept.pop();
  kept.push(`${key}=${value}`);
  kept.push('');
  fs.writeFileSync(file, kept.join('\n'), { mode: 0o600 });
}

async function main() {
  loadLocalEnv();
  refuseProduction();

  const supabaseUrl = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
  const adminKey = process.env.SUPABASE_TEST_ADMIN_KEY ?? '';
  const email = (process.env.SUPABASE_TEST_EMAIL ?? EXPECTED_EMAIL).trim().toLowerCase();

  if (!supabaseUrl) throw new Error('SUPABASE_URL required');
  if (!adminKey) throw new Error('SUPABASE_TEST_ADMIN_KEY required in .env.local');
  if (email !== EXPECTED_EMAIL) {
    throw new Error(`Refusing: SUPABASE_TEST_EMAIL must be exactly ${EXPECTED_EMAIL}`);
  }
  if (supabaseUrl !== EXPECTED_URL && !supabaseUrl.includes(EXPECTED_PROJECT)) {
    throw new Error('Refusing: SUPABASE_URL does not match DEVELOPMENT project ref');
  }
  if (adminKey.startsWith('sb_publishable_') || adminKey.includes('example')) {
    throw new Error('SUPABASE_TEST_ADMIN_KEY does not look like an admin/server key');
  }

  // Generate password locally — never print.
  const password = randomBytes(24).toString('base64url');
  const cwd = process.cwd();
  upsertEnvLocal('SUPABASE_TEST_PASSWORD', password, cwd);
  upsertEnvLocal('SUPABASE_TEST_EMAIL', EXPECTED_EMAIL, cwd);
  process.env.SUPABASE_TEST_PASSWORD = password;
  process.env.SUPABASE_TEST_EMAIL = EXPECTED_EMAIL;

  if (countEnvLocalKey('SUPABASE_TEST_PASSWORD', cwd) !== 1) {
    throw new Error('Failed to enforce single SUPABASE_TEST_PASSWORD entry');
  }

  const admin = createClient(supabaseUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // List users and find exact email match only.
  let existingId: string | null = null;
  {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw new Error(`admin.listUsers failed: ${error.message}`);
    const matches = (data.users ?? []).filter(
      (u) => (u.email ?? '').toLowerCase() === EXPECTED_EMAIL,
    );
    if (matches.length > 1) {
      throw new Error('Multiple users match synthetic email — refuse destructive reconcile');
    }
    if (matches.length === 1) existingId = matches[0]!.id;
  }

  let action: 'created' | 'updated' | 'recreated' = 'created';
  let userId: string;

  if (existingId) {
    // Prefer update/reset password + confirm (A).
    const { data, error } = await admin.auth.admin.updateUserById(existingId, {
      password,
      email_confirm: true,
      email: EXPECTED_EMAIL,
    });
    if (error) {
      // Fallback B: delete exact synthetic user then recreate.
      const del = await admin.auth.admin.deleteUser(existingId);
      if (del.error) throw new Error(`admin.deleteUser failed: ${del.error.message}`);
      const created = await admin.auth.admin.createUser({
        email: EXPECTED_EMAIL,
        password,
        email_confirm: true,
      });
      if (created.error || !created.data.user) {
        throw new Error(`admin.createUser after delete failed: ${created.error?.message ?? 'no user'}`);
      }
      userId = created.data.user.id;
      action = 'recreated';
    } else {
      if (!data.user) throw new Error('admin.updateUserById returned no user');
      userId = data.user.id;
      action = 'updated';
    }
  } else {
    const created = await admin.auth.admin.createUser({
      email: EXPECTED_EMAIL,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw new Error(`admin.createUser failed: ${created.error?.message ?? 'no user'}`);
    }
    userId = created.data.user.id;
    action = 'created';
  }

  // Clear password from this process memory after env write (probe reloads from file).
  // Keep env for immediate probe in-process though — probe uses process.env.

  console.log(
    JSON.stringify({
      TEST_USER_PROVISIONING: 'PASS',
      action,
      email: EXPECTED_EMAIL,
      userIdPrefix: userId.slice(0, 8),
      passwordWrittenToEnvLocal: true,
      passwordPrinted: false,
      note: 'SUPABASE_TEST_PASSWORD updated in .env.local (value not printed)',
    }),
  );

  // Immediate credential proof via minimal probe (reloads .env.local).
  const probe = spawnSync('npx', ['tsx', 'scripts/probe-auth-minimal.ts'], {
    cwd,
    env: process.env,
    encoding: 'utf8',
    shell: true,
  });
  if (probe.stdout) process.stdout.write(probe.stdout);
  if (probe.stderr) process.stderr.write(probe.stderr);
  if (probe.status !== 0) {
    console.log(JSON.stringify({ DIRECT_AUTH_PROBE: 'FAIL', afterProvision: true }));
    process.exit(probe.status ?? 1);
  }
  console.log(JSON.stringify({ DIRECT_AUTH_PROBE: 'PASS' }));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : 'provision-supabase-test-user failed');
  process.exit(1);
});
