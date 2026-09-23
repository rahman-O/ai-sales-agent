# Integration risks

External account/policy and uncertain I/O behavior need sandbox evidence, not assumptions.

- [R04: Provider onboarding delays or policy mismatch](risk-register.md) — P00 sandbox/access/policy review; keep simulator for development. Closure gate: P00/P08.
- [R10: Unknown send or replay after restore](risk-register.md) — UNKNOWN state, reconciliation and outbound quarantine during restore. Closure gate: P08/P13.
- [R15: Provider outage or revoked credentials](risk-register.md) — Durable backlog, circuit breaking, safe pause and reconnect workflow. Closure gate: P08/P13.

The register owns severity, accountability and release-blocking triggers. Record realized incidents and mitigation evidence there; do not duplicate divergent risk scores across documents.
