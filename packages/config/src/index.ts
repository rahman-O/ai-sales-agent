import { z } from 'zod';

const nodeEnv = z.enum(['development', 'test', 'production']);

/** Public / browser-safe fragment (Next.js). */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
});

/** Server env for NestJS API / worker. Never includes MIGRATION_DATABASE_URL. */
export const serverEnvSchema = z.object({
  NODE_ENV: nodeEnv.default('development'),
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
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type MigrationEnv = z.infer<typeof migrationEnvSchema>;

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
