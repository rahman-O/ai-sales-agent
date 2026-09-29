# Multi-Business Platform — Target Architecture

> This document defines the intended architecture for the multi-business AI sales platform.
> **Core principle:** Behavior is driven by capabilities, structured data, and allowed workflows — never by business-type branching.

---

## Anti-Pattern: Business-Type Branching

The architecture **MUST NOT** contain patterns like:

```typescript
// ❌ FORBIDDEN — business-type branching
if (businessType === "clinic") { ... }
if (businessType === "salon") { ... }
if (businessType === "real_estate") { ... }

// ❌ FORBIDDEN — switch on business type
switch (org.businessType) {
  case "dental": return dentalWorkflow();
  case "ecommerce": return ecommerceWorkflow();
}
```

Instead, behavior **MUST** depend on:

```typescript
// ✅ CORRECT — capability-driven behavior
if (capabilities.supportsBooking) { enableBookingTools(); }
if (capabilities.supportsOrders) { enableOrderTools(); }

// ✅ CORRECT — data-driven behavior
const catalogItems = await getCatalog(orgId);
const activeWorkflows = deriveWorkflows(capabilities);
```

---

## Architecture Layers

```
┌──────────────────────────────────────────────────┐
│                 CHANNELS                          │
│           WhatsApp  ·  Future channels            │
├──────────────────────────────────────────────────┤
│              AGENT ORCHESTRATOR                   │
│    Run loop · Model calls · Tool dispatch         │
│    Schema validation · Finalization · Idempotency │
├──────────────────────────────────────────────────┤
│              CONTEXT BUILDER                      │
│  Org Profile → Persona                            │
│  Capabilities → Workflow Guidance                 │
│  Structured Data → Facts                          │
│  Knowledge → RAG Context                          │
│  Working State → Operational Memory               │
│  Style Profile → Tone & Language                  │
├──────────────────────────────────────────────────┤
│              TOOL EXECUTOR                        │
│  Capability-gated tool registry                   │
│  Tool authorization (AgentConfig allowlist)        │
│  Read tools · Mutation tools                      │
├──────────────────────────────────────────────────┤
│           BUSINESS LOGIC LAYER                    │
│  Booking · Lead · Order · Quote · FollowUp        │
│  Catalog · Offers · Policies · Knowledge          │
├──────────────────────────────────────────────────┤
│             DATA LAYER                            │
│  PostgreSQL + RLS · pgvector · Outbox             │
│  Organization-scoped multi-tenancy                │
├──────────────────────────────────────────────────┤
│           INFRASTRUCTURE                          │
│  Docker · DeepSeek API · Object Storage           │
└──────────────────────────────────────────────────┘
```

---

## Separation of Concerns

### 1. Business Identity / Profile

**What it is:** Organization metadata — name, type label, description, branding, timezone, locale.

**Where it lives:** `Organization` table (extended) or `OrganizationProfile`.

**Runtime role:** Informs AI persona. Does NOT drive behavioral branching.

**Example:** A dental clinic's description is injected into the system prompt as persona context, but the orchestrator doesn't check `businessType`.

### 2. Capabilities

**What it is:** Structured boolean/config flags declaring what features an organization uses.

**Where it lives:** `OrganizationCapabilities` (JSONB column or table).

**Runtime role:**
- Determines which tools are available
- Determines which workflow guidance is injected
- Determines which dashboard modules are visible
- Does NOT determine internal business logic — that's data-driven

**Example:**
```json
{
  "supportsBooking": true,
  "supportsLeads": true,
  "supportsOrders": false,
  "supportsServices": true,
  "supportsProducts": false
}
```

### 3. Structured Truth (Backend-Authoritative)

**What it is:** Facts that the AI must not invent — prices, availability, offers, inventory, booking status, orders, staff, locations.

**Where it lives:** PostgreSQL tables (Service/CatalogItem, Booking, Lead, Offer, etc.).

**Runtime role:** Tools query this data. AI presents it but never modifies it without tool calls. Backend enforces validity.

**Key principle:** **The AI is a presenter of structured truth, not a source of it.**

### 4. Knowledge / RAG

**What it is:** Human-readable content that supplements structured truth — FAQs, service explanations, business descriptions, pre/post instructions, general policies.

**Where it lives:** `KnowledgeDocument` → `KnowledgeChunk` with embeddings.

**Runtime role:** Retrieved via similarity search and injected as context. Never authoritative for transactional data.

**Key principle:** **RAG does not own transactional truth.** Prices, availability, and booking status come from structured data, not knowledge documents.

### 5. Conversation Style

**What it is:** Organization-level preferences for how the AI assistant communicates — language, dialect, tone, formality, response length, sales style, emoji usage, customer name usage, greeting style, handoff phrasing.

**Where it lives:** `organization_conversation_profiles` table (1-to-1 with `Organization`).

**Runtime role:** Injected into system prompt (`formatConversationProfileBlock`). Controls phrasing and personality. Does NOT control facts, prices, policies, tools, or permissions.

**Key principle:** **LLM controls natural phrasing and intent understanding. Backend controls facts, permissions, workflows, and mutations.**

### 6. Operational Working State

**What it is:** Per-conversation structured memory of completed actions — selected service, customer ID, lead ID, candidate slots, last confirmed booking.

**Where it lives:** `ConversationWorkingState` table (JSONB `state_json`).

**Runtime role:** Prevents redundant tool calls, enables multi-turn flows, provides authoritative operational memory.

### 7. Sales State

**What it is:** The Lead — representing a sales opportunity with status, qualification, and assignment.

**Where it lives:** `Lead` + `LeadActivity` tables.

