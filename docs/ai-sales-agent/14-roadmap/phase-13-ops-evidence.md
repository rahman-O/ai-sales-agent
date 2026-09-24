# Phase 13 — Ops, security, observability, backup evidence

Date: 2026-09-24. Complements [phase-13-findings-register.md](phase-13-findings-register.md). Does not authorize P14.

## Redis policies (locked)

```text
REDIS_STARTUP_POLICY: REQUIRED
REDIS_RUNTIME_LOSS_POLICY: API_READY_FAILS_WORKER_WAKE_PAUSED_DB_TRUTH_RETAINS
```

Evidence: `apps/api/src/health/health.controller.ts` ready path PINGs Redis; worker constructs ioredis/BullMQ at boot. Degraded-start is not supported. Cases A/B/C encoded in `apps/api/src/common/phase13-fault-matrix.test.ts`.

## Rate / request limits

| Control | Value | Notes |
|---|---|---|
| JSON body | 1mb | `apps/api/src/main.ts` |
| URL-encoded | 16kb | same |
| Read rate | 120 / 60s per auth-or-IP subject | `security.middleware.ts` |
| Mutation rate | 30 / 60s | same |
| Exclusions | `/health/*`, `/v1/webhooks/*` | webhooks use HMAC + receipt dedupe |

Limitation (documented, not FIXED as product change): subject key is `Authorization` header or IP — cross-tenant fairness under a shared egress IP remains imperfect for anonymous clients; authenticated subjects are separated by token string.

## Kill switches

| Switch | Scope | Behavior |
|---|---|---|
| Conversation takeover / `AI_PAUSED` | Conversation | Human inbox; no auto AgentRuns for that conversation |
| Org AI emergency | Organization | `POST /v1/organizations/:id/ai-emergency-disable` — no new AgentRuns; inbound persists; re-enable fences `ai_eligible_after_sequence` |
| Global AI emergency | Process | `AI_EMERGENCY_DISABLE_ALL=true` |
| Follow-up policy | Organization | `followUpEnabled` (outreach only; not AI kill) |
| Channel health | ChannelConnection | `AUTH_FAILED` blocks successful Meta send path |

## Health

- `GET /health/live` — process up
- `GET /health/ready` — Postgres `SELECT 1` + Redis `PING`

## Observability detection drills

See unit export `DETECTION_DRILLS` in `apps/api/src/common/phase13-observability-drills.test.ts` (5 drills: Meta AUTH, Redis outage, worker crash, UNKNOWN outbound, DB pool exhaustion). Each records SIGNAL, LOCATION, CORRELATION ID, SECRET/PII SAFE, OPERATOR ACTION.

## Secret canary

Operators must confirm logs never print `DATABASE_URL`, JWT secrets, Meta tokens, or raw customer phone content in structured worker error strings (safeMessage paths). Automated canary: middleware and health responses contain no credential fields (covered by security middleware tests + health controller shape).

## Graceful shutdown

Worker accepts SIGTERM with 30s drain (`apps/worker/src/main.ts`). API uses Nest `enableShutdownHooks()`.

## Backup / restore evidence levels

```text
BACKUP_CAPABILITY: UNVERIFIED_EXTERNAL_DEPENDENCY
RESTORE_DRILL: NOT_POSSIBLE_WITH_CURRENT_PLAN
```

Rationale: hosted Supabase project backup plan, PITR window, and restore UI were not accessible to this closure run with operator-visible evidence. No guessing. If restore becomes available, validate as **`app_runtime`** (FORCE RLS, tenant isolation, SECURITY DEFINER grants, migrations, key data, app smoke) — rows-only admin restore is insufficient.

## Migration spot-check

P13 migrations in tree:

- `202609240700_p13_security_definer_grants` — revoke PUBLIC/app_runtime on `rls_auto_enable()`
- `202609241800_p13_ai_emergency_kill` — org emergency AI columns
