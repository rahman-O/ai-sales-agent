# Tenant isolation enforcement

The application runtime database role is neither owner, superuser nor BYPASSRLS. Migration ownership uses a separate secret. Enable and FORCE RLS on tenant tables; policies check organization_id against a transaction-local setting for both USING and WITH CHECK. Missing scope denies access. OrganizationMember bootstrap requires a dedicated narrowly scoped identity lookup, not general bypass privileges.

Set context using parameterized set_config inside an explicit transaction on the same connection as all tenant queries. Use transaction-local settings; pooled connections must not retain tenant state. Background workers open the same scoped unit of work. Long model/provider calls happen between transactions. Never rely on a Prisma client extension alone to cover raw SQL or nested writes.

A compromised runtime DB role that can set arbitrary scope is outside what session-variable RLS alone can prevent. Trusted application authorization is still required; RLS is defense against query omissions. Separate database credentials, secret access and network controls limit stronger threats.

Composite foreign keys reject cross-tenant references. Policies cover reads, inserts, updates, deletes, join tables and analytics projections. Global User authentication lookups expose only the subject's account; tenant membership lists do not leak unrelated users. Storage access is authorized against database metadata before issuing short-lived URLs.

Test all roles with two tenants, guessed IDs, nested writes, raw SQL, search, export, object downloads, queued jobs and event streams. Reuse a physical pooled connection across tenants and confirm absent/expired scope denies access. Migration tests query database policy metadata to catch newly added unprotected tables. [PostgreSQL RLS caveats](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).
