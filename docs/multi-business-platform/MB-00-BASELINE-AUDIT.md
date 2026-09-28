# MB-00 — Discovery & Baseline Architecture Audit

> **Document Status:** Authoritative Implementation Baseline  
> **Phase:** MB-00 (Discovery & Baseline Audit)  
> **Target Next Phase:** MB-01 (Organization Profile + Capabilities)  
> **P14 Authorization:** NOT AUTHORIZED  

---

## 1. Executive Summary

This baseline audit provides a comprehensive, repository-verified analysis of the AI Sales Agent platform before commencing multi-business generalization. 

### Key Findings
1. **Strong Multi-Tenant Foundation:** The core architecture (`Organization`, `OrganizationMember`, `User`, Row-Level Security, Tenant Context, Outbox, Idempotency, and Audit Logs) is robust, strictly isolated, and 100% reusable as-is.
2. **Zero Runtime `businessType` Branching:** There is no `if (businessType === 'clinic')` branching anywhere in the codebase. The database schema has no `business_type` column.
3. **Domain Coupling is Localized:** Dental domain coupling is strictly confined to:
   - Initial prompt wording (`POLICY_BLOCK` in `packages/agent-core/src/context-builder.ts`).
   - Service search fallback aliases (`CANONICAL_ALIASES_BY_NAME_PATTERN` in `packages/agent-adapters/src/service-search.ts`).
   - RAG embedding query instruction default (`QWEN_DENTAL_QUERY_INSTRUCTION` in `packages/embeddings/src/ports.ts`).
   - Synthetic demo fixtures and tests (`scripts/demo/seed.ts`, `tests/e2e/booking-flow.spec.ts`).
4. **Clean Decoupling of Customer vs. Lead:** `Customer` represents contact/channel identity, while `Lead` represents commercial sales opportunity. A Customer can exist independently without a Lead.
5. **Proven Booking Core:** The appointment booking engine (slots math, slot token cryptographic provenance, idempotency, deterministic post-booking finalization, zero-slot recovery) is completely generic scheduling math that does not depend on dental concepts.
6. **Missing Multi-Business Layers:** The platform currently lacks:
   - `OrganizationProfile` and `OrganizationCapabilities` (MB-01).
   - Dynamic Dashboard Navigation (MB-03).
   - Generic Catalog Abstraction for Products/Listings (MB-04).
   - Structured Offers/Promotions (MB-05).
   - Business Policies (MB-06).
   - Configurable Assistant Conversation Profile/Style (MB-07).
   - Non-Booking Transactional Models (Orders/Quotes) (MB-12).

---

## 2. Repository Inventory

```
AI Sales Agent/
├── apps/
│   ├── api/                     # NestJS Core API (Multi-tenant, JWKS auth, RLS)
│   │   └── src/
│   │       ├── agent/           # Agent orchestration & run triggers
│   │       ├── analytics/       # Organization analytics & conversion reporting
│   │       ├── auth/            # Token verification & actor resolution
│   │       ├── bookings/        # Appointment booking management
│   │       ├── catalog/         # Services CRUD & location/staff relations
│   │       ├── common/          # Filters, guards, pipes, DTO validation
│   │       ├── config/          # Environment configuration
│   │       ├── conversations/   # Conversation lifecycle & message timeline
│   │       ├── customers/       # Customer profile & identity management
│   │       ├── dashboard/       # Aggregated operator dashboard views
│   │       ├── database/        # PrismaService & TenantContextService
│   │       ├── followups/       # Scheduled outreach & quiet hours
│   │       ├── health/          # Readiness & liveness probes
│   │       ├── knowledge/       # Document upload, chunking, and review
│   │       ├── leads/           # CRM lead management & status transitions
│   │       ├── messaging/       # Ingress webhook handlers & outbound queue
│   │       ├── organizations/   # Org CRUD, member roles, AI emergency kill
│   │       └── templates/       # WhatsApp HSM message template versions
│   ├── web/                     # Next.js 14 Operator Web App
│   │   └── src/
│   │       ├── app/             # Dashboard, inbox, bookings, leads, knowledge pages
│   │       ├── components/      # Shared operator navigation (OperatorNav.tsx)
│   │       └── proxy.ts         # Supabase SSR cookie / JWT proxy
│   └── worker/                  # Background Worker Engine
│       └── src/
│           ├── agent-runner/    # Autonomous AgentRun execution loop
│           ├── followups/       # FollowUp dispatch consumer
│           ├── outbox/          # Outbox event publisher
│           └── webhooks/        # Inbound webhook ingestion
├── packages/
│   ├── agent-core/              # LLM-agnostic decision engine, context builder, ports
│   ├── agent-adapters/          # Postgres/pgvector tool execution, working state
│   ├── contracts/               # Shared TypeScript DTOs & API schemas
│   ├── db/                      # Database client & migration tooling
│   ├── embeddings/              # TEI / Qwen embedding provider ports & profiles
│   ├── knowledge-chunking/      # Markdown / text chunking algorithms
│   └── storage/                 # S3 / MinIO blob storage adapters
├── prisma/
│   └── schema.prisma            # Authoritative database schema (29 models)
├── docs/
│   └── multi-business-platform/ # Authoritative multi-business planning hub
└── scripts/
    ├── demo/                    # Synthetic demo seeds & docker runner
    └── pre-p14/                 # Verification probes & E2E benchmarks
```

