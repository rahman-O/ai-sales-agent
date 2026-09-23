# ADR-008 — Shared schema with scoped commands and RLS

Status: ACCEPTED. Date: 2026-09-23. Proposed accountable owner: technical lead. Acceptance evidence: Phase 00 spike proved FORCE RLS, non-owner runtime role, transaction-local `set_config`, connection-reuse isolation, and composite tenant FKs under Prisma 7.10.0.

## Context

The platform must safely turn tenant-specific conversations into auditable business actions within a small initial operating footprint. Repository inspection found no existing architecture to migrate.

## Decision

Every tenant-owned record uses organization scope, composite references and runtime RLS; global user identity is explicit.

## Alternatives and consequences

Schema/database per tenant increases operations at pilot scale; application filtering alone leaves query-omission risk.

## Validation and review trigger

P01 pooled-connection/raw SQL/nested-write isolation suite; revisit contractual dedicated-instance or regional requirements.

Approval record: technically accepted on spike evidence 2026-09-23; Supabase pooler re-validation remains P01. Supersession: none.
