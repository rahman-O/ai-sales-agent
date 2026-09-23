# Phase 08 — WhatsApp transport integration

Status: NOT STARTED. Relative complexity: L. Proposed accountable owner: engineering lead with product reviewer. Dates and staffing are unestimated.

## 1. Objective

Connect real verified WhatsApp text traffic to the channel-neutral durable pipeline.

## 2. Why This Phase Exists

A fake adapter proves internal behavior but cannot validate provider policy, credentials or uncertain delivery.

## 3. Entry Criteria

P03 CLOSED and P00 provider access verified. Integrated agent/booking acceptance additionally requires P04–P07; external customer activation waits for P09 and MVP gates.

## 4. Scope

Credential lifecycle, signature/challenge ingress, canonical normalization, outbound policy/templates, status receipts and uncertainty reconciliation.

## 5. Out of Scope

Instagram, voice/media understanding, bulk campaigns and assumed exactly-once provider delivery.

## 6. Architecture Impact

Implement WhatsApp adapter and verified connection mapping without introducing provider dependencies into domain/agent modules.

## 7. Files / Modules Expected

Likely implementation locations: apps/api/src/modules/integrations/whatsapp and messaging; apps/worker/outbound; apps/web/settings/channels.

## 8. Data Model Changes

Complete ChannelConnection, WebhookReceipt and OutboundAttempt fields; service-window timestamps and provider IDs/status history.

## 9. APIs

GET/POST webhook route, channel connect/disconnect/health APIs, adapter send/normalize/reconcile contracts.

## 10. Business Rules

2xx after durable acceptance only; raw signature verification; execution-time template/window checks; UNKNOWN sends never blindly retried.

## 11. Implementation Tasks

- [ ] P08-T001: Implement verified subscription and raw-body signature checks. Verification: Modified payload and wrong challenge token fail.
- [ ] P08-T002: Map canonical inbound/status events with dedup. Verification: Repeated/mixed batches create one message and monotonic derived status.
- [ ] P08-T003: Implement secure channel credentials and reconnect lifecycle. Verification: Revoked or foreign-bound credentials cannot send.
- [ ] P08-T004: Implement send-policy and template enforcement. Verification: Expired window or unavailable template blocks unsafe send.
- [ ] P08-T005: Implement outbound acceptance/unknown reconciliation. Verification: Acceptance followed by lost response produces UNKNOWN without automatic duplicate send.
- [ ] P08-T006: Run provider sandbox end-to-end contract fixtures. Verification: Record real IDs/receipts safely and verify integrated inquiry path once dependencies close.

## 12. Testing Requirements

- Unit: Payload normalization, signature helper, channel capability/policy and error classification.
- Integration: Raw-byte verification, mixed-batch replay, outbox/receipt transaction and uncertain send restart.
- E2E: Real test customer message persists and gets eligible response; integrated booking confirmation is tested after P07/P09.
- Failure scenarios: Token revocation, provider 429/5xx, status-before-message, template rejection and network loss after acceptance.

## 13. Observability Requirements

Webhook acknowledgement latency, rejected signatures, provider request IDs, receipt lag and UNKNOWN count.

## 14. Security Considerations

Encrypted credentials, verified channel mapping, request limits, no secrets in payload logs and tenant-safe reconnect.

## 15. Acceptance Criteria

- [ ] Duplicate webhooks do not duplicate messages or business actions.
- [ ] Webhook handlers never wait on inference before acknowledgement.
- [ ] Channel policy is checked at actual dispatch.
- [ ] Uncertain outbound acceptance is visible and safely recoverable.

## 16. Exit Criteria

All P08 tasks are implemented or formally removed through reviewed scope change; required tests and acceptance checks pass; linked architecture/API/data documents match actual behavior; evidence and reviewer sign-off are recorded using the [closure template](phase-closure-template.md). No critical unresolved defect in this phase's boundary remains. A list of created files alone is not closure evidence.

## 17. Dependencies

Requires P03 and P00 sandbox; can be developed alongside P04–P07. Activation requires P09 and minimum P11.

## 18. Risks

R04, R10, R15; provider review delay is an external critical-path risk.

## 19. Deliverables

WhatsApp adapter, verified webhook/send pipeline, connection UI and sandbox failure evidence.

Canonical context: [master plan](master-plan.md), [test strategy](../09-testing/testing-strategy.md), [risk register](../13-risks/risk-register.md).
