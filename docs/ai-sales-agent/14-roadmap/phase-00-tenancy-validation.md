# Phase 00 multi-tenancy validation

Decision status: PROPOSED. The model is suitable for initial scale but requires the selected database/ORM/pool spike and architecture approval.

## Ownership model

Organization is the tenant root. User is a global authenticated identity and contains no organization business data. OrganizationMember joins a User to an Organization and carries role/status. Every customer, identity, channel, conversation, message, lead, service, staff record, schedule, booking, knowledge record, agent run, operation, follow-up, usage record, audit record, storage object, queue reference, and analytics fact is organization-owned.

Use UUID primary keys plus `organization_id`. Tenant parents expose `UNIQUE (organization_id, id)` and tenant children use composite foreign keys so a globally unique-looking ID cannot connect rows across organizations. Business uniqueness includes organization scope. Channel provider identifiers that must be globally unique still map to exactly one organization through a restricted connection table.

## Authorization and application scope

Staff requests derive identity from a verified session, then resolve active OrganizationMember and permission. A path/body organization ID is only a routing claim and must match server authority. Webhooks derive organization from a verified provider connection; customer-supplied identifiers never choose a tenant. Jobs carry organization plus record IDs, then re-resolve ownership and permissions/state from durable records. The LLM never supplies organization or actor authority.

Repositories/application services require a TenantContext and expose no tenant-owned “find by ID” without organization scope. Raw SQL, vector search, export, object downloads, event streams, caches, Redis keys, traces, and analytics use the same boundary. Frontend filters and hidden controls are usability only, never security.

## PostgreSQL defense in depth

Use a migration-owner role separate from a non-owner runtime role without superuser/BYPASSRLS. Enable and FORCE RLS on tenant tables. Policies apply `USING` and `WITH CHECK` against a transaction-local tenant setting. Missing scope denies. Set the tenant with a parameterized `set_config(..., true)` inside the same explicit transaction and connection as all protected queries; never rely on session-level state across pooled requests.

The application remains a trusted policy-enforcement layer because a runtime role able to set arbitrary tenant context can select another value. RLS protects against omitted query predicates, not a compromised application identity. Composite foreign keys provide an independent write-integrity layer. Separate credentials, network policy, secret access, audit, and role checks complete defense in depth.

## Prisma, pooling, and jobs

Prisma **7.10.0** with `@prisma/adapter-pg` is the spike-validated pin. One transaction callback must use one backend connection and permit tenant `set_config` before protected queries (proved with pool `max: 1`). Transaction-pooling is compatible only when tenant scope is transaction-local and set inside every transaction; session `SET` is prohibited. Migrations/admin tooling use the direct connection and migration role. Background workers use the same scoped transaction wrapper as HTTP and never keep transactions open across LLM/provider calls. Every BullMQ job must carry `organizationId` and reconstruct tenant context per job.

## Required acceptance tests

Create two tenants with overlapping phone numbers, names, provider-like IDs, services, documents, and bookings. Test reads, creates, nested writes, updates/deletes, raw SQL, vector retrieval, exports, object URLs, jobs, SSE, caches, audit/usage and analytics. Reuse one physical pooled connection across alternating tenants; missing/expired context must deny. Attempt cross-tenant composite references. Confirm table-owner and migration roles bypass only where intended. Query catalog metadata to fail CI when a new tenant table lacks RLS/FORCE/policies.

