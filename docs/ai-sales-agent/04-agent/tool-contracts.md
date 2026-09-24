# Tool contracts

All schemas reject additional properties. IDs are UUIDs except opaque signed proposal tokens. Text queries max 500 characters, pages max 20 tool results, date search horizon max 30 days. No tool accepts organization_id, actor_id, SQL or arbitrary URLs. Common authority/error/result behavior is in [registry](tool-registry.md). All customer and booking IDs must resolve to the current conversation customer; staff users use the staff API for other customers.

## Read tools

- searchKnowledge({query,limit?}): published tenant chunks with source/version, excerpt and relevance; READ_KNOWLEDGE; no relevant result returns an empty evidence list, never a synthesized fact.
- searchServices({query,limit?}): active service IDs/names and match reasons; READ_CATALOG; no invented service aliases become IDs.
- getServiceDetails({serviceId}): duration, staff eligibility, description and active status; READ_CATALOG; archived service returns NOT_FOUND for agent use.
- getServicePrice({serviceId}): amountMinor as string, currency, pricingVersion, effectiveAt and expiry; READ_CATALOG; unsupported variable pricing requires human quotation.
- getCustomer({}): bound customer profile, allowed contact fields and consent; READ_SELF_CUSTOMER; no arbitrary customer enumeration.
- getAvailableSlots({serviceId,startDate,endDate?,locationId?,staffMemberId?,limit?}): at most 20 candidates with UTC/local times, timezone, and HMAC `slotToken` (v1); READ_AVAILABILITY. A slot/token is advisory until commit — not a hold.

## Customer and lead commands

- createCustomer({displayName?,phone?}): idempotently ensure/update the inbound-bound contact, returning customer ID/version; WRITE_SELF_CUSTOMER. Transport establishes channel identity; tool-supplied phone cannot rebind identity or access another person. Existing customer wins identity uniqueness.
- ensureLead({serviceId?,needSummary?,preferredContactChannel?,language?,locationId?}): idempotent OPEN lead for conversation customer; WRITE_SELF_LEAD. With serviceId: promote generic in place or collide-merge (`MERGED_DUPLICATE_OPEN_LEAD`). Without: reuse generic only; multiple OPEN without selector → `AMBIGUOUS_LEAD`. Never invent service IDs.
- updateLeadQualification({leadId,expectedVersion,needSummary?,preferredContactChannel?,language?,locationId?,serviceId?}): patch allowlisted fields; cannot overwrite non-null human-owned values; cannot assign/archive/disqualify; stale version → `VERSION_CONFLICT`.
- getLead({leadId?,serviceId?}): current OPEN lead for conversation customer. leadId must match customer; serviceId selects among OPEN; no selector with >1 OPEN → `AMBIGUOUS_LEAD`.
- transitionLead({leadId,expectedVersion,toStatus}): AI may progress among NEW/ENGAGED/QUALIFIED/NURTURE only; **cannot** set ARCHIVED or DISQUALIFIED.

P06 tools are **opt-in** via a new AgentConfig allowlist version; default ACTIVE configs stay P04-only (plus any prior explicit opts). No BOOKED/WON from tools.

## Booking commands (P07)

P07 tools are **opt-in** via a new AgentConfig allowlist; **DEFAULT_ALLOWLIST stays P04**. Never silently grant booking tools to existing ACTIVE configs.

- getAvailableSlots — see Read tools; returns `slotToken` per candidate.
- createBooking({slotToken,confirmationMessageId,leadId?}): BOOK_SELF. Requires HMAC-valid `slotToken` **and** server-proven `confirmationMessageId` (inbound message driving the current AgentRun, classified as explicit confirmation/selection — never an LLM `customerConfirmed` boolean). Full revalidation at commit; GiST occupied exclusion; conflict → `SLOT_UNAVAILABLE`. Optional `leadId` writes LeadActivity `BOOKING_CONFIRMED` only (no BOOKED/WON status).
- getBookings({}): list conversation customer's bookings.
- cancelBooking({bookingId,expectedVersion,reasonCode?}): CANCEL_SELF; versioned cancel → CANCELLED + LeadActivity when linked.
- rescheduleBooking({bookingId,expectedVersion,slotToken}): RESCHEDULE_SELF; atomic update-in-place (self-conflict safe); conflict leaves original unchanged.

Operator/API create attests via ADMIN/OWNER actor — not LLM boolean.

## Control and follow-up

- handoffToHuman({reasonCode,summary?}): HANDOFF_SELF; allowlisted reason and max 500-character summary; atomically pause/increment epoch and enqueue notification, returning mode/epoch. This is a terminal tool for the run; any customer acknowledgement is a separately authorized control message, not an ordinary stale AI draft.
- scheduleFollowUp({purpose,dueAt,relatedBookingId?}): FOLLOWUP_SELF; approved purpose, recorded consent, horizon ≤30 days and max three pending reminders per conversation; backend template/policy mapping, not arbitrary model text. Return FollowUp ID/status. Existing purpose/target schedule deduplicates.

All mutation commands write operation result, audit and business events together. Test unauthorized references, expired confirmations, schema errors, stale versions and ambiguous commits for each contract. No model call ID alone provides semantic deduplication.
