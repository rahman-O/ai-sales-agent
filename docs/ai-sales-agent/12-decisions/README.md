# Architecture decision records

Architecture status is independent of implementation status. Only ADR-005 is ACCEPTED because it restates an explicit user requirement; all design selections await review. No phase is closed.

- [ADR-001: Modular monolith](ADR-001-modular-monolith.md) — PROPOSED.
- [ADR-002: PostgreSQL as primary store](ADR-002-postgresql.md) — PROPOSED.
- [ADR-003: pgvector for approved knowledge](ADR-003-pgvector.md) — PROPOSED.
- [ADR-004: BullMQ with durable database intent](ADR-004-bullmq.md) — PROPOSED.
- [ADR-005: Backend-controlled tools](ADR-005-backend-tools.md) — ACCEPTED.
- [ADR-006: MessagingChannel boundary](ADR-006-messaging-channel.md) — PROPOSED.
- [ADR-007: Layered bounded conversation memory](ADR-007-layered-memory.md) — PROPOSED.
- [ADR-008: Shared schema with scoped commands and RLS](ADR-008-tenant-isolation.md) — PROPOSED.
- [ADR-009: Internal booking authority](ADR-009-booking-authority.md) — PROPOSED.
- [ADR-010: Explicit outbound uncertainty](ADR-010-outbound-uncertainty.md) — PROPOSED.
- [ADR-011: Narrow privileged work-claim for FORCE RLS workers](ADR-011-privileged-work-claim.md) — ACCEPTED (P03).

Use the [template](ADR-template.md). A changed decision must explain affected contracts, tests, roadmap tasks and migration; preserve superseded records.
