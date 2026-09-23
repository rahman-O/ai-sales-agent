# Product capabilities

Owner capabilities: invite staff, configure channel and agent, publish knowledge, manage services/prices/hours, inspect usage, disable automation, and offboard the tenant. Administrative settings never bypass business invariants.

Operator capabilities: work a shared inbox, claim a conversation, send a reply, edit contact facts, qualify a lead, book/reschedule/cancel, and record attendance. Analyst access is aggregate-only by default; transcript access is a separate role capability.

Customer capabilities: ask questions, provide lead details, request an appointment, confirm a proposal, request a human, and withdraw follow-up permission. Customers do not receive staff API credentials.

Platform capabilities: durable ingestion, bounded agent orchestration, backend-controlled tools, isolated retrieval, retries, recovery, cost limits, and audit. These support all visible features and must precede external usage.

Acceptance coverage is mapped in [requirements traceability](../14-roadmap/requirements-traceability.md). The MVP boundary in [scope](../00-overview/product-scope.md) takes precedence over future capability names.
