# Phase 04 closure evidence

Phase ID/name: Phase 04 — Bounded agent core and safe tools

Status: **CLOSED — READY_FOR_P05**

**Do not start Phase 05 in this closure pass** — readiness only.

---

## Environment loading

Canonical: `.env` then `.env.local` via `loadLocalEnv()`. Values never printed.

| Variable | Status |
|----------|--------|
| `MIGRATION_DATABASE_URL` | PRESENT — CONFIGURED |
| `DATABASE_URL` | PRESENT — CONFIGURED (`app_runtime`) |
| Supabase / JWKS / test user | CONFIGURED |

Identical migration/runtime URLs: **false**. Hosted ready: **true**.

---

## Database runtime identity (hosted)

| Check | Result |
|-------|--------|
| Runtime `current_user` | `app_runtime` |
| SUPERUSER / BYPASSRLS | **false** / **false** |
| `DATABASE_RUNTIME_IDENTITY` | **VERIFIED_APP_RUNTIME** |

---

## P04 hosted migration

| Step | Result |
|------|--------|
| Migration | `202609232200_p04_agent_core` applied via `prisma migrate deploy` |
| Method | Non-destructive adds only (no `db push`, no reset, no `BYPASSRLS`) |
| Tables | `agent_configs`, `agent_runs`, `tool_calls`, `command_operations`, `usage_events`, `conversation_summaries` |
| RLS | ENABLE + FORCE on all six; `app_runtime` grants; tenant policies |
| Constraints | `run_key` UNIQUE per org; one ACTIVE config per org; `final_outbound_message_id` UNIQUE; operation_key UNIQUE |

**P04 HOSTED MIGRATION = PASS**

---

## Hardening locks verified

| Item | Evidence |
|------|----------|
| Ingress watermark only | `hasNewerInbound` uses `conversations.next_sequence`; timeline advances do not supersede |
| runKey create-or-resume | UNIQUE + terminal replay returns `already_terminal` |
| ActionGate | Fence/epoch/mode/watermark revalidated before mutate |
| Handoff terminal | `HANDOFF_REQUESTED` + epoch bump + `AI_PAUSED`; SYSTEM ack (not CONTROL) |
| Mode/cursor | Non-AI drain holds `processed_sequence` |
| Fake fail-closed | `resolveProductionProvider` returns null without key; prod blocks Fake |
| Sandbox | `POST .../agent/test-run` dry-run; mutate/handoff blocked |
| Module ownership | `packages/agent-core` pure; `packages/agent-adapters` + Nest/worker glue |

---

## Hosted acceptance (`npm run test:hosted`)

All gates PASS including CONNECTION_MODE=SESSION_POOLER, AUTH_SIGNING_MODE=ES256, RLS, tenant isolation, JWKS, real login/logout, membership, idempotency.

**HOSTED ACCEPTANCE = PASS**

---

## P01 / P02 / P03 / P04 regression

| Suite | Result |
|-------|--------|
| `npm test` (unit, incl. agent-core 12) | PASS |
| `npm run test:integration` (12/12 incl. P04 watermark/replay/handoff/RLS) | PASS |
| `npm run test:hosted` | PASS |

**PHASE 01–03 REGRESSION = PASS**  
**PHASE 04 TESTS = PASS**

---

## Quality gates

| Gate | Result |
|------|--------|
| `npm test` | PASS |
| `npm run test:integration` | PASS |
| `npm run test:hosted` | PASS |
| `npm run build` | PASS (config, contracts, agent-core, agent-adapters, api, worker, web) |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |

---

## Deliverables

- `packages/agent-core` — orchestrator, Fake/OpenAI-compatible providers, ContextBuilder, summary CAS, OutputGate
- `packages/agent-adapters` — PgRunStore, ToolExecutor (ActionGate), `runConversationAgent`
- `packages/contracts` — AgentDecision schemas + P04 tool names
- Worker `drainConversation` → agent when `AI_ACTIVE` + ingress backlog
- Nest `AgentModule` — config activate/disable, run traces (redacted), sandbox test-run
- Migration `202609232200_p04_agent_core`
- Eval fixtures under `apps/api/src/agent/`

---

## Security review

FORCE RLS on agent tables; no new broad SECURITY DEFINER; ADR-011 claim functions unchanged; Fake not production fallback; sandbox non-mutating.

**SECURITY REVIEW = PASS**

---

## Sign-off

| Gate | Status |
|------|--------|
| HOSTED MIGRATION | PASS |
| HOSTED ACCEPTANCE | PASS |
| APP_RUNTIME | PASS |
| RLS / TENANT ISOLATION | PASS |
| P01 / P02 / P03 / P04 | PASS |
| API / WORKER / WEB BUILD | PASS |
| LINT / TYPECHECK | PASS |
| SECURITY REVIEW | PASS |

**REMAINING BLOCKERS: NONE**  
**PHASE 05 READINESS: YES**

Exact next action: begin Phase 05 only when explicitly authorized (not part of this closure).

---

## PHASE 04 STATUS

**CLOSED — READY_FOR_P05**
