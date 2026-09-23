# Phase 09 — Human takeover and safe resume

Status: NOT STARTED. Relative complexity: L. Proposed accountable owner: engineering lead with product reviewer. Dates and staffing are unestimated.

## 1. Objective

Make operator ownership authoritative across in-flight agent work and outbound dispatch.

## 2. Why This Phase Exists

Human escalation is a required safety path, not an optional inbox enhancement.

## 3. Entry Criteria

P04/P03 CLOSED; epoch primitives exist. P08 is required for final live-channel acceptance but not fake-channel race development.

## 4. Scope

Claim/pause/resume/close UI, operator assignment, handoff tool, notifications, offline handling and in-flight dispatch visibility.

## 5. Out of Scope

Automatic AI resume on timer, skill-based routing engine and omnichannel contact center.

## 6. Architecture Impact

Complete conversation ownership application commands and inbox mutations; dispatch authority checks become operationally visible.

## 7. Files / Modules Expected

Likely implementation locations: conversations/ownership services; agent/tools/handoff; apps/web/inbox; worker/notifications.

## 8. Data Model Changes

Ownership transition audit and current member assignment; no duplicate independent ownership table unless notification delivery needs durable records.

## 9. APIs

Conversation claim/pause/resume/close/human-send endpoints; handoffToHuman tool and ConversationModeChanged events.

## 10. Business Rules

One owner; every control transition increments epoch; pending stale AI sends suppress; already dispatching sends may arrive and must be disclosed.

## 11. Implementation Tasks

- [ ] P09-T001: Implement compare-and-swap claim and reassignment. Verification: Simultaneous operators yield one owner and one conflict.
- [ ] P09-T002: Complete pause/handoff and notification outbox. Verification: Notification failure leaves conversation safely paused.
- [ ] P09-T003: Enforce ownership at tool commit and dispatch claim. Verification: Takeover races reject stale mutation/draft authority.
- [ ] P09-T004: Implement explicit resume and member-removal handling. Verification: Resume builds fresh context; removing owner pauses the thread.
- [ ] P09-T005: Build operator composer and in-flight send indicators. Verification: UI prevents unauthorized send and explains UNKNOWN/DISPATCHING states.
- [ ] P09-T006: Verify human-request language and coverage workflow. Verification: Iraqi Arabic/English requests pause and notify with approved off-hours behavior.

## 12. Testing Requirements

- Unit: Transition ownership rules, member removal, terminal handoff tool and resume eligibility.
- Integration: Takeover during LLM/tool commit/draft commit/dispatch; two-owner race; failed notification replay.
- E2E: Customer requests human, operator claims/replies/resumes and the next AI turn uses latest human messages.
- Failure scenarios: Operator disconnect, role revocation, closed thread reopens, in-flight provider request and notification outage.

## 13. Observability Requirements

Time to claim, unassigned pause age, suppressed stale intents, ownership audit and notification failure.

## 14. Security Considerations

Membership/role recheck, owner-scoped sends, sanitized composer output and no implicit timed resumption.

## 15. Acceptance Criteria

- [ ] Explicit human requests stop new AI actions and pending sends.
- [ ] Two operators cannot simultaneously claim ownership.
- [ ] Already-dispatching exceptions are visible rather than falsely claimed recalled.
- [ ] Resume uses fresh context and member revocation safely pauses ownership.

## 16. Exit Criteria

All P09 tasks are implemented or formally removed through reviewed scope change; required tests and acceptance checks pass; linked architecture/API/data documents match actual behavior; evidence and reviewer sign-off are recorded using the [closure template](phase-closure-template.md). No critical unresolved defect in this phase's boundary remains. A list of created files alone is not closure evidence.

## 17. Dependencies

Requires P03/P04; real-channel verification with P08. Required for MVP and P10 follow-up suppression.

## 18. Risks

R06, R12; lack of staffing cannot be solved by UI alone.

## 19. Deliverables

Takeover lifecycle/UI, handoff tool, race tests and operator coverage runbook.

Canonical context: [master plan](master-plan.md), [test strategy](../09-testing/testing-strategy.md), [risk register](../13-risks/risk-register.md).
