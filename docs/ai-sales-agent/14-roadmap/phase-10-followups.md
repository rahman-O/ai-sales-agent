# Phase 10 — Consent-aware follow-up engine

Status: CLOSED (see [phase-10-closure.md](phase-10-closure.md) and [phase-10-scope-manifest.md](phase-10-scope-manifest.md)). Relative complexity: M.

## 1. Objective

Send limited approved reminders from durable schedules with execution-time eligibility checks.

## 2. Why This Phase Exists

Delayed jobs can outlive customer consent, booking state or human ownership; scheduling alone is insufficient authorization.

## 3. Entry Criteria

P07/P08/P09 CLOSED; consent and channel policies configured.

## 4. Scope

Durable FollowUp schedule/generation, BullMQ wakeups, due sweeper, reminder templates, cancellation/suppression and operator visibility.

## 5. Out of Scope

Marketing campaign builder, arbitrary generated outreach and complex multi-step automation.

## 6. Architecture Impact

Followups module evaluates current domain/channel state and creates outbound intents through messaging.

## 7. Files / Modules Expected

Likely implementation locations: apps/api/src/modules/followups; apps/worker/followups; apps/web/customer-detail; prisma/migrations.

## 8. Data Model Changes

FollowUp with semantic dedup key, due_at, purpose, target, generation and status; consent reference and send operation link.

## 9. APIs

scheduleFollowUp tool, GET/POST followups and POST /followups/{id}/cancel staff endpoints; consent/booking/mode events suppress stale work.

## 10. Business Rules

The canonical schedule lifecycle, quiet hours, generation and revocation race rules are in [follow-up architecture](../02-architecture/followup-architecture.md).

Require purpose-specific consent, current target and allowed conversation mode; no more than three pending reminders/conversation; recheck again at dispatch.

## 11. Implementation Tasks

- [ ] P10-T001: Persist deduplicated reminder schedule and generation. Verification: Repeated scheduling creates one active semantic reminder.
- [ ] P10-T002: Implement due sweeper and BullMQ wakeups. Verification: Redis loss rebuilds outstanding due work.
- [ ] P10-T003: Implement current-state eligibility evaluator. Verification: Opt-out, cancellation, recent response or takeover suppresses send.
- [ ] P10-T004: Map approved template and channel policy. Verification: Outside-window unapproved content never dispatches.
- [ ] P10-T005: Implement cancel/reschedule race handling. Verification: Older generation cannot send after replacement commits.
- [ ] P10-T006: Add operator schedule/outcome view and audit. Verification: Staff can explain sent/suppressed/failed outcomes without inspecting queue internals.

## 12. Testing Requirements

- Unit: Due time, quiet hours, purpose consent, recent-inbound suppression and generation rules.
- Integration: Opt-out/send race, booking cancellation, duplicate due jobs and Redis recovery.
- E2E: Consented reminder sends once; opt-out before due time suppresses it and appears in operator history.
- Failure scenarios: Template rejected, channel disconnected, human takeover, retry after expiry and provider UNKNOWN outcome.

## 13. Observability Requirements

Due backlog, sent/suppressed reasons, consent version, template ID and external outcome.

## 14. Security Considerations

Purpose-limited consent, no bulk autonomy, quiet hours and hard tenant rate/cost limits.

## 15. Acceptance Criteria

- [ ] Revoked consent and cancelled targets suppress pending reminders.
- [ ] Duplicate jobs cannot create duplicate reminder intent.
- [ ] Channel policy and ownership are rechecked at send time.
- [ ] Redis loss does not lose durable schedules.

## 16. Exit Criteria

All P10 tasks are implemented or formally removed through reviewed scope change; required tests and acceptance checks pass; linked architecture/API/data documents match actual behavior; evidence and reviewer sign-off are recorded using the [closure template](phase-closure-template.md). No critical unresolved defect in this phase's boundary remains. A list of created files alone is not closure evidence.

## 17. Dependencies

Requires P07/P08/P09; pilot requirement, optional for initial MVP milestone.

## 18. Risks

R04, R10, R12, R15; provider acceptance uncertainty remains explicit.

## 19. Deliverables

Follow-up engine/tool, operational controls, suppression race tests and reminder policy.

Canonical context: [master plan](master-plan.md), [test strategy](../09-testing/testing-strategy.md), [risk register](../13-risks/risk-register.md).
