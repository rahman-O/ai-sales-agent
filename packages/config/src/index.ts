import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';

const nodeEnv = z.enum(['development', 'test', 'production']);
export const appEnvSchema = z.enum(['development', 'test', 'staging', 'production']);
export const dbEnvSchema = z.enum(['local', 'remote_test', 'staging', 'production']);

export type AppEnv = z.infer<typeof appEnvSchema>;
export type DbEnv = z.infer<typeof dbEnvSchema>;

/** Public / browser-safe fragment (Next.js). */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
});

/** Server env for NestJS API / worker. Never includes MIGRATION_DATABASE_URL. */
export const serverEnvSchema = z.object({
  NODE_ENV: nodeEnv.default('development'),
  APP_ENV: appEnvSchema.optional(),
  DB_ENV: dbEnvSchema.optional(),
  APP_URL: z.string().url(),
  API_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_JWT_SECRET: z.string().min(1).optional(),
  ALLOW_DB_SEED: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  /** Global emergency AI disable (all orgs). Org-scoped column remains the primary pilot control. */
  AI_EMERGENCY_DISABLE_ALL: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

/** Prisma CLI / seed privileged tooling only. */
export const migrationEnvSchema = z.object({
  MIGRATION_DATABASE_URL: z.string().min(1),
  SHADOW_DATABASE_URL: z.string().min(1).optional(),
  ALLOW_DB_SEED: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  NODE_ENV: nodeEnv.default('development'),
  APP_ENV: appEnvSchema.optional(),
  DB_ENV: dbEnvSchema.optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type MigrationEnv = z.infer<typeof migrationEnvSchema>;

/**
 * Resolves the effective application environment.
 */
export function resolveAppEnvironment(env: NodeJS.ProcessEnv = process.env): AppEnv {
  if (env.APP_ENV && appEnvSchema.safeParse(env.APP_ENV).success) {
    return env.APP_ENV as AppEnv;
  }
  if (env.NODE_ENV === 'production') return 'production';
  if (env.NODE_ENV === 'test') return 'test';
  return 'development';
}

/**
 * Asserts that the current environment is NOT production before running destructive operations.
 * Throws a fatal error if production is detected.
 */
export function assertNonProduction(commandName: string, env: NodeJS.ProcessEnv = process.env): void {
  const appEnv = resolveAppEnvironment(env);
  const isProd =
    appEnv === 'production' ||
    env.NODE_ENV === 'production' ||
    env.DB_ENV === 'production';

  if (isProd) {
    throw new Error(
      `CRITICAL_SECURITY_GUARD: Refusing destructive command '${commandName}' in production environment (APP_ENV=${appEnv}, NODE_ENV=${env.NODE_ENV}, DB_ENV=${env.DB_ENV}).`,
    );
  }
}

/**
 * Redacts sensitive tokens/passwords for safe logging.
 */
export function redactSecret(secret: string | undefined | null): string {
  if (!secret) return '[EMPTY]';
  if (secret.length <= 6) return '***';
  return `${secret.slice(0, 3)}...${secret.slice(-3)}`;
}

/**
 * Redacts database connection strings removing username/password.
 */
export function redactUrlCredentials(urlString: string | undefined | null): string {
  if (!urlString) return '[EMPTY]';
  try {
    const u = new URL(urlString.replace(/^postgresql:/, 'http:').replace(/^postgres:/, 'http:'));
    const protocol = urlString.startsWith('postgresql') ? 'postgresql:' : urlString.startsWith('postgres') ? 'postgres:' : u.protocol;
    const user = u.username ? '***' : '';
    const pass = u.password ? ':***@' : (user ? '@' : '');
    const auth = user ? `${user}${pass}` : '';
    return `${protocol}//${auth}${u.host}${u.pathname}`;
  } catch {
    return '[REDACTED_URL]';
  }
}

const SENSITIVE_HEADER_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'apikey',
  'supabase-service-role-key',
]);

/**
 * Redacts sensitive headers from a headers object.
 */
export function redactHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADER_KEYS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = value;
    }
  }
  return result;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'secret',
  'token',
  'apikey',
  'key',
  'authorization',
  'database_url',
  'migration_database_url',
  'redis_url',
]);

