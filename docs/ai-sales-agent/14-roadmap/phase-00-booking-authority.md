# Phase 00 booking authority analysis

Decision status: PROPOSED — internal booking engine for MVP, conditional on clinic approval and exclusive operational use.

## Options

### A — Internal booking engine is authoritative

Availability and confirmed allocations live in PostgreSQL. This allows one transaction to validate the proposal, current price/schedule, confirmation evidence, and non-overlap constraint. It is the lowest technical risk for MVP if operators enter every relevant appointment and schedule change in this product. Its operational risk is shadow booking in paper, phone, or external calendars.

### B — External calendar is authoritative

Availability and commitment depend on the external provider. This respects an existing operational system but introduces credentials, mapping, quota, webhook replay, stale free/busy, provider-specific idempotency, partial failure, and reconciliation. A local “success” is invalid until the provider confirms its authoritative write. This adds a new Phase 00 provider decision and moves calendar integration ahead of P07.

### C — Hybrid authority

The platform and external system both accept writes. Without a single field/resource owner and conflict policy, hybrid is the highest-risk option. Even with a synchronization contract, neither database transactions nor queue ordering makes a third-party write atomic. Use only when a concrete clinic workflow requires it and an ADR defines write ownership, degraded mode, replay, conflict resolution, and reconciliation.

## Recommended MVP semantics

Choose A only if the clinic commits to this platform as the complete appointment ledger. Store organization/location IANA timezone, but persist booking instants in UTC with the display timezone and immutable service duration/price snapshots. Availability is derived from location hours, staff working hours, effective-dated rules, date-specific available/blocked overrides, service eligibility, lead-time policy, buffers, and existing CONFIRMED allocations.

Slot search returns advisory candidates. `prepareBooking` creates an expiring proposal bound to organization, customer, conversation, service, staff, exact UTC/local time, current schedule/price versions, amount/currency, and a hash. The customer must explicitly confirm those terms. The AI cannot manufacture confirmation. `createBooking` revalidates all facts and commits only if the authoritative database operation succeeds. Only then may a backend-rendered response call it confirmed.

Concurrent attempts are resolved in PostgreSQL: a partial exclusion constraint on organization, staff, and half-open occupied `tstzrange` for CONFIRMED bookings prevents overlap; a staff schedule row lock/version coordinates schedule edits with booking commits. Application checks improve UX but are not the final correctness boundary. Adjacent ranges may touch. Service buffers are part of the occupied range.

Cancellation requires an action-specific confirmed proposal, current booking version, policy check, and audit. A committed cancellation releases the range. Reschedule is one atomic operation that validates the replacement and changes the existing booking; on conflict the original appointment remains. Terminal history is append-only. A send failure after a successful mutation does not roll back the booking; it creates an operator-visible delivery problem.

## Approval evidence

The clinic must disclose every current booking channel/system, confirm that operators will enter phone/walk-in appointments here, supply sample services/durations/buffers/hours/overrides, approve timezone and cancellation/reschedule semantics, and accept the exact confirmation wording. If any external system remains authoritative or independently writable, keep ADR-009 PROPOSED and revise the critical path before P01 approval.

