# Phase 07 — Scope manifest

Status: **CLOSED**. Internal PostgreSQL booking authority. No P08+.

## Design lock (summary)

- Confirmation: server-proven `confirmationMessageId` — never LLM `customerConfirmed` boolean
- DST: nonexistent REJECT; ambiguous → dual UTC candidates
- Slot token: v1 canonical JSON + HMAC-SHA256 (`base64url.payload.sig`), TTL 10m
- Customer overlap: no overlapping CONFIRMED for same customer (clinic MVP business rule)
- Buffers expand occupied range; GiST + availability use occupied; appointment display uses duration only
- Lead: activities only (`BOOKING_CONFIRMED|CANCELLED|RESCHEDULED`); no BOOKED/WON status
- Statuses: CONFIRMED | CANCELLED only

## Non-goals

External calendars, payments, slot holds, WhatsApp, follow-ups, WON, multi-resource.
