# Testing strategy

Separate deterministic correctness from probabilistic quality. Domain/authorization/idempotency/state tests gate every commit. Real-model evaluations gate prompt/model releases and pilot readiness, with sample sizes and variability reported. Neither replaces the other.

Suggested implementation tools: a TypeScript unit runner compatible with the selected NestJS release, real PostgreSQL/Redis integration containers, HTTP contract tests, and Playwright for staff journeys. Pin tools during P01 rather than assuming a current version. Fake clock/model/channel adapters make failures reproducible.

Every phase supplies unit, integration, end-to-end and failure evidence. Tests use two tenants with overlapping names/phone numbers and adversarial cross-references. Capture observed database state and emitted events, not just HTTP success. Never test tenant isolation with an owner/superuser role that bypasses RLS.

Critical fault injection points: before/after DB commit, before/after queue publication, lease expiry during model work, successful mutation before worker crash, takeover before dispatch, and provider acceptance before response loss. Retry must preserve one business effect; UNKNOWN external sends stay explicit.

Closure evidence includes commit, environment, commands/reports, fixture versions, acceptance results, unresolved defects and reviewer. See [phase closure template](../14-roadmap/phase-closure-template.md). Documentation existence does not close implementation phases.
