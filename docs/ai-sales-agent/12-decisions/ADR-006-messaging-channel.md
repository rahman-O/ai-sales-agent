# ADR-006 — MessagingChannel boundary

Status: PROPOSED. Date: 2026-09-23. Proposed accountable owner: technical lead.

## Context

The platform must safely turn tenant-specific conversations into auditable business actions within a small initial operating footprint. Repository inspection found no existing architecture to migrate.

## Decision

Normalize messages/policy results in adapters; keep WhatsApp details outside the agent domain.

## Alternatives and consequences

Putting provider payloads in agent/domain code couples future channels to business logic. A universal integration framework is unnecessary.

## Validation and review trigger

P03 fake adapter and P08 WhatsApp pass the same contract fixtures. Revisit only when a second channel shows a concrete mismatch.

Approval record: pending architecture/product review. Supersession: none.
