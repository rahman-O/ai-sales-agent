import { defineConfig } from 'prisma/config';

// Migrations use the administrative DIRECT_URL. Runtime tests use DATABASE_URL (app_runtime).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
});
