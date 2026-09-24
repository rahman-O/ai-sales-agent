# Phase 12 — Usage, funnel and business outcomes

Status: **CLOSED**. Relative complexity: M. Proposed accountable owner: engineering lead with product reviewer. Dates and staffing are unestimated. See the [validation report](phase-12-validation-report.md), [discovery report](phase-12-discovery-report.md), and [locked metric definitions](phase-12-metric-definitions-lock.md).

## 1. Objective

Produce reconciled tenant reports from evidence-linked events and actual/estimated usage.

## 2. Why This Phase Exists

Conversion and cost must be measurable without conflating bookings, attendance and collected revenue.

## 3. Entry Criteria

P07 and P11 CLOSED; domain/usage events have been captured since prior phases. P10 events included if follow-ups enabled.

## 4. Scope

The authoritative resolved MVP scope is `analytics_overview:v1`: bounded direct SQL over existing evidence, cohort and event conversion, follow-up associations, response and delivery metrics, workload, agent/tool/token usage, completeness labels, and explicit unavailable states. Projections, exports, versioned cost tariffs, and attendance/revenue workflows are deferred.

## 5. Out of Scope

Data warehouse, causal revenue claims, payment gateway and sophisticated marketing attribution.

## 6. Architecture Impact

Analytics reads domain events/projections; no influence on transactional booking correctness.

## 7. Files / Modules Expected

Implemented under `apps/api/src/analytics`, the web analytics route/page, and integration tests. No worker projection or Prisma migration was required for the resolved scope.

## 8. Data Model Changes

None. Existing evidence tables are queried directly within bounded tenant and date ranges.

## 9. APIs

`GET /organizations/{organizationId}/analytics/overview` with local-date, IANA timezone, and bounded-range filters.

## 10. Business Rules

Duplicate events do not double count; unknown outcomes stay unknown; currencies are not summed without approved conversion; model text is never revenue evidence.

## 11. Implementation Tasks

- [x] P12-T001: Lock definitions, completeness states, attribution labels, and bounded timezone semantics.
- [x] P12-T002: Implement tenant-scoped overview aggregates and direct/associated conversion rules.
- [x] P12-T003: Implement agent, tool and token usage; report cost as unavailable without a versioned tariff ledger.
- [x] P12-T004: Keep attendance and verified revenue unavailable until authoritative facts exist.
- [x] P12-T005: Build the ADMIN/OWNER-scoped aggregate API and operator UI without transcript or customer PII exposure.
- [x] P12-T006: Validate deterministic synthetic data, tenant isolation, regressions and query plans.

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

- [x] Funnel counts reconcile to existing source evidence with explicit denominators.
- [x] Booking facts remain distinct from unavailable attendance and verified revenue.
- [x] Missing usage/outcomes are labeled rather than treated as zero.
- [x] Overview access enforces tenant and ADMIN/OWNER role permissions.

## 16. Exit Criteria

All P12 tasks are implemented or formally removed through reviewed scope change; required tests and acceptance checks pass; linked architecture/API/data documents match actual behavior; evidence and reviewer sign-off are recorded using the [closure template](phase-closure-template.md). No critical unresolved defect in this phase's boundary remains. A list of created files alone is not closure evidence.

## 17. Dependencies

Requires P07/P11 and captured events; required for pilot learning and P14 outcome review.

## 18. Risks

R14 and R09; misleading metrics can hide operational harm.

## 19. Deliverables

Metrics projections/APIs/UI, reconciliation tests and business outcome definitions.

Canonical context: [master plan](master-plan.md), [test strategy](../09-testing/testing-strategy.md), [risk register](../13-risks/risk-register.md).
