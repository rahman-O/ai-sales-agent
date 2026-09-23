# Phase 03 — Scope manifest

Status: IMPLEMENTATION. Source priority: `phase-03-conversations.md` → domain/architecture docs → P01/P02 patterns → hardened P03 plan.

## Goal and scope

Persist and order inbound messages with recoverable processing and ownership state before connecting a model.

**In scope:** ChannelConnection (fixture), Conversation, Message, WebhookReceipt (org-scoped foundation), OutboxEvent publication fields, ConsumerReceipt, OutboundAttempt foundation, FakeMessagingChannel, DB ingress + timeline sequences, lease fencing, mode/epoch primitives, outbox relay + sweeper via narrow claim functions, minimum read-only inbox + authenticated SSE refetch, non-production org-scoped inbound route.

**Out of scope:** Real WhatsApp / unscoped webhook quarantine (P08), LLM/agent loop and outbound intents (P04), RAG, leads, booking, ConversationSummary, complete claim/pause/resume/human-send UX (P09).

## Truth layers

PostgreSQL = durable truth and recovery. BullMQ/Redis = wake-up transport only. SSE = UI invalidation hint only (refetch from Postgres).

## Entities and invariants

- **ChannelConnection:** unique global `(provider, externalChannelId)` — one provider channel binds one organization; composite `(organizationId, id)`.
- **CustomerIdentity:** uniqueness `(organizationId, channelConnectionId, externalAddress)`; denormalized `channel` kept in sync for P02 bind API.
- **Conversation:** unique `(organizationId, channelConnectionId, identityId)`; modes AI_ACTIVE | AI_PAUSED | HUMAN_ACTIVE | CLOSED; `ownershipEpoch` ≠ `leaseFence`; `nextSequence >= 1`, `processedSequence >= 0`, `processedSequence < nextSequence`; `providerEventWatermarkAt` for late classification.
- **Message:** `channelConnectionId` must match conversation; `ingressSequence` inbound FIFO only; `timelineSequence` required for all directions; unique provider dedup `(channelConnectionId, providerMessageId)` when present; same provider id + different digest → conflict.
- **WebhookReceipt:** `organizationId` required (P03); unique `(channelConnectionId, eventIdentity)`.
- **OutboxEvent.id** equals `DomainEventEnvelope.eventId`; publication claim/mark; BullMQ `jobId = id`.
- **ConsumerReceipt:** only after successful durable consumer apply; tenant-consistent FK to outbox event.
- **OutboundAttempt:** delivery-attempt foundation only — not an outbound-intent store. Epoch invalidation rejects mismatched fence/epoch writes; no P04 intent entity.

## Worker privilege boundary

Cross-tenant work discovery uses narrow SECURITY DEFINER claim functions that return only `{organizationId, workKind, workId, …}` metadata. Domain processing always uses `app_runtime` + `runInTenantContext`. Forbidden: migration owner, BYPASSRLS, SUPERUSER, disabling FORCE RLS. See ADR-011.

## Identity resolution

Org-scoped authenticated fixture ingress → ChannelConnection in that org → normalize ContactAddress → CustomerIdentity → Customer → Conversation upsert. Unknown connection does not invent a tenant. No LLM / fuzzy merge.

## Message idempotency and ordering

Provider-message uniqueness is domain uniqueness (not HTTP IdempotencyRecord). Replay returns existing message without consuming sequences. Ingress order ≠ timeline order. Cursor inbox: `(lastMessageAt, id)`. Timeline: `(timelineSequence, id)`.

## Customer merge compatibility

P02 merge reparents `Conversation.customerId` (and identities) to the canonical customer in the same transaction.

## Commands, queries and API

- `GET /v1/organizations/:organizationId/conversations` — cursor inbox
- `GET /v1/organizations/:organizationId/conversations/:id/messages` — cursor timeline
- `GET /v1/organizations/:organizationId/conversations/events` — authenticated SSE invalidation
- `POST /v1/organizations/:organizationId/dev/messaging/inbound` — non-production only; Auth + ACTIVE membership + TenantTransaction

## Acceptance

P03-T001…T006 verification, amendment test matrix (outbox crash, lease fence, epoch, merge, SSE, worker security), P01/P02 regression, build/lint/typecheck, hosted acceptance as `app_runtime`.
