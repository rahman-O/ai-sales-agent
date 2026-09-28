# MB-03 — Dynamic Dashboard Navigation Implementation

> **Document Status:** Authoritative Implementation Record  
> **Phase:** MB-03 (Dynamic Dashboard Navigation)  
> **Status:** CLOSED  
> **Next Phase:** MB-04 (Generic Business Catalog)  
> **P14 Authorization:** NOT AUTHORIZED  

---

## 1. Executive Summary

Phase MB-03 delivers the single authoritative, capability-driven navigation engine for the multi-business operator dashboard. Organizations dynamically see only the modules corresponding to their active capabilities. Furthermore, direct route access to disabled features is securely protected on both frontend and backend layers with user-friendly explanations.

### Key Deliverables Completed
1. **Authoritative Navigation Configuration (`packages/contracts/src/navigation.ts`):**
   - Central typed definitions (`DASHBOARD_NAV_ITEMS`, `DashboardNavItem`, `NavModuleId`, `NavGroup`, `ModuleImplementationStatus`).
   - Clean grouping (`WORKSPACE`, `OPERATIONS`, `GROWTH`, `ADMIN`).
   - Localization metadata (`label`, `labelAr`, `description`, `descriptionAr`).
   - Strict capability and role requirement attachments (`requiredCapability`, `requiredRole`).
2. **Always-Available Core Modules:**
   - `Overview` (`/dashboard`), `Inbox` (`/inbox`), `Follow-ups` (`/follow-ups`), `Knowledge` (`/knowledge`), `Analytics` (`/analytics`).
3. **Capability-Gated Modules:**
   - `Bookings` (`/bookings`) → requires `supportsBooking=true`
   - `Schedule` (`/schedule`) → requires `supportsBooking=true`
   - `Leads` (`/leads`) → requires `supportsLeads=true`
4. **Future Capability Strategy (`COMING_SOON`):**
   - Future modules (`Products`, `Orders`, `Quotes`, `Offers`, `Inventory`, `Listings`) are typed and registered with `implementationStatus: 'COMING_SOON'`.
   - In active operator navigation, `COMING_SOON` items are omitted so users are never exposed to broken or fake domain pages.
5. **Route Authorization & Direct Disabled Route Protection:**
   - **Frontend:** Created `<CapabilityGuard>` component which checks organization capabilities before rendering gated module surfaces, providing clean, friendly "Feature Not Enabled" cards with direct return buttons.
   - **Backend:** `BookingsService` (`requireBookingCapability`) and `LeadsService` (`requireLeadsCapability`) reject direct API access with `403 Forbidden` if capabilities are disabled.
6. **Mobile & RTL Responsive Chrome (`apps/web/src/components/OperatorNav.tsx`):**
   - Responsive layout with desktop group pills, mobile-friendly touch targets, accessible `aria-current="page"`, and native Arabic/English RTL toggle.
7. **Cross-Tenant Isolation & Role Intersection:**
   - Navigation filtering is purely tenant-capability and role-specific without cross-tenant bleed or `businessType` runtime branching.

---

## 2. Navigation Architecture & Information Hierarchy

```text
┌─────────────────────────────────────────────────────────────┐
│                 CENTRAL NAVIGATION REGISTRY                 │
│              (packages/contracts/src/navigation.ts)         │
└──────────────────────────────┬──────────────────────────────┘
                               │
               filterNavItems(capabilities, role)
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
 ┌──────────────┐       ┌──────────────┐       ┌──────────────┐
 │  WORKSPACE   │       │  OPERATIONS  │       │    GROWTH    │
 ├──────────────┤       ├──────────────┤       ├──────────────┤
 │ • Overview   │       │ • Bookings   │       │ • Knowledge  │
 │ • Inbox      │       │ • Schedule   │       │ • Analytics  │
 │ • Leads      │       │ • Follow-ups │       │ • (Offers)*  │
 └──────────────┘       └──────────────┘       └──────────────┘
                               │                      │
                               └──────────┬───────────┘
                                          ▼
                                   ┌──────────────┐
                                   │    ADMIN     │
                                   ├──────────────┤
                                   │ • Channels   │
                                   │ • Templates  │
                                   └──────────────┘
* Note: Unimplemented modules marked COMING_SOON and omitted from active operator UI.
```

---

## 3. Module Visibility & Route Access Mapping

