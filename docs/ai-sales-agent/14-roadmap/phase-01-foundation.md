# Phase 01 — Project foundation and tenant security

Status: IN_PROGRESS — BLOCKED (local foundation PASS; Supabase Auth/DB external access blocked). Relative complexity: L. See [phase-01-closure.md](phase-01-closure.md).


## 1. Objective

Create a reproducible workspace and a tested tenant-aware authentication/data access foundation.

## 2. Why This Phase Exists

Every later API, queue and tool must inherit a verified authority boundary rather than retrofit tenancy.

## 3. Entry Criteria

P00 CLOSED with documented approval; compatible versions, host approach, identity provider and role policy selected.

## 4. Scope

TypeScript workspace, Next.js shell, NestJS API/worker entrypoints, config validation, PostgreSQL/Redis local setup, auth/session/membership, RLS and CI baseline.

## 5. Out of Scope

Agent inference, live messaging, booking features and full dashboard.

## 6. Architecture Impact

Introduce modular-monolith boundaries, scoped unit of work, runtime/migration roles, request correlation and validated DTO conventions.

## 7. Files / Modules Expected

Likely implementation locations: apps/web, apps/api, apps/worker, packages/contracts, packages/config, prisma, tests/integration, .github/workflows or selected CI equivalent.

## 8. Data Model Changes

Organization, User, OrganizationMember and minimal AuditLog/OutboxEvent foundations; tenant composite keys and RLS policies.

## 9. APIs

Auth session endpoints, GET /me, organization create/settings and membership commands; liveness/readiness endpoints with no secrets.

## 10. Business Rules

No tenant-owned repository access without server context. Runtime DB role must not bypass RLS. Last active owner cannot be removed.

## 11. Implementation Tasks

- [x] P01-T001: Scaffold pinned workspace and validated environment configuration. Verification: Fresh setup fails clearly on missing required variables and runs API/web/worker.
- [x] P01-T002: Add PostgreSQL migrations and separated database roles. Verification: Fresh and upgrade tests confirm RLS and composite keys under runtime role.
- [ ] P01-T003: Integrate selected identity provider and secure session lifecycle. Verification: Login, logout, expiration and revocation pass deterministic HTTP tests. **Architecture implemented; live provider BLOCKED_EXTERNAL_ACCESS.**
- [x] P01-T004: Implement organization membership and role policy. Verification: Cross-tenant and last-owner negative cases are rejected.
- [x] P01-T005: Create scoped transaction and audit/outbox primitives. Verification: A transaction rollback leaves neither business mutation nor success event.
- [x] P01-T006: Add CI gates and two-tenant synthetic seed. Verification: Fresh checkout passes typecheck and isolation suite without production secrets.

## 12. Testing Requirements

- Unit: Configuration parsing, role predicates, session expiration and organization membership rules.
- Integration: Pooled-connection tenant switching, absent scope, nested references, migration drift and revoked membership.
- E2E: Sign in, create tenant, invite operator, switch between permitted tenants and reject an unauthorized tenant URL.
- Failure scenarios: Identity provider unavailable, database startup failure, CSRF attempt and interrupted membership transaction.

## 13. Observability Requirements

Request IDs, auth denials and role-change audit; API/DB latency and health metrics without PII.

## 14. Security Considerations

Secure cookies, CSRF/origin checks, separate secrets, deny-by-default roles, RLS and secret scanning.

## 15. Acceptance Criteria

- [ ] Tenant A cannot read or mutate tenant B data through tested paths.
- [ ] Pooled connections do not leak prior tenant context.
- [ ] Owner transfer and member revocation enforce invariants.
- [ ] Fresh local setup and CI pass using synthetic data.

## 16. Exit Criteria

All P01 tasks are implemented or formally removed through reviewed scope change; required tests and acceptance checks pass; linked architecture/API/data documents match actual behavior; evidence and reviewer sign-off are recorded using the [closure template](phase-closure-template.md). No critical unresolved defect in this phase's boundary remains. A list of created files alone is not closure evidence.

## 17. Dependencies

Requires P00. Unblocks P02 and all scoped modules.

## 18. Risks

R01 and R13; wrong database role can make passing application tests misleading.

## 19. Deliverables

Workspace skeleton, setup guide, auth/tenant modules, migrations, CI and isolation reports.

Canonical context: [master plan](master-plan.md), [test strategy](../09-testing/testing-strategy.md), [risk register](../13-risks/risk-register.md).
