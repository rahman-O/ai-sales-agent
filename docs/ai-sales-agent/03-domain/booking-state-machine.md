# Booking state machine (P07)

```mermaid
stateDiagram-v2
  [*] --> CONFIRMED: createBooking commits
  CONFIRMED --> CONFIRMED: atomic reschedule
  CONFIRMED --> CANCELLED: authorized cancel
```

No COMPLETED/NO_SHOW/WON in P07.

Slot offers are not bookings. `slotToken` proves backend generation only.

Occupied range (buffers) is the conflict unit; appointment interval is customer-facing duration only.

Half-open `[start,end)` allows adjacent slots.