| Module ID | Route | Group | Required Capability | Required Role | Implementation Status | Visibility Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `dashboard` | `/dashboard` | WORKSPACE | *None* | Member+ | `IMPLEMENTED` | Always Available |
| `inbox` | `/inbox` | WORKSPACE | *None* | Member+ | `IMPLEMENTED` | Always Available |
| `leads` | `/leads` | WORKSPACE | `supportsLeads` | Member+ | `IMPLEMENTED` | Gated by `supportsLeads` |
| `bookings` | `/bookings` | OPERATIONS | `supportsBooking` | Member+ | `IMPLEMENTED` | Gated by `supportsBooking` |
| `schedule` | `/schedule` | OPERATIONS | `supportsBooking` | Member+ | `IMPLEMENTED` | Gated by `supportsBooking` |
| `follow-ups`| `/follow-ups`| OPERATIONS | *None* | Member+ | `IMPLEMENTED` | Always Available |
| `products` | `/products` | OPERATIONS | `supportsProducts` | Member+ | `COMING_SOON` | Omitted from active nav |
| `orders` | `/orders` | OPERATIONS | `supportsOrders` | Member+ | `COMING_SOON` | Omitted from active nav |
| `inventory` | `/inventory`| OPERATIONS | `supportsInventory`| Member+ | `COMING_SOON` | Omitted from active nav |
| `listings` | `/listings` | OPERATIONS | `supportsListings` | Member+ | `COMING_SOON` | Omitted from active nav |
| `knowledge` | `/knowledge` | GROWTH | *None* | Member+ | `IMPLEMENTED` | Always Available |
| `analytics` | `/analytics` | GROWTH | *None* | Member+ | `IMPLEMENTED` | Always Available |
| `offers` | `/offers` | GROWTH | `supportsOffers` | Member+ | `COMING_SOON` | Omitted from active nav |
| `quotes` | `/quotes` | GROWTH | `supportsQuotes` | Member+ | `COMING_SOON` | Omitted from active nav |
| `settings-channels` | `/settings/channels` | ADMIN | *None* | Owner/Admin | `IMPLEMENTED` | Gated by role |
| `settings-templates`| `/settings/templates`| ADMIN | *None* | Owner/Admin | `IMPLEMENTED` | Gated by role |

---

## 4. Test Matrix & Verification

### Test Coverage Summary
- **Dynamic Navigation Suite (`apps/api/src/organizations/dynamic-navigation.test.ts`):**
  - Central navigation items definition and grouping integrity (PASS)
  - Always-available modules persist across all capability states (PASS)
  - Scenario A: Booking organization displays Bookings & Schedule, evaluates route access (PASS)
  - Scenario B: Lead-only organization displays Leads and hides Booking modules (PASS)
  - Future modules (`COMING_SOON`) omitted from active operator nav without broken routes (PASS)
  - Role & capability intersection restricts admin routes for standard members (PASS)
  - Tenant isolation prevents cross-tenant capability bleed (PASS)
- **Full Workspace Test Suite:**
  - `220/220 tests passing` across all 7 packages.
- **Build Verification:**
  - Full clean compilation across all workspaces (`npm run build`).

---

## 5. Phase Status & Invariant Guarantees

| Invariant | Status |
| :--- | :--- |
| Authoritative Navigation Configuration Created | **YES** (`packages/contracts/src/navigation.ts`) |
| Dynamic Capability-Driven Navigation | **PASS** (`filterNavItems`) |
| Business Type Runtime Branching Added | **NO** (Strictly capability-driven) |
| Always Available Modules Enforced | **PASS** (`Overview`, `Inbox`, `Follow-ups`, `Knowledge`, `Analytics`) |
| Bookings Gated | **YES** (`supportsBooking`) |
| Leads Gated | **YES** (`supportsLeads`) |
| Direct Disabled Route Protection | **PASS** (`CapabilityGuard` + API exceptions) |
| Future Module Strategy | **COMING_SOON** (Omitted from active UI, no fake/broken pages) |
| Mobile Navigation & Touch Targets | **PASS** |
| RTL / Arabic Friendly | **PASS** |
| Cross-Tenant Isolation | **PASS** |
| Onboarding & Booking Regression | **PASS** (100% green) |
| DeepSeek Runtime Preserved | **PASS** |
| **MB-03 Status** | **CLOSED** |
| **Next Phase** | **MB-04 — Generic Business Catalog** |
| **P14 Authorization** | **NOT AUTHORIZED** |
