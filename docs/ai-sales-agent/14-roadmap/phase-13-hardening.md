# Phase 13 — Security, performance and resilience validation

Status: **CLOSED**. Relative complexity: XL. Discovery and design lock are recorded in [phase-13-discovery-report.md](phase-13-discovery-report.md) and [phase-13-design-lock.md](phase-13-design-lock.md); evidence in [phase-13-findings-register.md](phase-13-findings-register.md), [phase-13-resilience-load-report.md](phase-13-resilience-load-report.md), [phase-13-ops-evidence.md](phase-13-ops-evidence.md), [phase-13-closure.md](phase-13-closure.md). **P14 remains unauthorized.**

## 1. Objective

Prove the integrated system can safely handle the approved pilot load and recover from realistic failures.

## 2. Why This Phase Exists

Security/observability were built throughout; this phase validates their combined behavior before external scale.

## 3. Entry Criteria

MVP milestone passed; P10/P12 CLOSED for pilot scope; deployment environment and target SLO/load envelope approved.

## 4. Scope

Threat-model review, adversarial security suite, sustained/burst/fairness load tests, crash/provider-failure drills, restore/deletion drill and operational alerts.

## 5. Out of Scope

New feature expansion, microservice rewrite or claiming certification without an appropriate audit.

## 6. Architecture Impact

Tune indexes, limits, pools and worker concurrency only using measured evidence; preserve domain/tool contracts.

## 7. Files / Modules Expected

Likely implementation locations: tests/security, tests/load, infrastructure deployment configs, monitoring and recovery runbooks.

## 8. Data Model Changes

Validate all RLS/index/constraint metadata; any new index/migration follows expand-compatible rollout; no unnecessary new domain tables.

## 9. APIs

Exercise all exposed APIs/webhooks/subscriptions with role and load matrices; verify readiness and administrative replay controls.

## 10. Business Rules

Zero known critical isolation/integrity failures; no unlimited retries/spend; restore quarantines uncertain outbound work.

## 11. Implementation Tasks

- [x] P13-T001: Execute threat-model and tenant-boundary suite. Verification: Every new table/API/job/storage path is covered with two-tenant probes.
- [x] P13-T002: Run approved baseline/burst/noisy-tenant load test. Verification: Measured latency/queue/fairness meets targets or causes explicit scope revision.
- [x] P13-T003: Inject worker/Redis/DB/provider failures. Verification: Durable work recovers without duplicate business mutations.
- [x] P13-T004: Perform isolated backup/restore plus deletion replay. Verification: Measured RPO/RTO and post-restore outbound quarantine are documented.
- [x] P13-T005: Validate alerts, secret rotation and incident ownership. Verification: On-call can follow alerts to a tested mitigation without hidden knowledge.
- [x] P13-T006: Close critical findings and record residual risk review. Verification: Release reviewers see reproducible reports and no unowned critical defects.

## 12. Testing Requirements

- Unit: Regression tests for every discovered logic defect and retry/limit configuration.
- Integration: Real pooled DB/RLS, lease reclaim, provider uncertainty, retention purge and restore reconciliation.
- E2E: Staging customer journey survives controlled failures and operator handoff without false success.
- Failure scenarios: Crash at every commit/send boundary, stolen/revoked credential simulation, parser abuse and hot-tenant exhaustion.

## 13. Observability Requirements

Measured SLOs, saturation curves, alert delivery proof, runbook timing and incident correlations.

## 14. Security Considerations

Independent checklist review, dependency/image/secret scan, authorization probes and privacy deletion evidence.

## 15. Acceptance Criteria

- [x] Approved load/SLO targets have measured evidence.
- [x] No critical tenant, booking or false-success defect remains open.
- [x] Restore drill meets approved recovery goals or blocks pilot.
- [x] Alerts and kill switches have been exercised by designated operators.

## 16. Exit Criteria

All P13 tasks are implemented or formally removed through reviewed scope change; required tests and acceptance checks pass; linked architecture/API/data documents match actual behavior; evidence and reviewer sign-off are recorded using the [closure template](phase-closure-template.md). No critical unresolved defect in this phase's boundary remains. A list of created files alone is not closure evidence.

## 17. Dependencies

Requires integrated MVP plus P10/P12; blocks P14 external pilot readiness.

## 18. Risks

R01/R02/R06/R09/R10/R13/R15; capacity claims without measurements are invalid.

## 19. Deliverables

Hardening report, load/fault/security evidence, restore report and operational runbooks.

Canonical context: [master plan](master-plan.md), [test strategy](../09-testing/testing-strategy.md), [risk register](../13-risks/risk-register.md).
