# Phase 00 — Discovery and architecture validation

Status: IN REVIEW — **TECHNICAL READY_FOR_P01**; pilot/product items deferred to later gates. Relative complexity: M. Proposed accountable owner: product and technical leads. See [closure report](phase-00-closure.md) and [technical readiness](phase-00-technical-readiness.md).

## 1. Objective

Resolve the business and platform assumptions that can invalidate the implementation sequence.

## 2. Why This Phase Exists

An empty repository provides no evidence about provider access, calendar ownership, operational capacity or regulatory constraints.

## 3. Entry Criteria

The planning package is available for review; product and technical decision owners are identified. No production implementation is authorized by this document.

## 4. Scope

Pilot interviews and baseline; Q01–Q08 decisions; threat/data-flow review; WhatsApp sandbox eligibility; compatible stack/host selection; architecture review and evaluation fixture outline.

## 5. Out of Scope

Production application features, real customer traffic, infrastructure purchases or deployment without separate authorization.

## 6. Architecture Impact

Confirm or revise proposed module boundaries, tenancy model, calendar authority, identity/session design and provider adapters before scaffolding.

## 7. Files / Modules Expected

docs/ai-sales-agent; future isolated compatibility-spike workspace only after approval. No application folders are assumed to exist.

## 8. Data Model Changes

Review the entity catalog and global-user exception; prove planned PostgreSQL extension/RLS/exclusion support in a disposable spike, without creating a final production schema.

## 9. APIs

Validate webhook challenge/signature/payload shapes in provider sandbox and identify identity-provider contract. Review staff API and tool contracts for missing business decisions.

## 10. Business Rules

No inferred clinical capability, no assumed external calendar authority, no acceptance of unverified provider limits. Design approval must be recorded before P01.

## 11. Implementation Tasks

- [ ] P00-T001: Interview pilot owner/operators and document baseline plus inquiry-to-booking workflow. Verification: Interview notes identify volume, staff coverage, current booking source and failure points. **Deferred gate: P14 / product (does not block P01 scaffolding).**
- [ ] P00-T002: Resolve Q01–Q08 with named owners and decision deadlines. Verification: Every question is answered or explicitly blocks its dependent phase. **Partial: Prisma pin + D09 accepted; remaining items reclassified to P07/P08/P14/PRODUCTION.**
- [ ] P00-T003: Validate Meta account, test-number, template and webhook access. Verification: A dated sandbox report contains verified event fixtures and remaining onboarding constraints. **Deferred gate: P08.**
- [x] P00-T004: Prove selected database/ORM/pool compatibility. Verification: Disposable spike verifies tenant-local context, required extensions and transactional conflict primitive. **DONE locally — Prisma 7.10.0 / PG 17 / 12/12 PASS. Supabase hosted pooler: P01 follow-through.**
- [ ] P00-T005: Review threat model, ADRs, scope and measurable release targets. Verification: Review record approves or revises proposed decisions and identifies residual risks. **ADR-002/003/008 accepted on spike evidence; human product review still open.**
- [ ] P00-T006: Approve roadmap and fixture plan. Verification: Product/technical reviewers record authorization for P01; no phase closes merely on document existence. **Technical READY_FOR_P01; named ceremony still open.**

## 12. Testing Requirements

- Unit: Review confirmation, qualification and timezone examples as explicit expected outcomes for future tests.
- Integration: Run disposable provider/database compatibility probes only when discovery work is authorized; capture failures and supported versions.
- E2E: Walk through customer inquiry, booking and human escalation with operators using a storyboard and sandbox account.
- Failure scenarios: Document blocked provider access, external calendar dependency and unsuitable host capabilities as replan triggers.

## 13. Observability Requirements

Define event IDs, required trace fields, pilot SLOs, budget limits and incident ownership; produce a reviewed observability checklist.

## 14. Security Considerations

Approve data categories, region and provider processing constraints; review tenant threats and clinical-scope exclusions.

## 15. Acceptance Criteria

- [ ] Repository assessment is reviewed and all proposed paths remain clearly labeled.
- [ ] Booking source of truth and pilot vertical are explicitly chosen.
- [ ] Provider/host compatibility has evidence or a recorded blocking dependency.
- [ ] Product and technical owners approve scope, gates and P01 start.

## 16. Exit Criteria

Discovery tasks and probes have reviewable evidence; product/technical decisions and remaining explicit blockers are recorded; documentation is updated and P01 implementation approval is captured using the [closure template](phase-closure-template.md). This planning package alone does not satisfy that review or authorize implementation.

## 17. Dependencies

No preceding implementation phase. Blocks P01; provider/calendar decisions also block P07/P08/P14.

## 18. Risks

R04, R05, R08, R12 and R13 can change scope or prevent pilot launch.

## 19. Deliverables

Decision log, approved ADR set, provider/host spike evidence, baseline metrics, named owners and reviewed roadmap.

Current evidence package: [audit](phase-00-audit.md), [decision register](phase-00-decision-register.md), [product boundary](phase-00-product-boundary.md), [booking authority](phase-00-booking-authority.md), [tenancy validation](phase-00-tenancy-validation.md), [database spike](phase-00-database-spike.md), [technical readiness](phase-00-technical-readiness.md), [WhatsApp discovery](phase-00-whatsapp-discovery.md), [threat review](phase-00-threat-review.md), [AI trust boundary](phase-00-ai-trust-boundary.md), [evaluation fixtures](phase-00-evaluation-fixtures.md), [pilot metrics](phase-00-pilot-metrics.md), [ADR review](phase-00-adr-review.md), and [closure report](phase-00-closure.md). Technical database spike is complete; pilot/WhatsApp/privacy evidence remains deferred to later gates.

Canonical context: [master plan](master-plan.md), [test strategy](../09-testing/testing-strategy.md), [risk register](../13-risks/risk-register.md).
