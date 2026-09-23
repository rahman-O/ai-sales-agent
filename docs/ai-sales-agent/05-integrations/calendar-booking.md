# Booking source of truth and calendar boundary

MVP PostgreSQL is the appointment source of truth. An external calendar is not required. Discovery must confirm operators will maintain availability and all relevant bookings here; otherwise silent external conflicts invalidate the design and a calendar synchronization phase must precede pilot.

Generate candidate slots from service duration/buffers, eligible active staff, local working hours, date-specific overrides, lead time and confirmed allocations. Convert using IANA timezone rules, reject ambiguous/nonexistent local times until clarified, and store UTC instants. One active location per tenant limits MVP complexity without hardcoding clinic concepts.

Slot search is advisory. Backend proposals snapshot current terms; customer confirmation and transactional conflict enforcement are required for reservation. Concurrent schedule edits share the staff schedule lock with bookings. Cancellation and reschedule policies are versioned configuration and checked by backend commands.

Future external calendars need sync tokens, provider event IDs, conflict ownership, webhook dedup, reconciliation and explicit degraded-mode behavior. An outbound calendar event after a booking commit is not proof that an externally managed slot was reserved. Do not pretend a database transaction can atomically commit to a third-party calendar. [Booking state machine](../03-domain/booking-state-machine.md).
