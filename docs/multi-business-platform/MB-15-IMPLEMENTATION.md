# MB-15 — External / Live Provider Acceptance

## Status

`PARTIAL / NOT_CLOSED`. The checked-in environment proves the Meta WhatsApp adapter contract, bounded retry behavior, provider metrics, and database integration tests. It does not contain live Meta credentials, a public webhook URL, an authorized test recipient, or the MB-14 acceptance evidence required to claim live readiness.

## Audited boundary

- Provider: Meta WhatsApp Cloud API, pinned by `META_GRAPH_API_VERSION`.
- Webhook: `GET/POST /webhooks/whatsapp/meta`.
- Trust: GET verify token; POST HMAC-SHA256 over the exact raw bytes; one-megabyte body limit.
- Tenant resolution: verified `phone_number_id` maps through the globally unique `ChannelConnection(provider, externalChannelId)` pair. Message content cannot select a tenant.
- Inbound: provider events normalize before entering the generic persistence and agent pipeline. Database constraints and receipts supply durable deduplication.
- Outbound: worker-owned `Message` and `OutboundAttempt` state is authoritative. Timeout or malformed success becomes `UNKNOWN`, which blocks blind resend.
- Statuses: repeated callbacks dedupe by receipt; explicit transitions reject backward movement.

Provider-specific payloads remain inside the messaging adapter and webhook boundary. No runtime branch depends on `businessType` or a pack ID.

## Evidence completed in this checkout

- Valid, invalid, missing, and modified-body signature tests.
- Webhook challenge tests.
- Inbound normalization and trusted channel mapping tests.
- Cross-tenant channel uniqueness and RLS-backed integration coverage.
- Inbound replay, outbound timeout, no-blind-resend, provider ID persistence, care-window, and monotonic status coverage.
- HTTP 400, 401, 403, 429, 500, network refusal, timeout, malformed success, and secret non-disclosure adapter tests.

## Honest limitations

The webhook performs verified persistence before returning and queues subsequent processing through the existing outbox. Its acknowledgement latency includes database work, but never waits for model execution. BullMQ limits provider jobs to four attempts with exponential backoff starting at five seconds. Only definite transient and rate-limit results are retried. Authentication, permanent, and ambiguous outcomes are terminal; ambiguous sends remain `UNKNOWN` and are never blindly duplicated. The adapter captures `Retry-After`; the current BullMQ policy uses its bounded exponential schedule rather than a per-response delay.

Process-local operational counters cover received/rejected webhooks, duplicate events, processed inbound messages, outbound attempts/success/failure, rate limits, authentication failures, and timeouts. Labels are limited to provider, event type, result, and failure class.

No live provider traffic was sent. Live webhook verification, inbound receipt, outbound delivery/read/failure callbacks, rapid-message ordering, and business workflow conversations are `NOT_RUN`. MB-08, MB-09, MB-10, MB-12, MB-13, and MB-14 implementation files named by the phase brief are absent from `docs/multi-business-platform`; the authoritative roadmap in this checkout marks MB-07 as next and MB-08 through MB-15 as not started.

The first hosted integration run exposed database drift: migration history was current while `conversation_working_state` and four proven foreign-key/Phase-09 invariants were absent. The missing working-state migration was reapplied and an idempotent recovery migration restored only the constraints and columns demonstrated missing by the failing tests. The final hosted run passed all 24 integration cases, including Meta/WhatsApp, booking, workflows, analytics, runtime-role verification, RLS, connection reuse, and cross-tenant isolation.

## Live gate

Pre-live simulator transport evidence is documented in [`../operations/MB15-SIMULATOR-ACCEPTANCE-REPORT.md`](../operations/MB15-SIMULATOR-ACCEPTANCE-REPORT.md). It remains separate from live Meta acceptance.

Run live acceptance only after an operator records all of the following without placing secrets in source control or evidence files:

1. Environment classification (`STAGING` or explicitly approved production acceptance).
2. Controlled test organization ID and active Meta `ChannelConnection`.
3. Authorized test recipient and proof the recipient may receive the test messages.
4. Public HTTPS webhook URL and successful Meta control-panel challenge.
5. Environment-only app secret, verify token, and access token.
6. Named operator, start/end time, stop conditions, and rollback authority.

Follow the production release checklist and capture redacted provider IDs, request/correlation IDs, timestamps, resulting internal record IDs, status transitions, and duplicate counts. Never record token values, message bodies, or full phone numbers.

## Closure rule

MB-15 can close only after the missing prerequisite phases are reconciled with the repository and the required live matrix passes against the explicitly authorized target. Until then `PROVIDER_ACCEPTANCE=NOT_VERIFIED`, `GO_LIVE_READY=NO`, and `P14_AUTHORIZED=NO`.
