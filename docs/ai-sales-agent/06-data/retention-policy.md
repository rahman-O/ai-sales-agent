# Retention and deletion policy

These are proposed engineering defaults requiring product/privacy approval in P00; they are not statements of applicable law.

- Raw webhook bodies and quarantined uploads: seven days unless an incident hold applies.
- Message text and customer-linked conversation summaries: 180 days after last activity; tenant-configurable shorter retention.
- Redacted model context snapshots: 14 days; trace metadata and usage evidence: 90 days.
- Business customer/lead/booking records: 365 days after relationship closure, subject to agreed operational/recordkeeping needs.
- Audit events: 365 days; remove direct PII where references suffice.
- Aggregated de-identified metrics: 24 months; prevent tiny-cohort re-identification.
- Receipt IDs: 90 days; operational command identities follow their referenced business record.

DeletionRequest freezes new processing for the subject, revokes retrieval visibility, cancels follow-ups, removes blobs/chunks/summaries/caches and pseudonymizes retained business references. Global User deletion must account for memberships and ownership transfer independently of customer deletion. Tenant offboarding revokes credentials, stops jobs, exports authorized data and schedules purge.

Maintain a deletion ledger outside normal restored snapshots, then reapply it before reopening a restored environment. Backups expire on their configured lifecycle; disclose that deletion from active systems does not instantly erase historical backups. Legal holds require explicit recorded authority, scope and expiry. Test completion across object storage, vector data and third-party trace providers, not only primary tables.
