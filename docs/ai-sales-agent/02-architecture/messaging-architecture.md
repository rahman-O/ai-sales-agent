# Messaging architecture

The agent emits channel-neutral outbound content and semantic intent. MessagingChannel validates capabilities, determines channel policy eligibility and sends. WhatsApp identifiers, templates and transport errors live in its adapter; channel-specific payloads do not enter prompts as privileged instructions.

Inbound receipt persistence, canonical message creation and an outbox wake-up commit together. If payload normalization is not immediately possible, persist a bounded verified receipt for quarantine and acknowledge it; never acknowledge a message held only in memory. Signed unknown-connection events are quarantined without inferring a tenant from user-supplied IDs.

Outgoing messages progress DRAFT → PENDING → DISPATCHING → ACCEPTED → DELIVERED → READ where receipts support it; FAILED, SUPPRESSED and UNKNOWN are explicit outcomes. Accepted means the provider accepted the request, not customer delivery. Receipt history is append-only and updates derived status without regressing READ to DELIVERED.

Exact-once external delivery is not promised: a network timeout after provider acceptance may leave uncertainty. Do not blindly resend UNKNOWN operations; reconcile via provider IDs/receipts where available, otherwise require an operator decision. [Idempotency](../06-data/idempotency.md) is canonical for this boundary.
