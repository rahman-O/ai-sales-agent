# MB-15B adversarial and soak acceptance

Generated: 2026-10-02T22:12:08.986Z

Status: **VERIFIED**. Real Meta was not contacted. MB15 remains **NOT_CLOSED**.

| Field | Result |
|---|---|
| CHAOTIC_TOPIC_SWITCH | PASS |
| RAPID_FIRE_FIFO | PASS |
| COMPLEX_MULTI_INTENT | PASS |
| LONG_CONVERSATION_50 | PASS |
| LONG_CONVERSATION_100 | NOT_RUN |
| TOPIC_RESUME_STRESS | PASS |
| CONCURRENT_SLOT_RACE | PASS |
| DELAYED_DUPLICATE_PROVIDER_EVENTS | PASS |
| REDIS_TEMPORARY_FAILURE | PASS |
| DATABASE_TEMPORARY_FAILURE | PASS |
| PROMPT_INJECTION_RESISTANCE | PASS |
| MESSY_LANGUAGE_HANDLING | PASS |
| OUT_OF_SCOPE_CHAT_SAFETY | PASS |
| HANDOFF_PAUSE_SAFETY | PASS |
| KNOWLEDGE_PROMPT_INJECTION | PASS |
| CROSS_TENANT_ADVERSARIAL | PASS |
| BOOKING_LIFECYCLE_CHAOS | PASS |
| SOAK_10_CONVERSATIONS | PASS |
| SOAK_25_CONVERSATIONS | PASS |
| SOAK_50_CONVERSATIONS | PASS |
| MODEL_BUDGET_STABILITY | PASS |
| STUCK_STATE_AUDIT | PASS |
| DATA_INTEGRITY_AUDIT | PASS |
| SECRET_HYGIENE | PASS |
| TOPIC_RESUME_SUCCESS_RATE | 10/10 |
| DOUBLE_BOOKING_PREVENTED | YES |
| WORKER_CRASH_RECOVERY | PASS |
| DEEPSEEK_BUSINESS_FAILURE_RECOVERY | PASS |
| MALFORMED_MODEL_OUTPUT_SAFETY | PASS |
| TOOL_LOOP_GUARD | PASS |
| AVG_MODEL_CALLS | 2 |
| P95_MODEL_CALLS | 2 |
| MAX_MODEL_CALLS | 2 |
| AVG_TOOL_CALLS | 1 |
| P95_TOOL_CALLS | 1 |
| FINALIZATION_RESERVE_USAGE | 0 |
| SAFE_STOP_COUNT | 0 |
| STRUCTURED_REPAIR_COUNT | 0 |
| DEEPSEEK_PROVIDER_FAILURE_COUNT | 0 |
| UNIT_TESTS | PASS |
| INTEGRATION_TESTS | PASS |
| BUILD | PASS |
| PROD_CHECK | PASS |
| NORMALIZED_SCHEMA_DRIFT | NONE |
| MB15A_SIMULATOR_REGRESSION | PASS |
| REAL_DEEPSEEK_AGENT_EXECUTION | PASS |
| SIMULATOR_ACCEPTANCE | VERIFIED |
| MULTI_INTENT_FLOW | PASS |
| FULL_PLATFORM_REGRESSION | PASS |
| NEW_ROOT_CAUSES_FOUND | 16 (14 platform, 2 harness/measurement) |
| FIXES_APPLIED | 16 |
| MIGRATIONS_CREATED | 1: 202610030015_mb15b_expired_outbox_claim_recovery |
| MB-15B ADVERSARIAL & SOAK ACCEPTANCE | PASS |
| MB15B_STATUS | VERIFIED |
| READY_FOR_REAL_META_AFTER_STRESS | YES |
| REAL_META_CREDENTIALS_USED | NO |
| REAL_META_MESSAGES_SENT | NO |
| MB15_STATUS | NOT_CLOSED |
| NEXT_STEP | REAL_META_LIVE_ACCEPTANCE |
| P14_AUTHORIZED | NO |
| FILES_CHANGED | See file inventory below; pre-existing MB-15A changes retained. |

## Measured soak

All inputs and business entities were synthetic; provider/model audit is deepseek/deepseek-chat.

| Concurrent conversations | Elapsed s | p50 response s | p95 response s | Max response s | Completed conversations/s | Peak waiting jobs | Provider failures | Duplicate mutations |
|---|---|---|---|---|---|---|---|---|
| 10 | 31.542 | 27.003 | 31.488 | 31.488 | 0.317 | 121 | 0 | 0 |
| 25 | 61.076 | 58.991 | 59.428 | 61.014 | 0.409 | 186 | 0 | 0 |
| 50 | 117.314 | 115.538 | 117.053 | 117.264 | 0.426 | 559 | 0 | 0 |

