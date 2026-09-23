# ADR-010 — Explicit outbound uncertainty

Status: PROPOSED. Date: 2026-09-23. Proposed accountable owner: technical lead.

## Context

The platform must safely turn tenant-specific conversations into auditable business actions within a small initial operating footprint. Repository inspection found no existing architecture to migrate.

## Decision

Represent UNKNOWN provider sends and require reconciliation/operator decision rather than blind resend.

## Alternatives and consequences

Database dedup cannot guarantee exactly-once external delivery without provider support.

## Validation and review trigger

P08 simulates acceptance followed by response loss; P09 UI shows in-flight takeover exception; P13 restore drill quarantines uncertain sends.

Approval record: pending architecture/product review. Supersession: none.
