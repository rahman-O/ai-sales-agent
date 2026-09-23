# Phase 03 — Pre-migration review gate

Date: 2026-09-23. Status: all mandatory items RESOLVED before migration generation.

| Item | Status | Resolution |
|------|--------|------------|
| WORKER CROSS-TENANT DISCOVERY | RESOLVED | Narrow SECURITY DEFINER claim functions; domain under TenantTransaction; ADR-011 |
| WEBHOOK RECEIPT OWNERSHIP | RESOLVED | organizationId NOT NULL; unscoped quarantine deferred to P08 |
| CHANNEL CONNECTION UNIQUENESS | RESOLVED | UNIQUE(provider, external_channel_id) global; documented |
| MESSAGE DEDUP KEY | RESOLVED | Message.channel_connection_id + UNIQUE(channel_connection_id, provider_message_id) WHERE provider_message_id IS NOT NULL |
| TIMELINE ORDERING | RESOLVED | Message.timeline_sequence required; ingress_sequence inbound-only |
| PROVIDER EVENT WATERMARK | RESOLVED | Conversation.provider_event_watermark_at |
| LEASE FENCING | RESOLVED | lease_owner + lease_fence + lease_expires_at; DB now() |
| OWNERSHIP EPOCH | RESOLVED | ownership_epoch separate from lease_fence |
| CUSTOMER MERGE COMPATIBILITY | RESOLVED | merge reparents conversations |
| OUTBOX CRASH SEMANTICS | RESOLVED | claim → BullMQ(jobId=id) → mark published; ConsumerReceipt after apply |
| SSE SECURITY | RESOLVED | authenticated; no JWT query string; refetch from Postgres |
| OUTBOX EVENT IDENTITY | RESOLVED | OutboxEvent.id = DomainEventEnvelope.eventId |
| OUTBOUND INTENT VS ATTEMPT | RESOLVED | OutboundAttempt = delivery foundation only |
