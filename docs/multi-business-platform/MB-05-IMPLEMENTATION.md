# MB-05 — Offers / Promotions Implementation

> **Document Status:** Authoritative Implementation Record  
> **Phase:** MB-05 (Offers / Promotions)  
> **Status:** CLOSED  
> **Next Phase:** MB-06 (Business Policies)  
> **P14 Authorization:** NOT AUTHORIZED  

---

## 1. Executive Summary

Phase MB-05 introduces the authoritative, generic, organization-owned Offers and Promotions system (`Offer`, `OfferCatalogItem`) that applies structured discounts and promotional pricing to catalog items (`CatalogItem`). 

Offers are strictly backend-authoritative and capability-gated by `supportsOffers`. The AI runtime reads verified offers using structured tool execution (`getActiveOffers`) and is strictly prevented from inventing discounts, dates, eligibility criteria, or prices.

### Key Deliverables Completed
1. **Generic Offer Domain Model (`Offer` & `OfferCatalogItem`):**
   - Implemented `model Offer` in PostgreSQL and Prisma schema with fields: `id`, `organizationId`, `name`, `description`, `status`, `offerType`, `discountPercentage`, `discountAmountMinor`, `currency`, `startsAt`, `endsAt`, `priority`, `stackable`, `eligibility`, `metadataJson`, `version`, `archivedAt`, `createdAt`, `updatedAt`.
   - Implemented `model OfferCatalogItem` join table for safe targeting of specific catalog items (`organizationId`, `offerId`, `catalogItemId`).
2. **Offer Types & Statuses:**
   - Supported Types: `PERCENTAGE_DISCOUNT`, `FIXED_DISCOUNT`, `FIXED_PRICE`, `INFORMATIONAL`.
   - Supported Statuses: `DRAFT`, `ACTIVE`, `PAUSED`, `ARCHIVED`.
   - Supported Eligibilities: `ANY_CUSTOMER`, `NEW_CUSTOMER`, `EXISTING_CUSTOMER`.
3. **Backend-Authoritative Price Calculation:**
   - Implemented pure calculation function `calculateDiscountedPrice()` adhering to minor money units, bounded percentages (1 to 100), deterministic priority resolution, non-negative price bounds (finalAmountMinor >= 0), and stacking policies.
4. **Authoritative Active Window & Applicability:**
   - Applicable offers are filtered by tenant identity, `status = 'ACTIVE'`, non-archived status, and UTC time window `(starts_at IS NULL OR starts_at <= now) AND (ends_at IS NULL OR ends_at >= now)`.
5. **Multi-Tenant Security & PostgreSQL RLS:**
   - Migration `202609282200_mb05_offers/migration.sql` created and applied.
   - `FORCE ROW LEVEL SECURITY` and `tenant_isolation` policies on both `offers` and `offer_catalog_items`.
   - Cross-tenant creation, reads, updates, and cross-tenant item targeting are rejected by database foreign keys and RLS policies.
6. **AI Agent Tooling (`getActiveOffers`):**
   - Implemented `getActiveOffers` tool in `@ai-sales-agent/agent-adapters`.
   - Tool returns structured facts (base price, discount, final price, dates, eligibility summary) for customer queries and price objections without model hallucination.
7. **Capability Gating (`supportsOffers`):**
   - If `supportsOffers = false`, backend APIs reject mutations, AI tools return empty structured result with capability notice, and frontend UI is protected by `CapabilityGuard`.
8. **Dashboard UI & Arabic RTL:**
   - Built interactive Offers page (`apps/web/src/app/offers/page.tsx`) with full Arabic RTL and English localization, offer listing, creation modal, and status management.

---

## 2. Domain & Entity Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                 ORGANIZATION (Multi-Tenant)                 │
└──────────────┬──────────────────────────────┬───────────────┘
               │ 1:N                          │ 1:N
               ▼                              ▼
