/**
 * demo:verify — authenticated API readbacks (requires API + Auth online).
 */
import { requireLocalDemoDb } from './assert-local-demo-db.ts';
import { DEMO_ORG_ID, DEMO_TIMEZONE } from './constants.ts';
import { loadDemoCliEnv } from './load-demo-cli-env.ts';

async function getAccessToken(): Promise<string> {
  const url = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
  const email = (process.env.SUPABASE_TEST_EMAIL ?? '').trim();
  const password = process.env.SUPABASE_TEST_PASSWORD ?? '';
  if (!url || !key || !email || !password) throw new Error('Auth credentials not configured');
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as { access_token?: string };
  if (!res.ok || !body.access_token) throw new Error(`password_grant_failed:${res.status}`);
  return body.access_token;
}

function apiBase() {
  return (process.env.API_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
}

async function api(token: string, method: string, path: string) {
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 120) };
  }
  return { status: res.status, json };
}

function asList(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object' && Array.isArray((json as { items?: unknown[] }).items)) {
    return (json as { items: unknown[] }).items;
  }
  return [];
}

async function main() {
  loadDemoCliEnv();
  requireLocalDemoDb();

  const live = await fetch(`${apiBase()}/health/live`).then((r) => r.status).catch(() => 0);
  if (live !== 200) throw new Error('API_not_ready');

  const token = await getAccessToken();
  const me = await api(token, 'GET', '/v1/auth/me');
  const authPass = me.status === 200;
  console.log(JSON.stringify({ AUTH: authPass ? 'PASS' : 'FAIL' }));

  const org = DEMO_ORG_ID;
  const checks: Array<{ key: string; path: string; ok: (s: number, j: unknown) => boolean }> = [
    {
      key: 'INBOX_READBACK',
      path: `/v1/organizations/${org}/conversations`,
      ok: (s, j) => s < 300 && asList(j).length > 0,
    },
    {
      key: 'LEADS_READBACK',
      path: `/v1/organizations/${org}/leads`,
      ok: (s, j) => s < 300 && asList(j).length > 0,
    },
    {
      key: 'BOOKINGS_READBACK',
      path: `/v1/organizations/${org}/bookings`,
      ok: (s, j) => s < 300 && asList(j).length > 0,
    },
    {
      key: 'SCHEDULE_READBACK',
      path: `/v1/organizations/${org}/schedule/rules`,
      ok: (s, j) => s < 300 && asList(j).length > 0,
    },
    {
      key: 'FOLLOWUPS_READBACK',
      path: `/v1/organizations/${org}/follow-ups`,
      ok: (s, j) => s < 300 && asList(j).length > 0,
    },
    {
      key: 'DASHBOARD_READBACK',
      path: `/v1/organizations/${org}/dashboard`,
      ok: (s, j) => s < 300 && j != null,
    },
  ];

  const day = (d: Date) => d.toISOString().slice(0, 10);
  const analyticsPath = `/v1/organizations/${org}/analytics/overview?from=${encodeURIComponent(day(new Date(Date.now() - 7 * 86400000)))}&to=${encodeURIComponent(day(new Date(Date.now() + 86400000)))}&timezone=${encodeURIComponent(DEMO_TIMEZONE)}`;
  checks.push({
    key: 'ANALYTICS_READBACK',
    path: analyticsPath,
    ok: (s, j) => s < 300 && j != null,
  });

  let fail = !authPass;
  for (const c of checks) {
    const r = await api(token, 'GET', c.path);
    const pass = c.ok(r.status, r.json);
    if (!pass) fail = true;
    console.log(JSON.stringify({ [c.key]: pass ? 'PASS' : 'FAIL', status: r.status }));
  }

  console.log(
    JSON.stringify({
      API_READBACK: fail ? 'FAIL' : 'PASS',
      VISUAL_BROWSER_VERIFICATION: 'NOT_RUN',
    }),
  );
  if (fail) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
