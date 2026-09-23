# Database design conventions

Use UUID primary keys, UTC created_at/updated_at and organization_id on tenant-owned rows. Every tenant parent has UNIQUE(organization_id,id), and children reference that pair. Mutable aggregates have version; append-only records have occurred_at and recorded_at. Transaction time and provider event time remain distinct.

Default foreign-key delete action is RESTRICT, not cascade. Explicit privacy deletion workflows purge or anonymize children in a controlled order. Soft deletion is for catalog/customer discoverability and account lifecycle, not a guarantee that personal data is erased. Tombstones preserve only non-PII dedup keys within their approved retention window.

Money is integer minor units with currency; JSON is limited to validated versioned configuration, tool envelopes and event payloads. Core prices, status, staff allocation, identities and consent are relational and queryable. Encrypt especially sensitive fields only when a defined access/query requirement warrants it; database/storage encryption alone does not replace authorization.

Supporting tables are necessary for correctness: CustomerIdentity, ConsentRecord, ServiceStaff, Location, KnowledgeDocumentVersion, ConversationSummary, BookingProposal, BookingHistory, LeadStageHistory, WebhookReceipt, OutboxEvent, ConsumerReceipt, CommandOperation, OutboundAttempt, RevenueRecord and DeletionRequest. Do not model a generic workflow engine.

See [entities](../03-domain/entities.md) for per-model ownership and constraints, [indexes](indexing-strategy.md), [idempotency](idempotency.md) and [Prisma plan](prisma-model-plan.md). No executable schema is supplied in this planning package.
