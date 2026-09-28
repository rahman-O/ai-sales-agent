# MB-04 — Generic Business Catalog Implementation

> **Document Status:** Authoritative Implementation Record  
> **Phase:** MB-04 (Generic Business Catalog)  
> **Status:** CLOSED  
> **Next Phase:** MB-05 (Offers / Promotions)  
> **P14 Authorization:** NOT AUTHORIZED  

---

## 1. Executive Summary

Phase MB-04 establishes the single authoritative, generic, organization-owned catalog layer (`CatalogItem`) that decouples generic item representations from specialized domain behaviors. The current `Service` model and all existing booking, lead, and staff dependencies are preserved with 100% backward compatibility and deterministic database backfilling.

### Key Deliverables Completed
1. **Generic Catalog Item Abstraction (`CatalogItem`):**
   - Implemented `model CatalogItem` in PostgreSQL and Prisma schema with shared fields: `id`, `organizationId`, `kind`, `name`, `description`, `sku`, `amountMinor`, `currency`, `status`, `metadataJson`, `version`, `archivedAt`, `createdAt`, `updatedAt`.
   - Supported item kinds: `SERVICE`, `PRODUCT`, `LISTING`, `PACKAGE`, `OTHER`.
   - Supported lifecycle states: `ACTIVE`, `INACTIVE`, `ARCHIVED`.
2. **Service Specialization & Relational Integrity:**
   - `Service` model linked to `CatalogItem` via `services.catalog_item_id` foreign key (`UNIQUE(organization_id, catalog_item_id)`).
   - Preserved existing `Service.id` primary keys, foreign key references in `bookings.service_id`, `leads.primary_service_id`, and `service_staff(service_id)`.
   - `CatalogItem` acts as the single source of truth for generic catalog attributes (`name`, `description`, `price`, `currency`, `status`), while `Service` owns booking/scheduling attributes (`durationMinutes`, `bufferBeforeMinutes`, `bufferAfterMinutes`, `bookingEnabled`, `locationId`, etc.).
3. **Deterministic Database Migration & Backfill:**
   - Migration `202609282100_mb04_generic_catalog/migration.sql` created and applied.
   - For every existing `Service`, an authoritative `CatalogItem` (kind: `SERVICE`) was created and linked to `Service.catalog_item_id`.
   - Enabled and enforced PostgreSQL Row-Level Security (`FORCE ROW LEVEL SECURITY`) with `tenant_isolation` policy.
4. **Backend Capability Enforcement:**
   - Backend creation logic in `CatalogService` enforces tenant capabilities:
     - Creating `SERVICE` requires `supportsServices=true`.
     - Creating `PRODUCT` requires `supportsProducts=true`.
     - Creating `LISTING` requires `supportsListings=true`.
   - Rejects unpermitted kinds with `ConflictException` without runtime `businessType` branching.
5. **Transactional Service Specialization:**
   - Creating a `SERVICE` through the catalog layer transactionally creates both `CatalogItem` and `Service` specialization within a single database transaction.
6. **AI Tools & Booking Backward Compatibility:**
   - Existing `searchServices`, `getServiceDetails`, `getServicePrice`, and `createBooking` remain 100% stable and operational.
7. **Typed Contracts & Schemas (`@ai-sales-agent/contracts`):**
   - Created typed DTOs and Zod validation schemas (`CatalogItemKind`, `CatalogItemStatus`, `CatalogItemDto`, `CreateCatalogItemSchema`, `UpdateCatalogItemSchema`).

---

## 2. Catalog Architecture & Entity Model