Worker-attributed Postgres connections reached 4 against a configured pool maximum of 4. The maximum sampled HTTP health latency was 6 ms. These are health probes; they are not isolated Graph-send timing.

Throughput is completed-conversation throughput over the full stage, including drain time; it is not peak webhook ingress capacity. Waiting jobs include durable wake/outbox/drain jobs, rather than one job per conversation. Each stage ended with waiting/active/delayed queues zero, Redis PONG and simulator health 200. CPU, memory, per-run queue/worker latency, DB connection and pool counters, and health timings remain in the soak artifact.

The 50-turn continuity run passed with mean 16.243 s, p95 15.648 s and max 300.466 s. The maximum includes a provider/queue outlier and must not be read as a normal latency guarantee.

## Root causes and fixes

| Boundary | Applied fix |
|---|---|
| Canonical decision parsing | Strict schema; no promotion of prose, wrappers or untyped decisions. |
| Oldest context window | Tenant-scoped latest 50 messages, returned chronologically through the target. |
| Empty provider output | Existing single structured repair includes empty output; bounded failure stays closed. |
| Explicit ordinal confirmation | Recognize clear selections while rejecting questions, negations and conditionals. |
| Customer refusal classification | Safe customer refusals use canonical final_response; operational safe_stop stays terminal. |
| Webhook path exemption | Use originalUrl with Express wildcard mounting; retain authenticated API limits. |
| Crash replay counters | Restore durable model/tool counts, ordinals and loop fingerprints; restore actual successful booking result. |
| Dispatch crash ambiguity | Commit attempt before provider I/O; ambiguous recovered dispatch becomes UNKNOWN and is not resent. |
| Rapid ingress target ordering | The exact current inbound is the last user message, even after an older reply. |
| Opaque slot-token copying | Server resolves explicitly selected candidate index and validates the original signed token and all original booking checks. |
| Foreign offers catalog reference | Reject missing/foreign catalog IDs before consulting offers. |
| Service versus catalog identity | Expose actual catalogItemId from service discovery/price; prohibit substituting service ID. |
| Expired publication claim | Reclaim expired CLAIMED outbox events; live/published claims remain excluded. |
| Omitted factual detour lookup | One bounded correction requires successful offers/location evidence before finalization; no extra budget. |
| Exhausted test day | Select an unused future canonical open day; preserve old bookings and all assertions. |
| Health timer contamination | Stop the simulator health timer before Redis/other metric collection; rerun staged measurements. |

No assertions, RLS, tool authorization, confirmation, duplicate checks or operational call budgets were weakened. No existing migration was rewritten. The new migration only replaces the existing outbox claim function with expiry recovery; normalized comparison against a fresh replay of all 27 migrations is NONE.

## Evidence

- chaos: [artifact](MB15B-mb15b-chaos-catalog-20261003.json)
- long: [artifact](MB15B-mb15b-long-verified-20261002.json)
- resume: [artifact](MB15B-mb15b-resume-freshday-20261003.json)
- race: [artifact](MB15B-mb15b-race-final-20261002.json)
- events: [artifact](MB15B-mb15b-events-final-20261002.json)
- infrastructure: [artifact](MB15B-mb15b-infrastructure-fixed2-20261002.json)
- mutationCrash: [artifact](MB15B-mb15b-crash-mutation-fixed-20261002.json)
- abuse: [artifact](MB15B-mb15b-abuse-final-20261002.json)
- knowledge: [artifact](MB15B-mb15b-knowledge-final-20261002.json)
- tenant: [artifact](MB15B-mb15b-tenant-final-20261002.json)
- lifecycle: [artifact](MB15B-mb15b-lifecycle-final-20261002.json)
- soak: [artifact](MB15B-mb15b-soak-measured-20261003.json)
- audit: [artifact](MB15B-mb15b-audit-sealed-20261003.json)
- sequences: [artifact](MB15B-mb15b-call-sequences-20261003.json)
- [Complete MB-15A simulator report](MB15-SIMULATOR-ACCEPTANCE-REPORT.md)
- [Normalized schema evidence](MB15B-NORMALIZED-SCHEMA-EVIDENCE.json)
- [Preserved failure index](MB15B-PRESERVED-FAILURES.json)

