# Idempotency and uncertainty

## Inbound and internal delivery

Deduplicate canonical inbound messages by connection and provider message ID, not webhook-body hash: one webhook can contain many messages and statuses. Receipt records use provider event identity when available, otherwise a canonical event digest including connection, event type and stable event fields. Preserve status events independently of message content.

Commit receipt/canonical message/outbox together, then acknowledge. Crash after commit before acknowledgement produces a duplicate receipt on retry, not a duplicate message. Outbox relay and queue deliveries are at-least-once; each consumer stores unique event IDs with its own transaction. Removing completed queue jobs must not erase durable business dedup evidence.

## Commands

CommandOperation uses UNIQUE(organization_id,operation_key), canonical input hash, actor, command name, state, result reference and timestamps. Reusing the same key and hash returns committed result; a different hash returns IDEMPOTENCY_CONFLICT. The action and successful operation result commit together. A lost response is recovered by lookup, not another mutation.

HTTP callers supply Idempotency-Key; backend namespaces it by tenant/actor/command. Tools receive server-issued operation keys stable across run retries. Booking proposal IDs provide semantic identity even when a model invents a fresh tool-call ID. Lead/customer uniqueness provides additional protection. Transient FAILED attempts may retry the same operation; terminal validation failures require corrected inputs and a new operation.

## External send boundary

Persist outbound intent and attempt before I/O. Record provider ID on known acceptance. A crash or timeout after possible acceptance becomes UNKNOWN unless reconciliation proves failure or success. When the provider lacks usable idempotency/reconciliation, exactly-once sending is impossible; do not retry automatically and risk duplicate customer messages. Operators decide resend with an audit reason. Queue retry is not evidence that external I/O is safe.

Proposed dedup retention: receipt identities 90 days; command identities as long as the referenced business record, with compact non-PII tombstones after archival. Match actual provider replay windows and privacy decisions before release. [Retention](retention-policy.md).
