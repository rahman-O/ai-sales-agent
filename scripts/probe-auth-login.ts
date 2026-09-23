import { loadLocalEnv } from './load-local-env.ts';
import fs from 'node:fs';

loadLocalEnv();

async function main() {
  const email = process.env.SUPABASE_TEST_EMAIL ?? '';
  const password = process.env.SUPABASE_TEST_PASSWORD ?? '';
  const url = process.env.SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  const local = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
  const passwordLineCount = [...local.matchAll(/^SUPABASE_TEST_PASSWORD=/gm)].length;
  const emailLineCount = [...local.matchAll(/^SUPABASE_TEST_EMAIL=/gm)].length;

  const attempts: Array<Record<string, unknown>> = [];

  // Attempt A: password grant with Bearer publishable
  {
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    const text = await res.text();
    let code = 'none';
    let msg = '';
    try {
      const j = JSON.parse(text) as Record<string, string>;
      code = j.error_code || j.error || 'none';
      msg = (j.msg || j.message || '').slice(0, 100);
    } catch {
      msg = 'non_json';
    }
    attempts.push({ name: 'password_grant', status: res.status, code, msg });
  }

  // Attempt B: supabase-js
  {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    attempts.push({
      name: 'supabase_js',
      ok: Boolean(data.session?.access_token),
      hasUser: Boolean(data.user),
      errorCode: error?.code ?? null,
      errorStatus: error?.status ?? null,
      errorMessageKind: (error?.message ?? '').slice(0, 100),
    });
  }

  // Attempt C: user lookup via admin is forbidden — skip.
  // Check GoTrue settings publicly if available
  let signupDisabled: unknown = null;
  try {
    const settings = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
    if (settings.ok) {
      const s = (await settings.json()) as { disable_signup?: boolean; external?: unknown };
      signupDisabled = s.disable_signup ?? null;
    }
  } catch {
    /* ignore */
  }

  console.log(
    JSON.stringify(
      {
        emailExact: email === 'phase01-test@example.com',
        emailLen: email.length,
        passwordLen: password.length,
        passwordHasWhitespace: /\s/.test(password),
        passwordHasCR: password.includes('\r'),
        passwordHasLF: password.includes('\n'),
        passwordQuoted: (password.startsWith('"') && password.endsWith('"')) || (password.startsWith("'") && password.endsWith("'")),
        passwordLineCountInEnvLocal: passwordLineCount,
        emailLineCountInEnvLocal: emailLineCount,
        signupDisabled,
        attempts,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(String((e as Error).message));
  process.exit(1);
});
