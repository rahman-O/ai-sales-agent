# Multi-Business Platform — Detailed Phase Breakdown

> Every phase includes a structured breakdown with repository-aware detail.
> Items marked **REQUIRES AUDIT** need further investigation during implementation.

---

## MB-00 — Discovery & Baseline Audit

| Field | Value |
|-------|-------|
| **PHASE ID** | MB-00 |
| **NAME** | Discovery & Baseline Audit |
| **STATUS** | CLOSED |
| **PURPOSE** | Map all existing modules, identify generalization points, and create planning documentation |
| **PROBLEM BEING SOLVED** | No authoritative plan exists for the dental→multi-business transition |
| **WHY NOW** | Foundation for all subsequent phases; blocks nothing but enables everything |
| **DEPENDENCIES** | None |

**FILES / MODULES LIKELY AFFECTED:**
- `docs/multi-business-platform/` (created)
- No production code

**DATA MODEL CHANGES:** None
**API CHANGES:** None
**AGENT CHANGES:** None
**UI/UX CHANGES:** None
**SECURITY / TENANCY CONSIDERATIONS:** None

**TEST MATRIX:**
| Test | Scope |
|------|-------|
| Documentation consistency check | Manual review |

**MIGRATION STRATEGY:** N/A — documentation only
**ACCEPTANCE GATES:**
- [ ] All 10 planning documents exist
- [ ] System mapping complete
- [ ] Phase dependency graph validated against repo

**DEFINITION OF DONE:** All planning documents reviewed and internally consistent

**NON-GOALS:** Implementation, code changes, migrations

---

## MB-01 — Organization Profile + Capabilities

| Field | Value |
|-------|-------|
| **PHASE ID** | MB-01 |
| **NAME** | Organization Profile + Capabilities |
| **STATUS** | CLOSED |
| **PURPOSE** | Enable organizations to declare what they are and what they support |
| **PROBLEM BEING SOLVED** | Organization has no profile or capability metadata; system assumes dental |
| **WHY NOW** | Every subsequent phase reads capabilities to determine behavior |
| **DEPENDENCIES** | MB-00 |

**FILES / MODULES LIKELY AFFECTED:**
- `prisma/schema.prisma` — extend Organization or add new tables
- `apps/api/src/organizations/` — profile + capability CRUD
- `packages/contracts/src/` — capability type definitions
- `prisma/seed.ts` — demo fixture updates
- `apps/web/src/app/settings/` — new profile/capability settings page

**DATA MODEL CHANGES:**
```
Organization (extend)
  + businessType: String?        -- e.g. "dental_clinic", "salon", "ecommerce"
  + businessDescription: String?
  + logoUrl: String?
  + timezone: String?            -- org-level default (currently only on Location)
  + locale: String?              -- default language

OrganizationCapabilities (new — JSONB column or separate table)
  + supportsLeads: Boolean       (default: true)
  + leadRequiredBeforeBooking: Boolean (default: true)
  + autoCreateLeadOnIntent: Boolean (default: true)
  + supportsBooking: Boolean     (default: true)
  + supportsOffers: Boolean      (default: false)
  + supportsQuotes: Boolean      (default: false)
  + supportsOrders: Boolean      (default: false)
  + supportsInventory: Boolean   (default: false)
  + supportsStaff: Boolean       (default: true)
  + supportsLocations: Boolean   (default: true)
  + supportsProducts: Boolean    (default: false)
  + supportsServices: Boolean    (default: true)
  + supportsListings: Boolean    (default: false)
```

> REQUIRES AUDIT: Determine if JSONB column on Organization or separate table is better for RLS performance.

**API CHANGES:**
- `GET /organizations/:id/profile` — read profile
- `PATCH /organizations/:id/profile` — update profile
- `GET /organizations/:id/capabilities` — read capabilities
- `PATCH /organizations/:id/capabilities` — update capabilities

**AGENT CHANGES:**
- Context builder reads `businessDescription` for persona
- Tool allowlist may cross-reference capabilities

**UI/UX CHANGES:**
- Settings → Organization Profile page
- Settings → Capabilities page (progressive disclosure)

**SECURITY / TENANCY CONSIDERATIONS:**
- Profile and capabilities must be RLS-scoped to organization
- Only org ADMIN/OWNER can modify capabilities
- Capability changes must audit-log

**TEST MATRIX:**
| Test | Scope |
|------|-------|
| Unit: capability CRUD | Backend |
| Unit: default capabilities match current dental behavior | Backend |
| Integration: capability affects tool allowlist | agent-core + adapters |
| RLS: cross-org capability access blocked | Database |
| API: auth + validation | Backend |

**MIGRATION STRATEGY:**
- Add columns with defaults matching current dental behavior
- Existing orgs get `supportsBooking: true, supportsLeads: true, supportsServices: true`
- No breaking changes

**ACCEPTANCE GATES:**
- [ ] Organization can set and query profile + capabilities
- [ ] Default capability set for existing dental orgs matches current behavior exactly
- [ ] No runtime `if businessType === X` branching exists
- [ ] RLS prevents cross-org access
- [ ] Audit log records capability changes

