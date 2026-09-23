# Indexing strategy

Default tenant access paths lead with organization_id. Conversations: (organization_id,mode,last_message_at DESC,id); messages: UNIQUE(organization_id,conversation_id,ingress_sequence) for inbound sequencing and (organization_id,conversation_id,created_at,id) for timeline cursor pagination. Outbound messages need a separate outbound sequence or nullable ingress sequence, never fabricated inbound ordering.

Provider identity: unique (channel_connection_id,provider_message_id) when provider_message_id is non-null; channel connection is itself bound to a single tenant. CustomerIdentity: unique (organization_id,channel_connection_id,external_address). Leads: partial unique open opportunity key and (organization_id,stage,updated_at,id). Bookings: (organization_id,starts_at,staff_id) plus the overlap exclusion constraint.

Due work: partial indexes on pending outbox available_at, lease expires_at, followup due_at/status and outbound retry_at. Usage: (organization_id,occurred_at,model); tool traces: (organization_id,run_id,created_at). Knowledge: (organization_id,document_version_id,chunk_index), published-version filter and selected vector index only after recall/performance testing.

Use EXPLAIN ANALYZE against realistic tenant skew in staging. Avoid indexing every JSON field or payload. Pagination uses stable tuples with a unique tie-breaker; cap pages at 100. Validate concurrent index rollout separately for large tables because not every DDL operation can run inside a transaction.
