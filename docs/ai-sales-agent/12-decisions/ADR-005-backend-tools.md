# ADR-005 — Backend-controlled tools

Status: ACCEPTED. Date: 2026-09-23. Proposed accountable owner: technical lead.

## Context

The platform must safely turn tenant-specific conversations into auditable business actions within a small initial operating footprint. Repository inspection found no existing architecture to migrate.

## Decision

The model requests actions; backend validates, authorizes and commits through a controlled registry. No direct LLM database mutation.

## Alternatives and consequences

Direct mutation or arbitrary code tools violate the explicit project requirement.

## Validation and review trigger

Accepted as a constraint explicitly required by the user brief, not implementation sign-off. P04/P07 denial and replay tests verify compliance.

Approval record: user brief establishes the invariant; implementation remains unapproved. Supersession: none.
