# AI Sales Agent

Multi-tenant, multi-business AI sales and customer operations platform. It combines natural-language conversations with backend-authoritative catalog, offer, policy, lead, booking, follow-up, and human-handoff workflows. The original dental demo remains supported through organization capabilities and configuration; runtime behavior does not branch on business type.

Clinical workflows, payment processing, refund execution, order fulfillment, inventory, and delivery routing are outside the current scope. Development and demo data is synthetic only.

## Status

Phase 00..Phase 13: **CLOSED**  
Pre-P14 Conversation Working State: **CLOSED**  
Multi-Business Platform Roadmap:
- MB-00 Discovery & Baseline Audit: **CLOSED**
- MB-01 Organization Profile + Capabilities: **CLOSED**
- MB-02 Multi-Business Onboarding: **CLOSED**
- MB-03 Dynamic Dashboard Navigation: **CLOSED**
- MB-04 Generic Business Catalog: **CLOSED**
- MB-05 Offers / Promotions: **CLOSED**
- MB-06 Business Policies: **CLOSED**
- MB-07 Conversation Style & Assistant Personality: **NEXT**
- Multi-Business Roadmap: see [`docs/multi-business-platform/ROADMAP.md`](docs/multi-business-platform/ROADMAP.md)

P14: **NOT AUTHORIZED**

## Implemented platform capabilities

- Organization profiles, editable capabilities, and resumable onboarding
- Capability-driven dashboard navigation with protected organization routes
- Generic catalog items: services, products, listings, and packages
- Backend-authoritative offers and deterministic price calculation
- Versioned business policies with effective windows, RLS, and AI retrieval
- Enforced cancellation and rescheduling cutoffs for current booking workflows
- Tenant-scoped customers, leads, bookings, conversations, and follow-ups
- Server-proven slot tokens, booking confirmation, idempotency, and post-booking final-response recovery
- DeepSeek-only production conversation runtime; local providers remain limited to approved demo paths
- Human takeover, ownership fencing, emergency AI disable, audit logs, and outbox events

Policy, catalog, and offer implementation details are documented in [`docs/multi-business-platform/`](docs/multi-business-platform/README.md).

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
packages/agent-core
packages/agent-adapters
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
npm run demo:migrate      # guarded local demo DB migration
npm run demo:reseed       # guarded reset + deterministic demo seed
npm run demo:verify       # authenticated demo API readback
npm run pre-p14:deepseek-probe
npm run pre-p14:valid-slot-e2e
```

The demo database commands load `.env.demo.local`, force `DEMO_DB_TARGET=LOCAL`, and refuse unsafe targets. Use ordinary Prisma migration commands only when the configured target has been reviewed explicitly.

## Verification baseline

The MB-06 closure baseline passed:

- `npx prisma validate`
- `npx prisma generate`
- `npm test`
- `npm run test:integration` — 24/24 integration suites, including catalog, offers, policies, booking, and tenant isolation
- `npm run build`
- `npm run demo:reseed`
- `npm run demo:verify`

Do **not** add a root `install` script (npm lifecycle).

## Spike

`spikes/database-compatibility/` remains disposable Phase 00 evidence. Do not treat it as the production app.
