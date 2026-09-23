# Technical risks

Integrity, recovery and isolation take precedence over throughput optimization.

- [R01: Cross-tenant data exposure](risk-register.md) — Composite references, RLS, server context and adversarial two-tenant tests. Closure gate: P01 and every phase.
- [R02: Duplicate or conflicting business actions](risk-register.md) — Operation ledger, semantic proposal keys, exclusion constraint and crash tests. Closure gate: P03/P07/P08.
- [R06: Takeover race sends stale AI text](risk-register.md) — Epoch/fence checks and visible in-flight dispatch exception. Closure gate: P03/P09.
- [R09: Runaway cost or hot-tenant starvation](risk-register.md) — Atomic cost reservations, bounded loops and per-tenant fairness. Closure gate: P04/P13.
- [R13: ORM/host features do not support chosen constraints](risk-register.md) — P00 compatibility spike for RLS, pgvector, exclusion and migrations. Closure gate: P00/P01.

The register owns severity, accountability and release-blocking triggers. Record realized incidents and mitigation evidence there; do not duplicate divergent risk scores across documents.
