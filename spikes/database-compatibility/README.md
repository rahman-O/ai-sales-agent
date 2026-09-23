# Disposable database compatibility spike

This directory proves Phase 00 assumptions only. It is not the production schema, not a reusable application foundation, and not Phase 01. All rows are synthetic. The Docker database and generated client can be deleted and recreated at any time.

Pinned validation stack: Node.js 24.14.0, Prisma CLI/Client **7.10.0**, `@prisma/adapter-pg` 7.10.0, `pg` 8.16.3, PostgreSQL 17 with pgvector. An interrupted mid-spike pin of Prisma 6.19.3 also passed the suite, but was not kept: the same CLI transitive advisories remain on both lines, so a major downgrade does not improve security posture. Generator is `prisma-client` → `generated/client` (gitignored). Migrations use administrative `DIRECT_URL` via `prisma.config.ts`; tests use non-owner `app_runtime` `DATABASE_URL` through `PrismaPg` with pool `max: 1` to force connection reuse.

## Commands

1. `docker compose up -d`
2. `npm install`
3. set `DIRECT_URL` and `DATABASE_URL` (see `.env.example`)
4. `npm run generate`
5. `npm run migrate`
6. `npm test`
7. `node auth-boundary.test.mjs` (local authorize invariant only)
8. `docker compose down -v`

The commands use only the isolated `ai_sales_agent_compat` database and container declared here. Do not point them at another database. Results are recorded in the Phase 00 technical-readiness report.

## What is proved

- Prisma 7.10.0 connectivity with driver adapter and deployable custom SQL migration workflow.
- `vector` and `btree_gist` extension availability.
- Runtime role is not owner/BYPASSRLS; missing tenant context denies.
- Transaction-local `set_config` scopes reads, writes, updates, deletes, raw ID guesses, and pgvector similarity.
- Reusing one pooled connection does not retain tenant context after commit.
- Composite tenant foreign keys reject cross-tenant relations.
- PostgreSQL exclusion constraint permits only one of two overlapping confirmed bookings and permits adjacent ranges.
- One rollback covers a resource, audit, and outbox write.
- Local authorization design: browser `organizationId` alone never authorizes (verified identity + OrganizationMember).

Supabase-hosted connectivity, Supabase Auth JWT/JWKS/refresh/logout/revocation, and Supabase transaction-pooler behavior are not proved locally. They require project credentials and are tracked as `BLOCKED_EXTERNAL_ACCESS`.
