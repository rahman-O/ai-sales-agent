# Phase 00 — Technical readiness report

Report date: 2026-09-23. Technical status: **READY_FOR_P01**.

This report is **TECHNICAL READINESS** evidence only. It is not pilot readiness, production readiness, WhatsApp readiness, or privacy approval for real customer data.

## 1. Recovery assessment

Interrupted Phase 00 work left a disposable spike at `spikes/database-compatibility/`. Workspace truth at continuation start:

- Spike files (Compose, custom SQL migration, tests, auth-boundary) intact.
- Pin had been partially moved to Prisma **6.19.3** mid-advisory investigation; `prisma.config.ts` was missing; orphan Prisma 7 `generated/client` remained (gitignored).
- Docker `ai-sales-agent-compat-postgres` was healthy (tmpfs — ephemeral).
- No secrets in tracked files; `.env.example` uses disposable local passwords only.
- Roadmap docs still claimed the spike was not executed.

Continuation actions: reproduced **12/12 PASS** on 6.19.3; classified advisories; restored and re-proved **Prisma 7.10.0** (preferred after analysis); did not recreate the spike or discard custom SQL/tests.

## 2. Development Profile v0.1

| Field | Value |
|-------|-------|
| Target | Iraq |
| Initial vertical | Dental clinics |
| Scope | Reception + sales assistance + lead qualification + booking |
| Clinical workflows | EXCLUDED |
| Development data | SYNTHETIC ONLY |
| Architecture | Modular monolith |
| Backend | NestJS + TypeScript |
| Frontend | Next.js + TypeScript |
| Database | PostgreSQL / Supabase |
| ORM | Prisma **7.10.0** (spike-validated) |
| Auth | Supabase Auth, subject to validated boundary |
| Vector | pgvector |
| Async | Redis + BullMQ |
| AI | Provider abstraction |
| Early messaging | FakeMessagingChannel / simulator |
| WhatsApp | Phase 08 |
| Booking | Internal booking engine as development/MVP assumption; revalidate with first real clinic |

## 3. Exact tested environment

| Component | Version |
|-----------|---------|
| Node.js | v24.14.0 |
| npm | 11.9.0 |
| PostgreSQL | 17.11 (`pgvector/pgvector:pg17`) |
| pgvector extension | 0.8.6 |
| btree_gist | 1.7 |
| Prisma CLI | 7.10.0 |
| @prisma/client | 7.10.0 |
| @prisma/adapter-pg | 7.10.0 |
| pg | 8.16.3 |
| Connection mode | Local Docker; runtime role `app_runtime`; migrate via `DIRECT_URL` (owner); client via `PrismaPg` pool `max: 1` |

Also reproduced earlier on Prisma **6.19.3** / `prisma-client-js` (12/12 PASS) before restoring 7.10.0.

## 4. Database test matrix

| # | Check | Result |
|---|-------|--------|
| 1 | PostgreSQL and Prisma connectivity | PASS |
| 2 | Extensions enabled (vector, btree_gist) | PASS |
| 3 | Runtime role non-owner / no BYPASSRLS | PASS |
| 4 | Missing tenant context denies rows | PASS |
| 5 | Tenant A cannot read or guess Tenant B | PASS |
| 6 | Tenant A cannot update or delete Tenant B | PASS |
| 7 | Connection reuse does not leak tenant context | PASS |
| 8 | Composite tenant FK rejects cross-tenant staff | PASS |
| 9 | pgvector insert + tenant-scoped similarity | PASS |
| 10 | Transaction rollback (resource + audit + outbox) | PASS |
| 11 | Concurrent overlapping bookings → exactly one commit | PASS |
| 12 | Adjacent half-open booking succeeds | PASS |

Auth-boundary local asserts: 4/4 design checks PASS (not provider integration).

## 5. Exact PASS / FAIL / BLOCKED counts