---

## 3. Module Classification

| Module | Classification | Purpose | Source of Truth | Multi-Business Impact | Target Phase |
|---|---|---|---|---|---|
| `apps/api/organizations` | `REQUIRES_GENERALIZATION` | Org & membership CRUD, AI emergency kill | PostgreSQL (`organizations`, `organization_members`) | Needs profile & capability models | MB-01 |
| `apps/api/catalog` | `REQUIRES_GENERALIZATION` | Services & pricing management | PostgreSQL (`services`, `locations`, `staff_members`) | Extend to generic `CatalogItem` (Services, Products, Listings) | MB-04 |
| `apps/api/customers` | `REUSABLE_AS_IS` | Contact & identity resolution | PostgreSQL (`customers`, `customer_identities`) | Generic contact truth | Retain |
| `apps/api/leads` | `REUSABLE_AS_IS` | Sales opportunity & qualification | PostgreSQL (`leads`, `lead_activities`) | Generic sales truth | Retain / MB-10 |
| `apps/api/bookings` | `REUSABLE_AS_IS` | Scheduling & appointments | PostgreSQL (`bookings`, `booking_activities`) | Generic time-slot reservation engine | Retain (Capability-gated) |
| `apps/api/followups` | `REUSABLE_AS_IS` | Automated outreach & quiet hours | PostgreSQL (`follow_ups`, `organization_follow_up_policies`) | Generic automated re-engagement | Retain |
| `apps/api/knowledge` | `REUSABLE_AS_IS` | RAG ingestion & vector indexing | PostgreSQL (`knowledge_documents`, `knowledge_chunks` with pgvector) | Generic unstructured knowledge | MB-08 |
| `apps/api/conversations` | `REUSABLE_AS_IS` | Ingress sequence, messaging timeline, takeover | PostgreSQL (`conversations`, `messages`, `webhook_receipts`) | Generic multi-turn communication | Retain |
| `apps/api/analytics` | `REQUIRES_GENERALIZATION` | Operational & conversion reporting | PostgreSQL aggregated queries | Make metrics capability-aware | MB-13 |
| `packages/agent-core/context-builder` | `REQUIRES_GENERALIZATION` | Prompt assembly & working memory formatting | Code + snapshot data | Remove dental policy text, dynamic prompt generation | MB-01, MB-07, MB-10 |
| `packages/agent-core/orchestrator` | `REUSABLE_AS_IS` | Single/multi-turn agent loop & decision parsing | Core TypeScript logic | Fully generic | Retain |
| `packages/agent-adapters/tool-executor` | `REQUIRES_GENERALIZATION` | Tool dispatch & mutation ActionGate | PostgreSQL + RunStore | Dynamic capability-gated tool manifest | MB-01, MB-10 |
| `packages/agent-adapters/service-search` | `REQUIRES_GENERALIZATION` | Catalog search & query normalization | Regex patterns + in-memory matching | Remove hardcoded dental aliases; replace with generic catalog match | MB-04 |
| `packages/agent-adapters/conversation-working-state` | `REUSABLE_AS_IS` | Operational multi-turn state writeback | PostgreSQL (`conversation_working_state`) | Extensible JSON payload | MB-10 |
| `apps/web/OperatorNav` | `REQUIRES_GENERALIZATION` | Shared navigation bar | Static TypeScript array | Make dynamic based on enabled capabilities | MB-03 |
| `scripts/demo/seed.ts` | `DEMO_SPECIFIC` | Synthetic demo data seeder | Script file | Add multi-vertical fixtures (Salon, Real Estate, Retail) | MB-11 |

