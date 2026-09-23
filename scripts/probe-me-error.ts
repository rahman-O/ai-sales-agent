import { loadLocalEnv } from './load-local-env.ts';
import { spawn, type ChildProcess } from 'node:child_process';

loadLocalEnv();
delete process.env.SUPABASE_JWT_SECRET;

async function main() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const email = process.env.SUPABASE_TEST_EMAIL!;
  const password = process.env.SUPABASE_TEST_PASSWORD!;

  const tokenRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const tokenBody = (await tokenRes.json()) as { access_token?: string };
  if (!tokenBody.access_token) throw new Error(`login failed ${tokenRes.status}`);

  const childEnv = { ...process.env, API_URL: 'http://127.0.0.1:3011' };
  delete childEnv.SUPABASE_JWT_SECRET;
  const apiChild: ChildProcess = spawn('node', ['apps/api/dist/main.js'], {
    cwd: process.cwd(),
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('boot timeout')), 30000);
    let buf = '';
    apiChild.stdout?.on('data', (c: Buffer) => {
      buf += c.toString();
      if (buf.includes('api_listening')) {
        clearTimeout(t);
        resolve();
      }
    });
    apiChild.stderr?.on('data', (c: Buffer) => {
      const s = c.toString();
      if (/api_boot_failed|Error/.test(s)) process.stderr.write(s.slice(0, 400));
    });
    apiChild.on('exit', (code) => reject(new Error(`exit ${code}`)));
  });

  try {
    const me = await fetch('http://127.0.0.1:3011/v1/auth/me', {
      headers: { Authorization: `Bearer ${tokenBody.access_token}` },
    });
    const text = await me.text();
    // Redact any JWT-looking strings
    const safe = text.replace(/[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g, '[REDACTED_JWT]');
    console.log(JSON.stringify({ status: me.status, bodyPreview: safe.slice(0, 500) }));
  } finally {
    apiChild.kill('SIGTERM');
  }
}

main().catch((e) => {
  console.error(String((e as Error).message));
  process.exit(1);
});