| Suite | PASS | FAIL | BLOCKED |
|-------|------|------|---------|
| Database compatibility (`npm test`) | 12 | 0 | 0 |
| Auth architecture design (`auth-boundary.test.mjs`) | 4 | 0 | 0 |
| Auth provider integration (Supabase live) | 0 | 0 | BLOCKED_EXTERNAL_ACCESS |
| Supabase-hosted Postgres / transaction pooler | 0 | 0 | BLOCKED_EXTERNAL_ACCESS |

## 6. RLS evidence

Custom migration enables and **FORCE**s RLS on tenant tables; policies `USING`/`WITH CHECK` against `current_tenant_id()` from transaction-local `app.current_organization_id`. Runtime role lacks `BYPASSRLS`. Missing context yields empty reads. Cross-tenant update/delete counts stay 0; admin verifies B row unchanged.

## 7. Tenant isolation evidence

Transaction wrapper sets `set_config(..., true)` then queries. Tenant A sees only A resources; `findUnique` on B id returns null. Composite FK `booking_staff_tenant_fk` rejects booking in org B referencing staff from org A (`23503`).

## 8. Connection reuse evidence

Pool `max: 1`. After tenant A transaction commits, unscoped `findMany` returns 0 rows. Same for B. Transaction-local config does not leak across requests on the reused connection.

## 9. pgvector evidence

Extension present. Insert via `$executeRaw` with `vector(3)`; tenant-scoped `<->` similarity returns only tenant A label; B row inserted by admin is invisible under A context. Schema models embedding as `Unsupported("vector(3)")`.

## 10. Booking concurrency evidence

Constraint: partial GiST exclusion `booking_no_confirmed_overlap` on `(organization_id, staff_id, tstzrange(start_at, end_at, '[)'))` where `status = 'CONFIRMED'`.

Test: `Promise.allSettled([insert(), insert()])` for identical overlapping windows — **genuine concurrent attempts**, not sequential checks. Exactly one fulfills; one rejects; count remains 1. Adjacent half-open range `[11:00,12:00)` after `[10:00,11:00)` succeeds.

Expected application behavior later: map exclusion/unique violation to conflict response; retry only with a new non-overlapping slot; CANCELLED rows must not block when excluded by the partial predicate; reschedule = cancel/replace or update under same constraint.

## 11. Prisma / custom migration findings

Prisma-generated migrations alone **cannot** represent: `CREATE ROLE`, FORCE RLS, policies, `btree_gist` exclusion constraints, or first-class `vector` columns with operators. **Custom/raw SQL migrations are required** for the intended architecture. Spike keeps reviewed SQL under `prisma/migrations/202609230001_compatibility/migration.sql` and uses Prisma Client for ORM paths plus `$executeRaw`/`$queryRaw` for vectors and `set_config`.

Prisma 7 requires `prisma.config.ts` for CLI datasource URL and `@prisma/adapter-pg` for client connections.

## 12. Dependency security audit findings

### On Prisma 7.10.0 (selected)

`npm audit`: **4 high** (no critical).

| Package | Direct? | Path | Advisory | Role |
|---------|---------|------|----------|------|
| `deepmerge-ts` `<8.0.0` | transitive | `prisma` → `@prisma/config` → `deepmerge-ts` | GHSA-ggr8-5vv4-36mx (stack exhaustion on recursive graphs) | Prisma **CLI config** tooling |
| `mysql2` `<=3.23.0` | transitive | `prisma` → `mysql2` | GHSA-3f6p-5ww8-9rcr / GHSA-rgwj-5xj2-c3m3 (and related) | Prisma CLI **MySQL** driver bundle; unused by this PostgreSQL spike |

**VULNERABILITY EXISTS IN DEPENDENCY TREE:** yes (CLI transitive).

