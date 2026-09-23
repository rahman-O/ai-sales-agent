# Backup and recovery

Proposed pilot RPO ≤15 minutes and RTO ≤4 hours, pending host capability/cost approval. Enable managed PostgreSQL point-in-time recovery and daily backups with a proposed 30-day expiry. Version private objects or back them up with a manifest linked to document versions. Redis backups are optional for acceleration; durable work must be rebuildable from PostgreSQL.

Restore drill: declare incident and freeze outbound/agent workers; restore database to an isolated environment; restore required objects; apply deletion/consent revocation ledger newer than backup; validate tenant policies, constraints, row counts and referential integrity; classify operations/sends after restore cutoff using external receipts and independent incident records; rebuild queue intent; run isolated smoke tests; authorize resuming traffic.

Historical PENDING/DISPATCHING outbox cannot be blindly released after restore. Quarantine sends whose post-backup outcomes are unknown and reconcile before delivery. A model replay must not recreate bookings with new keys. Record actual lost-data interval, recovery time and unresolved external uncertainty.

Perform a full drill before pilot and quarterly thereafter. Include a single-tenant privacy deletion check, missing blob recovery and revoked secret handling. Backup success notification is not restore proof. Business owner approves any remaining data-loss/uncertain-send impact before reopening affected tenants.
