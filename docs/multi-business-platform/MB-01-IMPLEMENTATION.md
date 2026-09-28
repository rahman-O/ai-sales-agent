# MB-01 — Organization Profile & Capabilities Implementation

> **Document Status:** Authoritative Implementation Record  
> **Phase:** MB-01 (Organization Profile + Capabilities)  
> **Status:** CLOSED  
> **Next Phase:** MB-02 (Multi-Business Onboarding)  
> **P14 Authorization:** NOT AUTHORIZED  

---

## 1. Executive Summary

Phase MB-01 establishes the foundational data models, API endpoints, capability-combination validation engine, and backend authorization gates required to transform the system into a capability-driven multi-business platform.

### Key Deliverables Completed
1. **`OrganizationProfile` Model:** Holds descriptive business identity metadata (`displayName`, `businessType`, `description`, `country`, `timezone`, `defaultLanguage`, `defaultCurrency`). `businessType` is strictly descriptive and does not govern runtime logic.
2. **`OrganizationCapabilities` Model:** Explicit typed boolean capability flags that govern features, tools, and workflows without hardcoded industry branching.
3. **Additive Database Migration:** Created and deployed migration `202609281900_mb01_organization_profile_capabilities` with PostgreSQL Row-Level Security (RLS), FORCE RLS, and safe default backfills.
4. **Authoritative API Layer:** Added `GET /organizations/:id/profile`, `PATCH /organizations/:id/profile`, `GET /organizations/:id/capabilities`, and `PATCH /organizations/:id/capabilities` with strict role-based access (`OWNER`/`ADMIN` only) and tenant isolation.
5. **Backend Policy Enforcement:**
   - **Booking Tools:** Gated by `supportsBooking`. When disabled, `getAvailableSlots`, `createBooking`, `cancelBooking`, `rescheduleBooking`, and `getBookings` are blocked (`TOOL_NOT_AUTHORIZED`).
   - **Lead Tools:** Gated by `supportsLeads`. When disabled, `ensureLead`, `getLead`, `updateLeadQualification`, `transitionLead`, and `scheduleLeadFollowUp` are blocked (`TOOL_NOT_AUTHORIZED`).
   - **Lead Requirement Before Booking:** When `supportsLeads=true` and `leadRequiredBeforeBooking=true`, `createBooking` authoritatively verifies that an active, non-archived lead exists for the customer.
6. **Agent Context Integration:** Exposes concise `ORGANIZATION_PROFILE` and `ORGANIZATION_CAPABILITIES` blocks to `context-builder` while preserving core decision contracts.

---

## 2. Database Schema & Migration

### Schema Models (`prisma/schema.prisma`)
```prisma
model OrganizationProfile {
  organizationId  String       @id @map("organization_id") @db.Uuid
  displayName     String?      @map("display_name")
  businessType    String?      @map("business_type")
  description     String?
  country         String?      @default("IQ")
  timezone        String       @default("Asia/Baghdad")
  defaultLanguage String       @default("ar") @map("default_language")
  defaultCurrency String       @default("IQD") @map("default_currency")
  createdAt       DateTime     @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime     @updatedAt @map("updated_at") @db.Timestamptz(6)
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@map("organization_profiles")
}

model OrganizationCapabilities {
  organizationId            String       @id @map("organization_id") @db.Uuid
  supportsLeads             Boolean      @default(true) @map("supports_leads")
  leadRequiredBeforeBooking Boolean      @default(false) @map("lead_required_before_booking")
  autoCreateLeadOnIntent    Boolean      @default(true) @map("auto_create_lead_on_intent")
  supportsBooking           Boolean      @default(true) @map("supports_booking")
  supportsOffers            Boolean      @default(false) @map("supports_offers")
  supportsQuotes            Boolean      @default(false) @map("supports_quotes")
  supportsOrders            Boolean      @default(false) @map("supports_orders")
  supportsInventory         Boolean      @default(false) @map("supports_inventory")
  supportsStaff             Boolean      @default(true) @map("supports_staff")
  supportsLocations         Boolean      @default(true) @map("supports_locations")
  supportsProducts          Boolean      @default(false) @map("supports_products")
  supportsServices          Boolean      @default(true) @map("supports_services")
  supportsListings          Boolean      @default(false) @map("supports_listings")
  createdAt                 DateTime     @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt                 DateTime     @updatedAt @map("updated_at") @db.Timestamptz(6)
  organization              Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@map("organization_capabilities")
}
```

### Migration File
Location: `prisma/migrations/202609281900_mb01_organization_profile_capabilities/migration.sql`
- Creates tables with foreign key cascades on `organization_id`.
- Grants permissions to `app_runtime`.
- Enables and forces Row Level Security (`tenant_isolation` policy matching `current_tenant_id()`).
- Backfills existing organizations with safe default values.

---

## 3. Backward-Compatible Defaults

For backward compatibility with existing clinic workflows, the default capability values are:

