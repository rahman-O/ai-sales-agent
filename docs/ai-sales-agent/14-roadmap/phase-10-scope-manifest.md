# Phase 10 — Scope manifest

Status: **CLOSED**. Durable follow-ups + versioned WhatsApp templates. No P11.

## Design lock (FINAL HARDENED)

- Durable timer: **OutboxEvent.available_at** (`FollowUpDue`); BullMQ wake only; low-freq repair not primary scheduler
- FollowUp terminal success: **DISPATCHED** (logical Message → P08); delivery truth = `Message.deliveryState`
- AUTOMATED: `baselineOwnershipEpoch` fence; takeover/resume → `CONVERSATION_AUTHORITY_CHANGED`
- Reply race: Conversation `FOR UPDATE` then FollowUp; sequence baseline
- Outreach basis enum (not org toggle alone); ConsentRecord **DEFERRED**
- Quiet hours: `scheduledFor` immutable; `nextEligibleAt` drives outbox; deadline → `MISSED_ALLOWED_WINDOW`
- Templates: immutable versions; internalStatus ≠ providerStatus; typed `FREE_FORM|TEMPLATE`
- Exactly-once: `outbound_message_id` UNIQUE; PROCESSING lease ≠ correctness
- Agent tools opt-in only (`scheduleLeadFollowUp`, `cancelFollowUp`, `getFollowUps`)
- LIVE_TEMPLATE_ACCEPTANCE: **NOT_RUN** without Meta sandbox

## Non-goals

Campaigns, ConsentRecord subsystem, marketing broadcast, email/SMS, P11+.
