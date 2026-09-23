# ADR-002 — PostgreSQL as primary store

Status: ACCEPTED. Date: 2026-09-23. Proposed accountable owner: technical lead. Acceptance evidence: Phase 00 disposable spike (`spikes/database-compatibility/`) on PostgreSQL 17.11 with custom SQL migrations, RLS, exclusion constraints, and Prisma 7.10.0.

## Context

The platform must safely turn tenant-specific conversations into auditable business actions within a small initial operating footprint. Repository inspection found no existing architecture to migrate.

## Decision

Keep structured business truth, event/outbox and operation ledgers in PostgreSQL.

## Alternatives and consequences

Document stores simplify some payloads but do not remove relational consistency needs; Redis is not durable booking truth.

## Validation and review trigger

P00 validates host, RLS, backups and extensions. P07 proves concurrent slot exclusion. Revisit for measured scale or residency contracts.

Approval record: technically accepted on spike evidence 2026-09-23; product/hosting region approval for managed Supabase remains a P01/ops follow-through. Supersession: none.