```text
┌─────────────────────────────────────────────────────────────┐
│                 ORGANIZATION (Multi-Tenant)                 │
└──────────────┬──────────────────────────────┬───────────────┘
               │ 1:N                          │ 1:N
               ▼                              ▼
┌──────────────────────────────┐       ┌──────────────────────────────┐
│         CatalogItem          │       │           Location           │
├──────────────────────────────┤       ├──────────────────────────────┤
│ id: UUID (PK)                │       │ id: UUID (PK)                │
│ organization_id: UUID (FK)   │       │ timezone: String             │
│ kind: SERVICE | PRODUCT | ...│       │ name: String                 │
│ name: String                 │       └──────────────┬───────────────┘
│ description: String?         │                      │
│ sku: String?                 │                      │
│ amount_minor: BigInt?        │                      │
│ currency: String?            │                      │
│ status: ACTIVE | INACTIVE |..│                      │
│ metadata_json: Json?         │                      │
└──────────────┬───────────────┘                      │
               │ 1:1 (Optional Specialization)        │
               ▼                                      │
┌──────────────────────────────┐                      │
│           Service            │                      │
├──────────────────────────────┤                      │
│ id: UUID (PK - Preserved)    │                      │
│ organization_id: UUID (FK)   │                      │
│ catalog_item_id: UUID (FK)   │                      │
│ location_id: UUID (FK) ◄─────┴──────────────────────┘
│ duration_minutes: Int        │
│ buffer_before_minutes: Int   │
│ buffer_after_minutes: Int    │
│ booking_enabled: Boolean     │
└──────────────┬───────────────┘
               │
        ┌──────┴──────────────────────┐
        ▼                             ▼
┌──────────────┐              ┌──────────────┐
│   Booking    │              │     Lead     │
│ (service_id) │              │ (service_id) │
└──────────────┘              └──────────────┘
```

---

## 3. Source of Truth & Field Ownership Matrix

| Field | Authoritative Owner | Mirrored on Service for BC | Notes |
| :--- | :--- | :--- | :--- |
| `name` | `CatalogItem` | Yes | Synchronized on updates |
| `description` | `CatalogItem` | No | Generic metadata |
| `sku` | `CatalogItem` | No | Generic SKU/identifier |
| `amountMinor` / `currency` | `CatalogItem` | Yes | Synchronized on updates |
| `status` / `archivedAt` | `CatalogItem` | Yes (`active`, `archivedAt`) | Archived status cascades to specialization |
| `durationMinutes` | `Service` | Authoritative | Booking/scheduling engine |
| `bufferBeforeMinutes` | `Service` | Authoritative | Booking slot calculation |
| `bufferAfterMinutes` | `Service` | Authoritative | Booking slot calculation |
| `bookingEnabled` | `Service` | Authoritative | Slot generation gating |
| `locationId` | `Service` | Authoritative | Location association |

---

## 4. API Endpoints

| Method | Endpoint | Description | Capability / Guard |
| :--- | :--- | :--- | :--- |
| `GET` | `/organizations/:orgId/catalog` | List locations, services, and staff (Legacy backward compatible) | Active Member |
| `GET` | `/organizations/:orgId/catalog/items` | List generic catalog items with filtering (`kind`, `status`) | Active Member |
| `GET` | `/organizations/:orgId/catalog/items/:itemId` | Retrieve single catalog item with linked specialization | Active Member |
| `POST` | `/organizations/:orgId/catalog/items` | Create generic catalog item (or transactional service specialization) | `supportsServices` / `supportsProducts` / `supportsListings` |
| `PATCH`| `/organizations/:orgId/catalog/items/:itemId` | Update catalog item and synchronized service specialization | Active Member |
| `POST` | `/organizations/:orgId/catalog/items/:itemId/archive` | Archive catalog item and deactivate linked specialization | Active Member |
| `POST` | `/organizations/:orgId/catalog/services` | Transactional legacy service creation (links CatalogItem automatically) | `supportsServices=true` |
| `POST` | `/organizations/:orgId/catalog/locations`| Create location | Active Member |
| `POST` | `/organizations/:orgId/catalog/staff` | Create staff member | Active Member |

---

## 5. Verification and Quality Gates

| Verification Gate | Command | Result |
| :--- | :--- | :--- |
| Prisma Validation | `npx prisma validate` | PASS |
| Prisma Client Generation | `npx prisma generate` | PASS |
| Unit Tests (All Packages) | `npm test` | PASS (224/224 tests passing) |
| Integration & RLS Tests | `npm run test:integration` | PASS (22/22 tests passing) |
| Monorepo Build | `npm run build` | PASS |
| Full Workspace Typecheck | `npm run typecheck` | PASS |
| Demo Seed & Reseed | `npm run demo:reseed` | PASS |
