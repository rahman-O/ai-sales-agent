# Tool contracts

All schemas reject additional properties. IDs are UUIDs except opaque signed proposal tokens. Text queries max 500 characters, pages max 20 tool results, date search horizon max 30 days. No tool accepts organization_id, actor_id, SQL or arbitrary URLs. Common authority/error/result behavior is in [registry](tool-registry.md). All customer and booking IDs must resolve to the current conversation customer; staff users use the staff API for other customers.

## Read tools

- searchKnowledge({query,limit?}): published tenant chunks with source/version, excerpt and relevance; READ_KNOWLEDGE; no relevant result returns an empty evidence list, never a synthesized fact.
- searchServices({query,limit?}): active service IDs/names and match reasons; READ_CATALOG; no invented service aliases become IDs.
- getServiceDetails({serviceId}): duration, staff eligibility, description and active status; READ_CATALOG; archived service returns NOT_FOUND for agent use.
- getServicePrice({serviceId}): amountMinor as string, currency, pricingVersion, effectiveAt and expiry; READ_CATALOG; unsupported variable pricing requires human quotation.
- getCustomer({}): bound customer profile, allowed contact fields and consent; READ_SELF_CUSTOMER; no arbitrary customer enumeration.
- getAvailableSlots({serviceId,from,to,staffId?}): at most 20 candidates with UTC/local times, timezone and schedule version; READ_AVAILABILITY. A slot is advisory until commit.

## Customer and lead commands

- createCustomer({displayName?,phone?}): idempotently ensure/update the inbound-bound contact, returning customer ID/version; WRITE_SELF_CUSTOMER. Transport establishes channel identity; tool-supplied phone cannot rebind identity or access another person. Existing customer wins identity uniqueness.
- createLead({serviceId?,interestNote?,qualificationFacts?}): return open opportunity ID/stage/version; WRITE_SELF_LEAD. Facts use allowlisted fields and message evidence references validated against this conversation. Unique open opportunity key prevents duplicates.
- updateLead({leadId,expectedVersion,patch}): patch permits service interest, allowed qualification facts, and nonterminal stage proposals only; WRITE_SELF_LEAD. Backend computes qualification and disallows BOOKED/WON or terminal reopening from model input. Return committed stage/version.

## Booking proposal and commands

Add prepareBooking({serviceId,staffId,startAt,timezone}) as a required current safety boundary: backend creates a proposal with customer binding, calculated end/buffers, current price snapshot, expiry (default ten minutes), human-readable exact terms and server-generated proposal ID. It allocates nothing. Response generation presents these terms and asks for confirmation.

Confirmation is server-recorded from an explicit reply to that proposal: interactive confirmation token where supported, or a narrow affirmative text parser when exactly one unexpired proposal is pending and no terms changed. Ambiguous/mixed replies ask again or hand off. The LLM cannot set a confirmed flag. Confirmation records the source inbound message and proposal hash.

- createBooking({proposalId}): BOOK_SELF; requires unconsumed verified confirmation; returns booking ID, CONFIRMED, price/time snapshot and version only after transaction commit. Proposal ID is the semantic operation key. Recheck schedule/price versions; changed terms require a new proposal and confirmation. Conflict returns replacement-slot guidance with no mutation.
- cancelBooking({bookingId,expectedVersion,reason,confirmationRef}): CANCEL_SELF; server-recorded confirmation must name the exact booking and action. Validate policy/cutoff, then return CANCELLED and version. Repeated same operation returns original result.
- rescheduleBooking({bookingId,expectedVersion,proposalId}): RESCHEDULE_SELF; new proposal names original booking/version and replacement terms. Atomic update preserves original if conflict. Return new committed version; never implement as separate cancel and create operations.

For changes to an existing appointment, add prepareBookingChange({bookingId,expectedVersion,action,replacement?}), where action is CANCEL or RESCHEDULE. RESCHEDULE requires replacement service/staff/start/timezone; CANCEL forbids replacement. The backend creates an action-specific BookingProposal bound to the current booking version, customer and conversation. Its displayed terms name the original booking and either cancellation consequences or the replacement time/price. The same server confirmation mechanism records an explicit reply to those exact terms. cancelBooking accepts that confirmed proposal ID as confirmationRef; rescheduleBooking accepts it as proposalId. One confirmation cannot authorize a different action or two separate operations. Proposal generation is not permission to execute the change.

## Control and follow-up

- handoffToHuman({reasonCode,summary?}): HANDOFF_SELF; allowlisted reason and max 500-character summary; atomically pause/increment epoch and enqueue notification, returning mode/epoch. This is a terminal tool for the run; any customer acknowledgement is a separately authorized control message, not an ordinary stale AI draft.
- scheduleFollowUp({purpose,dueAt,relatedBookingId?}): FOLLOWUP_SELF; approved purpose, recorded consent, horizon ≤30 days and max three pending reminders per conversation; backend template/policy mapping, not arbitrary model text. Return FollowUp ID/status. Existing purpose/target schedule deduplicates.

All mutation commands write operation result, audit and business events together. Test unauthorized references, expired confirmations, schema errors, stale versions and ambiguous commits for each contract. No model call ID alone provides semantic deduplication.
