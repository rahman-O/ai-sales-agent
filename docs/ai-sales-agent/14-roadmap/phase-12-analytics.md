# Phase 12 — Usage, funnel and business outcomes

Status: NOT STARTED. Relative complexity: M. Proposed accountable owner: engineering lead with product reviewer. Dates and staffing are unestimated.

## 1. Objective

Produce reconciled tenant reports from evidence-linked events and actual/estimated usage.

## 2. Why This Phase Exists

Conversion and cost must be measurable without conflating bookings, attendance and collected revenue.

## 3. Entry Criteria

P07 and P11 CLOSED; domain/usage events have been captured since prior phases. P10 events included if follow-ups enabled.

## 4. Scope

Replay-safe daily projections, cohort funnel, cost/usage reconciliation, attendance/revenue evidence, scoped reports and exports.

## 5. Out of Scope

Data warehouse, causal revenue claims, payment gateway and sophisticated marketing attribution.

## 6. Architecture Impact

Analytics reads domain events/projections; no influence on transactional booking correctness.

## 7. Files / Modules Expected

Likely implementation locations: apps/api/src/modules/analytics; apps/worker/analytics; apps/web/analytics; prisma/migrations.

## 8. Data Model Changes

Consumer receipts, projection tables, versioned tariff metadata and RevenueRecord; retain source event IDs and correction references.

## 9. APIs

GET /analytics/funnel, /usage, /cost, /outcomes with cohort/date filters; POST /analytics/exports; POST /bookings/{id}/revenue-records for authorized verified manual outcome.

## 10. Business Rules

Duplicate events do not double count; unknown outcomes stay unknown; currencies are not summed without approved conversion; model text is never revenue evidence.

## 11. Implementation Tasks

- [ ] P12-T001: Implement versioned event-to-fact projections. Verification: Full replay twice yields identical totals.
- [ ] P12-T002: Implement cohort and attribution rules. Verification: Multiple bookings per lead do not inflate lead conversion.
- [ ] P12-T003: Implement usage/tariff reconciliation. Verification: Timeout/fallback charges and duplicate imports reconcile correctly.
- [ ] P12-T004: Add verified attendance/revenue correction workflow. Verification: Corrections preserve source/actor history and distinguish booked value.
- [ ] P12-T005: Build scoped reports with freshness and sample size. Verification: Analyst sees aggregates without unauthorized transcript access.
- [ ] P12-T006: Reconcile fixture and pilot sample to source IDs. Verification: Every reported conversion/cost can be traced to evidence.

## 12. Testing Requirements

- Unit: Denominator/cohort rules, currency arithmetic, missing-data states and correction handling.
- Integration: Duplicate/out-of-order events, projection rebuild, tariff effective dates and export tenant scope.
- E2E: Known synthetic inquiry-to-revenue dataset produces expected reports; analyst cannot open customer transcript.
- Failure scenarios: Delayed receipts, missing attendance, partial projection outage and corrected revenue after export.

## 13. Observability Requirements

Projection lag, reconciliation gaps, estimated-cost share and report as-of timestamps.

## 14. Security Considerations

Aggregate role boundaries, audited exports, small-cohort controls and PII-free facts where possible.

## 15. Acceptance Criteria

- [ ] Funnel counts reconcile to source events without duplicate effects.
- [ ] Booked value, attendance and verified revenue remain distinct.
- [ ] Missing usage/outcomes are labeled rather than treated as zero.
- [ ] Exports and trace drill-down enforce tenant and role permissions.

## 16. Exit Criteria

All P12 tasks are implemented or formally removed through reviewed scope change; required tests and acceptance checks pass; linked architecture/API/data documents match actual behavior; evidence and reviewer sign-off are recorded using the [closure template](phase-closure-template.md). No critical unresolved defect in this phase's boundary remains. A list of created files alone is not closure evidence.

## 17. Dependencies

Requires P07/P11 and captured events; required for pilot learning and P14 outcome review.

## 18. Risks

R14 and R09; misleading metrics can hide operational harm.

## 19. Deliverables

Metrics projections/APIs/UI, reconciliation tests and business outcome definitions.

Canonical context: [master plan](master-plan.md), [test strategy](../09-testing/testing-strategy.md), [risk register](../13-risks/risk-register.md).
