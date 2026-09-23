# ADR-009 — Internal booking authority

Status: PROPOSED. Date: 2026-09-23. Proposed accountable owner: technical lead. Note: PostgreSQL exclusion-constraint primitive validated in Phase 00 spike; clinic system-of-record decision (Q02) still required before treating this ADR as operationally ACCEPTED.

## Context

The platform must safely turn tenant-specific conversations into auditable business actions within a small initial operating footprint. Repository inspection found no existing architecture to migrate.

## Decision

MVP uses PostgreSQL as the appointment system of record with transactional non-overlap and confirmed proposals.

## Alternatives and consequences

External calendar authority requires synchronization/reconciliation before pilot; pretending both commit atomically is invalid.

## Validation and review trigger

Product resolves Q02 in P00; if external authority is required, revise P07 and critical path before implementation.

Approval record: pending architecture/product review. Supersession: none.
