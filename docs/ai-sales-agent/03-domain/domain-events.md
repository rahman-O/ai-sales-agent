# Domain events

Envelope: event_id (UUID), organization_id, event_type, schema_version, aggregate_type/id, aggregate_version, occurred_at, actor reference, correlation_id, causation_id, payload and optional privacy classification. Persist outbox and mutation together; consumers record unique (consumer,event_id) before applying their effect in the same transaction.

Events: CustomerCreated, ConsentChanged, MessageReceived, ConversationModeChanged, LeadCreated, LeadQualified, LeadStageChanged, BookingCreated, BookingRescheduled, BookingCancelled, AttendanceRecorded, RevenueRecorded, KnowledgePublished, AgentRunCompleted, ToolExecutionFinished, FollowUpScheduled, FollowUpSuppressed and OutboundStatusChanged.

Business payloads carry IDs and minimal facts needed for projections. BookingCreated includes lead/conversation attribution, service, start and price snapshot; it does not mean attendance or revenue occurred. RevenueRecorded needs amount/currency, source and verification actor/reference; corrections use compensating events.

Consumers tolerate duplicates and out-of-order aggregate events. Projections use aggregate version and replay support; incompatible payload changes require a new schema version and dual-reader migration. No event contains raw channel secrets or full customer transcripts. See [metrics model](../11-product-metrics/metrics-model.md).
