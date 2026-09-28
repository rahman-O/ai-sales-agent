# Multi-Business Platform — Risk Management & Mitigation

> This document identifies strategic, architectural, operational, and AI-related risks in evolving from a dental-first AI sales agent to a generic multi-business sales platform, along with concrete mitigation strategies.

---

## Strategic & Architectural Risks

### R-01: Over-Generalizing Too Early
* **Severity:** High
* **Probability:** High
* **Description:** Designing overly abstract schemas or metadata-only tables (EAV anti-patterns) before understanding actual real-world business needs across diverse verticals (e.g. attempting to model restaurants, real estate, and clinics into a single nebulous JSON document).
* **Impact:** Loss of type safety, sluggish query performance, impossible reporting, and unmaintainable adapter code.
* **Mitigation Strategy:**
  - Adhere to the **Capability + Structured Subtypes** pattern: Shared base entity (`CatalogItem`) with explicit, typed specialization tables (`Service`, `Product`, `Listing`).
  - Introduce new vertical capabilities only through proven domain packs (e.g., Dental first, Salon next, then Real Estate/Retail).
  - Enforce Zod validation at all boundaries and never use untyped JSON for core transactional truths.

---

### R-02: Giant Universal Tables (God Tables)
* **Severity:** High
* **Probability:** Medium
* **Description:** Attempting to force every transaction type (Bookings, Quotes, Food Orders, Physical Retail Shipments, Property Viewings) into a single monolithic `Transaction` or `Booking` table with hundreds of nullable columns.
* **Impact:** Database schema bloat, degraded index performance, complicated RLS policies, brittle ORM mappings.
* **Mitigation Strategy:**
  - Keep `Booking` dedicated to time-slot reservation workflows.
  - Create separate, dedicated transactional tables when needed (`Order`, `Quote`, `Viewing`) with shared foreign keys (`organizationId`, `customerId`, `leadId`, `conversationId`).
  - Use polymorphic interfaces at the UI/Agent level rather than table-level unions.

---

### R-03: Capability Flag Sprawl & Combinatorial Incompatibility
* **Severity:** Medium
* **Probability:** High
* **Description:** Introducing dozens of independent boolean capability flags that create exponential configuration matrices (e.g., `supportsBooking=true` + `supportsServices=false`, leading to undefined runtime behavior).
* **Impact:** Untestable state combinations, edge-case bugs in context builder, broken dashboard layouts.
* **Mitigation Strategy:**
  - Define **Validated Capability Presets / Domain Packs** with strict dependency rules (e.g., `supportsBooking` requires `supportsServices` or `supportsResources`).
  - Enforce cross-field schema validation in `OrganizationCapabilitiesSchema` (Zod `refine`).
  - Automated matrix test suites verifying every valid capability combination.

---

### R-04: Business-Specific Edge Cases Leaking into Core Agent Engine
* **Severity:** Critical
* **Probability:** High
* **Description:** Developers adding `if (org.type === 'clinic')` or `if (businessType === 'real_estate')` branches inside `@agent/core` or `context-builder`.
* **Impact:** Immediate loss of platform genericity, spaghetti codebase, fragile regressions when editing core agent prompts.
* **Mitigation Strategy:**
  - Architectural linting rules & PR review checks preventing `businessType` checks in `@agent/core`.
  - Core agent runtime interacts strictly with:
    1. Capabilities (`capabilities.supportsBooking`)
    2. Dynamic Tool Registry (tools exposed based on enabled capabilities)
    3. Structured Business Context (catalog, policies, offers provided dynamically)
    4. Organization Conversation Style & Knowledge.

---

## AI & Runtime Risks

### R-05: Prompt Explosion & Context Window Bloat
* **Severity:** High
* **Probability:** High
* **Description:** As businesses add dozens of services, extensive policies, multi-tier offers, and large knowledge bases, injecting all of this into every LLM turn exceeds token limits and increases latency/cost.
* **Impact:** Slow responses (degraded UX on WhatsApp), high API costs, lost reasoning focus from the LLM.
* **Mitigation Strategy:**
  - **Tiered Context Injection:**
    - High-frequency core prompt (Identity, Style, Enabled Capabilities, Active Working State) in system prompt.
    - Low-frequency details (Full catalog, lengthy cancellation policies) exposed via Agent Tools (`get_service_details`, `search_catalog`, `get_active_promotions`).
  - Strict summarization and item capping in initial context prompts.

---

