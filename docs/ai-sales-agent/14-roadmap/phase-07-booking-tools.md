# Phase 07 — Services, availability and safe booking

Status: NOT STARTED. Relative complexity: XL. Proposed accountable owner: engineering lead with product reviewer. Dates and staffing are unestimated.

## 1. Objective

Create, cancel and reschedule appointments through confirmed proposals and transactional resource constraints.

## 2. Why This Phase Exists

Booking is the highest-impact business mutation and must remain correct under concurrency and model retries.

## 3. Entry Criteria

P06 and P04 CLOSED; catalog references exist; Q02 confirms internal authority or approved synchronization scope replaces this phase.

## 4. Scope

Working hours/overrides, slot generation, proposal/confirmation evidence, booking commands/tools, catalog/schedule editor and booking view.

## 5. Out of Scope

Payments, external calendars, group/multi-resource/recurring appointments and model-created clinical recommendations.

## 6. Architecture Impact

Bookings owns schedule locks and allocation; agent invokes exported commands; lead BOOKED transitions occur with committed booking.

## 7. Files / Modules Expected

Likely implementation locations: apps/api/src/modules/bookings and services; agent/tools/bookings; apps/web/bookings; prisma/migrations.

## 8. Data Model Changes

WorkingHours, AvailabilityOverride, BookingProposal, Booking and BookingHistory; staff schedule version, occupied-range exclusion and command links.

## 9. APIs

Availability/catalog/staff/schedule/booking APIs; getServicePrice/getAvailableSlots/prepareBooking/createBooking/cancelBooking/rescheduleBooking.

## 10. Business Rules

Explicit confirmation of exact terms; no slot hold implied by search; overlap forbidden; reschedule atomic; changed terms need fresh consent.

## 11. Implementation Tasks

- [ ] P07-T001: Implement schedules and slot computation with timezone rules. Verification: Fixtures cover overrides, buffers, adjacent slots and ambiguous local time.
- [ ] P07-T002: Add database exclusion and schedule-lock protocol. Verification: Two simultaneous conflicting creates allow exactly one.
- [ ] P07-T003: Implement expiring proposal and server confirmation evidence. Verification: Model boolean or ambiguous affirmative cannot confirm.
- [ ] P07-T004: Implement idempotent create/cancel/reschedule commands. Verification: Crash replay yields one effect; failed reschedule preserves original.
- [ ] P07-T005: Register tools and backend confirmation rendering. Verification: Reply names only the committed booking/time/price.
- [ ] P07-T006: Build operator booking/catalog controls and tests. Verification: Manual actions require permissions, versions and explicit customer-agreement attestation.

## 12. Testing Requirements

- Unit: Availability, durations/buffers, price versions, confirmation parsing, cancellation policy and state transitions.
- Integration: Overlapping concurrent booking, concurrent schedule edit, atomic reschedule and operation-result crash recovery.
- E2E: Customer receives price/slots, confirms, books, reschedules and cancels; staff records attendance in a separate authorized action.
- Failure scenarios: Expired proposal, stale price, slot taken after offer, timezone ambiguity, DB commit response loss and message send failure.

## 13. Observability Requirements

Proposal/confirmation/action references, slot conflicts, booking latency and linked lead events.

## 14. Security Considerations

Bind proposals to customer/conversation; no arbitrary customer booking; only staff record attendance; PII-minimized snapshots.

## 15. Acceptance Criteria

- [ ] Overlapping confirmed allocations for a staff member are impossible under race tests.
- [ ] Unconfirmed or stale proposals cannot create bookings.
- [ ] Repeated create/reschedule/cancel operations are idempotent.
- [ ] AI claims match committed booking results, and failed reschedule leaves original intact.

## 16. Exit Criteria

All P07 tasks are implemented or formally removed through reviewed scope change; required tests and acceptance checks pass; linked architecture/API/data documents match actual behavior; evidence and reviewer sign-off are recorded using the [closure template](phase-closure-template.md). No critical unresolved defect in this phase's boundary remains. A list of created files alone is not closure evidence.

## 17. Dependencies

Requires P06/P04; required for integrated MVP, P10 reminder targets and P12 outcomes.

## 18. Risks

R02, R03, R05, R11, R13; external calendar authority would require replanning.

## 19. Deliverables

Booking schema/constraints/tools, schedule and booking UI, race tests and confirmed-action E2E evidence.

Canonical context: [master plan](master-plan.md), [test strategy](../09-testing/testing-strategy.md), [risk register](../13-risks/risk-register.md).