The infrastructure aggregate retains its original 3/4 failure. Final four-boundary acceptance combines its passing before-tool, after-read and dispatch cases with the separately passing post-mutation regression. The original aggregate is not relabelled.

## Scope and limits

- 100-turn stage was optional and not run.
- Knowledge injection uses real published retrieval and DeepSeek; injected provider failures are explicitly component tests, not live-provider replacements.
- Tenant matrix covers runtime-role RLS, actual tools and actual endpoint-service 404 boundaries; it does not claim forged-JWT HTTP testing.
- Simulator latency is its HTTP health endpoint latency, not isolated Graph-send transport timing. Worker pool measurements use container-attributed Postgres connection activity; checked-out idle clients cannot be distinguished from free idle clients.
- Previous crash baseline reached 11 calls before the durable-budget fix; its retained failure and scoped containment are preserved. The passing code retains five operational calls plus one finalization-only reserve.
- Controlled dispatch crash retains one explained UNKNOWN message with one accepted simulator send; no blind resend. Global UNKNOWN rows also include 18 controlled timeout attempts and 7 explicit simulator ambiguous-message fixtures.
- The wider local demo contains 17 P07 component fixture rows labelled RUNNING. Exact source signature, P07 organization, zero model calls/usage and consumed target ingress identify them; none is claimed as live DeepSeek acceptance. They are preserved and reported separately from operational abandoned runs.

## File inventory

This is the current working-tree inventory, including retained MB-15A work and generated evidence. MB-15B production changes are concentrated in agent-core, agent-adapters, contracts, worker dispatch and API security middleware; tests, harnesses and one outbox migration accompany them.

