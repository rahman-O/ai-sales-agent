# Phase 14 — Pilot readiness and controlled launch

Status: **NOT STARTED**; **P14_AUTHORIZED: NO**. Relative complexity: M. Proposed accountable owner: product and technical leads. Dates and staffing are unestimated.

Pre-P14 zero-cost discovery (read-only): [pre-p14-zero-cost-discovery.md](pre-p14-zero-cost-discovery.md). Strongest path today: **PATH B** (real app stack + Fake/dev WhatsApp transport). PATH A (real Meta) blocked. Estimated new spend for PATH B: **0**. This phase remains unauthorized.

## 1. Objective

Authorize a limited, staffed pilot with clear success measures, stop conditions and recovery ownership.

## 2. Why This Phase Exists

Technical correctness must be paired with approved business workflow, provider eligibility and accountable human operations.

## 3. Entry Criteria

P13 CLOSED; P00 decisions remain valid; MVP/pilot scope implemented; no unresolved critical release blocker.

## 4. Scope

Tenant onboarding rehearsal, consent/privacy/configuration review, full model evaluation, operator training, canary plan, support rota and go/no-go review.

## 5. Out of Scope

General availability, new channels, assumed conversion uplift and automatic rollout to unapproved tenants.

## 6. Architecture Impact

Enable existing capabilities for approved tenants through controlled configuration; no last-minute architectural rewrite.

## 7. Files / Modules Expected

Likely implementation locations: onboarding/runbook documentation, release configuration and evaluation fixtures; code only for verified blocking fixes.

## 8. Data Model Changes

Seed approved tenant configuration/catalog/knowledge with provenance; confirm retention/deletion settings and synthetic-data removal.

## 9. APIs

Exercise real provider onboarding, channel health, kill switch, staff takeover and report/export endpoints using permitted test recipients.

## 10. Business Rules

Named operators cover escalations; customer-facing disclosures approved; any safety/integrity breach pauses affected automation; expanding pilot requires review.

## 11. Implementation Tasks

- [ ] P14-T001: Rehearse owner onboarding and operator playbooks. Verification: A non-developer completes setup, booking correction and unknown-send escalation.
- [ ] P14-T002: Run final bilingual evaluation and real-channel smoke. Verification: Dataset gates and sandbox/live-approved test evidence pass.
- [ ] P14-T003: Review privacy, retention, provider eligibility and support coverage. Verification: Responsible owners sign the actual tenant configuration and operating plan.
- [ ] P14-T004: Define canary tenants, success baseline and stop conditions. Verification: Release record names who may enable, pause, rollback and expand.
- [ ] P14-T005: Hold go/no-go review with evidence links. Verification: No critical blocker is waived implicitly; residual risks have explicit owners.
- [ ] P14-T006: Observe controlled pilot and record exit decision. Verification: Review actual incidents/outcomes against baseline before any production/general-availability promotion.

## 12. Testing Requirements

- Unit: Run regression suite unchanged for final release configuration; test tenant-specific validation rules.
- Integration: Selected provider accounts, backups, alert routes and permission lifecycle in deployment environment.
- E2E: Real permitted customer test covers FAQ, lead, confirmed booking, human handoff, reminder suppression and outcome report.
- Failure scenarios: Practice provider outage, absent operator, wrong booking correction and emergency automation disable.

## 13. Observability Requirements

Daily pilot review of failures, handoff age, UNKNOWN sends, spend and evidence completeness; weekly outcome comparison.

## 14. Security Considerations

Final role/secret/data-processing checks, private content retention and tenant offboarding rehearsal.

## 15. Acceptance Criteria

- [ ] Named product, technical and operations owners record go/no-go decision.
- [ ] All deterministic safety gates and final evaluation thresholds pass.
- [ ] Staff can take over, correct a booking and pause automation without developer access.
- [ ] Pilot limits, stop conditions, support coverage and success measures are recorded.

## 16. Exit Criteria

All P14 tasks are implemented or formally removed through reviewed scope change; required tests and acceptance checks pass; linked architecture/API/data documents match actual behavior; evidence and reviewer sign-off are recorded using the [closure template](phase-closure-template.md). No critical unresolved defect in this phase's boundary remains. A list of created files alone is not closure evidence.

## 17. Dependencies

Requires P13 and all pilot-required phases. Production expansion follows a separate pilot-exit review, not automatic phase closure.

## 18. Risks

R04/R08/R11/R12/R14; successful demo does not prove sustained pilot fitness.

## 19. Deliverables

Pilot release dossier, operator training evidence, approved canary configuration and post-pilot recommendation.

Canonical context: [master plan](master-plan.md), [test strategy](../09-testing/testing-strategy.md), [risk register](../13-risks/risk-register.md).
