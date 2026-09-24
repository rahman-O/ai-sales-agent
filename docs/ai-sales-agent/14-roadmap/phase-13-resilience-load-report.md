# P13 RESILIENCE + LOAD VALIDATION REPORT

Date: 2026-09-24. Artifact for Phase 13 closure. **P14_AUTHORIZED: NO**.

## 1. Canonical runtime artifact

| Item | Result |
|---|---|
| Images | `Dockerfile.api` → `asa-api:p13-canonical`; `Dockerfile.worker` → `asa-worker:p13-canonical` |
| Label | `CANONICAL_PILOT_RUNTIME_ARTIFACT=true` |
| In-image | `prisma` / `mysql2` / `deepmerge-ts` **absent** (`npm ls` empty; top-level dirs absent) |
| Prisma client | Generated client present; API artifact includes `apps/api/dist/main.js` |
| Commands | `node scripts/p13/run-image-inspect.mjs`; builds via `docker build -f Dockerfile.{api,worker}` |

## 2. HIGH advisory disposition (final image)

| Advisory chain | Disposition | Evidence |
|---|---|---|
| `prisma` CLI → `@prisma/config` → `deepmerge-ts` (GHSA-ggr8-5vv4-36mx) | **ACCEPTED_WITH_EVIDENCE** | Absent from final images; build-only |
| `prisma` CLI → `mysql2` (GHSA-3f6p-5ww8-9rcr, GHSA-rgwj-5xj2-c3m3) | **ACCEPTED_WITH_EVIDENCE** | Absent from final images; runtime uses `pg` + adapter-pg |
| Direct runtime HIGH | **0** | In-image `npm ls` empty for vulnerable packages |

No CRITICAL unresolved. No KNOWN/TODO/INVESTIGATE leftovers for these HIGHs.

## 3. Exactly-once / ambiguous send

```text
LOGICAL IDEMPOTENCY: PASS
EXTERNAL EXACTLY-ONCE: NOT_GUARANTEED_BY_PROVIDER_PROTOCOL
AMBIGUOUS SEND SAFETY: PASS
```

Crash/provider matrices: `apps/api/src/common/phase13-fault-matrix.test.ts`. Outbound path maps `AMBIGUOUS_DISPATCH` → `delivery_state=UNKNOWN` without blind resend (`packages/agent-adapters` messaging tests).

## 4. Redis

```text
REDIS_STARTUP_POLICY: REQUIRED
REDIS_RUNTIME_LOSS_POLICY: API_READY_FAILS_WORKER_WAKE_PAUSED_DB_TRUTH_RETAINS
```

A/B/C encoded in fault matrix tests. DB-durable Message/FollowUp/Booking/OutboxEvent retained on Redis loss (architecture + ready gate).

## 5. AI emergency kill switch

```text
AI EMERGENCY KILL SWITCH: PASS
```

Org columns + API disable/enable (backlog fence) + global env + worker/pg-run-store gates. Unit: `packages/agent-adapters/src/ai-emergency-kill.test.ts`.

## 6. Load dataset + mixed load

Locked profile: `scripts/p13/load-dataset-lock.ts` (tags: MEASURED_CONFIG / EXISTING_PROPOSED_ENVELOPE / PILOT_ASSUMPTION).

```text
orgs=5 conversations_total=50
api_pool_max=2 worker_pool_max=4 combined_theoretical=6
hosted_session_pooler_constraint=15 (PILOT_ASSUMPTION — not raised to pass)
```

Baseline (mocked providers): `npm run p13:mixed-load -- --mode=baseline --seconds=3` → concurrency logical exact-one winners PASS; cascadeFailObserved=false; `SLO_STATUS=MEASURED_BASELINE` (full 30-minute envelope SLO deferred / not silently proven).

## 7. Observability drills

Five drills PASS structure proof (`phase13-observability-drills.test.ts`).

## 8. Backup / restore

```text
BACKUP_CAPABILITY: UNVERIFIED_EXTERNAL_DEPENDENCY
RESTORE_DRILL: NOT_POSSIBLE_WITH_CURRENT_PLAN
```

## 9. Gate summary

```text
TECHNICALLY_READY_FOR_P14: YES
P14_AUTHORIZED: NO
```

Pilot deployment **must** use the same multi-stage image shape labeled `CANONICAL_PILOT_RUNTIME_ARTIFACT`.
