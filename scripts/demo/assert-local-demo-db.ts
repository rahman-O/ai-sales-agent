/**
 * Hard safety gate for local demo CLI.
 * Never infer safety from NODE_ENV alone.
 */
export type LocalDemoGateResult =
  | { ok: true; demoDbTarget: 'LOCAL'; databaseHost: string; migrationHost: string }
  | { ok: false; reason: string };

const BLOCKED_HOST_RE = /supabase\.(co|com)|pooler\.supabase\.com/i;
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);

export function parseDbHost(url: string | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const u = new URL(url);
    return (u.hostname || '').toLowerCase();
  } catch {
    return null;
  }
}

export function isApprovedLocalDemoHost(host: string | null): boolean {
  if (!host) return false;
  if (BLOCKED_HOST_RE.test(host)) return false;
  return LOOPBACK.has(host);
}

/**
 * Assert local demo target. Pure (pass env) for tests.
 */
export function assertLocalDemoDb(
  env: NodeJS.ProcessEnv = process.env,
  opts: { requireAllowReset?: boolean } = {},
): LocalDemoGateResult {
  if (env.NODE_ENV === 'production') {
    return { ok: false, reason: 'NODE_ENV_production' };
  }
  const marker = env.DEMO_DB_TARGET === 'LOCAL' || env.DEMO_FORCE_LOCAL_DB === '1';
  if (!marker) {
    return { ok: false, reason: 'DEMO_DB_TARGET_or_DEMO_FORCE_LOCAL_DB_required' };
  }
  if (opts.requireAllowReset && env.ALLOW_DEMO_RESET !== 'true') {
    return { ok: false, reason: 'ALLOW_DEMO_RESET_required' };
  }

  const dbHost = parseDbHost(env.DATABASE_URL);
  const migHost = parseDbHost(env.MIGRATION_DATABASE_URL);
  if (!isApprovedLocalDemoHost(dbHost)) {
    return { ok: false, reason: `DATABASE_URL_not_local_loopback:${dbHost ?? 'missing'}` };
  }
  if (!isApprovedLocalDemoHost(migHost)) {
    return { ok: false, reason: `MIGRATION_DATABASE_URL_not_local_loopback:${migHost ?? 'missing'}` };
  }
  return {
    ok: true,
    demoDbTarget: 'LOCAL',
    databaseHost: dbHost!,
    migrationHost: migHost!,
  };
}

export function requireLocalDemoDb(
  env: NodeJS.ProcessEnv = process.env,
  opts: { requireAllowReset?: boolean } = {},
): asserts env is NodeJS.ProcessEnv {
  const r = assertLocalDemoDb(env, opts);
  if (!r.ok) {
    throw new Error(`demo_safety_gate_failed:${r.reason}`);
  }
  console.log(JSON.stringify({ DEMO_DB_TARGET: 'LOCAL' }));
}