**DEFINITION OF DONE:**
Profile and capabilities are queryable, modifiable, RLS-protected, and audited. Existing dental orgs are unaffected.

**NON-GOALS:**
- Dashboard navigation changes (MB-03)
- Catalog generalization (MB-04)
- Enforcing capabilities at tool execution time (deferred to MB-10)

---

## MB-02 — Multi-Business Onboarding

| Field | Value |
|-------|-------|
| **PHASE ID** | MB-02 |
| **NAME** | Multi-Business Onboarding |
| **STATUS** | CLOSED |
| **PURPOSE** | Guided setup wizard for new organizations of any business type |
| **PROBLEM BEING SOLVED** | No structured onboarding; new orgs must configure everything manually |
| **WHY NOW** | Critical for non-dental businesses to get started quickly |
| **DEPENDENCIES** | MB-01 |

**FILES / MODULES LIKELY AFFECTED:**
- `apps/web/src/app/` — new onboarding route/pages
- `apps/api/src/organizations/` — onboarding state API
- `prisma/schema.prisma` — onboarding progress tracking

**DATA MODEL CHANGES:**
```
OrganizationOnboarding (new)
  organizationId: UUID (PK, FK → organizations)
  currentStep: String
  completedSteps: JSONB
  completedAt: DateTime?
  updatedAt: DateTime
```

**API CHANGES:**
- `GET /organizations/:id/onboarding` — current progress
- `PATCH /organizations/:id/onboarding` — advance/save step

**AGENT CHANGES:** None
**UI/UX CHANGES:**
- Multi-step wizard: identity → capabilities → catalog → policies → knowledge → style → channel → test → go live
- Save-and-resume
- Mobile/RTL friendly
- Arabic/English bilingual

**SECURITY / TENANCY CONSIDERATIONS:**
- Onboarding state is org-scoped
- Only org members can access onboarding

**TEST MATRIX:**
| Test | Scope |
|------|-------|
| E2E: complete dental onboarding | Frontend + Backend |
| E2E: complete salon onboarding | Frontend + Backend |
| E2E: complete ecommerce onboarding | Frontend + Backend |
| Responsive/RTL | Frontend |
| Save-and-resume | Frontend + Backend |

**MIGRATION STRATEGY:** Additive — existing orgs skip onboarding (already configured)

**ACCEPTANCE GATES:**
- [ ] Onboarding wizard works for 3+ business types
- [ ] State persists across sessions
- [ ] Missing steps are clearly indicated
- [ ] Arabic/RTL layout works

**DEFINITION OF DONE:** New organization can complete end-to-end onboarding for dental, salon, and ecommerce within 10 minutes each.

**NON-GOALS:** Automated setup (only guided), customer-facing widget

---

## MB-03 — Dynamic Dashboard Navigation

| Field | Value |
|-------|-------|
| **PHASE ID** | MB-03 |
| **NAME** | Dynamic Dashboard Navigation |
| **STATUS** | CLOSED |
| **PURPOSE** | Dashboard nav adapts to show only relevant modules per org capabilities |
| **PROBLEM BEING SOLVED** | Static nav shows dental-specific items to all orgs |
| **WHY NOW** | UX foundation for all subsequent dashboard features |
| **DEPENDENCIES** | MB-01 |

**FILES / MODULES LIKELY AFFECTED:**
- `apps/web/src/components/OperatorNav.tsx` — replace with dynamic nav
- `apps/web/src/lib/` — navigation configuration
- `apps/api/src/organizations/` — capabilities query (from MB-01)

**DATA MODEL CHANGES:** None (reads capabilities from MB-01)

**API CHANGES:** None new (uses capabilities API from MB-01)

**AGENT CHANGES:** None

**UI/UX CHANGES:**
- Dynamic navigation component
- Capability → nav item mapping
- "Coming soon" indicators for unconfigured capabilities
- Consistent icon set

**SECURITY / TENANCY CONSIDERATIONS:** Nav items must not expose capabilities of other orgs

**TEST MATRIX:**
| Test | Scope |
|------|-------|
| Unit: nav renders correct items per capability | Frontend |
| Snapshot: dental nav layout | Frontend |
| Snapshot: salon nav layout | Frontend |
| Snapshot: ecommerce nav layout | Frontend |

**MIGRATION STRATEGY:** Feature-flagged; gradual rollout
**ACCEPTANCE GATES:**
- [ ] Nav dynamically reflects org capabilities
- [ ] No nav item appears for disabled capabilities

**DEFINITION OF DONE:** Dashboard navigation is fully dynamic and renders correctly for all capability combinations.

**NON-GOALS:** Building actual module pages (those are in MB-04+)

---

## MB-04 — Generic Business Catalog

| Field | Value |
|-------|-------|
| **PHASE ID** | MB-04 |
| **NAME** | Generic Business Catalog |
| **STATUS** | CLOSED |
| **PURPOSE** | Evolve the Service model into a generic catalog supporting multiple item types |
| **PROBLEM BEING SOLVED** | `Service` is dental/appointment-oriented; cannot represent products, listings, or packages |
| **WHY NOW** | Catalog is the data foundation for offers, policies, and workflows |
| **DEPENDENCIES** | MB-01 |

