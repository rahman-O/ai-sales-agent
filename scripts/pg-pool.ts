import { Pool, type PoolConfig } from 'pg';

/**
 * Hosted Supabase pooler often presents a cert chain Node rejects under
 * sslmode=require→verify-full. Prefer explicit ssl rejectUnauthorized:false
 * for DEVELOPMENT acceptance without printing URLs.
 */
export function createPgPool(connectionString: string, overrides: PoolConfig = {}): Pool {
  let url = connectionString;
  url = url
    .replace(/[?&]sslmode=[^&]*/g, '')
    .replace(/[?&]uselibpqcompat=[^&]*/g, '')
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '');

  const hosted = /supabase\.com|supabase\.co/i.test(connectionString);
  return new Pool({
    connectionString: url,
    max: 1,
    connectionTimeoutMillis: 20_000,
    idleTimeoutMillis: 10_000,
    ssl: hosted ? { rejectUnauthorized: false } : undefined,
    ...overrides,
  });
}
