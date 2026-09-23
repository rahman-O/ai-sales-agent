# Leads workspace

## Purpose and interaction

List/filter by stage, owner and service; open detail with qualification evidence and stage history. A simple list is sufficient for MVP; drag-and-drop pipeline is optional.

## Data and failure behavior

Stage changes use command endpoints and expectedVersion. Present missing qualification fields or invalid transitions inline. Duplicate opportunity conflict links existing authorized lead.

## Acceptance

A contact can have multiple historical opportunities; booked/won facts are linked to evidence; no optimistic stage jump survives rejected backend validation.

Shared accessibility, cache and role rules: [information architecture](information-architecture.md). Proposed implementation belongs in `apps/web` feature routes; no UI is implemented in this package.
