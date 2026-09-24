import { loadLocalEnv } from '../load-local-env.ts';
import fs from 'node:fs';
import path from 'node:path';

function applyOverlayFile(filePath: string, keys?: Set<string>): void {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    if (keys && !keys.has(key)) continue;
    process.env[key] = t.slice(eq + 1).trim();
  }
}

const DEMO_OVERLAY_KEYS = new Set([
  'DATABASE_URL',
  'MIGRATION_DATABASE_URL',
  'REDIS_URL',
  'DEMO_DB_TARGET',
  'DEMO_FORCE_LOCAL_DB',
  'ZERO_COST_DEMO',
  'AI_ALLOW_FAKE',
  'BOOKING_SLOT_TOKEN_SECRET',
  'ALLOW_DB_SEED',
  'APP_RUNTIME_DB_PASSWORD',
  'POSTGRES_PASSWORD',
  'POSTGRES_USER',
  'POSTGRES_DB',
]);

/** Load .env + .env.local with DEMO_FORCE; overlay .env.demo.session / .env.demo.local for host seed vs compose Postgres. */
export function loadDemoCliEnv(cwd = process.cwd()): void {
  if (process.env.DEMO_DB_TARGET === 'LOCAL') {
    process.env.DEMO_FORCE_LOCAL_DB = '1';
  }
  const sessionPath = path.join(cwd, '.env.demo.session');
  const demoLocalPath = path.join(cwd, '.env.demo.local');
  applyOverlayFile(sessionPath);
  applyOverlayFile(demoLocalPath, DEMO_OVERLAY_KEYS);
  process.env.DEMO_FORCE_LOCAL_DB = process.env.DEMO_FORCE_LOCAL_DB || '1';
  if (!process.env.DEMO_DB_TARGET) process.env.DEMO_DB_TARGET = 'LOCAL';
  loadLocalEnv(cwd);
  // Re-assert demo overlays after .env.local Auth merge (host → published 5433/6380)
  applyOverlayFile(sessionPath, DEMO_OVERLAY_KEYS);
  applyOverlayFile(demoLocalPath, DEMO_OVERLAY_KEYS);
  // When .env.demo.local exists, host seed/reset MUST target published demo ports + those passwords.
  if (fs.existsSync(demoLocalPath)) {
    const runtimePw = process.env.APP_RUNTIME_DB_PASSWORD;
    const migratePw = process.env.POSTGRES_PASSWORD;
    const db = process.env.POSTGRES_DB || 'ai_sales_agent';
    const user = process.env.POSTGRES_USER || 'postgres';
    if (runtimePw) {
      process.env.DATABASE_URL = `postgresql://app_runtime:${runtimePw}@127.0.0.1:5433/${db}`;
    }
    if (migratePw) {
      process.env.MIGRATION_DATABASE_URL = `postgresql://${user}:${migratePw}@127.0.0.1:5433/${db}`;
    }
    process.env.REDIS_URL = 'redis://127.0.0.1:6380';
  }
  process.env.DEMO_FORCE_LOCAL_DB = '1';
  process.env.DEMO_DB_TARGET = 'LOCAL';
  delete process.env.SUPABASE_JWT_SECRET;
}
