# ADR-007 — Layered bounded conversation memory

Status: PROPOSED. Date: 2026-09-23. Proposed accountable owner: technical lead.

## Context

The platform must safely turn tenant-specific conversations into auditable business actions within a small initial operating footprint. Repository inspection found no existing architecture to migrate.

## Decision

Use typed durable facts, versioned summaries and recent turns with bounded retrieved evidence.

## Alternatives and consequences

Unlimited transcripts increase cost and stale fact risk; vectorizing every fact obscures authoritative state.

## Validation and review trigger

P04 context-budget and P05 grounding evaluations; test changed/deleted facts and summary watermark races.

Approval record: pending architecture/product review. Supersession: none.
