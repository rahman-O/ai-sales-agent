# Phase 02 — Scope manifest

Status: IMPLEMENTATION. Source priority follows the Phase 02 scope resolution and `phase-02-core-domain.md`.

## Goal and scope

Establish the tenant-owned customer/contact and catalog/reference primitives required by later conversation, lead and booking phases. In scope: Customer, CustomerIdentity, Location, Service, StaffMember, ServiceStaff, Money, TimeRange, ContactAddress normalization, versioned domain-event envelopes, lifecycle rules, tenant repositories, scoped APIs and deterministic two-tenant verification.

Out of scope: Conversation, Message, channel connections/adapters, consent workflows, Lead, schedules, availability, proposals, Booking, AI, RAG, WhatsApp, handoff, follow-ups and analytics. CustomerIdentity uses a normalized fixture `channel` key until the separately owned ChannelConnection model exists.

## Invariants and lifecycle

- Every entity belongs to one `organizationId`; composite foreign keys enforce tenant consistency.
- Customer identities are unique by organization, channel and normalized external address. Phone-like channels require E.164. Binding and merge are explicit and audited.
- Merge locks both active customers, moves identities atomically, archives the source with `mergedIntoId`, increments both versions and never crosses organizations.
- Location timezone is an IANA identifier. Location, Service and StaffMember archive rather than delete.
- Money uses nonnegative integer minor units and an allowlisted uppercase ISO currency. API serialization uses decimal strings.
- Service duration is positive; buffers are nonnegative. Service and StaffMember must reference an active same-tenant Location.
- ServiceStaff is a same-tenant, same-location eligibility relation and carries no scheduling behavior.
- Mutable aggregates use monotonic optimistic versions. Archived references cannot support new eligibility operations.

## Commands, queries and API

Customer commands: create, update with expected version, bind identity, verified operator merge, archive. Queries: scoped list/search and detail. Catalog commands: create location/service/staff, link eligible staff, archive references. Query: scoped catalog view. Routes remain under `/v1/organizations/{organizationId}` and require the established JWT plus ACTIVE membership trust chain.

## Persistence, authorization and evidence

The Phase 02 migration adds composite keys, checks, indexes, minimal `app_runtime` grants, and ENABLE/FORCE RLS policies for all six tables. All service operations use `TenantContextService`; meaningful mutations write `AuditLog` in the same transaction. Customer creation writes a versioned `CustomerCreated` envelope to the existing outbox. No second auth, audit, event or idempotency subsystem is introduced; merge is deterministic on replay through persisted merge state and returns a conflict for incompatible repeat attempts.

Acceptance requires domain tests, schema generation, local migration and runtime-role integration tests, API build/typecheck/lint, Phase 01 regression, and hosted migration/runtime acceptance as `app_runtime`.
