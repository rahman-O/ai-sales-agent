/**
 * Loads `.env` then `.env.local` into process.env without printing values.
 * `.env.local` always wins for keys it defines (including over inherited shell env).
 * Never logs secret contents. Skips `NODE_ENV` (framework/runtime owns it).
 *
 * Keep in sync with `loadLocalEnv` in `@ai-sales-agent/config`.
 */
import fs from 'node:fs';
import path from 'node:path';

const ENV_FILE_SKIP_KEYS = new Set(['NODE_ENV']);

function parseFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
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
}

export function loadLocalEnv(cwd: string = process.cwd()): void {
  const fromEnv = parseFile(path.join(cwd, '.env'));
  const fromLocal = parseFile(path.join(cwd, '.env.local'));

  for (const [key, value] of Object.entries(fromEnv)) {
    if (ENV_FILE_SKIP_KEYS.has(key)) continue;
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  for (const [key, value] of Object.entries(fromLocal)) {
    if (ENV_FILE_SKIP_KEYS.has(key)) continue;
    process.env[key] = value;
  }
}

/** Count duplicate keys in .env.local without reading values into logs. */
export function countEnvLocalKey(key: string, cwd: string = process.cwd()): number {
  const filePath = path.join(cwd, '.env.local');
  if (!fs.existsSync(filePath)) return 0;
  const text = fs.readFileSync(filePath, 'utf8');
  const re = new RegExp(`^${key}=`, 'gm');
  return [...text.matchAll(re)].length;
}