**FILES / MODULES LIKELY AFFECTED:**
- `prisma/schema.prisma` — new `CatalogItem` or extend `Service`
- `apps/api/src/catalog/` — generalize CRUD
- `agent-adapters/src/tool-executor.ts` — tool definitions
- `agent-adapters/src/service-search.ts` — rename/extend
- `agent-adapters/src/booking-tools.ts` — FK compatibility
- `contracts/src/agent.ts` — tool name registry
- `apps/web/src/app/` — catalog management page

**DATA MODEL CHANGES:**
> REQUIRES AUDIT: Two migration strategies exist:

Option A — Extend `Service` table:
```
Service (extend)
  + itemType: String  -- "SERVICE" | "PRODUCT" | "LISTING" | "PACKAGE"
  + description: String?
  + imageUrl: String?
  + metadata: JSONB?  -- type-specific attributes
  -- Keep all existing columns; non-applicable ones nullable
```

Option B — New `CatalogItem` table:
```
CatalogItem (new)
  id: UUID
  organizationId: UUID
  locationId: UUID?
  itemType: String  -- "SERVICE" | "PRODUCT" | "LISTING" | "PACKAGE"
  name: String
  description: String?
  amountMinor: BigInt
  currency: String
  metadata: JSONB
  active: Boolean
  ...
```

> **Recommendation:** Option A (extend Service) is safer for migration because it preserves all existing FKs (bookings, leads, service_staff). The `itemType` column defaults to `"SERVICE"` for existing rows.

**API CHANGES:**
- Existing service endpoints become aliases
- New generic catalog endpoints

**AGENT CHANGES:**
- `searchServices` becomes `searchCatalog` (with backward-compatible alias)
- Tool descriptions generalized

**UI/UX CHANGES:**
- Generic catalog management page
- Item type filter/selector

**SECURITY / TENANCY CONSIDERATIONS:** Same RLS as current Service

**TEST MATRIX:**
| Test | Scope |
|------|-------|
| Unit: catalog CRUD for all item types | Backend |
| Integration: booking works with SERVICE items | Full stack |
| Migration: existing Service data intact | Database |
| RLS: tenant isolation | Database |
| Tool: searchCatalog returns correct results | agent-adapters |

**MIGRATION STRATEGY:**
1. Add `itemType` column with default `"SERVICE"` to `services` table
2. All existing rows automatically tagged as SERVICE
3. Booking pipeline unchanged — still references service FK
4. New item types don't require booking-specific columns
5. `searchServices` tool wraps `searchCatalog` for backward compatibility

**ACCEPTANCE GATES:**
- [ ] Catalog items can be created for SERVICE, PRODUCT, LISTING types
- [ ] Existing Service data remains bookable
- [ ] `searchServices` tool continues to work
- [ ] No breaking changes to booking pipeline

**DEFINITION OF DONE:** Generic catalog works for all item types while booking remains stable for SERVICE items.

**NON-GOALS:** Inventory tracking, pricing tiers, variant management

---

## MB-05 through MB-15

> Phases MB-05 through MB-15 follow the same structure. Detailed breakdowns for these phases will be completed as their predecessor phases near completion. See [ROADMAP.md](./ROADMAP.md) for high-level scope and dependencies.

**Common fields for all remaining phases:**

| Phase | STATUS | Key Question (REQUIRES AUDIT) |
|-------|--------|-------------------------------|
| MB-05 Offers | CLOSED | Offer-to-CatalogItem relationship model (OfferCatalogItem join table implemented) |
| MB-06 Policies | CLOSED | Generic typed policy model, deterministic resolution, RLS, UI, AI retrieval, and booking cutoff enforcement |
| MB-07 Style | CLOSED | Organization conversation profile, tone, dialect, sales style, deterministic preview, and context-builder integration |
| MB-08 Knowledge | CLOSED | Generic KnowledgeSource model, review/publish boundary, pgvector search, and structured truth precedence |
| MB-09 Preview | CLOSED | First-class PREVIEW execution mode, safe tool simulation, zero DB rows, UI trace inspector |
| MB-10 Workflows | CLOSED | Three-tier Intent + Workflow + Working State orchestration layer, capability-driven gating, topic-switching (suspend/resume) |
| MB-11 Packs | CLOSED | Code-owned versioned packs (clinic.v1, salon.v1, real_estate.v1, restaurant.v1, professional_services.v1), preview diff, idempotent merge, bootstrap-only rule |
| MB-12 Orders | CLOSED | Backend-authoritative Quote/Order state machines, BigInt minor unit pricing, capability gating, preview simulation |
| MB-13 Analytics | CLOSED | Structured metric catalog, workflow funnels, capability-driven dashboards, multi-currency isolation, zero LLM dependency |
| MB-14 Hardening | CLOSED | Full regression test surface, rate limiting, error standardizing, RLS verification, runbooks |
| MB-15 Acceptance | NEXT | Provider acceptance criteria |
