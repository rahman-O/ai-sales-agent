# Entity catalog

This catalog is the schema plan, not an implemented schema. Unless explicitly global, every entity has organization_id, a UUID id, created_at and recorded/updated timestamps as appropriate; immutable history uses recorded_at instead of meaningless update tracking. Tenant foreign keys are composite. Mutable aggregate rows have version. Invariants and defaults are in [database conventions](../06-data/database-design.md).

## Organization

Owner module: organizations. Tenant root; id, name, slug, status, timezone, defaultCurrency, locale, quota policy.

Constraints and indexes: Unique slug; index status.

Deletion/lifecycle: Suspend before purge; preserve referenced history. Audit: Creation, settings, suspension, offboarding.

## User

Owner module: users. Global identity exception; id, identity issuer/subject, email, status. No tenant business data.

Constraints and indexes: Unique (issuer,subject); email is not an authorization key.

Deletion/lifecycle: Disable; deletion requires membership and last-owner checks. Audit: Sign-in security events, disable and identity changes.

## OrganizationMember

Owner module: organizations. organization_id, user_id, role, status, invited_by.

Constraints and indexes: Unique (organization_id,user_id); index (organization_id,role,status).

Deletion/lifecycle: Revoke membership, do not silently delete audit actor identity. Audit: Invitation, acceptance, role and owner changes.

## ChannelConnection

Owner module: integrations. organization_id, provider, external account/phone ID, credential reference, status, policy settings.

Constraints and indexes: Unique (provider,external channel ID); index (organization_id,status).

Deletion/lifecycle: Disconnect/revoke before deletion; provider mapping tombstone during dedup window. Audit: Connect, credential rotation, disable and reconnect.

## Customer

Owner module: customers. organization_id, display name, contact fields, preferred locale, version.

Constraints and indexes: Index (organization_id,updated_at,id); no global phone uniqueness.

Deletion/lifecycle: Soft archive; privacy workflow purges or pseudonymizes. Audit: Creation, field changes, merge and erasure.

## CustomerIdentity

Owner module: customers. organization_id, customer_id, channel_connection_id, normalized external address.

Constraints and indexes: Unique (organization_id,channel_connection_id,external address).

Deletion/lifecycle: Revoke mapping; preserve minimal dedup identity per policy. Audit: Binding and verified merge only.

## ConsentRecord

Owner module: customers. organization_id, customer_id, channel, purpose, status, source, collected/revoked instants.

Constraints and indexes: Index (organization_id,customer_id,purpose,recorded_at); one current consent projection per purpose/channel.

Deletion/lifecycle: Append changes; privacy-delete identifying evidence when required. Audit: Grant, withdraw and operator correction.

## Conversation

Owner module: conversations. organization_id, customer_id, channel_connection_id, identity_id, mode, owner_member_id, epoch, next_sequence, processed_sequence, lease_owner/fence/expiry, version.

Constraints and indexes: Unique (organization_id,channel_connection_id,identity_id); inbox and lease-expiry indexes.

Deletion/lifecycle: CLOSED is lifecycle, not deletion; retention workflow handles content. Audit: Claim, pause, resume, close and reassignment.

## Message

Owner module: conversations. organization_id, conversation_id, direction, origin, provider ID, nullable ingress sequence, content, provider/received times, delivery state.

Constraints and indexes: Unique connection/provider ID when present; unique conversation/ingress sequence; timeline index.

Deletion/lifecycle: No ordinary edits; redact/delete content through privacy workflow. Audit: Human sends, redaction and delivery correction; receipt events provide transport history.

## ConversationSummary

Owner module: conversations. organization_id, conversation_id, version, through_sequence, source hash, text, model/config reference.

Constraints and indexes: Unique (organization_id,conversation_id,version); active pointer on conversation.

Deletion/lifecycle: Invalidate on source deletion; expire with messages. Audit: Publication and invalidation.

## Lead

Owner module: leads. organization_id, customer_id, status (NEW|ENGAGED|QUALIFIED|NURTURE|DISQUALIFIED|ARCHIVED — no WON/BOOKED in P06), optional primary_service_id/location_id, assignment via organization_members composite FK, qualification fields, source conversation/message provenance, optimistic version. `qualificationState` is **derived**, not stored.

Constraints: partial unique one OPEN generic per (org, customer); one OPEN per (org, customer, service). Indexes on (org, status, updated_at), (org, customer).

Deletion/lifecycle: soft archive; never delete activity history. Audit: create, qualification, status, assign, merge.

## LeadActivity