**VULNERABILITY IS RELEVANT TO PRODUCTION RUNTIME:** **no** for the NestJS deploy model that ships `@prisma/client` + `@prisma/adapter-pg` + `pg` and does not expose Prisma CLI config merge or MySQL driver to attacker-controlled recursive graphs / MySQL traffic. Residual risk: keep CLI off production app containers or isolate migrate jobs; monitor Prisma releases that bump `deepmerge-ts` ≥ 8.0.0.

On Prisma 6.19.3 the same `deepmerge-ts` chain remained (3 high). Downgrade does **not** clear the class. Did **not** run `npm audit fix --force` (would force-break to older Prisma).

## 13. Authentication architecture result

**AUTH_ARCHITECTURE_DESIGN: PASS**

Local `auth-boundary.test.mjs` proves: verified `sub` + non-expired claims required; membership must be ACTIVE for requested org; unauthorized org → FORBIDDEN; expired → UNAUTHENTICATED; revoked membership → FORBIDDEN. Browser-supplied `organizationId` alone never authorizes.

Documented target path: Browser → Next.js → Supabase session → NestJS → verified identity → OrganizationMember → organization authorization.

## 14. Authentication provider integration result

**AUTH_PROVIDER_INTEGRATION: BLOCKED_EXTERNAL_ACCESS**

No Supabase project credentials. Not proved: live JWT/JWKS validation, refresh, logout, revocation, MFA. This is an **explicit P01 implementation acceptance gate**, not a reason to block scaffolding of the modular monolith foundation.

## 15. Background-job tenant strategy

Future BullMQ invariant (not implemented in this spike):

- Every tenant-owned job payload carries explicit `organizationId` (plus record ids).
- Workers open a new DB transaction and `set_config` tenant context **per job**; never rely on connection state left by another request/job.
- Retries / duplicates re-resolve ownership from durable rows under that organization.

Future deterministic tests: tenant A job; tenant B job; connection reuse across jobs; retry; duplicate execution; failed job; assert no cross-tenant leakage.

## 16. ADR changes

| ADR | Prior | Now | Basis |
|-----|-------|-----|-------|
| ADR-002 PostgreSQL | PROPOSED | **ACCEPTED** | Spike PG 17 + constraints + RLS |
| ADR-003 pgvector | PROPOSED | **ACCEPTED** | Extension + tenant-scoped query (RAG quality still P05) |
| ADR-008 tenant isolation / RLS | PROPOSED | **ACCEPTED** | FORCE RLS + composite FK + connection reuse |
| ADR-005 backend tools | ACCEPTED | ACCEPTED | Unchanged |
| ADR-009 internal booking | PROPOSED | PROPOSED | Engine primitive proved; **Q02 clinic authority** still open |
| ADR-001/004/006/007/010 | PROPOSED | PROPOSED | No new executable product/provider proof |

No SUPERSEDED ADRs.

## 17. Remaining technical risks

- Supabase Auth + hosted Postgres / pooler behavior not exercised.
- Prisma CLI transitive advisories remain until upstream bumps.
- Internal booking assumes clinic adopts platform as SoT (Q02).
- BullMQ/Redis not spike-tested.
- Production NestJS module structure not scaffolded yet (P01).

## 18. Deferred pilot blockers

Remain visible; **do not** automatically block P01:

| Item | Gate |
|------|------|
| Real clinic interview / baseline metrics | P14 / product |
| Meta Business access / WhatsApp test number / credentials | P08 |
| Production consent wording / privacy approval | PRODUCTION / privacy |
| Pilot staffing / rollout authority / clinic operational approval | P14 |
| Booking authority interview (Q02) | P07 (revalidate) / product |

## 19. Exact P01 gate assessment

**READY_FOR_P01**

Sufficient executable evidence that the selected foundation (PostgreSQL 17, Prisma 7.10.0 + adapter-pg, custom SQL for RLS/exclusion/pgvector, auth architecture invariant) can safely begin Phase 01 scaffolding.

Does **not** authorize live WhatsApp, real patient data, or pilot launch.