### R-06: RAG Hallucination of Prices, Availability, or Discounts
* **Severity:** Critical
* **Probability:** Medium
* **Description:** Assistant extracting stale or hallucinated pricing/discounts from uploaded PDF flyers or FAQ text rather than authoritative database records.
* **Impact:** Customers promised incorrect prices, financial disputes, loss of merchant trust.
* **Mitigation Strategy:**
  - Strict separation of **Structured Truth** (Database) vs **Informational Knowledge** (RAG).
  - Explicit system prompt instructions: *\"Never quote custom discounts or prices not found in structured tool outputs. RAG knowledge is for descriptive guidance only.\"*
  - Runtime validation in booking/order tool execution preventing mismatch between user inputs and database truth.

---

### R-07: Stale Organization Configuration in Runtime Memory
* **Severity:** Medium
* **Probability:** Medium
* **Description:** Business owner changes operating hours, disables a service, or updates tone in the dashboard, but cached agent contexts continue using outdated settings.
* **Impact:** Booking unavailable slots, presenting disabled services to end users.
* **Mitigation Strategy:**
  - Context builder fetches fresh organization capabilities and active working state per conversation turn (or uses short-lived TTL cache invalidated on mutations).
  - Tool executions always perform real-time verification against the database within transaction boundaries.

---

## Tenancy, Security & Operational Risks

### R-08: Multi-Tenant Data Leakage
* **Severity:** Critical
* **Probability:** Low
* **Description:** AI assistant, RAG retriever, or analytics query returning data from Organization A to a customer conversing with Organization B.
* **Impact:** Catastrophic privacy breach, legal liability, immediate loss of trust.
* **Mitigation Strategy:**
  - Universal Supabase/PostgreSQL Row Level Security (RLS) enforcement on all multi-business tables (`organization_id = auth.jwt() ->> 'org_id'`).
  - Worker & Context Builder always scope queries with hardcoded `where: { organizationId }` parameter.
  - Vector/RAG embeddings filtered strictly by `organizationId` at the vector store index/query level.
  - Automated automated multi-tenant isolation integration tests in CI.

---

### R-09: Migration Regressions in Existing Dental Booking Flow
* **Severity:** Critical
* **Probability:** High
* **Description:** Refactoring `Service` or `Organization` models breaks existing E2E booking flows, DeepSeek prompt adherence, or post-booking finalization.
* **Impact:** Production downtime for existing dental clinic accounts.
* **Mitigation Strategy:**
  - Zero destructive changes to existing tables during early phases (`MB-00` to `MB-03`).
  - Additive migrations with nullable fields and default fallbacks.
  - Maintain the existing E2E automated test suite (`tests/e2e/booking-flow.spec.ts`, `demo-docker.ts`) as a mandatory CI blocker before approving any platform PR.

---

### R-10: Dashboard UI Overwhelm for Non-Technical Owners
* **Severity:** Medium
* **Probability:** High
* **Description:** Presenting small business owners (e.g., local barber, boutique real estate agent) with an overly complex enterprise interface filled with capability toggles, JSON schemas, and AI hyper-parameters.
* **Impact:** High onboarding drop-off, misconfigured bots, support ticket overload.
* **Mitigation Strategy:**
  - **Progressive Disclosure:** Simple step-by-step onboarding wizard hiding technical terminology.
  - **Domain Presets:** Pre-selected configurations for common business types (Salon, Clinic, Real Estate, Retail).
  - **Dynamic Dashboard Navigation:** Sidebar only displays tabs relevant to enabled capabilities (e.g. hide "Listings" for Salons, hide "Staff" for pure Ecommerce).
  - Interactive "Test Assistant" playground before going live.

---

## Risk Summary Matrix

| Risk ID | Title | Impact | Probability | Mitigation Priority |
|---|---|---|---|---|
| **R-01** | Over-generalizing too early | High | High | P0 — Design incrementally |
| **R-02** | Giant God tables | High | Medium | P0 — Separate specialized tables |
| **R-03** | Capability flag sprawl | Medium | High | P1 — Presets & validation |
| **R-04** | Business-type branching in core | Critical | High | P0 — Enforce architecture rules |
| **R-05** | Prompt explosion & latency | High | High | P1 — Tiered context & tools |
| **R-06** | RAG hallucinating pricing | Critical | Medium | P0 — Structured truth dominance |
| **R-07** | Stale runtime configuration | Medium | Medium | P1 — Dynamic context fetching |
| **R-08** | Multi-tenant data leakage | Critical | Low | P0 — Universal RLS & tenant filters |
| **R-09** | Regressions in existing booking | Critical | High | P0 — Backward compatibility & E2E gates |
| **R-10** | Dashboard UI complexity | Medium | High | P1 — Progressive disclosure & presets |
