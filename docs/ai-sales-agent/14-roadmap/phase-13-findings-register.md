# Phase 13 — Findings register

Date: 2026-09-24. This register records evidence and does not authorize P14.

| ID | Area | Severity | Finding and evidence | Disposition | Remaining risk | P14 action required |
|---|---|---|---|---|---|---|
| P13-001 | DB privilege | High | `rls_auto_enable()` was a `SECURITY DEFINER` event-trigger with `PUBLIC EXECUTE`. Catalog audit confirmed the finding. Migration `202609240700_p13_security_definer_grants` revoked `PUBLIC` and `app_runtime`; hosted audit now passes. | FIXED | None known. | No |
| P13-002 | Dependency | Moderate | BullMQ 5.58.5 brought vulnerable `uuid`. `npm audit --omit=dev` identified it. | FIXED | None known; BullMQ is now 5.81.5. | No |
| P13-003 | Dependency | High | Prisma 7.10.0 CLI brings `@prisma/config` → `deepmerge-ts` 7.1.5 (GHSA-ggr8-5vv4-36mx). Compatible patch unavailable without major downgrade. | ACCEPTED_WITH_EVIDENCE | Build/migration hosts still install CLI. Final images `asa-api:p13-canonical` / `asa-worker:p13-canonical` prove package absent (`npm ls` empty; top-level dirs absent). | Use same image shape in P14 deploy |
| P13-004 | Dependency | High | Prisma CLI brings `mysql2` (GHSA-3f6p-5ww8-9rcr / related). Runtime DB is PostgreSQL via `@prisma/adapter-pg` + `pg`. | ACCEPTED_WITH_EVIDENCE | Same as P13-003: absent from labeled `CANONICAL_PILOT_RUNTIME_ARTIFACT` images. | Use same image shape in P14 deploy |
| P13-005 | Ops | Medium | Hosted backup plan / PITR / restore UI not operator-visible in this closure run. | ACCEPTED_WITH_EVIDENCE | `BACKUP_CAPABILITY=UNVERIFIED_EXTERNAL_DEPENDENCY`; `RESTORE_DRILL=NOT_POSSIBLE_WITH_CURRENT_PLAN`. | Prove backup/restore as `app_runtime` before external pilot |

## Dependency path evidence

Dev tree: `prisma@7.10.0 -> @prisma/config -> deepmerge-ts` and `prisma -> mysql2`. Runtime artifacts: multi-stage `Dockerfile.api` / `Dockerfile.worker` prune and delete CLI chain; in-image inspect via `scripts/p13/run-image-inspect.mjs`.

## Current validation evidence

- Runtime DB role audit: PASS; `app_runtime` is not superuser and has no `BYPASSRLS`.
- Tenant RLS audit: PASS; 35 tenant tables have RLS enabled and forced.
- API unit tests: 40/40 PASS (includes security middleware + P13 fault/observability matrices).
- Config unit tests: 6/6 PASS.
- Agent-core unit tests: 12/12 PASS.
- Agent-adapters unit tests: 16/16 PASS (AI kill + Meta ambiguous send).
- Embeddings / knowledge-chunking / storage: 7+11+6 PASS.
- **Unit suite total: 98/98 PASS.**
- P01–P12 integration after `202609241800_p13_ai_emergency_kill`: **21/21 PASS**, zero skipped.
- Mixed-load baseline + concurrency exact-one: PASS (mocked); SLO not silently promoted.
- Org/global AI emergency kill: implemented and unit-tested.
- Canonical images: in-image `prisma`/`mysql2`/`deepmerge-ts` absent; label `CANONICAL_PILOT_RUNTIME_ARTIFACT=true`.

## External limitations

Restore drill remains not possible without accessible hosted backup controls. P14 remains unauthorized until product/ops approve separately.
