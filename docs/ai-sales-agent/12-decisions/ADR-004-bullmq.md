# ADR-004 — BullMQ with durable database intent

Status: PROPOSED. Date: 2026-09-23. Proposed accountable owner: technical lead.

## Context

The platform must safely turn tenant-specific conversations into auditable business actions within a small initial operating footprint. Repository inspection found no existing architecture to migrate.

## Decision

Use Redis/BullMQ for asynchronous wake-ups with PostgreSQL outbox, sweeper and idempotent commands.

## Alternatives and consequences

In-memory jobs lose acknowledged work; a larger workflow platform is unnecessary for bounded current processes.

## Validation and review trigger

P03/P08 inject crashes and Redis loss; P10 proves due-work rebuild. Queue IDs alone never certify exactly-once effects.

Approval record: pending architecture/product review. Supersession: none.
