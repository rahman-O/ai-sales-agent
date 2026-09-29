# Multi-Business Platform — Architecture Decision Records

> ADR-style decision log. Decisions start as PROPOSED and become ACCEPTED only after implementation validates them.

---

## D001 — Multi-Business Behavior Is Capability-Driven

**Status:** PROPOSED

**Context:** The platform needs to support multiple business types (dental, salon, ecommerce, real estate, etc.) without creating per-industry code branches.

**Decision:** Runtime behavior is determined by organization capabilities (structured boolean/config flags), not by `businessType` string matching. `businessType` exists only as descriptive metadata for UX and analytics — it never drives logic branching.

**Consequences:**
- No `if (businessType === "X")` patterns in backend, agent, or frontend code
- Tool availability derived from capabilities
- Workflow guidance composed from capabilities
- Dashboard navigation driven by capabilities
- Business-type templates exist only as onboarding convenience (preset capability combinations)

---

## D002 — No Business-Type Branching in Core Agent

**Status:** PROPOSED

**Context:** The agent orchestrator, context builder, and tool executor form the core AI engine.

**Decision:** The core agent engine (`agent-core` package) must remain business-type-agnostic. It receives its instructions from the context builder, which reads organization configuration. The orchestrator loop, schema validation, and finalization logic are universal.

**Consequences:**
- `orchestrator.ts` — no business-type awareness
- `context-builder.ts` — reads organization profile and capabilities, composes prompts dynamically
- Tool executor dispatches based on tool definitions and allowlist, not business type

---

## D003 — Structured Truth Remains Backend-Authoritative

**Status:** PROPOSED (partially ACCEPTED by current implementation)

**Context:** Prices, availability, booking status, offers, and inventory are factual data that the AI must not invent.

**Decision:** All transactional and factual data lives in PostgreSQL tables and is served through tools. The AI presents this data but cannot create or modify it without tool calls that are backend-validated.

**Consequences:**
- AI tools are the only mutation path
- Tool results are authoritative
- `createBooking` validates slot tokens server-side
- Offers cannot be invented by the AI
- Knowledge/RAG supplements but never overrides structured truth

**Already established:** The current booking pipeline, slot tokens, and working state already implement this principle.

---

## D004 — RAG Does Not Own Transactional Truth

**Status:** PROPOSED (partially ACCEPTED by current implementation)

**Context:** The knowledge pipeline (RAG) provides context from uploaded documents. Transactional data (prices, availability, bookings) lives in structured tables.

**Decision:** RAG is for supplementary content (FAQs, descriptions, instructions, general policies). It must never be the source of truth for prices, availability, inventory, or booking status.

**Consequences:**
- Knowledge documents should not duplicate pricing data
- If a knowledge document mentions a price, the structured `Service.amountMinor` takes precedence
- Context builder should inject structured truth before RAG context
- Offer/promotion details come from `Offer` table, not knowledge docs

---

## D005 — Customer and Lead Are Separate Concepts

**Status:** PROPOSED (ACCEPTED by current schema)

**Context:** The system tracks both customer identity (contact information) and sales opportunities (leads).

**Decision:**
- **Customer** = identity/contact (who is this person?)
- **Lead** = sales opportunity/commercial interest (what do they want?)
- A Customer can exist without a Lead
- A Lead always references a Customer
- Multiple Leads can exist for the same Customer

**Consequences:**
- Customer creation does not require a Lead
- Lead creation requires a Customer
- Customer list shows all contacts; Lead list shows commercial opportunities
- Analytics track conversion rates (Lead → Booking/Order)

**Already established:** Current schema has `Customer` and `Lead` as separate tables with `Lead.customerId` FK.

---

## D006 — One Dynamic Dashboard, Not Per-Industry Apps

**Status:** PROPOSED

**Context:** Different business types need different dashboard modules (dental needs bookings, ecommerce needs orders, real estate needs listings).

**Decision:** Build one dashboard application that dynamically renders navigation and modules based on organization capabilities. Do NOT build separate applications for each industry.

**Consequences:**
- `OperatorNav.tsx` becomes capability-driven
- Each dashboard module checks capability before rendering
- New business types require only capability presets, not new applications
- Frontend code stays in one `apps/web` package
- Module components are shared (e.g., table, list, detail views)

---

## D007 — Organization-Specific Assistant Style Is Configuration

**Status:** PROPOSED

**Context:** Different businesses need different assistant tones, languages, and communication styles.

**Decision:** Conversation style (language, dialect, tone, formality, response length, emoji preference, etc.) is stored as organization-level configuration and read by the context builder at runtime.