Owner module: leads. Append-only CRM events (LEAD_CREATED, STATUS_CHANGED, QUALIFICATION_UPDATED, SERVICE_INTEREST_CHANGED, ASSIGNED, UNASSIGNED, NOTE_ADDED, CONVERSATION_LINKED, MERGED_DUPLICATE). Replaces LeadStageHistory for P06. app_runtime: SELECT+INSERT only.

## LeadStageHistory

Superseded for P06 by LeadActivity. Do not introduce a separate stage-history table in this phase.

## Location

Owner module: services. organization_id, name, IANA timezone, address, active flag. One active location in MVP.

Constraints and indexes: Index (organization_id,active); application restricts MVP cardinality.

Deletion/lifecycle: Archive, never remove from historical bookings. Audit: Hours/timezone/address changes.

## Service

Owner module: services. organization_id, location_id, name, duration, buffers, amount_minor, currency, pricing_version, active, version.

Constraints and indexes: Index (organization_id,active,name); optional tenant SKU unique.

Deletion/lifecycle: Archive; booked snapshots remain immutable. Audit: Price, duration and active-status changes.

## StaffMember

Owner module: bookings. organization_id, location_id, optional member_id, display name, active, schedule_version. Staff need not log in.

Constraints and indexes: Index (organization_id,location_id,active).

Deletion/lifecycle: Archive; prevent new allocation, preserve past appointments. Audit: Eligibility and schedule changes.

## ServiceStaff

Owner module: bookings. organization_id, service_id, staff_id eligibility link.

Constraints and indexes: Unique (organization_id,service_id,staff_id), composite FKs.

Deletion/lifecycle: Remove eligibility only after checking future bookings. Audit: Eligibility edits.

## WorkingHours

Owner module: bookings. organization_id, location_id or staff_id, weekday, local start/end, effective date range. AvailabilityRule is this concept, not a duplicate table.

Constraints and indexes: Index tenant/resource/weekday/effective dates; validate owner XOR and intervals.

Deletion/lifecycle: Version/replace rules; no history-destroying edits. Audit: Rule publication and correction.

## AvailabilityOverride

Owner module: bookings. organization_id, staff/location reference, UTC range, available/blocked, reason.

Constraints and indexes: Index tenant/resource/start; start before end.

Deletion/lifecycle: Archive expired overrides with schedule evidence. Audit: Blocking and exception edits.

## BookingProposal

Owner module: bookings. organization_id, conversation/customer, service/staff, proposed range, price/schedule versions, hash, expiry, confirmation source, consumed operation.

Proposal additionally has action CREATE/CANCEL/RESCHEDULE and optional original_booking_id/expected_booking_version. CANCEL carries original terms without a replacement allocation; RESCHEDULE carries original identity/version and replacement terms. Confirmation is bound to action and proposal hash.

Constraints and indexes: Unique proposal ID; index (organization_id,conversation_id,expires_at).

Deletion/lifecycle: Expire unused proposals; retain confirmed reference with booking. Audit: Confirmation capture, invalidation and consumption.

## Booking

Owner module: bookings. organization_id, customer_id, optional lead/conversation, service/staff/location, UTC range, occupied range, snapshots, status, version.

Constraints and indexes: Partial exclusion for confirmed staff ranges; unique create operation; start/staff index.

Deletion/lifecycle: Cancel rather than delete; privacy lifecycle retains de-identified outcomes. Audit: Create, reschedule, cancel, attendance and correction.

## BookingHistory

Owner module: bookings. organization_id, booking_id, action, old/new version and schedule/status snapshots.

Constraints and indexes: Unique (organization_id,booking_id,version).

Deletion/lifecycle: Append-only until retention expiry. Audit: Immutable evidence linked from AuditLog.

## KnowledgeDocument

Owner module: knowledge. organization_id, title, active_version_id, publication status, archived_at.

Constraints and indexes: Index (organization_id,status,updated_at).

Deletion/lifecycle: Unpublish immediately; cleanup versions/blobs asynchronously. Audit: Upload, approve, publish, revoke and delete.

## KnowledgeDocumentVersion

Owner module: knowledge. organization_id, document_id, version, object key, checksum, scan/parse status, reviewer, embedding model/dimension.

Constraints and indexes: Unique (organization_id,document_id,version); unique ingestion operation.

Deletion/lifecycle: Immutable; purge content and vectors on deletion. Audit: Review and publication provenance.

## KnowledgeChunk

Owner module: knowledge. organization_id, document_version_id, chunk_index, text, content_hash, embedding and token count.

