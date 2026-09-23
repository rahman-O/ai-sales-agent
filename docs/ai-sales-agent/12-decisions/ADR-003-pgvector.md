# ADR-003 — pgvector for approved knowledge

Status: ACCEPTED. Date: 2026-09-23. Proposed accountable owner: technical lead. Acceptance evidence: Phase 00 spike enabled `vector` 0.8.6, inserted/queryied `vector(3)` under tenant RLS via Prisma raw SQL. Bilingual RAG quality remains a P05 concern.

## Context

The platform must safely turn tenant-specific conversations into auditable business actions within a small initial operating footprint. Repository inspection found no existing architecture to migrate.

## Decision

Keep versioned embeddings beside document metadata and tenant filters; begin exact search at pilot scale.

## Alternatives and consequences

A separate vector service adds a second isolation and deletion boundary without demonstrated need.

## Validation and review trigger

P05 benchmarks bilingual retrieval/tenant-filtered recall and deletion. Revisit at measured recall/latency/index maintenance limits.

Approval record: technically accepted on spike install/query/tenant-filter evidence 2026-09-23. Supersession: none.