**Consequences:**
- No hardcoded persona in context builder
- Each organization can customize their assistant's personality
- Style settings are validated (e.g., formality must be one of: formal, semi_formal, casual)
- Style cannot override backend safety (kill switch, tool auth, RLS still enforced)
- Default style per locale (e.g., Arabic/Iraqi defaults for new orgs in Iraq)

---

## D008 — Existing Booking Path Must Remain Backward Compatible

**Status:** PROPOSED (ACCEPTED as a constraint)

**Context:** The booking pipeline (searchServices → ensureLead → getAvailableSlots → createBooking) is production-proven with slot tokens, working state, idempotency, and deterministic finalization.

**Decision:** All multi-business evolution must preserve the existing booking path. No migration should break booking for existing dental organizations.

**Consequences:**
- `Service` table may be extended but not replaced
- `searchServices` tool continues to work (alias to `searchCatalog`)
- Slot tokens unchanged
- Working state schema unchanged
- Booking FK chain (`Booking → Service, Location, StaffMember, Customer`) preserved
- Demo fixtures must include dental booking scenario as regression baseline

---

## D009 — Catalog Extension Over Replacement

**Status:** PROPOSED

**Context:** The current `Service` model is tightly coupled to booking (duration, buffers, booking-enabled flag). A generic catalog needs to support products, listings, and packages.

**Decision:** Extend the `services` table with an `item_type` column rather than creating a new `catalog_items` table. This preserves all existing FKs and avoids data migration.

**Consequences:**
- Add `item_type` column defaulting to `"SERVICE"`
- Add optional description, image, metadata columns
- Non-SERVICE items don't require duration/buffer columns
- Booking pipeline continues to operate on SERVICE items only
- `searchCatalog` replaces `searchServices` (backward-compatible)

**Risk:** Table may accumulate type-specific nullable columns. Mitigation: use JSONB `metadata_json` for type-specific attributes.

---

## D010 — JSONB for Organization Configuration

**Status:** PROPOSED

**Context:** Organization capabilities, conversation style, and onboarding progress need storage.

**Decision:** Use JSONB columns on the `organizations` table rather than separate relational tables for these configurations.

**Rationale:**
- Read-heavy, write-rare data
- Always fetched with the organization
- Avoids JOINs on hot path
- Schema flexibility for future capability additions
- Validation enforced at API layer, not database constraints

**Consequences:**
- No FK relationships on capability values
- API validates JSONB structure on write
- Database-level constraints limited (CHECK constraints possible but not required)
- Indexing on JSONB values possible via GIN indexes if needed

---

## D011 — Business Packs Are Bootstrap-Only Inputs

**Status:** ACCEPTED

**Context:** Onboarding multiple business types benefits from industry presets (clinic, salon, real estate, restaurant, professional services). However, embedding industry branches into runtime logic creates fragility and tenant lock-in.

**Decision:** Business Packs are code-owned, versioned templates used strictly during initial onboarding or merge-missing setup. After application, all platform runtime components (orchestrator, tools, workflow resolver, policies, knowledge) operate exclusively on persisted generic configuration (`OrganizationCapabilities`, `BusinessPolicy`, `CatalogItem`, `KnowledgeDocument`, `OrganizationConversationProfile`). Pack application records minimal provenance for auditing but never acts as a runtime decision source.

**Consequences:**
- Zero runtime branching on `packId`, `businessType`, or industry strings
- Pack policy starters default to `DRAFT` (not active)
- Pack knowledge starters default to `DRAFT` (not published)
- Pack catalog starters default to `INACTIVE` with null price (no fake prices)
- Re-applying a pack uses deterministic starter keys for idempotency
- Operators can freely customize all settings post-application

---

## D012 — Backend-Authoritative Pricing and Transaction State
 
**Status:** ACCEPTED
 
**Context:** Non-booking commercial transactions (Quotes and Orders) require deterministic price calculation, offer discount stacking, currency consistency, and safety guarantees against hallucinated pricing or unauthorized state modifications by LLMs.
 
**Decision:** Pricing calculations are strictly backend-authoritative in integer minor units (BigInt) within a pure deterministically testable function (`calculateTransactionPricing`). The LLM is never trusted with computing totals, discounts, or order status mutations. Manual pricing is gated on catalog items (`pricingModel === 'MANUAL_QUOTE'`). Order confirmation requires explicit server-side state confirmation (`pendingTransactionConfirmation` in working state) and any line item modification invalidates confirmation. Quote and Order lifecycles enforce rigid state machines (`Quote: DRAFT -> SENT -> ACCEPTED / REJECTED / CANCELLED / EXPIRED`, `Order: DRAFT -> PENDING_CONFIRMATION -> CONFIRMED -> CANCELLED / FULFILLED / EXPIRED`). Preview mode simulates transactions in memory without database mutations.

