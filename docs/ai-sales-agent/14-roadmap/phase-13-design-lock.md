# Phase 13 — Design lock

Date: 2026-09-24. Status: **GO FOR TARGETED HARDENING**.

## Security and tenancy

- Exercise every tenant table and representative endpoint using `app_runtime`; no service-role shortcut is allowed.
- Audit the four narrow `SECURITY DEFINER` functions from P03 for ownership, `search_path`, grants and cross-tenant misuse.
- Retain JWT verification plus fresh membership lookup as the authorization boundary. Test malformed, expired and cross-organization access.
- Test-only fake providers remain permitted only under `NODE_ENV=test` and `AI_ALLOW_FAKE=true`; production provider selection must stay unchanged.

## Resource boundaries

- Add explicit global JSON limits and smaller endpoint-level validation limits for free text and sensitive mutations.
- Add bounded in-process API rate limits keyed by authenticated user plus organization where applicable. Webhooks rely on signature, size, deduplication and bounded processing rather than naive IP throttling.
- Keep current pool sizes until a measured test proves a different bound is needed. Add per-workload database timeouts only where they do not affect migrations.

## Resilience and operations

- Add API/worker graceful shutdown with a finite drain timeout and clean DB/Redis/BullMQ closure.
- Add liveness/readiness regression tests and a non-secret dependency-health response where useful.
- Build deterministic failure tests for Redis failure, provider ambiguity, duplicate jobs, stale leases and ownership fencing. Do not perform destructive hosted chaos or backup restores.

## Performance model

Use deterministic synthetic fixtures. The initial target is five tenants, 50 active conversations, sustained five inbound messages/sec and a 30-second 25 messages/sec burst, with a hot-tenant case. Measurements must be reported as local/hosted-test evidence, not production capacity claims.

## Known limitations

No verified Supabase backup/restore capability or isolated restore environment is currently available. Backup capability will be documented from configured-provider evidence; restore is expected to be `NOT_POSSIBLE_WITH_CURRENT_PLAN` unless a non-production restore target is supplied.

## Expected migrations

**NONE** unless a measured query/security finding proves a schema change is necessary.

## Blockers

None for targeted P13 hardening and validation. Provider backup/restore verification is an external limitation, not authorization to alter production data.