- env.demo.example
- apps/api/src/common/security.middleware.test.ts
- apps/api/src/common/security.middleware.ts
- apps/api/src/preview/preview.module.ts
- apps/api/src/preview/preview.service.test.ts
- apps/api/src/preview/preview.service.ts
- apps/api/test/integration/phase12-analytics.test.ts
- apps/worker/src/main.ts
- docker-compose.demo.yml
- docs/operations/MB15-SIMULATOR-ACCEPTANCE-REPORT.md
- packages/agent-adapters/src/booking-time.test.ts
- packages/agent-adapters/src/booking-time.ts
- packages/agent-adapters/src/booking-tools.ts
- packages/agent-adapters/src/messaging/outbound-dispatch.ts
- packages/agent-adapters/src/pg-run-store.ts
- packages/agent-adapters/src/run-conversation-agent.ts
- packages/agent-adapters/src/service-search.ts
- packages/agent-adapters/src/tool-executor.ts
- packages/agent-core/src/agent-decision-contract.test.ts
- packages/agent-core/src/context-builder.ts
- packages/agent-core/src/fake-provider.ts
- packages/agent-core/src/index.test.ts
- packages/agent-core/src/openai-compatible.test.ts
- packages/agent-core/src/openai-compatible.ts
- packages/agent-core/src/orchestrator.ts
- packages/agent-core/src/ports.ts
- packages/contracts/src/agent.ts
- scripts/mb15/simulator-acceptance.ts
- scripts/mb15/simulator-probe.ts
- apps/api/test/integration/mb15b-outbox-reclaim.test.ts
- apps/api/test/integration/mb15b-recent-context.test.ts
- docs/operations/MB15A-DEBUGGING-2026-10-02.md
- docs/operations/MB15A-FINAL-RECOVERY.md
- docs/operations/MB15A-HISTORY-RECONCILIATION.json
- docs/operations/MB15A-MULTI-INTENT-AFTER.json
- docs/operations/MB15A-MULTI-INTENT-BEFORE.json
- docs/operations/MB15A-MULTI-INTENT-LATEST.json
- docs/operations/MB15A-NORMALIZED-SCHEMA-EVIDENCE.json
- docs/operations/MB15A-RAW-PRISMA-DIFF.sql
- docs/operations/MB15A-RECOVERY-SIMULATOR-ATTEMPT1.md
- docs/operations/MB15A-RESTORE-DRIFT-SIMULATOR-2026-10-02.md
- docs/operations/MB15A-SCHEMA-DIFF-CLASSIFICATION.json
- docs/operations/MB15A-SCHEMA-GATE.md
- docs/operations/MB15B-ACCEPTANCE-SUMMARY.json
- docs/operations/MB15B-ADVERSARIAL-SOAK-ACCEPTANCE.md
- docs/operations/MB15B-NORMALIZED-SCHEMA-EVIDENCE.json
- docs/operations/MB15B-PRESERVED-FAILURES.json
- docs/operations/MB15B-mb15b-abuse-20261002.json
- docs/operations/MB15B-mb15b-abuse-final-20261002.json
- docs/operations/MB15B-mb15b-abuse-fixed-20261002.json
- docs/operations/MB15B-mb15b-audit-20261003.json
- docs/operations/MB15B-mb15b-audit-complete-20261003.json
- docs/operations/MB15B-mb15b-audit-final-20261003.json
- docs/operations/MB15B-mb15b-audit-report-20261003.json
- docs/operations/MB15B-mb15b-audit-report-final-20261003.json
- docs/operations/MB15B-mb15b-audit-sealed-20261003.json
- docs/operations/MB15B-mb15b-call-sequences-20261003.json
- docs/operations/MB15B-mb15b-chaos-baseline-20261002.json
- docs/operations/MB15B-mb15b-chaos-baseline2-20261002.json
- docs/operations/MB15B-mb15b-chaos-catalog-20261003.json
- docs/operations/MB15B-mb15b-chaos-final-20261002.json
- docs/operations/MB15B-mb15b-chaos-fixed-20261002.json
- docs/operations/MB15B-mb15b-chaos-verified-20261002.json
- docs/operations/MB15B-mb15b-chaos-webhook-fixed-20261002.json
- docs/operations/MB15B-mb15b-crash-containment-20261002.json
- docs/operations/MB15B-mb15b-crash-dispatch-before-20261002.json
- docs/operations/MB15B-mb15b-crash-mutation-fixed-20261002.json
- docs/operations/MB15B-mb15b-crash-read-before-20261002.json
- docs/operations/MB15B-mb15b-crash-read-observed-20261002.json
- docs/operations/MB15B-mb15b-events-20261002.json
- docs/operations/MB15B-mb15b-events-final-20261002.json
- docs/operations/MB15B-mb15b-infrastructure-fixed2-20261002.json
- docs/operations/MB15B-mb15b-knowledge-20261002.json
- docs/operations/MB15B-mb15b-knowledge-final-20261002.json
- docs/operations/MB15B-mb15b-lifecycle-20261002.json
- docs/operations/MB15B-mb15b-lifecycle-final-20261002.json
- docs/operations/MB15B-mb15b-load-20261002.json
- docs/operations/MB15B-mb15b-load-fixed-20261002.json
- docs/operations/MB15B-mb15b-load-webhook-fixed-20261002.json
- docs/operations/MB15B-mb15b-long-baseline-20261002.json
- docs/operations/MB15B-mb15b-long-baseline2-20261002.json
- docs/operations/MB15B-mb15b-long-baseline3-20261002.json
- docs/operations/MB15B-mb15b-long-final-20261002.json
- docs/operations/MB15B-mb15b-long-fixed-20261002.json
- docs/operations/MB15B-mb15b-long-verified-20261002.json
- docs/operations/MB15B-mb15b-race-final-20261002.json
- docs/operations/MB15B-mb15b-resume-complete-20261003.json
- docs/operations/MB15B-mb15b-resume-final-20261003.json
- docs/operations/MB15B-mb15b-resume-fixed-20261002.json
- docs/operations/MB15B-mb15b-resume-freshday-20261003.json
- docs/operations/MB15B-mb15b-resume-strict-20261002.json
- docs/operations/MB15B-mb15b-resume-verified-20261003.json
- docs/operations/MB15B-mb15b-soak-final-20261003.json
- docs/operations/MB15B-mb15b-soak-measured-20261003.json
- docs/operations/MB15B-mb15b-tenant-20261002.json
- docs/operations/MB15B-mb15b-tenant-catalog-before-20261002.json
- docs/operations/MB15B-mb15b-tenant-final-20261002.json
- docs/operations/MB15B-mb15b-worker-pool-20261003.json
- packages/agent-adapters/src/candidate-reference.test.ts
- packages/agent-adapters/src/messaging/dispatch-crash.test.ts
- packages/agent-adapters/src/offers-tenant-reference.test.ts
- packages/agent-adapters/src/recent-conversation-messages.ts
- packages/agent-core/src/mb15b-faults.test.ts
- prisma/migrations/202610030015_mb15b_expired_outbox_claim_recovery/
- scripts/mb15/business-recovery.ts
- scripts/mb15/handoff-recovery.ts
- scripts/mb15/multi-intent-recovery.ts
- scripts/mb15/normalized-schema-drift.ts
- scripts/mb15/reconcile-working-state-history.ts
- scripts/mb15b/
