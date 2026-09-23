# Multi-tenancy architecture

Propose a shared database/shared schema with organization_id on every tenant-owned row. This keeps transactions and operations simple for the initial scale. Dedicated tenant databases are a future contractual requirement, not an early abstraction.

User is a global identity exception; OrganizationMember carries tenant authority. Organization is the tenant root. Customer is never global. Platform-level provider tariff records contain no customer data and are read-only to tenant actors.

Resolve tenant scope from verified session membership on staff requests, from verified channel mappings on webhooks, and from durable record ownership on jobs. Client organization IDs are routing hints only. Never accept a model-supplied organization ID. Composite foreign keys prevent linking a tenant A booking to tenant B customer even with globally unique IDs.

Apply repository scoping plus PostgreSQL row-level security. Storage keys, query caches, Redis keys, search queries, exports, telemetry views and event streams require the same boundary. System maintenance uses a dedicated audited role, not ordinary runtime credentials.

Detailed database role/pooling requirements and adversarial tests are canonical in [tenant isolation](../06-data/tenant-isolation.md). Isolation is a P01 gate and tested at every phase.
