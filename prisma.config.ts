import { defineConfig } from 'prisma/config';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Prisma CLI does not load `.env.local` by itself.
 * Mirror scripts/load-local-env.ts: `.env` then `.env.local` (local wins).
 * Never logs values.
 */
function loadLocalEnvForPrisma(cwd = process.cwd()): void {
  const parse = (file: string): Record<string, string> => {
    const full = path.join(cwd, file);
    if (!fs.existsSync(full)) return {};
    const out: Record<string, string> = {};
    for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[key] = value;
    }
    return out;
  };
  const skip = new Set(['NODE_ENV']);
  for (const [key, value] of Object.entries(parse('.env'))) {
    if (skip.has(key)) continue;
    if (process.env[key] === undefined) process.env[key] = value;
  }
  for (const [key, value] of Object.entries(parse('.env.local'))) {
    if (skip.has(key)) continue;
    process.env[key] = value;
  }
}

loadLocalEnvForPrisma();

/**
 * Prisma CLI uses MIGRATION_DATABASE_URL only (migration owner).
 * NestJS runtime must use DATABASE_URL (app_runtime) — never this config URL.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.MIGRATION_DATABASE_URL!,
  },
});
