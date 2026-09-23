# ADR-001 — Modular monolith

Status: ACCEPTED. Date: 2026-09-23. Proposed accountable owner: technical lead. Acceptance evidence: Phase 01 workspace (`apps/api`, `apps/web`, `apps/worker`, shared packages) implements one modular monolith with API and worker entrypoints.

## Context

The platform must safely turn tenant-specific conversations into auditable business actions within a small initial operating footprint. Repository inspection found no existing architecture to migrate.

## Decision

One codebase with API and worker entrypoints; NestJS modules own domain boundaries.

## Alternatives and consequences

Microservices add distributed transactions and operations before load/team evidence justifies them. A single giant module obscures ownership.

## Validation and review trigger

Verify imports and shared transactional commands in P01/P02. Revisit when independently scaling teams or workloads produce measurable contention.

Approval record: accepted on Phase 01 scaffolding evidence 2026-09-23. Supersession: none.
