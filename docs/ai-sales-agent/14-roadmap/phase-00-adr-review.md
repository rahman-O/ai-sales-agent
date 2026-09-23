# Phase 00 ADR review

Review date: 2026-09-23 (updated after disposable database spike). Status labels use only PROPOSED | ACCEPTED | SUPERSEDED.

## ADR-001 — Modular monolith

Disposition: KEEP **PROPOSED**. Recommended for P01 scaffolding; not re-labeled ACCEPTED until module boundaries exist in code.

## ADR-002 — PostgreSQL primary database

Disposition: **ACCEPTED**. Spike evidence: PostgreSQL 17.11, custom migrations, RLS, exclusion constraints, Prisma 7.10.0 connectivity. Managed Supabase region/host still an ops follow-through.

## ADR-003 — pgvector for approved knowledge

Disposition: **ACCEPTED** for store/extension strategy. Spike proved install, insert, tenant-scoped similarity. Bilingual recall/latency remains P05.

## ADR-004 — BullMQ with durable database intent

Disposition: KEEP **PROPOSED**. Tenant job `organizationId` invariant documented; Redis/BullMQ not executed in P00 spike.

## ADR-005 — Backend-controlled tools

Disposition: **ACCEPTED** (unchanged). User-mandated invariant.

## ADR-006 — MessagingChannel boundary

Disposition: KEEP **PROPOSED**. Fake channel for early phases; WhatsApp = P08.

## ADR-007 — Layered bounded memory

Disposition: KEEP **PROPOSED**. Awaits P04 implementation evidence.

## ADR-008 — Shared schema with scoped commands and RLS

Disposition: **ACCEPTED**. Spike proved FORCE RLS, non-owner role, transaction-local scope, connection-reuse isolation, composite FKs.

## ADR-009 — Internal booking authority

Disposition: KEEP **PROPOSED**. Exclusion-constraint concurrency primitive **PASS** in spike; clinic SoT decision (Q02) still required for operational acceptance.

## ADR-010 — Explicit outbound uncertainty

Disposition: KEEP **PROPOSED**. Awaits P08 provider evidence.

## Review conclusion

Executable spike evidence justifies accepting ADR-002, ADR-003, and ADR-008. ADR-005 remains ACCEPTED. Product/provider ADRs stay PROPOSED. No ADR SUPERSEDED. Technical readiness: see [phase-00-technical-readiness.md](phase-00-technical-readiness.md).
