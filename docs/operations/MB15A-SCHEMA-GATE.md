# MB-15A normalized schema gate

The source of truth combines Prisma, SQL migrations, and the documented local migration bootstrap. Raw Prisma equality is not a valid replacement for SQL-managed RLS, selective SET NULL behavior, default generation, indexes, functions, or privileges.

The new read-only `scripts/mb15/normalized-schema-drift.ts` compares the live demo catalog with a separate, fresh PostgreSQL 17 migration replay. It checks table/RLS flags, columns/types/defaults, constraints (including selective SET NULL and exclusions), functional index definitions/validity, policies, function definitions/owners/ACLs, triggers, grants, extensions, enum definitions and app_runtime attributes. Names of indexes/constraints are normalized; definitions and multiplicity are preserved. Migration checksums remain strict. The checker also refuses a reference container unless Docker reports network mode none.

## Reference creation

Use a separate disposable container with the same database image, no network and no published ports:

```sh
docker run -d --rm --name mb15-schema-reference --network none -e POSTGRES_HOST_AUTH_METHOD=trust pgvector/pgvector:pg17
```

Replay every `prisma/migrations/*/migration.sql` in lexical order with `psql -v ON_ERROR_STOP=1`. Before the P13 grant migration, apply the exact local bootstrap function from `scripts/demo/prepare-local-migrate.ts`, as the existing `Dockerfile.migrate` does. Never seed the reference from live schema: the migrations must independently define expected state.

Run the gate with:

```sh
MB15_SCHEMA_REFERENCE_CONTAINER=mb15-schema-reference npx tsx scripts/mb15/normalized-schema-drift.ts
```

The gate only reads the demo database. Its JSON evidence lists all differences and both catalogs; any unmatched object, changed invariant or history checksum mismatch fails the command. Save evidence before removing the reference with `docker stop mb15-schema-reference`.

## Verified reconciliation

The 349 raw Prisma operation blocks comprise 306 intentional SQL differences and 43 index naming differences. Full catalog equivalence to migration replay proved no missing runtime invariant. A separate stale checksum for the working-state migration was the only history mismatch. `reconcile-working-state-history.ts` repaired only that metadata after rechecking exact catalog equivalence and guarding the old checksum. It retained the old metadata in `MB15A-HISTORY-RECONCILIATION.json`. No schema migration or business-data update occurred.

See `MB15A-SCHEMA-DIFF-CLASSIFICATION.json` for each comparison item's object, type, Prisma state, database state, migration references, category, and action.

Negative test: disabling RLS on conversations in the isolated reference caused the gate to fail with a table-state difference. Restoring reference RLS returned the gate to NONE. The demo database remained read-only throughout.

RAW_PRISMA_DIFF: FOUND
NORMALIZED_SCHEMA_DRIFT: NONE
MIGRATIONS_CREATED: NONE