**Runtime role:** Tracks commercial interest progression. Distinct from Customer (identity/contact).

### 8. Transaction State

**What it is:** The outcome of a sales interaction — Booking, Order, Quote.

**Where it lives:** `Booking` table (existing), future `Order` and `Quote` tables.

**Runtime role:** Created via tools, idempotent, backend-validated.

---

## Tool Architecture

### Current Tool Registry

```
P04 Tools (Core):
  searchServices, getServiceDetails, getServicePrice,
  getCustomer, createCustomer, handoffToHuman

P05 Tools (Knowledge):
  searchKnowledge

P06 Tools (Leads):
  ensureLead, updateLeadQualification, getLead, transitionLead

P07 Tools (Booking):
  getAvailableSlots, createBooking, getBookings,
  cancelBooking, rescheduleBooking

P10 Tools (Follow-ups):
  scheduleLeadFollowUp, cancelFollowUp, getFollowUps
```

### Future Tool Registry Evolution

Tools should be registered with capability requirements:

```
Tool: searchCatalog
  Requires: supportsServices OR supportsProducts OR supportsListings
  Classification: read

Tool: createBooking
  Requires: supportsBooking
  Classification: mutate

Tool: createOrder
  Requires: supportsOrders
  Classification: mutate

Tool: getActiveOffers
  Requires: supportsOffers
  Classification: read

Tool: getBusinessPolicies
  Requires: any (always available)
  Classification: read
```

The `AgentConfig.toolAllowlist` remains the authorization boundary. Capabilities determine which tools are *available* for allowlisting, not which are *authorized*.

---

## Context Builder Evolution

### Current (Dental-Hardcoded)

```
System Prompt = 
  POLICY_BLOCK (hardcoded dental persona)
  + WORKFLOW_GUIDANCE (hardcoded booking chain)
  + AGENT_DECISION_CONTRACT (schema — stays)
  + WORKING_STATE_BLOCK (dynamic — stays)
  + SUMMARY (if available — stays)
```

### Target (Capability-Driven)

```
System Prompt = 
  ORGANIZATION_PERSONA (from profile + style)
  + CAPABILITY_WORKFLOWS (from capabilities → workflow registry)
  + AGENT_DECISION_CONTRACT (schema — unchanged)
  + WORKING_STATE_BLOCK (dynamic — unchanged)
  + ACTIVE_OFFERS_BLOCK (from offers, if supportsOffers)
  + POLICIES_BLOCK (from policies, if any)
  + SUMMARY (if available — unchanged)
```

### Token Budget

The context window is limited (~12,000 chars currently). Dynamic composition must respect this:

- Persona: ~200 chars
- Per-workflow guidance: ~800 chars each
- Decision contract: ~1,500 chars (fixed)
- Working state: variable
- Offers: ~500 chars
- Policies: ~500 chars
- Conversation history: remainder

**Risk:** If 3+ workflows are active, guidance may exceed budget. Mitigation: prioritize by active intent.

---

## Multi-Tenancy Guarantee

The existing multi-tenancy model is preserved:

- Every data table has `organizationId` as a required FK
- RLS policies enforce row-level isolation
- All queries are org-scoped
- `@@unique([organizationId, id])` on every entity

Capabilities, profiles, and new catalog types follow the same pattern. No shared-tenant data.

---

## Deployment Architecture (Unchanged)

```
Docker Compose
├── api (NestJS)
├── worker (Node.js)
├── postgres (with pgvector)
├── redis (optional, for caching)
└── [local-ai profile] ollama (for embeddings only)

External:
├── DeepSeek API (LLM provider)
├── WhatsApp Business API (channel)
└── Object Storage (knowledge files)
```

The deployment architecture does not change for multi-business. The same stack serves all organization types.

---

## MB-06 Policy Architecture

Business policies are organization-owned typed records. The policy API validates rules by policy type, separates structured rules from explanatory summaries, and resolves one effective version by status, UTC window, version, effective start, and creation time. Activation serializes per organization and policy type and archives the prior active version.

The agent calls `getEffectivePolicy` only when a policy is relevant. It receives authoritative structured data or an authoritative empty result. Cancellation and rescheduling tools independently enforce current cutoff rules in the backend. Informational policy types cannot authorize or claim payment, refund, return, delivery, order, or quote execution.

Policies are always available as an Admin navigation module for OWNER and ADMIN roles. Capability flags influence prominence and enforcement relevance; no runtime path branches on `businessType`.

---

## MB-14 Production Hardening & Operational Architecture

The platform provides resilient, tenant-isolated operational foundations across production tiers:

1. **Environment Tiers**: Structured `APP_ENV` (`development | test | staging | production`) and `DB_ENV` (`local | remote_test | staging | production`). `assertNonProduction()` blocks destructive resets from executing against live production environments.
2. **Database Role Separation**: Runtime API and worker operate under the non-superuser role `app_runtime` (`NOBYPASSRLS`). `MIGRATION_DATABASE_URL` is used strictly during deployment migration steps.
3. **RLS & FORCE RLS**: All 47 tenant tables enforce `FORCE ROW LEVEL SECURITY`. Cross-tenant data access is blocked by PostgreSQL row policies.
4. **Health & Readiness**: `/health/live` verifies process uptime; `/health/ready` validates PostgreSQL and Redis connectivity with 3-second bounded timeouts.
5. **Worker Resilience**: BullMQ queue workers configure bounded attempts (3), exponential backoff (1000ms delay), dead-letter logging, and graceful `SIGTERM`/`SIGINT` shutdown.
6. **Error Masking & Observability**: Standardized `GlobalHttpExceptionFilter` hides internal database errors and stack traces in production while preserving `x-request-id` tracing.