---

## 4. Organization Model Audit

### Status Report
* **`ORGANIZATION_MODEL_EXISTS:`** **YES** (`prisma/schema.prisma:24-68`, table `organizations`)
* **`ORGANIZATION_PROFILE_EXISTS:`** **NO** (Only `name` and emergency kill fields exist)
* **`ORGANIZATION_SETTINGS_EXISTS:`** **NO** (Follow-up policy is the only settings model)
* **`CAPABILITY_MODEL_EXISTS:`** **NO**
* **`BUSINESS_TYPE_FIELD_EXISTS:`** **NO**

### Detailed Evidence
```prisma
model Organization {
  id                          String              @id @default(uuid()) @db.Uuid
  name                        String
  aiEmergencyDisabledAt       DateTime?           @map("ai_emergency_disabled_at") @db.Timestamptz(6)
  aiEmergencyDisabledReason   String?             @map("ai_emergency_disabled_reason")
  aiEmergencyDisabledByUserId String?             @map("ai_emergency_disabled_by_user_id") @db.Uuid
  createdAt                   DateTime            @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt                   DateTime            @updatedAt @map("updated_at") @db.Timestamptz(6)
  ...
}
```
**Conclusion:** The database structure is clean and unpolluted with industry-specific fields. Adding `OrganizationProfile` and `OrganizationCapabilities` in `MB-01` is completely additive and non-breaking.

---

## 5. Business-Type Hardcoding Audit

| Match Location | Content / Expression | Classification | Multi-Business Impact |
|---|---|---|---|
| `packages/agent-core/src/context-builder.ts:5` | `'You are a dental clinic reception assistant. You are not a clinician.'` | `PROMPT_ONLY` | Needs to be replaced with dynamic persona generated from `OrganizationProfile` and `ConversationProfile` (MB-07). |
| `packages/agent-adapters/src/service-search.ts:20-129` | `CANONICAL_ALIASES_BY_NAME_PATTERN` (Checkup, cleaning, whitening, filling, implant, braces regexes) | `RUNTIME_HARDCODE` | Hardcoded fallback for dental synonyms. Must be generalized in MB-04 (catalog search with custom synonyms or vector search). |
| `packages/agent-adapters/src/service-search.ts:159-170` | `GENERIC_STOP_WORDS` ('dental', 'teeth', 'tooth', 'اسنان', 'الاسنان', 'سن') | `RUNTIME_HARDCODE` | Stop words should be generic language stop words, not domain-specific. |
| `packages/embeddings/src/ports.ts:46-47` | `QWEN_DENTAL_QUERY_INSTRUCTION = 'Given a customer question, retrieve relevant passages from a dental clinic knowledge base...'` | `PROMPT_ONLY` | Default embedding instruction string. Needs generalization in MB-08. |
| `scripts/demo/seed.ts` | `Zero Cost Test Clinic`, `Dental Consultation`, `Teeth Cleaning` | `DEMO_ONLY` | Demo seed data. Keep for dental regression testing; add other industry presets in MB-11. |
| `packages/agent-core/src/agent-decision-contract.test.ts` | Mock test fixtures with `Dental Check-up` | `TEST_ONLY` | Unit test fixtures. Safe as-is. |
| `packages/agent-core/src/demo-scripted-provider.ts` | Scripted fallback test provider for dental demo | `DEMO_ONLY` | Synthetic scripted provider for local tests without live LLM. |

---

