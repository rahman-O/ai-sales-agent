import { Pool, type PoolConfig } from 'pg';

/** Strip sslmode so explicit Pool ssl options apply (Supabase pooler DEVELOPMENT). */
export function sanitizeDatabaseUrl(connectionString: string): string {
  return connectionString
    .replace(/[?&]sslmode=[^&]*/gi, '')
    .replace(/[?&]uselibpqcompat=[^&]*/gi, '')
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '')
    .replace(/\?$/, '');
}

export function isHostedSupabaseUrl(connectionString: string): boolean {
  return /supabase\.com|supabase\.co/i.test(connectionString);
}

export function createAppPool(connectionString: string, overrides: PoolConfig = {}): Pool {
  const hosted = isHostedSupabaseUrl(connectionString);
  const { max, ...rest } = overrides;
  return new Pool({
    connectionString: sanitizeDatabaseUrl(connectionString),
    max: max ?? 10,
    connectionTimeoutMillis: 20_000,
    ssl: hosted ? { rejectUnauthorized: false } : undefined,
    ...rest,
  });
}
