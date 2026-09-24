# Phase 13 — Discovery report

Date: 2026-09-24. Status: **DISCOVERY PASS**.

## Trust boundaries and topology

- Browser traffic reaches Next.js, which maintains the Supabase SSR session; its BFF routes obtain a server-side access token. Nest still verifies the Bearer token independently.
- Nest resolves Supabase JWT identity through JWKS, then resolves current `OrganizationMember` state before tenant operations. Organization IDs in routes are not authorization evidence by themselves.
- Runtime database traffic uses `app_runtime`, which is neither superuser nor `BYPASSRLS`; tenant context is transaction-local. Migration credentials are excluded from the server environment loader.
- Meta webhook traffic is unauthenticated browser-wise but protected by raw-body HMAC verification, 1 MB payload rejection, provider/channel resolution, receipts and message idempotency. It has no inline LLM path.
- Redis/BullMQ carries wake signals and jobs only. PostgreSQL is the durable source for messages, bookings, follow-ups, agent terminal state and outbox events.
- The worker owns four consumers: conversation drain, knowledge ingestion, outbound dispatch and follow-up execution. Its outbox relay claims globally only through narrow database functions and processes tenant work under tenant context.
- External dependencies are Supabase Auth/Postgres/Storage, Redis/BullMQ, Meta WhatsApp, and the configured embedding/model providers. Local TEI is bounded to four concurrent requests in Docker development configuration.

## Database privilege audit

The P03 migration defines four `SECURITY DEFINER` functions: `claim_pending_outbox_events(integer)`, `mark_outbox_event_published(uuid)`, `list_due_conversation_wakeups(integer)`, and `reclaim_expired_conversation_leases(integer)`. They are narrow worker-discovery operations, grant execute to `app_runtime`, and return/work with identifiers rather than generic tenant data. The P13 penetration suite must verify fixed `search_path`, revoked PUBLIC execute and malicious cross-tenant inputs against the hosted role.

## Existing resilience controls

- Database outbox, consumer receipts, leases, ownership epoch and ingress watermark fence duplicate or stale work.
- Booking exclusion constraints remain the final concurrency authority.
- Outbound ambiguity is represented explicitly; dispatch does not blindly resend after unknown provider outcome.
- Follow-up work uses a durable due event and reclaimable processing lease.
- Runtime pools are bounded: API Prisma pool is 2, direct API pool default is 10, and worker pool is 4. Hosted tests serialize files because the configured Supabase pooler has a 15-client constraint.
- API has `/health/live` and `/health/ready`; readiness currently checks database and Redis. Prisma and the SSE Redis hub implement module destruction cleanup.

## Existing test infrastructure

P01–P12 integration runs under the actual `app_runtime` role, currently 21/21 passing with zero skips. It already covers tenant context leakage, outbox claim semantics, booking races, ownership fencing, inbound/status idempotency, follow-up execution and analytics authorization. Unit tests cover fake-provider production guards, HMAC handling, booking time and analytics ranges. Existing load and security documents are proposals, not measured P13 evidence.

## Confirmed hardening gaps

1. Nest has no explicit global JSON request-size limit; only the Meta webhook enforces 1 MB after raw-body capture.
2. No API-level rate limiter exists for mutation and expensive read paths.
3. API and worker entrypoints do not yet own bounded graceful-shutdown orchestration.
4. No executable P13 adversarial security, deterministic failure, or load harness exists.
5. No verified provider backup capability or isolated restore target is currently available; restore drills must be formally recorded as provider-limited until such a target is supplied.

## Non-blocking external dependencies

P08 live Meta-provider acceptance and P10 live template acceptance remain `NOT_RUN` human/provider actions. They are P14 readiness dependencies and do not reopen P08/P10 engineering closure.
