import { loadLocalEnv } from '@ai-sales-agent/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
process.env.DEMO_FORCE_LOCAL_DB = '1';
loadLocalEnv(root);

const demoLocalPath = path.join(root, '.env.demo.local');
if (fs.existsSync(demoLocalPath)) {
  for (const line of fs.readFileSync(demoLocalPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    process.env[key] = t.slice(eq + 1).trim();
  }
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
}

process.env.APP_URL ??= 'http://localhost:3000';
process.env.API_URL ??= 'http://127.0.0.1:3001';
process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