## 6. Service / Catalog Audit

### Status Report
* **`CURRENT_SERVICE_MODEL:`** Booking-centric `services` table tied to `location_id`, `duration_minutes`, `amount_minor`, `currency`, `buffer_before_minutes`, `buffer_after_minutes`, `booking_enabled`, `minimum_lead_minutes`, `maximum_advance_days`.
* **`GENERIC_CATALOG_READY:`** **PARTIAL**
* **`RECOMMENDED_MB04_DIRECTION:`** Introduce a unified `catalog_items` base table with typed subtypes (`SERVICE`, `PRODUCT`, `LISTING`), while keeping the existing `services` table backward-compatible for booking execution.

### Service Model Structure
```prisma
model Service {
  id                  String         @id @default(uuid()) @db.Uuid
  organizationId      String         @map("organization_id") @db.Uuid
  locationId          String         @map("location_id") @db.Uuid
  name                String
  durationMinutes     Int            @map("duration_minutes")
  bufferBeforeMinutes Int            @default(0)
  bufferAfterMinutes  Int            @default(0)
  amountMinor         BigInt         @map("amount_minor")
  currency            String         @db.Char(3)
  pricingVersion      Int            @default(1)
  bookingEnabled      Boolean        @default(true)
  ...
}
```
* **Duration is Mandatory:** `durationMinutes Int` is non-nullable, making `Service` inherently appointment-based.
* **Pricing is Structural:** Stored as `amountMinor BigInt` and `currency String`, which is robust.
* **Location Dependency:** `locationId` is non-nullable.

---

## 7. Lead Model Audit

### Status Report
* **`LEAD_CURRENT_SEMANTICS:`** **OPTIONAL AT DB LEVEL, WORKFLOW-PROMPTED IN RUNTIME**
* **Evidence:**
  - In `prisma/schema.prisma:772`, `Booking.leadId` is nullable (`String? @map("lead_id") @db.Uuid`).
  - In `packages/agent-adapters/src/booking-tools.ts`, `toolCreateBooking` accepts optional `leadId`.
  - In `packages/agent-core/src/context-builder.ts:50`, `WORKFLOW_GUIDANCE` instructs: *"If customerId is present and leadId is absent: call ensureLead"*.
  - `ensureLead` is idempotent: if an open lead exists for the customer, it returns the existing `leadId` without duplication.
* **Multi-Business Capability:** In MB-01/MB-10, `supportsLeads` and `leadRequiredBeforeBooking` capability flags will determine whether `ensureLead` is called prior to booking.

---

## 8. Customer Model Audit

### Status Report
* **Customer Separation:** `Customer` and `Lead` are completely decoupled entities.
  - `Customer` owns identity, locale, and channel binding (`customer_identities` via WhatsApp phone / external address).
  - `Lead` owns commercial qualification (`need_summary`, `urgency`, `status`, `primary_service_id`).
  - A Customer can exist, chat, and book appointments without having an active Lead.
* **Multi-Tenancy:** `Customer` is strictly scoped to `organization_id` with composite primary/unique constraints (`[organizationId, id]`).

---

## 9. Booking Capability Audit

### Status Report
* **`BOOKING_CORE_REUSABLE:`** **YES**
* **Classification:**
  - Time-slot generation (`booking-time.ts`): **GENERIC_SCHEDULING_CORE** (Staff availability rules, weekly recurrence, date exceptions, buffer times, timezone math).
  - Slot Token provenance (`slot-token.ts`): **GENERIC_SCHEDULING_CORE** (HMAC/SHA256 signature binding slot parameters to prevent tampering).
  - Idempotent booking creation (`toolCreateBooking`): **GENERIC_SCHEDULING_CORE** (Atomic transaction, double-booking prevention, outbox event generation).
  - Post-booking deterministic finalization: **GENERIC_SCHEDULING_CORE** (Ensures confirmation is preserved even if model output fails).

---

## 10. Tool Registry Audit

Currently, 19 tools are registered in `packages/agent-adapters/src/tool-executor.ts`:

