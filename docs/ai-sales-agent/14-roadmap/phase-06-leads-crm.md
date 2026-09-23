# Phase 06 — Lead management and qualification

Status: NOT STARTED. Relative complexity: M. Proposed accountable owner: engineering lead with product reviewer. Dates and staffing are unestimated.

## 1. Objective

Capture and qualify one durable opportunity per active customer/service interest with evidence-linked history.

## 2. Why This Phase Exists

Conversation-to-booking conversion needs explicit lead state rather than inferred transcript analytics.

## 3. Entry Criteria

P04 CLOSED and P02 domain primitives available; qualification policy approved in P00.

## 4. Scope

Lead aggregate/history, qualification policy, create/update tools, operator list/detail and source attribution.

## 5. Out of Scope

Large CRM, campaigns, external sync, speculative scoring and sensitive-trait inference.

## 6. Architecture Impact

Leads module exports commands to agent/bookings; event facts establish future funnel provenance.

## 7. Files / Modules Expected

Likely implementation locations: apps/api/src/modules/leads; apps/web/leads; agent/tools/leads; prisma/migrations.

## 8. Data Model Changes

Lead and LeadStageHistory; open-interest uniqueness, customer/conversation/service references, qualification policy version.

## 9. APIs

Lead CRUD/transition/history endpoints; createLead and updateLead tool contracts; LeadCreated/Qualified/StageChanged events.

## 10. Business Rules

Qualification requires allowed evidence fields; model cannot set BOOKED/WON; duplicate open opportunity resolves to existing lead.

## 11. Implementation Tasks

- [ ] P06-T001: Implement lead schema and unique open-opportunity policy. Verification: Concurrent same-interest create resolves once.
- [ ] P06-T002: Implement qualification evidence validation. Verification: Missing or cross-conversation evidence cannot qualify.
- [ ] P06-T003: Enforce stage transitions and optimistic versions. Verification: Stale edits and invalid terminal reopening reject.
- [ ] P06-T004: Register createLead/updateLead tools. Verification: Model patches cannot write restricted fields or terminal success stages.
- [ ] P06-T005: Build operator lead detail and history. Verification: Operator can inspect source facts and resolve conflicts.
- [ ] P06-T006: Emit replay-safe attribution events. Verification: Duplicate delivery leaves one lead and one funnel fact.

## 12. Testing Requirements

- Unit: Qualification predicates, interest resolution, stage transitions and allowed patches.
- Integration: Open-lead uniqueness, unknown-to-known interest collision, history/audit/outbox consistency.
- E2E: Multi-turn customer supplies missing details and becomes qualified; operator sees evidence and stage history.
- Failure scenarios: Repeated model creation, stale operator edit, invalid service reference and archived customer.

## 13. Observability Requirements

Created/qualified counts with source IDs, dedup hits, stage conflict and tool-denial traces.

## 14. Security Considerations

No sensitive profiling, tenant-scoped customer IDs and role-limited lead editing.

## 15. Acceptance Criteria

- [ ] Repeated messages/tools cannot create duplicate open opportunities.
- [ ] Qualified status is backed by configured required facts.
- [ ] Lead history identifies actor/source and versions.
- [ ] Tenant and forbidden-stage tests pass.

## 16. Exit Criteria

All P06 tasks are implemented or formally removed through reviewed scope change; required tests and acceptance checks pass; linked architecture/API/data documents match actual behavior; evidence and reviewer sign-off are recorded using the [closure template](phase-closure-template.md). No critical unresolved defect in this phase's boundary remains. A list of created files alone is not closure evidence.

## 17. Dependencies

Requires P04/P02; can run independently of P05; unblocks P07 attribution.

## 18. Risks

R02, R11, R14; unclear qualification policy creates misleading conversion metrics.

## 19. Deliverables

Lead commands/tools, minimal lead UI, schema/history and deterministic qualification tests.

Canonical context: [master plan](master-plan.md), [test strategy](../09-testing/testing-strategy.md), [risk register](../13-risks/risk-register.md).
