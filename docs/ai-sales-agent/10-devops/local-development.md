# Local development plan

Phase 01 created the workspace. Verified local path:

1. Copy `.env.example` → `.env`
2. Put hosted/real secrets only in `.env.local` (gitignored)
3. `docker compose up -d` (Postgres 17+pgvector on `127.0.0.1:5433`, Redis on `6379`)
4. `npm ci`
5. `npx prisma generate`
6. `npx prisma migrate deploy` (requires `MIGRATION_DATABASE_URL`) — creates `app_runtime` **without** a committed password
7. `WRITE_DATABASE_URL_FROM_MIGRATION_HOST=true npm run db:provision-runtime-role` (sets LOGIN password from `APP_RUNTIME_DB_PASSWORD`)
8. `npm run db:seed` (`ALLOW_DB_SEED=true`)
9. `npm run dev:api` / `npm run dev:web` / `npm run dev:worker`

Use `DATABASE_URL` with role `app_runtime` for the API and integration tests. Never point NestJS at `MIGRATION_DATABASE_URL`.

Environment loading (canonical): `.env` then `.env.local` via `loadLocalEnv()` in `@ai-sales-agent/config` (used by Nest, worker, hosted scripts) and mirrored in `prisma.config.ts` for Prisma CLI. Secrets stay in gitignored `.env.local` only. Do **not** set `NODE_ENV` in those files — Next.js sets it for `next build` / `next start`; `loadLocalEnv` skips `NODE_ENV` if present.

`spikes/database-compatibility/` is disposable Phase 00 evidence on port 55432 — do not confuse it with production Compose.

### Hosted Supabase (Phase 01 closure)

1. Rotate any previously exposed DB password in the dashboard.
2. Configure `.env.local` with Project URL, publishable key, rotated `MIGRATION_DATABASE_URL`, synthetic `SUPABASE_TEST_*`.
3. Copy Connect host/user literally (pooler custom role username may be `app_runtime.<project-ref>`).
4. `npm run db:migrate` → `npm run db:provision-runtime-role` → `npm run test:hosted`
5. Prefer asymmetric Auth signing (ES256/RS256). Leave `SUPABASE_JWT_SECRET` unset for hosted acceptance.
6. Auth URL config: Site URL `http://localhost:3000`, redirect `http://localhost:3000/auth/callback`.

Until `.env.local` is CONFIGURED, `npm run env:classify` / `npm run test:hosted` report **HUMAN ACTION REQUIRED** and hosted gates stay BLOCKED.

### Synthetic Auth user (DEVELOPMENT only)

```bash
npm run auth:provision-test-user
```

Requires `SUPABASE_TEST_ADMIN_KEY` in `.env.local` (never `NEXT_PUBLIC_*` / Nest runtime). Generates `SUPABASE_TEST_PASSWORD` locally. Remove the admin key from `.env.local` after provisioning if unused.

### Phase 03 conversations

After P02 catalog/customers:

- Apply P03 migration (`npx prisma migrate deploy`)
- Worker: `npm run dev:worker` (outbox relay + drain sweeper; uses narrow claim functions — never migration owner)
- Dev inbound (non-production): `POST /v1/organizations/:organizationId/dev/messaging/inbound`
- Inbox shell: `/inbox?organizationId=…`
- Authenticated SSE BFF: `/api/backend/organizations/:organizationId/conversations/events`

See [phase-03-scope-manifest](../14-roadmap/phase-03-scope-manifest.md) and [ADR-011](../12-decisions/ADR-011-privileged-work-claim.md).

Exit evidence for a second engineer: README + this file + `npm run typecheck && npm run test && npm run test:integration`.

### New Device Bootstrap (environment recovery)

Use when cloning onto a new machine against the **existing** hosted DEVELOPMENT project (`cpeelvqtlykxybtwbhex`). Do not create a new Supabase project. Do not start Phase 03.

1. `git clone` → `npm ci` (lockfile only; do not modernize deps).
2. Copy `.env.example` → `.env` for local Docker fakes. Create **gitignored** `.env.local` for hosted secrets.
3. Authenticate Supabase CLI locally (`npx supabase login`), then `npx supabase link --project-ref cpeelvqtlykxybtwbhex`.
4. In `.env.local`, set non-secret URLs:
   - `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` = `https://cpeelvqtlykxybtwbhex.supabase.co`
5. Dashboard → API Keys → copy **Publishable** key into `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (never into chat).
6. Dashboard → Connect → Session Pooler → copy host literally. Migration user: `postgres.cpeelvqtlykxybtwbhex` → `MIGRATION_DATABASE_URL`. Runtime user: `app_runtime.cpeelvqtlykxybtwbhex` (password via `npm run db:provision-runtime-role` using Connect host pieces / `APP_RUNTIME_DB_*`).
7. Synthetic Auth: set temporary `SUPABASE_TEST_ADMIN_KEY`, run `npm run auth:provision-test-user`, then remove the admin key.
8. Leave `SUPABASE_JWT_SECRET` unset for hosted JWKS/ES256.
9. `npm run env:classify` → `npm run test:hosted` → `npm run typecheck` / `lint` / `test` / `test:integration` / `build`.

Never paste database passwords, admin keys, or connection strings into chat or commits.
