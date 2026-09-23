# Migration strategy

Existing application migration: none; this was an empty workspace. Proposed schema evolves by the phase allocations in [Prisma plan](prisma-model-plan.md). Documentation creation is not a database migration.

Use expand/backfill/contract for deployed schemas. Add nullable fields or compatible tables, deploy dual-compatible readers/writers, backfill in bounded tenant-scoped batches with checkpoints, validate, then enforce constraints and remove old fields in a later release. No destructive production migration on application startup.

Run migrations once through a controlled release job with migration credentials. Verify extensions, RLS, composite keys, exclusions and index definitions after migration. Test fresh install and upgrade from the last supported release; replay fixture data including duplicate operations and old event versions.

Rollback application containers only while schema compatibility holds. For irreversible data changes prefer forward repair; restore is an incident procedure with measured data-loss window and outbound sends disabled. Knowledge re-embedding builds a separate version and swaps publication pointers; never mix vector dimensions in one index.
