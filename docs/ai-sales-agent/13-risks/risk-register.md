# Risk register

All risks are OPEN planning risks. Likelihood/impact are qualitative assumptions, not measured probabilities. Owners are proposed roles, not assigned people. Review at each phase entry/exit.

Phase 00 review note (2026-09-23): no risk is closed or reduced. R04/R05/R08/R12/R13 are confirmed P01 decision/evidence blockers: Meta access is absent, booking authority is unapproved, dental data/jurisdiction is unknown, operator coverage is unnamed, and the database compatibility spike is unexecuted. The detailed threat/control/test matrix is in [Phase 00 threat review](../14-roadmap/phase-00-threat-review.md).

## R01 — Cross-tenant data exposure

Category: technical. Impact: Critical. Likelihood: Medium. Owner: Technical lead. Gate: P01 and every phase.

Cause: Scope omissions in raw SQL, jobs, storage or tracing. Mitigation: Composite references, RLS, server context and adversarial two-tenant tests. Trigger/acceptance: Any cross-scope read/write; blocks every release. Residual risk: verify mitigation with phase evidence before lowering severity.

## R02 — Duplicate or conflicting business actions

Category: technical. Impact: Critical. Likelihood: High. Owner: Backend lead. Gate: P03/P07/P08.

Cause: Webhook/worker replay and concurrent slot offers. Mitigation: Operation ledger, semantic proposal keys, exclusion constraint and crash tests. Trigger/acceptance: More than one effect per operation or overlapping confirmed allocation. Residual risk: verify mitigation with phase evidence before lowering severity.

## R03 — False success or invented price

Category: ai. Impact: High. Likelihood: High. Owner: AI lead. Gate: P04/P07/P14.

Cause: Probabilistic output without authoritative evidence. Mitigation: Structured tools and backend-rendered action confirmation. Trigger/acceptance: Any false success in release set blocks promotion. Residual risk: verify mitigation with phase evidence before lowering severity.

## R04 — Provider onboarding delays or policy mismatch

Category: integration. Impact: High. Likelihood: High. Owner: Product/integration lead. Gate: P00/P08.

Cause: Unverified account ownership, templates or vertical eligibility. Mitigation: P00 sandbox/access/policy review; keep simulator for development. Trigger/acceptance: No verified test account by P01; replan external MVP. Residual risk: verify mitigation with phase evidence before lowering severity.

## R05 — Existing calendar remains authoritative

Category: product. Impact: Critical. Likelihood: Medium. Owner: Product lead. Gate: P00/P07.

Cause: Operators continue booking in another system. Mitigation: Resolve Q02; bring synchronization into scope if required. Trigger/acceptance: External appointments absent from availability invalidate pilot. Residual risk: verify mitigation with phase evidence before lowering severity.

## R06 — Takeover race sends stale AI text

Category: technical. Impact: High. Likelihood: High. Owner: Backend lead. Gate: P03/P09.

Cause: Model/provider I/O overlaps ownership change. Mitigation: Epoch/fence checks and visible in-flight dispatch exception. Trigger/acceptance: Pending old-epoch send dispatches after takeover commit. Residual risk: verify mitigation with phase evidence before lowering severity.

## R07 — Prompt injection or poisoned knowledge

Category: ai. Impact: High. Likelihood: High. Owner: AI/security lead. Gate: P04/P05.

Cause: Customer or document instructions seek privileged actions. Mitigation: Limited tools, approval pipeline, provenance and adversarial tests. Trigger/acceptance: Unauthorized action or leaked data blocks release. Residual risk: verify mitigation with phase evidence before lowering severity.

## R08 — Sensitive clinic data collected without approved policy

Category: product. Impact: Critical. Likelihood: Medium. Owner: Product/privacy reviewer. Gate: P00/P14.

Cause: Reception scope expands into clinical workflow. Mitigation: Minimize data, prohibit clinical advice, resolve region/retention/processing terms. Trigger/acceptance: Unapproved sensitive workflow prevents pilot activation. Residual risk: verify mitigation with phase evidence before lowering severity.

## R09 — Runaway cost or hot-tenant starvation

Category: technical. Impact: High. Likelihood: Medium. Owner: Platform lead. Gate: P04/P13.

Cause: Repeated inference and unconstrained concurrent runs. Mitigation: Atomic cost reservations, bounded loops and per-tenant fairness. Trigger/acceptance: Tenant exceeds configured reserve or other tenants miss queue target. Residual risk: verify mitigation with phase evidence before lowering severity.

## R10 — Unknown send or replay after restore

Category: integration. Impact: High. Likelihood: High. Owner: Platform lead. Gate: P08/P13.

Cause: Provider accepts before connection loss or backup rollback. Mitigation: UNKNOWN state, reconciliation and outbound quarantine during restore. Trigger/acceptance: Unreconciled sends prevent affected queue release. Residual risk: verify mitigation with phase evidence before lowering severity.

## R11 — Iraqi Arabic or timezone misunderstanding

Category: ai. Impact: High. Likelihood: Medium. Owner: Product/AI lead. Gate: P04/P07/P14.

Cause: Dialect ambiguity and informal scheduling terms. Mitigation: Native-speaker evaluation and explicit localized confirmation. Trigger/acceptance: Unsafe/wrong-time action or dialect score below gate. Residual risk: verify mitigation with phase evidence before lowering severity.

## R12 — No staff coverage for escalations

Category: product. Impact: High. Likelihood: Medium. Owner: Operations owner. Gate: P09/P14.

Cause: AI pauses but nobody answers. Mitigation: Named coverage rota, queue-age alert and approved off-hours message. Trigger/acceptance: Unassigned requests exceed agreed response coverage SLA. Residual risk: verify mitigation with phase evidence before lowering severity.

## R13 — ORM/host features do not support chosen constraints

Category: technical. Impact: High. Likelihood: Medium. Owner: Technical lead. Gate: P00/P01.

Cause: Version/extension or pool assumptions not verified. Mitigation: P00 compatibility spike for RLS, pgvector, exclusion and migrations. Trigger/acceptance: Any missing integrity primitive requires ADR revision. Residual risk: verify mitigation with phase evidence before lowering severity.

## R14 — Misleading funnel or revenue claims

Category: product. Impact: Medium. Likelihood: High. Owner: Product/data lead. Gate: P12.

Cause: Bookings counted as paid outcomes; duplicate events. Mitigation: Evidence-linked outcomes, cohort definitions and replay-safe projections. Trigger/acceptance: Totals cannot reconcile to source IDs. Residual risk: verify mitigation with phase evidence before lowering severity.

## R15 — Provider outage or revoked credentials

Category: integration. Impact: High. Likelihood: Medium. Owner: Integration lead. Gate: P08/P13.

Cause: External availability and account lifecycle. Mitigation: Durable backlog, circuit breaking, safe pause and reconnect workflow. Trigger/acceptance: Growing queue or revoked token alerts operators. Residual risk: verify mitigation with phase evidence before lowering severity.
