# ADR-011 — Narrow privileged work-claim for FORCE RLS workers

Status: Accepted. Date: 2026-09-23.

## Context

Tenant tables use FORCE RLS with `organization_id = current_tenant_id()`. Background workers must discover pending OutboxEvent rows and expired conversation leases across organizations without using the migration owner, BYPASSRLS, or SUPERUSER.

## Decision

Introduce narrowly scoped PostgreSQL SECURITY DEFINER functions (`claim_pending_outbox_events`, `mark_outbox_event_published`, `list_due_conversation_wakeups`, `reclaim_expired_conversation_leases`) that:

- use a fixed `search_path`
- return only work metadata (`organization_id`, `work_kind`, `work_id`, `available_at`)
- are executable solely by `app_runtime`
- never expose a generic RLS bypass

After claim, workers open `runInTenantContext` / transaction-local tenant GUC for all domain processing.

## Consequences

BullMQ remains wake-up only. Redis loss does not lose durable work. A new privileged surface exists and must stay minimal; security tests must prove claim functions cannot read arbitrary tenant payloads.
