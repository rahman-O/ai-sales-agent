# Follow-up execution and suppression

FollowUp is a durable business schedule, while BullMQ is a wake-up mechanism. Store customer/conversation, purpose, related booking, due_at, generation, consent reference, semantic key and status. A database due-work sweeper recovers missing jobs. A worker claims a pending generation atomically and either creates one outbound intent or records a suppression reason.

Proposed lifecycle: SCHEDULED → CLAIMED → ENQUEUED → SENT; terminal alternatives SUPPRESSED, CANCELLED, FAILED or UNKNOWN. SENT means provider acceptance, with delivery tracked on the linked Message. A crash before intent commit leaves reclaimable scheduled work; a crash after commit recovers the same intent by operation key. Do not create another intent when a prior send is UNKNOWN.

Eligibility at intent creation and dispatch requires current consent for purpose/channel, an active customer/channel, a still-relevant booking/lead, current generation, AI_ACTIVE mode and no newer customer inbound since scheduling for sales follow-ups. Booking reminders may survive unrelated contact only if the approved purpose policy explicitly permits it. Cancellation/reschedule invalidates the old generation. Opt-out and mode changes suppress all not-yet-dispatching eligible proactive intents.

Default quiet hours: 20:00–09:00 in organization timezone; postpone to the next allowed time only if still before the reminder deadline and appointment. Default appointment reminder is 24 hours before start, at most one per booking version; no automatic sales follow-up until product approves its consent wording and cadence. Scheduling horizon is 30 days with at most three pending reminders per conversation. These are proposed product defaults for P00 approval, not provider rules.

Consent updates and dispatch claims use a consistent transaction lock order (conversation, customer consent projection, follow-up, outbound record) and compare versions so a committed revocation blocks later claims. External sends already DISPATCHING cannot reliably be recalled; expose the same in-flight exception as [takeover](../03-domain/conversation-state-machine.md). Honor revocation for all subsequent work.

Operator endpoints: GET/POST /v1/organizations/{organizationId}/followups and POST /followups/{id}/cancel, with Idempotency-Key and expectedVersion for changes. OPERATOR/ADMIN/OWNER may schedule approved purposes; only ADMIN/OWNER change purpose/cadence policy. Scheduling arbitrary generated marketing text is unsupported.

Acceptance: duplicate due jobs yield one intent; opt-out wins against any later dispatch claim; old-generation jobs cannot send; Redis loss does not lose schedules; no approved template means suppression/escalation rather than free-form outside-window send. [Phase 10](../14-roadmap/phase-10-followups.md) owns implementation and evidence.
