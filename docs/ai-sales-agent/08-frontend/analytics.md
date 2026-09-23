# Analytics workspace

## Purpose and interaction

Show defined funnel cohorts, model usage/cost, human escalation and verified attendance/revenue with sample counts and as-of times. Keep currency series separate unless an explicit exchange-rate policy exists.

## Data and failure behavior

Projection lag shows a freshness banner. Missing attendance/revenue is unknown, not zero. Export requires role checks and audit; small sensitive cohorts are suppressed.

## Acceptance

A sample lead traces to booking and attendance without duplicate retry counts; booked value and actual revenue have distinct labels; trace links enforce operational permissions.

Shared accessibility, cache and role rules: [information architecture](information-architecture.md). Proposed implementation belongs in `apps/web` feature routes; no UI is implemented in this package.