| Capability Flag | Default Value | Description |
|---|---|---|
| `supportsLeads` | `true` | CRM sales opportunity pipeline enabled |
| `leadRequiredBeforeBooking` | `false` | Booking can proceed without prior lead |
| `autoCreateLeadOnIntent` | `true` | Inbound intent qualifies a lead |
| `supportsBooking` | `true` | Time-slot appointment scheduling enabled |
| `supportsOffers` | `false` | Structured promotions (MB-05) |
| `supportsQuotes` | `false` | Quotation workflow (MB-12) |
| `supportsOrders` | `false` | Direct transactional orders (MB-12) |
| `supportsInventory` | `false` | Stock tracking (MB-12) |
| `supportsStaff` | `true` | Multi-staff scheduling enabled |
| `supportsLocations` | `true` | Multi-location scheduling enabled |
| `supportsProducts` | `false` | Physical/retail catalog items (MB-04) |
| `supportsServices` | `true` | Appointment-based services catalog enabled |
| `supportsListings` | `false` | Real estate / automotive listings (MB-04) |

---

## 4. API Specification

All endpoints require JWT Bearer authentication and active membership in the target organization (`OWNER` or `ADMIN` for mutations).

### Endpoints
1. `GET /organizations/:id/profile`
   - **Access:** `OWNER`, `ADMIN`, `MEMBER`
   - **Response:** `200 OK` with `OrganizationProfileDto`
2. `PATCH /organizations/:id/profile`
   - **Access:** `OWNER`, `ADMIN`
   - **Body:** `UpdateOrganizationProfileRequest` (validated against `UpdateOrganizationProfileSchema`)
   - **Audit Action:** `organization.profile_updated`
3. `GET /organizations/:id/capabilities`
   - **Access:** `OWNER`, `ADMIN`, `MEMBER`
   - **Response:** `200 OK` with `OrganizationCapabilitiesDto`
4. `PATCH /organizations/:id/capabilities`
   - **Access:** `OWNER`, `ADMIN`
   - **Body:** `UpdateOrganizationCapabilitiesRequest` (validated against `UpdateOrganizationCapabilitiesSchema` and `validateCapabilitiesCombination`)
   - **Audit Action:** `organization.capabilities_updated`

---

## 5. Validation Rules

Capability combinations are validated by `validateCapabilitiesCombination()`:
1. **Lead Requirement Rule:** `leadRequiredBeforeBooking = true` requires:
   - `supportsLeads = true`
   - `supportsBooking = true`
2. **Auto-Create Lead Rule:** `autoCreateLeadOnIntent = true` requires:
   - `supportsLeads = true`

Any conflicting patch payload is rejected with `400 Bad Request` explaining the exact constraint violation.

---

## 6. Backend Policy Enforcement Matrix

| Test Case | Scenario | Enabled Capabilities | Expected Runtime Behavior |
|---|---|---|---|
| **Case A** | Leads Disabled | `supportsBooking=true`, `supportsLeads=false` | • `ensureLead`, `getLead`, `updateLeadQualification`, `transitionLead` return `TOOL_NOT_AUTHORIZED`<br/>• `createBooking` succeeds without a lead |
| **Case B** | Leads Optional | `supportsBooking=true`, `supportsLeads=true`, `leadRequiredBeforeBooking=false` | • `ensureLead` and `getLead` are active<br/>• `createBooking` succeeds with or without a lead |
| **Case C** | Leads Required | `supportsBooking=true`, `supportsLeads=true`, `leadRequiredBeforeBooking=true` | • `createBooking` fails with `LEAD_REQUIRED` if customer has no active lead<br/>• After `ensureLead` creates lead, `createBooking` succeeds with lead attached |
| **Case D** | Booking Disabled | `supportsBooking=false`, `supportsLeads=true` | • `getAvailableSlots`, `createBooking`, `cancelBooking`, `rescheduleBooking`, `getBookings` return `TOOL_NOT_AUTHORIZED`<br/>• Lead intake continues normally |
| **Case E** | Backward Compatibility | Default Migrated Capabilities | • All existing dental clinic bookings and lead qualifications function identically to baseline |

---

## 7. Verification & Test Evidence

### Automated Unit & Integration Tests
- `apps/api/src/organizations/organization-profile-capabilities.test.ts` (Validates schemas, combination constraints, and default baseline).
- `packages/agent-adapters/src/mb01-capability-enforcement.test.ts` (Validates all 5 capability enforcement test cases A-E against `tool-executor.ts` and `booking-tools.ts`).
- Full test suite: **161 passing tests across all 7 packages and apps (`npm.cmd test`)**.
- Full project build: **`npm.cmd run build` passed with zero errors**.

---

## 8. Known Limitations & Next Steps
- **MB-02 (Onboarding Wizard):** Non-technical users cannot yet configure capabilities via a guided step-by-step UI wizard.
- **MB-03 (Dynamic Navigation):** Frontend operator navigation will be dynamically filtered based on `organization.capabilities` in MB-03.
- **MB-04 (Generic Catalog):** `CatalogItem` abstraction for physical products and property listings will be introduced in MB-04.