| Tool Name | Domain | Type | Capability It Represents | Dynamic Gating in Future |
|---|---|---|---|---|
| `searchServices` | Catalog | Read | `supportsServices` | Filter by `supportsServices` |
| `getServiceDetails` | Catalog | Read | `supportsServices` | Filter by `supportsServices` |
| `getServicePrice` | Catalog | Read | `supportsServices` | Filter by `supportsServices` |
| `getCustomer` | CRM | Read | Core | Always Available |
| `createCustomer` | CRM | Mutate | Core | Always Available |
| `handoffToHuman` | Safety | Mutate | `supportsHandoff` | Always Available |
| `searchKnowledge` | Knowledge | Read | `supportsKnowledge` | Filter by `supportsKnowledge` |
| `ensureLead` | CRM | Mutate | `supportsLeads` | Filter by `supportsLeads` |
| `updateLeadQualification` | CRM | Mutate | `supportsLeads` | Filter by `supportsLeads` |
| `getLead` | CRM | Read | `supportsLeads` | Filter by `supportsLeads` |
| `transitionLead` | CRM | Mutate | `supportsLeads` | Filter by `supportsLeads` |
| `getAvailableSlots` | Scheduling | Read | `supportsBooking` | Filter by `supportsBooking` |
| `createBooking` | Scheduling | Mutate | `supportsBooking` | Filter by `supportsBooking` |
| `getBookings` | Scheduling | Read | `supportsBooking` | Filter by `supportsBooking` |
| `cancelBooking` | Scheduling | Mutate | `supportsBooking` | Filter by `supportsBooking` |
| `rescheduleBooking` | Scheduling | Mutate | `supportsBooking` | Filter by `supportsBooking` |
| `scheduleLeadFollowUp` | Outreach | Mutate | `supportsFollowUps` | Filter by `supportsFollowUps` |
| `cancelFollowUp` | Outreach | Mutate | `supportsFollowUps` | Filter by `supportsFollowUps` |
| `getFollowUps` | Outreach | Read | `supportsFollowUps` | Filter by `supportsFollowUps` |

---

## 11. Context Builder Audit

### Status Report
* **`CONTEXT_GENERICITY:`** **MEDIUM**
* **Strengths:**
  - `AGENT_DECISION_CONTRACT` is 100% generic JSON protocol (`tool_request`, `final_response`, `safe_stop`).
  - `formatWorkingStateBlock` formats structured memory dynamically.
  - History budget management is generic.
* **Blockers to Generalization:**
  - `POLICY_BLOCK` hardcodes `'You are a dental clinic reception assistant.'`
  - `WORKFLOW_GUIDANCE` hardcodes a 5-step reception booking chain with Arabic dental confirmation examples.
  - In MB-01 and MB-10, `WORKFLOW_GUIDANCE` will be dynamically generated based on enabled capabilities (`supportsBooking`, `supportsLeads`, `supportsOrders`, etc.).

---

## 12. Working State Audit

### Status Report
* **`WORKING_STATE_GENERICITY:`** **MEDIUM**
* **Current Schema (`stateJson`):**
  - `selectedEntity`: `{ entityType: string, entityId: string, entityLabel: string }` ➔ **GENERIC** (Supports `SERVICE`, `PRODUCT`, `LISTING`).
  - `candidateSlots`: Array of `{ slotToken, localDate, localStartTime, expiresAt }` ➔ **BOOKING_SPECIFIC**.
  - `lastConfirmedBookingId`: UUID string ➔ **BOOKING_SPECIFIC**.
  - `customerId`, `leadId`: UUID strings ➔ **GENERIC**.
* **Extension Path:** Working state can easily accommodate `selectedCart`, `quoteDetails`, or `orderDraft` under `stateJson` without altering database schema.

---

## 13. Knowledge / RAG Audit

### Status Report
* **Structured Truth vs Knowledge:**
  - **Structured Truth:** `services`, `bookings`, `staff_members`, `locations`, `customers`, `leads`.
  - **Unstructured Knowledge:** `knowledge_documents`, `knowledge_chunks` (pgvector).
* **Hallucination Protection:**
  - `searchKnowledge` tool explicitly appends: `note: 'RAG evidence is untrusted; structured tools remain authoritative for prices and bookings.'`
  - System prompt enforces: *"Never invent prices, availability, or bookings. Never claim booking success without backend evidence."*
