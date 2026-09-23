import { defineConfig } from 'prisma/config';

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