┌──────────────────────────────┐       ┌──────────────────────────────┐
│         CatalogItem          │       │            Offer             │
├──────────────────────────────┤       ├──────────────────────────────┤
│ id: UUID (PK)                │       │ id: UUID (PK)                │
│ organization_id: UUID (FK)   │       │ organization_id: UUID (FK)   │
│ kind: SERVICE | PRODUCT | ...│       │ name: String                 │
│ name: String                 │       │ description: String?         │
│ amount_minor: BigInt?        │       │ status: DRAFT|ACTIVE|PAUSED..│
│ currency: String?            │       │ offer_type: PERCENTAGE | ... │
│ status: ACTIVE | INACTIVE |..│       │ discount_percentage: Int?    │
└──────────────┬───────────────┘       │ discount_amount_minor: BigInt│
               │                       │ starts_at / ends_at: Timestp │
               │                       │ priority: Int (default: 0)   │
               │                       │ stackable: Boolean (default) │
               │                       │ eligibility: ANY_CUSTOMER... │
               │                       └──────────────┬───────────────┘
               │                                      │
               │         ┌────────────────────────────┘
               │         │
               ▼         ▼
┌──────────────────────────────────────┐
│          OfferCatalogItem            │
├──────────────────────────────────────┤
│ organization_id: UUID (FK)           │
│ offer_id: UUID (FK)                  │
│ catalog_item_id: UUID (FK)           │
│ PRIMARY KEY (org_id, offer_id, item) │
└──────────────────────────────────────┘
```

---

## 3. Price Calculation & Stacking Specification

The `calculateDiscountedPrice()` engine guarantees deterministic output:

1. **Input:**
   - Base catalog price (`amountMinor: bigint`, `currency: string`).
   - Applicable active offers list.
2. **Deterministic Selection:**
   - Non-stackable offers compete by:
     1. Highest calculated discount amount.
     2. Highest priority score.
     3. Alphabetical tie-breaking on offer ID.
   - If multiple stackable offers apply without higher non-stackable offers, stackable discounts are applied sequentially.
3. **Safety Invariants:**
   - Discounts never produce negative final prices (`Math.max(0, base - discount)`).
   - Minor money units preserved without floating point precision loss.
   - Percentage bounds 1 <= percentage <= 100 enforced.

---

## 4. AI Retrieval vs Transactional Truth

| Capability | Structured Tool (`getActiveOffers`) | RAG / Knowledge Base |
| :--- | :--- | :--- |
| **Discount Amount** | Authoritative truth | Never authoritative |
| **Active Date Window** | Authoritative truth | Never authoritative |
| **Customer Eligibility** | Authoritative truth | Never authoritative |
| **Pricing Math** | Deterministic backend calculation | Hallucination prevented |
| **Natural Phrasing** | Formatted into natural reply | Human explanations only after tool lookup |

---

## 5. Verification Matrix

| Test Suite | Scope | Result |
| :--- | :--- | :--- |
| `offers.test.ts` | Schemas, validations, discount calculation, stacking rules | **PASS** |
| `mb05-offers.test.ts` | RLS isolation, time-window exclusions, target joins, AI tool | **PASS** |
| `dynamic-navigation.test.ts` | Capability navigation activation (`offers` implemented) | **PASS** |
| `catalog regression` | MB-04 CatalogItem and Service specialization intact | **PASS** |
| `booking regression` | MB-00..MB-04 Slot token, GiST concurrency, confirmation | **PASS** |
| `typecheck` & `build` | All 10 workspaces in monorepo compiled cleanly | **PASS** |
| `demo:reseed` | Deterministic demo offers, residual checks | **PASS** |

---

## 6. Known Boundaries (MB-05 vs MB-06+)

- **No Checkout / Payment:** MB-05 defines offer discovery and price calculations. Checkout and payment processing are deferred to future transaction phases.
- **No Booking Price Mutation:** Existing booking flow does not mutate slot tokens or transaction price semantics.
- **No Marketing Automation / Push:** Campaign sending and loyalty engines are excluded from MB-05.