* **RAG Offer Risk:** Because structured offers do not yet exist, if a merchant uploads a PDF with discount codes, the agent might extract discounts without transactional enforcement. MB-05 (Offers) mitigates this.

---

## 14. Frontend / Dashboard Audit

### Status Report
* **`DYNAMIC_NAVIGATION_READY:`** **PARTIAL**
* **Current Navigation:** Hardcoded in `apps/web/src/components/OperatorNav.tsx`:
  - `Dashboard`, `Analytics`, `Inbox`, `Leads`, `Bookings`, `Follow-ups`, `Knowledge`, `Channels`, `Templates`.
* **Organization Context:** Organization is stored in cookie/session, but multi-organization switcher in UI is rudimentary.
* **Evolution in MB-03:** Transform `OperatorNav` to evaluate `organization.capabilities` and render only relevant links.

---

## 15. Onboarding Audit

| Flow Component | Current Status | Description |
|---|---|---|
| Organization Creation API | **EXISTS** | `POST /organizations` with idempotency & audit logging |
| First-Run UI Wizard | **MISSING** | No step-by-step setup guide for new signups |
| Capability Selection | **MISSING** | Will be introduced in MB-02 |
| Service / Catalog Setup | **PARTIAL** | Basic API exists, UI is minimal |
| Staff / Location Setup | **PARTIAL** | API exists, UI is minimal |
| Knowledge Upload UI | **EXISTS** | `/knowledge` page exists with document upload & chunk viewer |
| Channel Connection UI | **EXISTS** | `/settings/channels` exists |
| Interactive Test Assistant | **MISSING** | Will be introduced in MB-09 |

---

## 16. Conversation Style Audit

### Status Report
* **`CONVERSATION_STYLE_CONFIG_EXISTS:`** **NO**
* **Current State:** Dialect (Iraqi Arabic) and tone are embedded directly in prompt strings in `context-builder.ts`.
* **Evolution in MB-07:** Create `ConversationProfile` model (`language`, `dialect`, `tone`, `formality`, `response_length`, `emoji_usage`, `custom_rules`).

---

## 17. Offer / Promotion Audit

### Status Report
* **`OFFER_MODEL_EXISTS:`** **NO**
* **`TRANSACTIONAL_OFFER_LOGIC_EXISTS:`** **NO**
* **`RAG_ONLY_OFFER_RISK:`** **YES**
* **Evolution in MB-05:** Introduce `offers` table with structured validation (`discount_type`, `discount_value`, `valid_from`, `valid_to`, `min_spend`, `applicable_item_ids`).

---

## 18. Order / Quote / Inventory Audit

| Subsystem | Current Status | Notes |
|---|---|---|
| Orders (`orders`, `order_items`) | **MISSING** | Planned for MB-12 |
| Quotes (`quotes`, `quote_items`) | **MISSING** | Planned for MB-12 |
| Physical Products | **MISSING** | Planned for MB-04 / MB-12 |
| Inventory Stock Tracking | **MISSING** | Planned for MB-12 |
| Real Estate / Automotive Listings | **MISSING** | Planned for MB-04 / MB-11 |

---

## 19. Analytics Audit

### Status Report
* **Current Analytics Scope:** Located in `apps/api/src/analytics/analytics.service.ts`:
  - `leads` (counts by status)
  - `conversion` (Lead ➔ Booking within 30 days)
  - `bookings` (counts by status)
  - `followUps` (reply rate, booking association within 7 days)
  - `conversations` (outbound origin, handoffs, no-human-intervention rate, response latency)
  - `delivery` (message delivery states)
  - `agent` (runs by status, tool calls by result code, token usage)
* **Generalization in MB-13:** Wrap lead/booking specific conversion metrics in capability gates so e-commerce or lead-only businesses do not see irrelevant zero-data charts.

---

## 20. Tenancy / Security Audit