/**
 * Recursively redacts sensitive keys from log objects.
 */
export function sanitizeLogObject(obj: unknown, depth = 0): unknown {
  if (depth > 5 || obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeLogObject(item, depth + 1));
  }
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('secret') || lowerKey.includes('password')) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogObject(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function parseEnvFile(filePath: string): Record<string, string> {
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

/** Keys never applied from project env files (framework/runtime owns them). */
const ENV_FILE_SKIP_KEYS = new Set(['NODE_ENV']);

/** When DEMO_FORCE_LOCAL_DB=1, do not let .env.local override DB connection targets. */
const DEMO_LOCAL_DB_SKIP_FROM_ENV_LOCAL = new Set([
  'DATABASE_URL',
  'MIGRATION_DATABASE_URL',
  'REDIS_URL',
  'APP_RUNTIME_DB_HOST',
  'APP_RUNTIME_DB_PASSWORD',
  'APP_RUNTIME_DB_USER',
  'APP_RUNTIME_DB_NAME',
  'APP_RUNTIME_DB_PORT',
  'APP_RUNTIME_DB_PARAMS',
  'CONNECTION_MODE',
]);

/**
 * Canonical local env loader: `.env` then `.env.local` (local wins).
 * Never logs secret values. Used by Nest, worker, Prisma config, and scripts.
 * Skips `NODE_ENV` so Next.js / Node tooling can set it per command.
 * PATH B: `DEMO_FORCE_LOCAL_DB=1` keeps Auth from `.env.local` but DB URLs from `.env`/shell.
 */
export function loadLocalEnv(cwd: string = process.cwd()): void {
  const fromEnv = parseEnvFile(path.join(cwd, '.env'));
  const fromLocal = parseEnvFile(path.join(cwd, '.env.local'));
  const forceLocalDb = process.env.DEMO_FORCE_LOCAL_DB === '1';
  for (const [key, value] of Object.entries(fromEnv)) {
    if (ENV_FILE_SKIP_KEYS.has(key)) continue;
    if (process.env[key] === undefined) process.env[key] = value;
  }
  for (const [key, value] of Object.entries(fromLocal)) {
    if (ENV_FILE_SKIP_KEYS.has(key)) continue;
    if (forceLocalDb && DEMO_LOCAL_DB_SKIP_FROM_ENV_LOCAL.has(key)) continue;
    process.env[key] = value;
  }
}

export function countEnvLocalKey(key: string, cwd: string = process.cwd()): number {
  const filePath = path.join(cwd, '.env.local');
  if (!fs.existsSync(filePath)) return 0;
  const text = fs.readFileSync(filePath, 'utf8');
  const re = new RegExp(`^${key}=`, 'gm');
  return [...text.matchAll(re)].length;
}

export function loadServerEnv(env: NodeJS.ProcessEnv = process.env): ServerEnv {
  // Nest must never fall back to migration credentials.
  const { MIGRATION_DATABASE_URL: _ignore, ...rest } = env;
  const parsed = serverEnvSchema.safeParse(rest);
  if (!parsed.success) {
    throw new Error(`Invalid server configuration: ${parsed.error.message}`);
  }
  if (parsed.data.DATABASE_URL === _ignore) {
    throw new Error('DATABASE_URL must not equal MIGRATION_DATABASE_URL');
  }
  return parsed.data;
}

export function loadPublicEnv(env: NodeJS.ProcessEnv = process.env): PublicEnv {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_API_URL: env.NEXT_PUBLIC_API_URL ?? env.API_URL,
  });
  if (!parsed.success) {
    throw new Error(`Invalid public configuration: ${parsed.error.message}`);
  }
  return parsed.data;
}

export function loadMigrationEnv(env: NodeJS.ProcessEnv = process.env): MigrationEnv {
  const parsed = migrationEnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid migration configuration: ${parsed.error.message}`);
  }
  return parsed.data;
}

export function supabaseJwksUrl(supabaseUrl: string): string {
  return new URL('/auth/v1/.well-known/jwks.json', supabaseUrl).toString();
}

export function supabaseIssuer(supabaseUrl: string): string {
  return new URL('/auth/v1', supabaseUrl).toString();
}
