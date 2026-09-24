# ADR-009 — Internal booking authority

Status: **ACCEPTED** (internal). Date: 2026-09-24. Accountable: engineering.

## Context

P07 requires an appointment system of record without external calendar sync.

## Decision

PostgreSQL is the appointment system of record. Confirmed bookings use transactional GiST exclusion on occupied ranges (`btree_gist`). Availability search and HMAC slot tokens are advisory; create/reschedule always revalidate. External calendar authority is deferred (non-goal for P07).

## Consequences

- Q02 resolved for P07 as INTERNAL
- No Google/Outlook/Apple sync in this phase
- Hosted migration role must support `CREATE EXTENSION btree_gist` (verified PASS before P07 migration)

## Supersession

Supersedes PROPOSED draft that waited on Q02/external calendar.
