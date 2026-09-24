# Phase 11 — Operational UI and dashboard

Status: CLOSED. Relative complexity: L. Proposed accountable owner: engineering lead with product reviewer. Dates and staffing are unestimated.

Closure: [phase-11-closure.md](phase-11-closure.md).

## 1. Objective

Complete the staff workflows needed to operate the MVP safely without developer database access.

## 2. Why This Phase Exists

A working backend cannot be piloted if operators cannot manage configuration, take over or resolve failures.

## 3. Entry Criteria

P03 provides early inbox slice; P05/P06/P07/P08/P09 CLOSED for full MVP UI acceptance. P10 needed only for reminder controls.

## 4. Scope

Complete navigation, onboarding/settings, inbox, lead/booking/catalog/knowledge views, trace inspection, basic operational dashboard and RTL/accessibility.

## 5. Out of Scope

Advanced analytics visualizations, mobile app and complex CRM boards.

## 6. Architecture Impact

Next.js feature routes consume scoped NestJS APIs; query cache and event subscriptions respect organization switch.

## 7. Files / Modules Expected

Likely implementation locations: apps/web/app organization routes, feature components, query hooks and Playwright journeys.

## 8. Data Model Changes

No new business truth; only optional per-user display preferences if justified. UI must not create shadow booking/lead state.

## 9. APIs

Consume the documented API groups; fill missing scoped read endpoints for dashboard counts and failure queues with explicit freshness.

## 10. Business Rules

Backend success precedes success UI; role hiding does not authorize; destructive/control mutations use versions and visible consequences.

## 11. Implementation Tasks

- [ ] P11-T001: Complete organization navigation and cache isolation. Verification: Switching tenants clears drafts, previews and subscriptions.
- [ ] P11-T002: Complete inbox/customer/lead operational journey. Verification: Operator can claim, inspect evidence, update facts and reply.
- [ ] P11-T003: Complete catalog/schedule/booking controls. Verification: Operator/admin workflows need no database console.
- [ ] P11-T004: Complete knowledge/agent/channel settings. Verification: Published state and automation enablement are clear and role-safe.
- [ ] P11-T005: Add failure queues and operational dashboard. Verification: Unknown sends and unassigned pauses are actionable, not buried.
- [ ] P11-T006: Validate Arabic/English accessibility and E2E flows. Verification: Keyboard, focus, RTL, timezone and conflict states pass browser tests.

## 12. Testing Requirements

- Unit: Query-key construction, display formatting, form validation and role-specific navigation.
- Integration: API errors/conflicts, SSE reconnect/refetch and organization cache teardown.
- E2E: Full owner setup and operator inquiry-to-booking/handoff flow in English and Arabic RTL.
- Failure scenarios: Network reconnect, stale claim, partial dashboard failure, expired session and pending send on refresh.

## 13. Observability Requirements

Client error/request correlation and failed mutation UX; no transcript or secrets in frontend telemetry.

## 14. Security Considerations

XSS-safe message rendering, CSRF, permission checks on API, private signed-link lifecycle and no service credentials.

## 15. Acceptance Criteria

- [ ] Required MVP operations are usable without developer intervention.
- [ ] Tenant switching cannot expose previous tenant data or drafts.
- [ ] No optimistic UI reports a rejected booking as successful.
- [ ] RTL, keyboard and stale/conflict states pass critical journeys.

## 16. Exit Criteria

All P11 tasks are implemented or formally removed through reviewed scope change; required tests and acceptance checks pass; linked architecture/API/data documents match actual behavior; evidence and reviewer sign-off are recorded using the [closure template](phase-closure-template.md). No critical unresolved defect in this phase's boundary remains. A list of created files alone is not closure evidence.

## 17. Dependencies

Incremental slices start P03; full MVP closure requires P05–P09. P10 controls may follow; P12 analytics remains separate.

## 18. Risks

R01, R06, R12; deferring all UI to this phase would delay safe validation.

## 19. Deliverables

Complete MVP operational interface, accessibility evidence and browser journey reports.

Canonical context: [master plan](master-plan.md), [test strategy](../09-testing/testing-strategy.md), [risk register](../13-risks/risk-register.md).
