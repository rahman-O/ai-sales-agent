# MB-15A continuation result — 2026-10-02

MB-15A RESTORE + DRIFT + SIMULATOR: PARTIAL
DEEPSEEK_KEY_CONFIGURED_IN_WORKER: YES
DEEPSEEK_KEY_PRINTED: YES — accidental credential exposure from the modified example file; sanitized without reprinting. Rotation required.
TARGETED_DEEPSEEK_PROBE: PASS
REAL_DEEPSEEK_AGENT_EXECUTION: PASS
SCHEMA_DIFF_TOTAL: 350 (349 raw operations plus one history checksum mismatch)
TRUE_DRIFT: 1 history mismatch repaired; 0 remaining
INTENTIONAL_SQL_DIFFERENCE: 306
COSMETIC: 43
UNKNOWN: 0
MIGRATIONS_CREATED: NONE
RAW_PRISMA_DIFF: FOUND
NORMALIZED_SCHEMA_DRIFT: NONE
SCHEMA_DRIFT: NONE
UNIT_TESTS: PASS (320/320; baseline 319 plus one contract regression test)
INTEGRATION_TESTS: PASS (27/27)
BUILD: PASS
PROD_CHECK: PASS (local demo environment)
PRISMA_VALIDATE: PASS
PRISMA_GENERATE: PASS
HARNESS_STRICT_TYPECHECK: PASS
FULL_PLATFORM_REGRESSION: PASS
BOOKING_MODEL_MODE: DEEPSEEK
SIMULATOR_ACCEPTANCE: PARTIAL
READY_FOR_REAL_META: NO
REAL_META_CREDENTIALS_USED: NO
REAL_META_MESSAGES_SENT: NO
MB15_STATUS: NOT_CLOSED
NEXT_STEP: Rotate exposed DeepSeek credential and resolve multi-intent budget exhaustion; rerun simulator acceptance before considering real Meta live acceptance.
P14_AUTHORIZED: NO

## Changes and verification

Worker environment was propagated through only the worker. Existing configured TEI embeddings were restored and CPU thread counts bounded to one after a warm-up stall. No alternative agent model was used. AgentDecision prompt guidance now describes the existing claim enum, with safe schema diagnostics and a regression test. Strict parsing and mutation safeguards remain intact.

The probe requires exact ingress/run correlation, audited DeepSeek usage, outbound simulator receipt and persisted provider ID. The acceptance harness checks real provider evidence, successful business tools, actual service fixtures, future open/closed days, zero-slot state and booking idempotency. Failed suites save PARTIAL evidence.

A fresh isolated PostgreSQL migration replay proved runtime schema equivalence, including RLS/FORCE RLS, functions, policies, constraints, grants and role state. Only stale migration checksum metadata was reconciled under exact guards with a before-record saved. No schema migration, reset, db push or business-data repair was performed. The final read-only gate found zero differences. A negative reference-only RLS test proved detection.

The full simulator passed inbound security/idempotency/FIFO, outbound lifecycle, retries/failures, tenant isolation, catalog/offers/policies/knowledge, real booking creation, duplicate confirmation, zero-slot handling and topic switching. Multi-intent exhausted the five-call budget after five successful tools and never produced a final outbound. Later optional/handoff checks were not reached. See MB15-SIMULATOR-ACCEPTANCE-REPORT.md for scenario evidence and the exact failed run.

## Credential incident

A configuration search accidentally displayed a credential in the modified .env.demo.example, contrary to the user's instruction. The example was sanitized; .env.demo.local was not displayed or altered. Treat the exposed credential as compromised and rotate it. No secret value is retained in this report. DEEPSEEK_KEY_PRINTED cannot truthfully be reported as NO.