### Status Report: PASS
* **PostgreSQL RLS:** All 29 tables enforce Row Level Security (`current_tenant_id() = organization_id`).
* **Tenant Context:** `TenantContextService.runInTenantContext` sets `app.current_organization_id` and `app.current_user_id` inside explicit transactions.
* **Worker Isolation:** `tool-executor.ts` uses `withTenant` wrapper setting session config variables on dedicated pool clients.
* **ActionGate Authority:** Before any mutation tool executes, `tool-executor.ts` locks the conversation row (`FOR UPDATE`) and validates:
  - `mode === 'AI_ACTIVE'`
  - `ownership_epoch === ctx.ownershipEpoch`
  - `lease_owner === ctx.leaseOwner`
  - `lease_fence === ctx.leaseFence`
  - `targetIngressSequence >= next_sequence - 1`
* **Emergency Kill Switch:** `aiEmergencyDisabledAt` timestamp on `Organization` immediately blocks new `AgentRun` creation across all worker instances.

---

## 21. Current Verified Invariants

Future multi-business phases **MUST NOT REGRESS** the following proven invariants:

1. **Multi-Tenant Isolation:** Zero queries across organization boundaries; mandatory RLS.
2. **Backend Authority:** AI model decisions propose tool calls; backend executes and validates truth.
3. **DeepSeek-Only Runtime:** Active provider is `deepseek` (`deepseek-chat`). Local Ollama/Qwen must not participate in runtime agent decisions or fallback.
4. **Working-State Continuity:** Multi-turn conversational memory survives turn boundaries, timeouts, and network drops.
5. **Exact Slot Token Provenance:** `createBooking` requires a cryptographically validated, non-expired `slotToken` from `getAvailableSlots`.
6. **Zero-Slot Guard:** When `getAvailableSlots` returns empty (`slots: []`), agent must never loop with identical arguments.
7. **Booking Idempotency:** Duplicate booking requests with same parameters are deduplicated via command operation keys.
8. **Deterministic Post-Booking Finalization:** A successful booking mutation is never undone or hidden by an assistant formatting failure.
9. **Human Takeover Fencing:** When operator claims conversation or mode is `HUMAN_TAKEN_OVER`, AI runs are fenced out.

---

## 22. Technical Debt Register

| ID | Issue | Severity | Current Impact | Target Phase | Blocks MB-01? | Recommended Action |
|---|---|---|---|---|---|---|
| **TD-01** | Hardcoded Dental Policy in Context Builder | Medium | Dental persona sent in prompt | MB-01 / MB-07 | No | Replace with dynamic prompt assembly from `OrganizationProfile` |
| **TD-02** | Hardcoded Dental Aliases in `service-search.ts` | Medium | Synonym matching is dental-specific | MB-04 | No | Move synonyms to catalog database or vector matching |
| **TD-03** | Missing `OrganizationProfile` & `Capabilities` | High | Cannot configure business type or features | MB-01 | **Yes** (Goal of MB-01) | Create additive models and service methods |
| **TD-04** | Static Operator Navigation | Medium | All nav items visible to all orgs | MB-03 | No | Make `OperatorNav.tsx` capability-aware |
| **TD-05** | Lack of Structured Offers | Medium | Offers cannot be safely discounted | MB-05 | No | Create `offers` schema and evaluation engine |
| **TD-06** | Hardcoded Qwen Dental Query Instruction | Low | Embedding instruction references dental | MB-08 | No | Make query instruction configurable or generic |
| **TD-07** | Non-Booking Transaction Models Missing | Low | Cannot do e-commerce orders or quotes | MB-12 | No | Add `orders` and `quotes` tables |

---

## 23. MB-01 Readiness Evaluation

### Status: **READY TO PROCEED**
* **`MB01_READY:`** **YES**
* **Prerequisites Met:**
  - Baseline audit complete and verified against repository reality.
  - Multi-tenant RLS infrastructure verified.
  - Organization service and database schema analyzed.
  - Zero breaking changes required for MB-01 (additive schema only).
* **MB-01 Scope:**
  - Create `OrganizationProfile` (display name, legal name, logo, contact, timezone, currency).
  - Create `OrganizationCapabilities` (boolean capability flags + JSON settings).
  - Add API endpoints for profile & capability management.
  - Seed default capabilities for existing organizations.
