# Phase 03 — Durable customers and conversations

Status: **CLOSED**. Relative complexity: L. See [closure](phase-03-closure.md) and the current regression baseline in [Phase 12 validation](phase-12-validation-report.md).

## 1. Objective

Persist and order inbound messages with recoverable processing and ownership state before connecting a model.

## 2. Why This Phase Exists

Agent correctness cannot compensate for lost, duplicated or reordered business inputs.

## 3. Entry Criteria

P02 CLOSED; tenant scope and event/audit infrastructure available.

## 4. Scope

Conversation/message persistence, identity mapping, fake channel, sequence allocation, outbox relay, lease fencing, delivery states, ownership primitives and minimum inbox read view.

## 5. Out of Scope

Real WhatsApp activation, model output and complete operator takeover UX.

## 6. Architecture Impact

Introduce conversations/messaging modules and queue workers sharing domain transactions; establish epochs now for later handoff.

## 7. Files / Modules Expected

Likely implementation locations: apps/api/src/modules/conversations and messaging; apps/worker/conversation; apps/web/inbox; prisma/migrations.

## 8. Data Model Changes

ChannelConnection fixture mapping, Conversation, Message, WebhookReceipt foundation, OutboxEvent, ConsumerReceipt, OutboundAttempt foundation; sequence, provider uniqueness and lease indexes.

## 9. APIs

Conversation list/timeline, simulated inbound fixture route restricted to non-production, SSE refetch events and internal MessagingChannel interface.

## 10. Business Rules

Acknowledge only durable receipt; accepted-order FIFO lives in DB; one current fenced processor per conversation; late inputs append with provenance.

## 11. Implementation Tasks

- [ ] P03-T001: Persist inbound receipt/message/outbox atomically. Verification: Crash after commit before acknowledgement produces one message on replay.
- [ ] P03-T002: Allocate ingress sequence under conversation row lock. Verification: Concurrent inputs produce unique increasing accepted-order sequence.
- [ ] P03-T003: Implement lease acquisition/renewal and fenced writes. Verification: Expired worker cannot commit after another worker reclaims.
- [ ] P03-T004: Implement outbox relay and durable pending-work sweeper. Verification: Redis loss/repeated publication does not lose pending inputs.
- [ ] P03-T005: Add conversation mode/epoch primitives and send intent states. Verification: Mode change invalidates old-epoch pending intent.
- [ ] P03-T006: Build minimum read-only inbox and scoped event subscription. Verification: Two-tenant browser sessions cannot receive each other’s timeline events.

## 12. Testing Requirements

- Unit: Sequence selection, mode transitions, receipt status non-regression and late-event classification.
- Integration: Concurrent receipt insertion, lease expiry, outbox duplicate publish, process crash and queue reconstruction.
- E2E: Fake customer sends a burst; operator sees one ordered durable timeline after worker restart.
- Failure scenarios: DB unavailable before acknowledgement, expired lease, out-of-order receipt and hot-tenant burst.

## 13. Observability Requirements

Dedup counter, oldest pending sequence, queue age, lease renewal/fence rejection and accepted-versus-delivered states.

## 14. Security Considerations

Verified channel-to-tenant mapping abstraction, restricted fixture routes, tenant-bound jobs and event subscriptions.

## 15. Acceptance Criteria

- [ ] Duplicate provider messages do not create duplicate records.
- [ ] Messages process in accepted conversation order and late events remain identifiable.
- [ ] Failed jobs can retry safely after worker and Redis interruption.
- [ ] Stale workers cannot mutate conversation state or create valid outbound intent.

## 16. Exit Criteria

All P03 tasks are implemented or formally removed through reviewed scope change; required tests and acceptance checks pass; linked architecture/API/data documents match actual behavior; evidence and reviewer sign-off are recorded using the [closure template](phase-closure-template.md). No critical unresolved defect in this phase's boundary remains. A list of created files alone is not closure evidence.

## 17. Dependencies

Requires P02; unblocks P04/P08/P09. Minimal ownership authority precedes model work.

## 18. Risks

R02, R06, R10; BullMQ FIFO/locks alone are insufficient.

## 19. Deliverables

Durable messaging core, fake channel, concurrency tests, scoped inbox slice and recovery evidence.

Canonical context: [master plan](master-plan.md), [test strategy](../09-testing/testing-strategy.md), [risk register](../13-risks/risk-register.md).
