# Organization settings

## Purpose and interaction

Manage members/roles, timezone/currency, WhatsApp connection health, service catalog, staff eligibility and hours. Owner handles ownership transfer and offboarding.

## Data and failure behavior

Warn on timezone changes affecting future displays; schedule changes conflicting with bookings fail for resolution. Credential entry is write-only and masked after save.

## Acceptance

Last owner cannot be removed; another tenant’s phone number cannot attach; each member change is audited; archived services disappear from new booking choices.

Shared accessibility, cache and role rules: [information architecture](information-architecture.md). Proposed implementation belongs in `apps/web` feature routes; no UI is implemented in this package.