Constraints and indexes: Unique (organization_id,document_version_id,chunk_index); scoped vector search.

Deletion/lifecycle: Hard purge with source; immediate retrieval exclusion on unpublish. Audit: Ingestion lineage rather than per-vector verbose audit.

## AgentConfig

Owner module: agent. organization_id, version, prompt reference, allowed tools, model profile, budget, locale, active flag.

Constraints and indexes: Unique (organization_id,version); one active pointer per tenant.

Deletion/lifecycle: Immutable versions, deactivate not overwrite. Audit: Publication, rollback and tool/budget changes.

## AgentRun

Owner module: agent. organization_id, conversation_id, input watermark, attempt, fence/epoch, context manifest, model/config, status, timing, usage references.

Constraints and indexes: Unique conversation/watermark/attempt; tenant/time/status index.

Deletion/lifecycle: Expire raw context first; retain minimal usage/trace evidence. Audit: Terminal outcome and safety decisions.

## ToolCall

Owner module: agent. organization_id, run_id, call index, tool/version, redacted arguments, operation reference, result code, duration.

Constraints and indexes: Unique (organization_id,run_id,call index); operation lookup index.

Deletion/lifecycle: Append attempts; trim sensitive payload by retention policy. Audit: Denial and execution evidence; mutation audit separate.

## FollowUp

Owner module: followups. organization_id, conversation/customer, purpose, booking reference, due_at, consent version, status, generation, operation key.

Constraints and indexes: Unique semantic reminder key; index (status,due_at); tenant/customer index.

Deletion/lifecycle: Cancel on revocation/invalid target; retain outcome history. Audit: Schedule, reschedule, suppress, send and cancel.

## AuditLog

Owner module: audit. organization_id, actor, action, target, version diff, reason and correlation references.

Constraints and indexes: Index tenant/recorded_at and tenant/target; append-only runtime permissions.

Deletion/lifecycle: Dedicated approved retention purge only. Audit: Audit access/export separately; no recursive audit loop.

## UsageEvent

Owner module: usage. organization_id, run/tool reference, provider request, attempt, token counts, estimated/actual flags, tariff version, amount/currency.

Constraints and indexes: Unique (organization_id,provider,request ID,usage kind) when known; fallback attempt key; tenant/time index.

Deletion/lifecycle: Append reconciliation adjustments; redact identifiers under retention. Audit: Cost correction and reconciliation actor.

## WebhookReceipt

Owner module: messaging. organization_id when resolved, connection/event digest, verification metadata, payload reference, status. Unknown-channel quarantine is platform restricted.

Constraints and indexes: Unique connection/event identity; received_at/status index.

Deletion/lifecycle: Raw payload seven days proposed; dedup tombstone longer. Audit: Quarantine and manual reprocess.

## OutboxEvent

Owner module: infrastructure. organization_id, event envelope, available_at, publication attempts/status.

Constraints and indexes: Unique event_id; partial pending/due index.

Deletion/lifecycle: Archive after durable consumers/reconciliation window. Audit: Manual replay and dead-letter intervention.

## ConsumerReceipt

Owner module: infrastructure. organization_id, consumer name, event_id, applied_at.

Constraints and indexes: Unique (consumer,event_id).

Deletion/lifecycle: Keep at least event replay horizon; no soft deletion. Audit: Replay administration.

## CommandOperation

Owner module: infrastructure. organization_id, operation_key, command, input hash, actor, state, result and attempt metadata.

Constraints and indexes: Unique (organization_id,operation_key).

Deletion/lifecycle: Retain result/tombstone with referenced business record. Audit: Manual resolution of uncertain operations.

## OutboundAttempt

Owner module: messaging. organization_id, message_id, attempt number, epoch, dispatch/acceptance timestamps, provider ID, status/error.

Constraints and indexes: Unique message/attempt; provider ID lookup; pending reconciliation index.

Deletion/lifecycle: Append-only attempt evidence, redact response bodies. Audit: Operator retry/reconciliation.

## RevenueRecord

Owner module: analytics. organization_id, booking_id, signed amount_minor, currency, source, verifier, correction_of.

Constraints and indexes: Unique tenant/source reference; booking/time index.

Deletion/lifecycle: Corrections are append-only; no unverified model revenue. Audit: Record, verify and correct.

## DeletionRequest

Owner module: organizations. organization_id, subject type/ID, requested_by, approved scope, hold state, progress checkpoints.

Constraints and indexes: Unique request key; status/due index.

Deletion/lifecycle: Keep minimal non-PII completion ledger for restore reconciliation. Audit: Request, hold, approval and completion.
