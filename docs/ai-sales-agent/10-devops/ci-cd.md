# CI and release pipeline

PR gates: formatting/typecheck, import-boundary rules, unit tests, real-database migration/RLS/constraint integration tests, critical E2E flows, secret/dependency scanning and documentation links. Prompt/model/config changes add dataset evaluation. Keep provider calls out of ordinary deterministic CI unless a dedicated budgeted job requests them.

Build one immutable image set tagged by commit. Stage deployment runs migration compatibility checks and smoke journeys against test tenants. Production promotion requires phase acceptance evidence, approved environment configuration and rollback owner; release approval does not replace security tests.

Use expand-compatible migrations before deploying readers/writers. Canary one tenant, monitor queue/send/booking errors and spend, then expand. A safety regression disables agent and proactive outbound work; staff inbox remains available when safe. Roll back images only when database compatibility permits; otherwise forward repair.

Store test reports, image digest, migration version, prompt/model/config versions and release actor. Do not deploy on the basis of files existing or an unreviewed successful build alone.
