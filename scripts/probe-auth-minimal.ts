/**
 * Minimal Auth diagnostic — same loader as test:hosted.
 * Never prints passwords or tokens.
 */
import { loadLocalEnv, countEnvLocalKey } from './load-local-env.ts';

loadLocalEnv();

const EXPECTED_URL = 'https://cpeelvqtlykxybtwbhex.supabase.co';
const EXPECTED_EMAIL = 'phase01-test@example.com';

async function main() {
  const email = (process.env.SUPABASE_TEST_EMAIL ?? '').trim();
  const password = process.env.SUPABASE_TEST_PASSWORD ?? '';
  const url = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

  const emailDupes = countEnvLocalKey('SUPABASE_TEST_EMAIL');
  const passwordDupes = countEnvLocalKey('SUPABASE_TEST_PASSWORD');

  const meta = {
    test_email_configured: Boolean(email),
    password_configured: Boolean(password) && password.length > 0,
    duplicate_effective_env_entries: emailDupes > 1 || passwordDupes > 1,
    email_dupe_count: emailDupes,
    password_dupe_count: passwordDupes,
    email_normalizes_to_expected: email.toLowerCase() === EXPECTED_EMAIL,
    supabase_project_url_matches_expected: url === EXPECTED_URL,
    publishable_key_configured: key.length > 20,
    // New-format publishable keys are project-scoped; we only verify non-example + length.
    publishable_key_safe_project_check:
      key.startsWith('sb_publishable_') && !key.includes('example') ? 'YES' : 'PARTIAL',
  };

  if (!meta.test_email_configured || !meta.password_configured || !meta.email_normalizes_to_expected) {
    console.log(
      JSON.stringify(
        {
          CAN_SUPABASE_AUTHENTICATE_TEST_USER: 'NO',
          AUTH_PROVIDER: 'FAIL',
          REAL_LOGIN: 'FAIL',
          ROOT_FAILURE_LAYER: 'LOCAL_ENV',
          ...meta,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return;
  }

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
  let error_code = 'none';
  let error_message = '';
  let hasAccessToken = false;
  try {
    const body = JSON.parse(text) as {
      access_token?: string;
      error_code?: string;
      error?: string;
      msg?: string;
      message?: string;
    };
    hasAccessToken = Boolean(body.access_token);
    error_code = body.error_code || body.error || 'none';
    error_message = body.msg || body.message || '';
  } catch {
    error_message = 'non_json_body';
  }

  // Drop token from memory ASAP if present — do not retain in output.
  const success = res.ok && hasAccessToken;

  console.log(
    JSON.stringify(
      {
        CAN_SUPABASE_AUTHENTICATE_TEST_USER: success ? 'YES' : 'NO',
        AUTH_PROVIDER: success ? 'PASS' : 'FAIL',
        REAL_LOGIN: success ? 'PASS' : 'FAIL',
        ROOT_FAILURE_LAYER: success ? 'NONE' : 'SUPABASE_AUTH_CREDENTIALS',
        http_status: res.status,
        supabase_auth_error_code: success ? null : error_code,
        supabase_auth_error_message: success ? null : error_message.slice(0, 120),
        ...meta,
      },
      null,
      2,
    ),
  );

  if (!success) process.exitCode = 1;
}

main().catch((e) => {
  console.error(String((e as Error).message));
  process.exit(1);
});
