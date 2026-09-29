# MB-11 Implementation — Business-Type Packs & Templates

## Summary

MB-11 introduces code-owned, typed, version-controlled **Business Packs / Templates** (`CLINIC`, `SALON`, `REAL_ESTATE`, `RESTAURANT`, `PROFESSIONAL_SERVICES`) designed to accelerate organization onboarding and initial setup without introducing any runtime `businessType` branching.

---

## Core Architectural Rule

> **Business Packs are BOOTSTRAP INPUTS only, never RUNTIME AUTHORITY.**

1. **Bootstrap Role:** When applied, a Business Pack populates baseline persisted configurations:
   - Organization Capabilities
   - Policy Starter Templates (created as `DRAFT`)
   - Knowledge Document Starters (created as `DRAFT`)
   - Catalog Starter Items (created as `INACTIVE` / `needsReview`, with `amountMinor = null`)
   - Conversation Profile Defaults (applied only if not already customized)
2. **Runtime Independence:** After application, all agent reasoning, tool execution, and workflow orchestration derive strictly from persisted database state (`OrganizationCapabilities`, `BusinessPolicy`, `CatalogItem`, `KnowledgeDocument`, `OrganizationConversationProfile`).
3. **Zero `businessType` Runtime Branching:** Prohibits `if (businessType === 'clinic')` or `if (packId === 'salon')` anywhere in agent orchestration, tool gating, or workflow resolution. Two organizations with different pack origins but identical persisted records behave identically at runtime.

---

## Pack Registry & Representative Packs

Registered in `@ai-sales-agent/contracts` and `@ai-sales-agent/agent-core`:

| Pack ID | Version | Category | Recommended Capabilities | Starters Summary |
|---|---|---|---|---|
| `CLINIC` | `clinic.v1` | Healthcare & Wellness | `supportsBooking`, `supportsServices`, `supportsStaff`, `supportsLocations`, `supportsLeads`, `supportsOffers` | 3 Draft Policies (Cancellation, Rescheduling, Payment), 3 Draft Knowledge Docs, 1 Inactive Consultation Service |
| `SALON` | `salon.v1` | Beauty & Personal Care | `supportsBooking`, `supportsServices`, `supportsStaff`, `supportsLocations`, `supportsLeads`, `supportsOffers` | 2 Draft Policies (Cancellation, Rescheduling), 2 Draft Knowledge Docs, 1 Inactive Styling Service |
| `REAL_ESTATE` | `real_estate.v1` | Real Estate & Property | `supportsListings`, `supportsLeads`, `supportsOffers`, `supportsQuotes`, `supportsBooking=false` | 1 Draft Policy (Service Area), 2 Draft Knowledge Docs, 1 Inactive Property Listing |
| `RESTAURANT` | `restaurant.v1` | Food & Hospitality | `supportsBooking`, `supportsServices`, `supportsProducts`, `supportsOffers`, `supportsLeads` | 2 Draft Policies (Cancellation, Advance Notice), 2 Draft Knowledge Docs, 1 Inactive Table Reservation Service |
| `PROFESSIONAL_SERVICES` | `professional_services.v1` | Consulting & Advisory | `supportsBooking`, `supportsServices`, `supportsLeads`, `supportsQuotes`, `leadRequiredBeforeBooking` | 2 Draft Policies (Cancellation, Rescheduling), 2 Draft Knowledge Docs, 1 Inactive Advisory Consultation Service |

---

## Application Semantics & Idempotency

- **Preview Mode (`PREVIEW_ONLY`):** Pure, side-effect-free diff computation comparing the pack definition against the organization's existing database records, returning categorized actions (`WILL_CREATE`, `WILL_UPDATE_IF_MISSING`, `WILL_SKIP`, `CONFLICT`, `NO_CHANGE`).
- **Initial Setup Mode (`INITIAL_SETUP`):** Transactionally applies recommended capabilities and creates draft policies, knowledge starters, and catalog starters.
- **Merge Missing Mode (`MERGE_MISSING`):** Safely merges unconfigured capabilities and missing starter items while preserving existing customizations.
- **Deterministic Starter Keys:** Every starter object has a deterministic key (e.g. `clinic.policy.cancellation.default`, `clinic.knowledge.preparation`, `clinic.catalog.general_consultation`). Re-applying a pack checks existing starter keys in `metadataJson` and skips duplicates, guaranteeing zero accidental duplication.
- **Safety Defaults:**
  - Policy starters are strictly `DRAFT` (not active or enforceable until reviewed).
  - Knowledge starters are strictly `DRAFT` (not published or customer-retrievable until reviewed).
  - Catalog starters are strictly `INACTIVE` with `amountMinor: null` (no fake prices invented).
- **Role Permissions:** Preview is available to all organization members; application requires `OWNER` or `ADMIN` role.

---

## Verification & Test Matrix

- **Pack Registry Validation:** Validates unique IDs, semver/version tags, policy rule schemas, no duplicate starter keys, no secrets or policy-override instructions.
- **Preview Diff Integrity:** Verified pure calculation with no DB mutations across fresh and partially configured organizations.
- **Transactional Apply & Idempotency:** Verified 1st apply creates records, 2nd apply creates 0 duplicates and skips all existing starter keys.
- **Runtime Independence:** Verified two organizations with different pack origins resolve to identical workflow resolution and context building.
- **Zero Runtime Branching:** Verified complete absence of runtime branching on `businessType` or `packId`.
