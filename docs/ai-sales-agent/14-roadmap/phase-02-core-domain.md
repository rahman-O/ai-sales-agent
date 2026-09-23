# Phase 02 — Core domain model

Status: CLOSED — READY_FOR_P03. Relative complexity: M. Proposed accountable owner: engineering lead with product reviewer. Closed 2026-09-23; see [closure report](phase-02-closure.md).

## 1. Objective

Establish validated domain primitives and reference data needed by conversations, leads and bookings.

## 2. Why This Phase Exists

Business commands need consistent money, time, identity and ownership rules before agent orchestration.

## 3. Entry Criteria

P01 CLOSED; scoped transactions and audit are working.

## 4. Scope

Customer/identity primitives, location/service/staff references, value objects, event envelopes, repository boundaries and lifecycle policies.

## 5. Out of Scope

Complete booking allocation, lead pipeline, live channel and model execution.

## 6. Architecture Impact

Create customers/services/bookings module boundaries and exported application services; no new deployable services.

## 7. Files / Modules Expected

Likely implementation locations: apps/api/src/modules/customers, services, bookings; packages/contracts; prisma/migrations; tests/domain.

## 8. Data Model Changes

Customer, CustomerIdentity, Location, Service, StaffMember and ServiceStaff with tenant keys, timestamps and archive behavior. Use local fixture identities until channel connection is introduced.

## 9. APIs

Scoped catalog/customer CRUD foundations and versioned domain-event envelope; commands return normalized domain errors.

## 10. Business Rules

No cross-tenant identity merge; money uses integer minor units; durations positive; archived services cannot support new sales actions.

## 11. Implementation Tasks

- [x] P02-T001: Implement money/time/contact value objects. Verification: Boundary tests reject ambiguous time and unsafe numeric conversion.
- [x] P02-T002: Add tenant-owned reference tables and constraints. Verification: Cross-tenant foreign references fail at database level.
- [x] P02-T003: Build customer identity ensure/merge policy. Verification: Duplicate same-channel identity resolves once; merge requires evidence.
- [x] P02-T004: Add catalog/staff eligibility application services. Verification: Archived and ineligible references are rejected.
- [x] P02-T005: Implement versioned domain event envelope. Verification: Outbox carries stable event IDs and schema versions; consumer receipt handling remains P03.
- [x] P02-T006: Document module APIs and fixtures. Verification: Scope manifest and hosted two-tenant fixtures cover the implemented boundary.

## 12. Testing Requirements

- Unit: Money, time ranges, archive rules, customer identity matching and service eligibility.
- Integration: Composite foreign keys, uniqueness, concurrent identity creation and event/audit transaction consistency.
- E2E: Authorized operator creates customer and catalog references; unauthorized tenant and archived record paths fail.
- Failure scenarios: Duplicate contact race, malformed currency, inactive staff and transaction rollback.

## 13. Observability Requirements

Domain command correlation, validation conflict metrics and catalog/customer audit records.

## 14. Security Considerations

Field allowlists, data minimization, scoped searches and role checks for catalog changes.

## 15. Acceptance Criteria

- [ ] All new tenant tables enforce composite references and RLS.
- [ ] Concurrent customer identity creation produces one binding.
- [ ] Archived catalog records remain in history but cannot be selected for new actions.
- [ ] Domain errors and event envelopes are documented and tested.

## 16. Exit Criteria

All P02 tasks are implemented or formally removed through reviewed scope change; required tests and acceptance checks pass; linked architecture/API/data documents match actual behavior; evidence and reviewer sign-off are recorded using the [closure template](phase-closure-template.md). No critical unresolved defect in this phase's boundary remains. A list of created files alone is not closure evidence.

## 17. Dependencies

Requires P01; unblocks P03/P06/P07.

## 18. Risks

R01, R05, R14; avoid overgeneralizing clinic-specific fields.

## 19. Deliverables

Domain primitives, reference schema migrations, module contracts and deterministic fixtures.

Canonical context: [master plan](master-plan.md), [test strategy](../09-testing/testing-strategy.md), [risk register](../13-risks/risk-register.md).
