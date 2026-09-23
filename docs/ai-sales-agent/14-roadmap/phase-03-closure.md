# Phase 03 closure evidence

Phase ID/name: Phase 03 — Durable conversations

Status: **CLOSED — READY_FOR_P04**

**Do not start Phase 04 in this closure pass** — readiness only.

---

## Environment loading

Canonical: `.env` then `.env.local` via `loadLocalEnv()` (skips `NODE_ENV`). Prisma mirrors the same loader. Web scripts use plain `next build` / `next start` (portable).

Presence (values never printed):

| Variable | Status |
|----------|--------|
| `MIGRATION_DATABASE_URL` | PRESENT — CONFIGURED (Supabase Session Pooler, migration owner) |
| `DATABASE_URL` | PRESENT — CONFIGURED (Supabase Session Pooler, `app_runtime.<project-ref>`) |
| `SUPABASE_TEST_PASSWORD` | PRESENT — CONFIGURED |
| Publishable / `SUPABASE_URL` | CONFIGURED |

Identical migration/runtime URLs: **false**. `hostedReady`: **true**.

---

## Database runtime identity (hosted)

| Check | Result |
|-------|--------|
| Migration `current_user` | `postgres` |
| Runtime `current_user` | `app_runtime` |
| `app_runtime` SUPERUSER | **false** |
| `app_runtime` BYPASSRLS | **false** |
| `DATABASE_RUNTIME_IDENTITY` | **VERIFIED_APP_RUNTIME** |

---

## P03 hosted migration

| Step | Result |
|------|--------|
| `prisma migrate status` | Schema up to date (P01–P03 applied) |
| `prisma migrate deploy` | No pending migrations (P03 previously applied: `202609232100_p03_durable_conversations`) |

Did **not** use `db push`, reset, or `migrate resolve`.

### Schema verification (hosted)

- Tables: `channel_connections`, `conversations`, `messages`, `webhook_receipts`, `consumer_receipts`, `outbound_attempts`
- Outbox extensions: `publication_status`, `publication_attempts`, `claimed_until`, `available_at`
- `customer_identities.channel_connection_id` backfill + composite FK
- FORCE RLS on all P03 tables
- Constraints/indexes/grants present

**P03 HOSTED MIGRATION = PASS**

---

## ADR-011 hosted security proof

| Check | Result |
|-------|--------|
| Claim functions present + SECURITY DEFINER | PASS |
| Fixed `search_path=pg_catalog, public` | PASS |
| PUBLIC EXECUTE revoked | PASS |
| `app_runtime` EXECUTE granted; claim callable | PASS |
| Bare `conversations` without tenant GUC | 0 rows |
| Runtime NOSUPERUSER / NOBYPASSRLS | PASS |

**ADR-011 HOSTED SECURITY = PASS**

---

## Hosted acceptance (`npm run test:hosted`)

| Gate | Result |
|------|--------|
| CONNECTION_MODE | SESSION_POOLER |
| AUTH_SIGNING_MODE | ES256 |
| SUPABASE / MIGRATION / RUNTIME connectivity | PASS |
| HOSTED_PRISMA / PGVECTOR | PASS |
| HOSTED_RLS / TENANT_ISOLATION / TX / REUSE | PASS |
| JWKS_VERIFICATION | PASS |
| REAL_LOGIN / REAL_LOGOUT / REAL_AUTH_FLOW | PASS |
| MEMBERSHIP_AUTHORIZATION | PASS |
| IDEMPOTENCY | PASS |

**HOSTED ACCEPTANCE = PASS**

### Harness fixes applied during closure

1. **DEP0190:** removed `shell: true` from `scripts/provision-supabase-test-user.ts` (probe spawn) and `scripts/hosted-acceptance.ts` (npm build spawn). Fixed argv only.
2. **Auth trust `fetch failed`:** child API `loadLocalEnv()` overwrote `API_URL` (3011→3001). API now honors `PORT`; hosted harness sets `PORT=3011`.
3. **Hosted integration SSL:** `tenant-isolation.test.ts` used raw `pg.Pool`; switched to `createAppPool` (same SSL sanitize as runtime).

---

## P01 / P02 / P03 regression

| Suite | Result |
|-------|--------|
| Hosted `test:hosted` (P01 auth/RLS/idempotency) | PASS |
| Hosted `test:integration` via loaded `.env.local` (P01 tenant + P02 + P03) | PASS 11/11 |
| Local unit `npm test` | PASS |

**PHASE 01 REGRESSION = PASS**  
**PHASE 02 REGRESSION = PASS**  
**PHASE 03 TESTS = PASS**

---

## Quality gates

| Gate | Result |
|------|--------|
| `npm test` | PASS |
| `npm run test:integration` | PASS |
| `npm run test:hosted` | PASS |
| `npm run build` (api + worker + web) | PASS |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| API BUILD | PASS |
| WORKER BUILD | PASS |
| WEB BUILD | PASS (Next.js 16.3.6; `/_global-error` fixed by not loading `NODE_ENV` from env files) |

---

## Web build root cause and fix

- **Root cause:** `NODE_ENV=development` from project env files leaked into `next build`.
- **Fix:** do not set `NODE_ENV` in `.env`/`.env.local`; loaders skip `NODE_ENV`; `"build": "next build"`.

---

## Security review

Hosted ADR-011 proof + hosted RLS/tenant isolation + verified `app_runtime` posture + ES256 JWKS path = **PASS**.

---

## Sign-off

| Gate | Status |
|------|--------|
| HOSTED MIGRATION | PASS |
| HOSTED ACCEPTANCE | PASS |
| APP_RUNTIME | PASS |
| RLS | PASS |
| TENANT ISOLATION | PASS |
| ADR-011 SECURITY PROOF | PASS |
| P01 / P02 / P03 | PASS |
| API / WORKER / WEB BUILD | PASS |
| LINT / TYPECHECK | PASS |
| SECURITY REVIEW | PASS |

**REMAINING BLOCKERS: NONE**  
**PHASE 04 READINESS: YES**

Exact next action: begin Phase 04 only when explicitly authorized (not part of this closure).
