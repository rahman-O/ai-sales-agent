/**
 * Ensure .env.demo.local exists for docker compose demo.
 * Merges placeholders + values from .env.local / .env.demo.session without printing secrets.
 */
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET = path.join(ROOT, '.env.demo.local');

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[t.slice(0, eq).trim()] = v;
  }
  return out;
}

function main() {
  if (fs.existsSync(TARGET)) {
    console.log(JSON.stringify({ env_demo_local: 'EXISTS' }));
    return;
  }
  const local = { ...parseEnvFile(path.join(ROOT, '.env')), ...parseEnvFile(path.join(ROOT, '.env.local')), ...parseEnvFile(path.join(ROOT, '.env.demo.session')) };
  const lines = [
    '# Generated locally — do not commit',
    `POSTGRES_DB=ai_sales_agent`,
    `POSTGRES_USER=postgres`,
    `POSTGRES_PASSWORD=${local.POSTGRES_PASSWORD || 'p01_migrate_only'}`,
    `APP_RUNTIME_DB_PASSWORD=${local.APP_RUNTIME_DB_PASSWORD || 'p01_runtime_only'}`,
    `BOOKING_SLOT_TOKEN_SECRET=${local.BOOKING_SLOT_TOKEN_SECRET || randomBytes(24).toString('hex')}`,
    `SUPABASE_URL=${local.SUPABASE_URL || ''}`,
    `NEXT_PUBLIC_SUPABASE_URL=${local.NEXT_PUBLIC_SUPABASE_URL || local.SUPABASE_URL || ''}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''}`,
    '',
  ];
  fs.writeFileSync(TARGET, lines.join('\n'), { mode: 0o600 });
  console.log(JSON.stringify({ env_demo_local: 'CREATED' }));
}

main();
