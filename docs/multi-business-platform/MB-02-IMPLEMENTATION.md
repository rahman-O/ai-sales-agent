# MB-02 — Multi-Business Onboarding Implementation

> **Document Status:** Authoritative Implementation Record  
> **Phase:** MB-02 (Multi-Business Onboarding)  
> **Status:** CLOSED  
> **Next Phase:** MB-03 (Dynamic Dashboard Navigation)  
> **P14 Authorization:** NOT AUTHORIZED  

---

## 1. Executive Summary

Phase MB-02 establishes the organization onboarding foundation and progressive setup user experience for arbitrary businesses. The solution is capability-driven, resumable across sessions and devices, mobile-responsive, RTL-safe (with native Arabic support), and guarantees full backward compatibility for existing organizations without introducing premature runtime modules.

### Key Deliverables Completed
1. **`OrganizationOnboarding` State Model:** Backend-owned persistent onboarding tracking model (`status`, `currentStep`, `completedSteps`, `startedAt`, `completedAt`, `updatedAt`).
2. **Database Migration with RLS:** Created and applied `202609282000_mb02_organization_onboarding` with Row-Level Security (`FORCE ROW LEVEL SECURITY`), `tenant_isolation` policy, and safe backfill setting existing organizations to `COMPLETED`.
3. **Save & Resume API Engine:**
   - `GET /organizations/:id/onboarding`: Retrieves current onboarding step, profile, capabilities, and live backend readiness.
   - `PATCH /organizations/:id/onboarding-progress`: Updates current step and completed steps with strict `OWNER`/`ADMIN` role gating.
   - `POST /organizations/:id/onboarding/complete`: Backend-authoritative readiness validation and completion transition.
4. **5-Step Progressive Onboarding Wizard (`/onboarding`):**
   - **Step 1 — Business Identity:** Collects `displayName`, business type (for capability suggestions), description, country, timezone, default language, currency.
   - **Step 2 — What Should Your AI Do?:** Presents human-readable capability cards (Appointments, Leads, Staff, Locations, Services, and graceful "Coming in next phase" cards for Products, Orders, Quotes, Offers, Inventory, Listings) and human-friendly Lead Intake Policy options.
   - **Step 3 — Basic Setup:** Dynamically adapts to enabled capabilities, displaying primary location, staff, and service readiness.
   - **Step 4 — Business Operations:** Summarizes operating rules, working hours, and human handoff readiness.
   - **Step 5 — Review & Finish:** Human-readable review with live backend-calculated readiness checks and single-click completion redirecting to the dashboard.
5. **Backend Readiness & Completion Validation:** Authoritative `computeReadiness` evaluator ensuring completion is rejected if required fields or capability invariants are incomplete, while ignoring non-enabled modules (`NOT_APPLICABLE`).
6. **Frontend BFF Proxy Routes:** Created secure Next.js BFF proxy routes for onboarding, onboarding-progress, completion, profile, and capabilities.

---

## 2. Database Schema & Migration

### Schema Model (`prisma/schema.prisma`)
```prisma
/// MB-02 — persistent organization onboarding state
model OrganizationOnboarding {
  organizationId String       @id @map("organization_id") @db.Uuid
  status         String       @default("NOT_STARTED")
  currentStep    String       @default("IDENTITY") @map("current_step")
  completedSteps Json         @default("[]") @map("completed_steps")
  startedAt      DateTime?    @map("started_at") @db.Timestamptz(6)
  completedAt    DateTime?    @map("completed_at") @db.Timestamptz(6)
  createdAt      DateTime     @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime     @updatedAt @map("updated_at") @db.Timestamptz(6)
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@map("organization_onboarding")
}
```

### Migration (`prisma/migrations/202609282000_mb02_organization_onboarding/migration.sql`)
- Creates table `organization_onboarding`.
- Grants `SELECT, INSERT, UPDATE, DELETE` to `app_runtime`.
- Enables and enforces `FORCE ROW LEVEL SECURITY`.
- Defines `tenant_isolation` policy ensuring `organization_id = current_tenant_id()`.
- Safely backfills existing active organizations as `COMPLETED` so existing operations are never blocked.

---

## 3. Contracts & Business Suggestion Presets

