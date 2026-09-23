# AI Sales Agent

Modular monolith foundation for a dental-clinic reception / sales / booking assistant (Iraq). Clinical workflows are excluded. Development data is synthetic only.

## Status

Phase 00 technical readiness: **READY_FOR_P01**  
Phase 01: see [`docs/ai-sales-agent/14-roadmap/phase-01-closure.md`](docs/ai-sales-agent/14-roadmap/phase-01-closure.md)

## Stack (pinned)

- Node 24+
- NestJS 11 (API + worker entry)
- Next.js **16.3.6**
- Prisma **7.10.0** + `@prisma/adapter-pg` + `pg` 8.16.3
- PostgreSQL 17 + pgvector (local Docker)
- Redis 7 (BullMQ connection foundation)
- Supabase Auth (JWKS); hosted Supabase DB/Auth may be `BLOCKED_EXTERNAL_ACCESS` until credentials exist

## Workspace

```text
apps/api      NestJS HTTP API
apps/web      Next.js staff shell (SSR session)
apps/worker   Nest/BullMQ connection foundation
packages/config
packages/contracts
prisma/       production schema + custom RLS SQL
spikes/       disposable Phase 00 evidence (not production)
```

## Local setup

1. Copy `.env.example` → `.env` (local Docker fake values). Put real Supabase secrets only in **`.env.local`** (never chat, never Git).
2. `docker compose up -d`
3. `npm ci`
4. `npx prisma generate`
5. `npx prisma migrate deploy`  (uses `MIGRATION_DATABASE_URL`)
6. `WRITE_DATABASE_URL_FROM_MIGRATION_HOST=true npm run db:provision-runtime-role`  (sets `app_runtime` LOGIN outside migrations)
7. `npm run db:seed`            (requires `ALLOW_DB_SEED=true`)
8. `npm run dev:api` / `npm run dev:web` / `npm run dev:worker`

### Database identities

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | NestJS + integration tests (`app_runtime`, no BYPASSRLS) |
| `MIGRATION_DATABASE_URL` | Prisma CLI / seed / provision only |
| `APP_RUNTIME_DB_PASSWORD` | Runtime LOGIN secret — never stored in migration SQL |

NestJS must never load `MIGRATION_DATABASE_URL`.

### Auth boundary

- Next.js owns Supabase SSR login/logout cookies (`proxy.ts`) + `/auth/callback`.
- NestJS verifies **Bearer** access tokens via JWKS (prefer ES256/RS256). `SUPABASE_JWT_SECRET` is local HS256 fallback only — not hosted acceptance.
- Authorization = verified `sub` → `User.authSubject` → ACTIVE `OrganizationMember` → `runInTenantContext` → RLS.
- Hosted Site URL / redirect allow-list must include `http://localhost:3000` and `http://localhost:3000/auth/callback`.

Browser must not use Supabase Data API for tenant tables.

## Scripts

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run test:integration   # must use DATABASE_URL=app_runtime
npm run env:classify       # classifications only — never prints secrets
npm run test:hosted        # hosted gates; BLOCKED when .env.local incomplete
npm run db:migrate
npm run db:provision-runtime-role
npm run db:seed
npm run db:reset:test
```

Do **not** add a root `install` script (npm lifecycle).

## Spike

`spikes/database-compatibility/` remains disposable Phase 00 evidence. Do not treat it as the production app.
