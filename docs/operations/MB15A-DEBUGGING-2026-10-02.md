# MB-15A debugging continuation — 2026-10-02

The running `ai-sales-demo-worker` was preserved. No container restart or real Meta request was made. No DeepSeek key was printed.

Worker verification: `AI_PROVIDER=deepseek`, `DEEPSEEK_API_KEY_CONFIGURED=false`. This was checked through Docker exec, the active processes' non-secret environment fields, and the same `loadLocalEnv()` loader used at worker startup. This differs from the handoff; new real DeepSeek acceptance is blocked until credentials are restored securely.

## Contract and fixes

Canonical AgentDecision objects must pass the strict schema without dropping unknown fields. Existing compatibility extraction for noncanonical wrappers remains. A provider that returns non-JSON prose receives one bounded structured-output retry and then fails closed with `unparseable_provider_json`.

After a committed booking, a schema-valid, safe acknowledgement may contain no booking success claim. The added mandatory-claim guard was removed. Invalid structured finalization still repairs once and falls back to authoritative backend evidence, without repeating the mutation. Existing mutation-count tests verify this.

The acceptance harness now queries the worker configuration safely and requires a completed target run with positive model calls and a matching `usage_events` DeepSeek provider/model audit. It no longer relies on host credentials or AgentConfig.model_profile. Conversation joins were tightened to prevent unrelated outbound messages from supplying evidence. Booking mode uses actual usage audit; the request uses a future Baghdad date. Preflight runs before simulator/channel resets. The report no longer hardcodes VERIFIED.

The analytics integration fixture inserted a lead with now() but queried September 2026. Its creation timestamp is now fixed inside the asserted interval; no assertion was weakened.

## Verification

- Targeted agent contract/provider/orchestrator tests: 70/70 PASS.
- Full unit suite: 319/319 PASS.
- Targeted analytics integration test: PASS.
- Full integration suite: 27/27 PASS.
- FULL_PLATFORM_REGRESSION: PASS (unit, integration, build and demo readiness checks; schema comparison remains an independent unresolved gate).
- Prisma validate and generate: PASS (existing SetNull relation warnings).
- Build: PASS.
- Demo readiness: PASS using app_runtime against local demo PostgreSQL/Redis; no migration-role fallback.
- Acceptance harness standalone TypeScript check: PASS.
- Simulator acceptance: BLOCKED_PRECONDITION before scenario execution; worker DeepSeek key missing.
- Repository MB-15 invariant check: working-state table/migration and inspected foreign keys present.
- Read-only Prisma datasource-to-schema diff: FOUND (exit 2), including defaults, foreign keys and index names. No schema changes applied. These differences require reconciliation against SQL migrations before NONE can be claimed.

MB15_STATUS: NOT_CLOSED
READY_FOR_REAL_META: NO
P14_AUTHORIZED: NO

Next: restore DeepSeek credentials securely, reconcile schema comparison, and rerun simulator acceptance. Real Meta acceptance remains deferred.

## Files touched during this continuation

- packages/agent-core/src/fake-provider.ts (canonical strict-parser contract retained; comment clarified)
- packages/agent-core/src/openai-compatible.ts (fail closed after bounded prose repair)
- packages/agent-core/src/orchestrator.ts (removed prior uncontracted mandatory booking-claim guard; restored baseline)
- packages/agent-core/src/index.test.ts (strict unknown-field regression coverage)
- apps/api/test/integration/phase12-analytics.test.ts (fixed fixture timestamp)
- scripts/mb15/simulator-acceptance.ts (worker/audit evidence, joins, preflight ordering, booking date/mode, report status)
- this report

Other pre-existing preview, compose, and run-store edits were preserved.
