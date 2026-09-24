# Follow-up execution and suppression

FollowUp is a durable business schedule. **OutboxEvent.available_at** is the primary durable timer (`FollowUpDue`); BullMQ is wake-up only (ADR-004 / ADR-011). PostgreSQL remains source of truth.

## Lifecycle

`SCHEDULED` → `PROCESSING` → (`DISPATCHED` | `SUPPRESSED` | `FAILED`); `SCHEDULED` → `CANCELLED`.

**DISPATCHED** means one logical outbound Message was created and handed to the P08 pipeline — **not** provider acceptance. Provider delivery lives on `Message.deliveryState`.

Exactly-once: unique `outbound_message_id` + transactional Message + `OutboundMessageReady` + FollowUp update. PROCESSING lease is worker coordination only.

## Scheduling

On create/reschedule (same TX): persist FollowUp (`version++`) and insert `FollowUpDue` with `available_at = nextEligibleAt`, payload `{ followUpId, followUpVersion }`. Stale version → NO-OP. Cancel does not require deleting old events/jobs.

`scheduledFor` = original business due. Quiet hours adjust **`nextEligibleAt` only**. Booking reminders past deadline → `MISSED_ALLOWED_WINDOW`.

Low-frequency repair may re-insert a missing due event; it is not the normal scheduler.

## Eligibility (execution TX)

Lock order: **Conversation → FollowUp** (same serialization boundary as P03 inbound).

Checks include: still SCHEDULED/claimable, channel health, outreach basis, template/provider eligibility, lead/booking snapshots, customer inbound sequence vs baseline, and for AUTOMATED: `AI_ACTIVE` + null owner + `ownershipEpoch == baselineOwnershipEpoch`.

Human takeover/resume invalidates AUTOMATED follow-ups (`CONVERSATION_AUTHORITY_CHANGED`). Do not rebase onto a new epoch.

## Consent / outreach

ConsentRecord is **deferred**. P10 does not implement comprehensive consent/compliance. Organization `followUpEnabled` is **not** customer consent. Automated outreach requires an explicit **outreach basis** (`CUSTOMER_INITIATED_CONVERSATION` | `TRANSACTIONAL_BOOKING` | `EXPLICIT_OPT_IN` | `OPERATOR_SCHEDULED`). General marketing/broadcast remains prohibited.

## Templates

Immutable `MessageTemplateVersion` with separate `providerStatus`. Internal APPROVED ≠ Meta approval. Outside 24h requires provider-eligible TEMPLATE send mode; adapter builds components from frozen schema + validated params (no raw Meta JSON from client/LLM).

## Operator / agent

Staff: GET/POST follow-ups, cancel; template settings. Agent tools opt-in via AgentConfig; ActionGate + epoch/watermark. [Phase 10](../14-roadmap/phase-10-followups.md).