**Consequences:**
- LLM cannot hallucinate totals or discounts
- Currency mismatches throw validation errors
- Offer discounts from MB-05 are stacked deterministically
- Line items snapshot historical name and unit price at transaction creation
- Multi-tenant RLS isolation with DB-level CHECK constraints

---

## D013 — Deterministic Derived Analytics from Structured Operational Truth
 
**Status:** ACCEPTED
 
**Context:** Analytics and dashboard metrics must reflect real business activity accurately across different business types without hallucinated totals, ungrounded conversational NLP inferences, cross-currency mixing, or expensive queries on hot transactional paths.
 
**Decision:** Analytics is strictly derived from authoritative structured backend state (`conversations`, `messages`, `leads`, `bookings`, `quotes`, `orders`, `catalog_items`, `agent_runs`). DeepSeek / LLM models are never used to compute, aggregate, or infer core metrics. Multi-currency values are partitioned and never summed across currencies. Zero denominators safely produce `rate: null` (`N/A`). Date ranges are converted to half-open UTC intervals `[from, to)` based on the organization's local timezone. Preview sessions and simulated tool mutations are strictly excluded. Dynamic dashboards render modules strictly according to `OrganizationCapabilities` with zero `businessType` runtime branching.

**Consequences:**
- LLMs cannot hallucinate metrics or revenue
- Financial totals are labelled accurately (Accepted Quote Value, Confirmed Order Value)
- Safe zero-denominator handling prevents runtime math errors
- Tenant RLS isolation guaranteed on all analytics queries
- Clean separation between hot operational transactions and derived aggregate read queries

---

## D014 — Production Hardening & Operational Safety

**Status:** ACCEPTED

**Context:** Live production deployments require strict environment boundaries, automated RLS verification, role separation, bounded retry and backoff mechanisms, standardized error masking, and disaster recovery procedures to ensure operational resilience and zero data contamination.

**Decision:**
1. **Environment Tiers & Safety Gates**: Explicit `APP_ENV` (`development | test | staging | production`) and `DB_ENV` (`local | remote_test | staging | production`). Destructive CLI commands (`demo:reset`, `demo:reseed`, `db:reset:test`, `db:seed`) fail closed via `assertNonProduction()` when production environment variables are detected.
2. **Database Role Separation**: Runtime processes operate exclusively under the `app_runtime` non-superuser role (`NOBYPASSRLS`). DDL migrations run via owner credentials during deployment and are stripped from runtime servers.
3. **RLS & FORCE RLS**: All 47 tenant tables enforce `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`. Automated cross-tenant negative test suites prevent cross-organization reads and writes.
4. **Resilient Queues & Observability**: BullMQ workers configure bounded retry attempts (3), exponential backoff (1000ms delay), dead-letter logging, and graceful shutdown handling (`SIGTERM`/`SIGINT`).
5. **Standardized Error Masking**: `GlobalHttpExceptionFilter` formats API errors to `{ statusCode, code, message, requestId, timestamp }` and masks raw SQL and internal traces in production.
6. **Production Readiness CLI**: `npm run prod:check` runs non-destructive checks against target databases and Redis before deployment.

**Consequences:**
- Accidental destructive resets against production databases are impossible.
- Tenant data leakage across organizations is strictly blocked at the PostgreSQL engine level.
- Unhandled exceptions never leak database topology, SQL queries, or secrets to external callers.
- Clear operational runbooks enable predictable incident triage and disaster recovery.

---

## Decision Summary

| ID | Decision | Status |
|----|----------|--------|
| D001 | Capability-driven behavior | PROPOSED |
| D002 | No business-type branching in agent | PROPOSED |
| D003 | Backend-authoritative structured truth | PROPOSED |
| D004 | RAG does not own transactional truth | PROPOSED |
| D005 | Customer ≠ Lead | PROPOSED (schema ACCEPTED) |
| D006 | One dynamic dashboard | PROPOSED |
| D007 | Style is configuration | PROPOSED |
| D008 | Backward-compatible booking | PROPOSED (constraint ACCEPTED) |
| D009 | Catalog extension over replacement | PROPOSED |
| D010 | JSONB for org configuration | PROPOSED |
| D011 | Business Packs are bootstrap-only inputs | ACCEPTED |
| D012 | Backend-authoritative pricing and transaction state | ACCEPTED |
| D013 | Deterministic derived analytics from structured operational truth | ACCEPTED |
| D014 | Production hardening and operational safety | ACCEPTED |