### Contracts (`packages/contracts/src/organization.ts`)
- **`OnboardingStatus`:** `'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'`
- **`OnboardingStepName`:** `'IDENTITY' | 'CAPABILITIES' | 'BASIC_SETUP' | 'OPERATIONS' | 'REVIEW'`
- **`ReadinessItemStatus`:** `'READY' | 'OPTIONAL' | 'INCOMPLETE' | 'NOT_APPLICABLE'`
- **`BUSINESS_TYPE_PRESETS`:** 10 descriptive presets (`CLINIC_HEALTHCARE`, `SALON_BEAUTY`, `REAL_ESTATE`, `RESTAURANT_FOOD`, `RETAIL_ECOMMERCE`, `PROFESSIONAL_SERVICES`, `REPAIR_MAINTENANCE`, `TRAINING_EDUCATION`, `TRAVEL_HOSPITALITY`, `OTHER`) that provide suggested default capabilities in the UX without imposing any runtime branching.

---

## 4. Backend Readiness & Completion Engine

### Readiness Rules
| Item Key | Evaluated Rule | Result when Disabled/Missing |
| :--- | :--- | :--- |
| `PROFILE_READY` | `displayName` non-empty | `INCOMPLETE` (blocks completion) |
| `CAPABILITIES_READY` | `validateCapabilitiesCombination()` valid | `INCOMPLETE` (blocks completion) |
| `BOOKING_SETUP_READY` | If `supportsBooking=true`, checks active location | `NOT_APPLICABLE` (if booking disabled) |
| `SERVICE_SETUP_READY` | If `supportsServices=true`, checks active services | `NOT_APPLICABLE` (if services disabled) |
| `STAFF_SETUP_READY` | If `supportsStaff=true`, checks staff members | `NOT_APPLICABLE` (if staff disabled) |
| `LOCATION_SETUP_READY` | If `supportsLocations=true`, checks locations | `NOT_APPLICABLE` (if locations disabled) |

---

## 5. Test Matrix & Verification

### Test Coverage Summary
- **Backend Onboarding Suite (`apps/api/src/organizations/organization-onboarding.test.ts`):**
  - `BUSINESS_TYPE_PRESETS provide editable suggestion defaults without runtime branching` (PASS)
  - `ONBOARDING_STEPS contains canonical 5 steps` (PASS)
  - `UpdateOnboardingProgressSchema validates progress updates` (PASS)
  - `Readiness model checks completion criteria correctly` (PASS)
  - `Completion rules ignore irrelevant non-enabled capabilities` (PASS)
- **Full Workspace Test Suite:**
  - `213/213 tests passing` across all workspaces (`@ai-sales-agent/api`, `@ai-sales-agent/agent-core`, `@ai-sales-agent/agent-adapters`, `@ai-sales-agent/embeddings`, `@ai-sales-agent/knowledge-chunking`, `@ai-sales-agent/storage`).
- **Build Verification:**
  - Clean build across all packages (`npm run build`).

---

## 6. Phase Status & Invariant Guarantees

| Invariant | Status |
| :--- | :--- |
| Onboarding State Persisted in DB | **YES** (`organization_onboarding`) |
| Save and Resume Across Sessions | **PASS** (backend-authoritative) |
| Human-Readable Capability Selection | **PASS** (clean cards + lead policy) |
| Business Type Runtime Branching Added | **NO** (metadata & suggestions only) |
| Backend Completion Authorization & Validation | **PASS** (`OWNER`/`ADMIN` only, readiness enforced) |
| Backward Compatibility for Existing Orgs | **PASS** (backfilled as `COMPLETED`) |
| DeepSeek Runtime Unchanged | **PASS** (100% DeepSeek-only preserved) |
| Booking Regression Suite | **PASS** (all invariants intact) |
| Mobile & RTL Support | **PASS** (native Arabic toggling & responsive layout) |
| Future Phase Modules (MB-03+) Prematurely Added | **NO** (only MB-02 onboarding orchestration) |
| **MB-02 Status** | **CLOSED** |
| **Next Phase** | **MB-03 — Dynamic Dashboard Navigation** |
| **P14 Authorization** | **NOT AUTHORIZED** |
