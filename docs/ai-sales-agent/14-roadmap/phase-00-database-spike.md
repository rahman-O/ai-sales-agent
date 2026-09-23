# Phase 00 disposable database compatibility spike

Status: **EXECUTED** — local Docker disposable spike PASS (12/12). See [technical readiness](phase-00-technical-readiness.md). Artifact location: `spikes/database-compatibility/`. Not a production schema or Phase 01 scaffold.

## Purpose and environment

Isolated disposable directory/database proved PostgreSQL 17.11 + pgvector + Prisma **7.10.0** (`@prisma/adapter-pg`, `pg` 8.16.3) with Node 24.14.0. Synthetic tenant IDs only. Migrations via administrative `DIRECT_URL`; runtime tests as non-owner `app_runtime`.

Prisma 6.19.3 was briefly present after an interrupted audit-driven pin change and also passed 12/12; it was not retained because the same CLI transitive advisories exist on both lines and 7.10.0 remains the preferred major after advisory classification.

## Minimal spike objects

Organization, User, OrganizationMember, TestResource, Staff, Booking, VectorRecord, AuditEvent, OutboxEvent — sufficient for composite FKs, RLS, exclusion concurrency, vector raw SQL, and multi-write rollback.

## Experiments and results

1. Extensions `vector` / `btree_gist`: **PASS**
2. Non-owner runtime + FORCE RLS: **PASS**
3. Transaction-local `set_config` + connection reuse: **PASS**
4. Composite tenant FKs: **PASS**
5. Rollback of resource/audit/outbox: **PASS**
6. Concurrent overlapping booking race (`Promise.allSettled`): **PASS** (exactly one commit)
7. Adjacent half-open ranges: **PASS**
8. Tenant-filtered vector similarity: **PASS**
9–10. Catalog/EXPLAIN/production pooler: deferred; local max-1 pool used for reuse proof. Supabase pooler: **BLOCKED_EXTERNAL_ACCESS**

## Conflict-strategy comparison

Unchanged recommendation: PostgreSQL exclusion constraints as final overlap authority; application prechecks for UX only.

## Prisma compatibility finding

Custom/raw SQL migrations are **required** for roles, FORCE RLS, policies, partial GiST exclusions, and vector operators. Prisma 7 uses `prisma.config.ts` and driver adapters. Pin: **7.10.0**.

## Evidence artifact and closure

Results live in [phase-00-technical-readiness.md](phase-00-technical-readiness.md). P00-T004 technical probe: **complete** for local disposable evidence. Hosted Supabase re-validation remains a P01 follow-through.
