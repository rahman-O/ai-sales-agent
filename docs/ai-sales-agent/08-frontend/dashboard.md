# Dashboard

## Purpose and interaction

Show backlog, unassigned paused conversations, today’s bookings and unresolved send failures before vanity counts. Date ranges use organization timezone; each metric links to filtered records.

## Data and failure behavior

Aggregate read endpoints use consistent as-of time and scoped projections. Partial metric failure displays unavailable rather than zero.

## Acceptance

Operator can reach the oldest unassigned conversation in one navigation step; stale data timestamp is visible; aggregate-only users cannot open transcripts.

Shared accessibility, cache and role rules: [information architecture](information-architecture.md). Proposed implementation belongs in `apps/web` feature routes; no UI is implemented in this package.
