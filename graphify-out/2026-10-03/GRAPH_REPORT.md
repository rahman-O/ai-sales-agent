# Graph Report - AI Sales Agent  (2026-09-29)

## Corpus Check
- 578 files · ~264,917 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 19 file(s) not represented in the graph (top: (none) 4, .example 3, .zip 3)

## Summary
- 4408 nodes · 8196 edges · 286 communities (261 shown, 25 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 425 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f3e05319`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- @nestjs/common
- ai-sales-agent/README.md
- prisma.service.ts
- agent-core/src/ports.ts
- requirements-traceability.md
- bookings.service.ts
- master-plan.md
- scripts
- TenantContextService
- Phase 00 — Discovery and architecture validation
- blob-store.ts
- information-architecture.md
- Entity catalog
- organizations.service.ts
- agent-adapters/src/messaging/messaging-channel.ts
- api/src/messaging/messaging-channel.ts
- local-model-capability-search.ts
- api-principles.md
- MB-00 — Discovery & Baseline Architecture Audit
- agent-core/src/openai-compatible.ts
- ref_node_crypto
- dashboard.service.ts
- demo/seed.ts
- tool-executor.ts
- loadLocalEnv
- agent-adapters/package.json
- ActorContext
- knowledge/page.tsx
- booking-tools.ts
- AuthenticatedRequest
- real-llm-compat-probe.ts
- real-llm-path-b-e2e.ts
- hosted-acceptance.ts
- ConversationsController
- TenantTxClient
- run-conversation-agent.ts
- createSupabaseServerClient
- ref_node_path
- Phase 00 initial AI evaluation fixtures
- phase13-fault-matrix.test.ts
- organization.ts
- demo-scripted-provider.ts
- WhatsAppWebhookController
- .runInTenantContext
- web/package.json
- Journey log
- agent-core/package.json
- api/package.json
- BookingsService
- sources.md
- Documentation map
- embeddings/package.json
- reset-residual.test.ts
- lead-state.ts
- Phase 00 — Technical readiness report
- storage/package.json
- .runAsActor
- BookingsController
- knowledge.service.ts
- KnowledgeController
- LeadsController
- Phase 01 — Project foundation and tenant security
- Phase 02 — Core domain model
- Phase 03 — Durable customers and conversations
- Phase 04 — Bounded agent core and safe tools
- Phase 05 — Approved knowledge and RAG
- Phase 07 — Services, availability and safe booking
- Phase 08 — WhatsApp transport integration
- Phase 09 — Human takeover and safe resume
- Phase 10 — Consent-aware follow-up engine
- Phase 11 — Operational UI and dashboard
- Phase 12 — Usage, funnel and business outcomes
- Phase 13 — Security, performance and resilience validation
- Phase 14 — Pilot readiness and controlled launch
- Multi-Business Platform — Roadmap
- dependencies
- OffersService
- api/src/main.ts
- compilerOptions
- product-scope.md
- ref_node_child_process
- config/package.json
- config/src/index.ts
- agent.ts
- embeddings/src/ports.ts
- database-compatibility/package.json
- ConversationsService
- CustomersController
- ChannelsController
- Multi-Business AI Sales Platform — Planning Hub
- run-bakeoff.ts
- phase-06-leads-crm.md
- Domain Concepts
- contracts/package.json
- knowledge-chunking/package.json
- AgentController
- FollowUpsController
- packages_contracts_dist_index
- worker/package.json
- Requirements traceability
- Risk register
- Multi-Business Platform — Migration Strategy
- Core UX Principles
- analytics.service.ts
- CatalogController
- ConversationControlService
- .getDashboard
- compilerOptions
- Master implementation plan
- Phase 05 — Embedding bake-off (local Qwen)
- TemplatesService
- Separation of Concerns
- demo-docker.ts
- mixed-load.ts
- policies.ts
- Conversation ownership state machine
- Phase 03 closure evidence
- Phase 04 closure evidence
- Phase 09 — Closure report
- Multi-Business Platform — Target Architecture
- service-search.ts
- EmbedResult
- AgentService
- provider-simulator/package.json
- CustomersService
- value-objects.ts
- createSupabaseBrowserClient
- OperatorNav
- PoliciesService
- 12-decisions/README.md
- Local development plan
- Phase 00 ADR review
- Phase 00 security and threat review
- MB-01 — Organization Profile & Capabilities Implementation
- package.json
- execute-followup.ts
- compilerOptions
- valid-slot-booking-e2e.ts
- compilerOptions
- compilerOptions
- compilerOptions
- compilerOptions
- CatalogService
- next
- User journeys
- security-architecture.md
- Phase 08 — Closure report
- Multi-Business Platform — Architecture Decision Records
- MB-02 — Multi-Business Onboarding Implementation
- Multi-Business Platform — Risk Management & Mitigation
- Phase 00 closure report
- PoliciesController
- compilerOptions
- compilerOptions
- chunk-v1.ts
- path-b-demo.ts
- main
- compilerOptions
- Phase 04 — Scope manifest
- Phase 13 — Ops, security, observability, backup evidence
- P13 RESILIENCE + LOAD VALIDATION REPORT
- multi-business-platform/README.md
- LocalQwenEmbeddingProvider
- AI Sales Agent
- run.mjs
- catalog.ts
- dashboard/page.tsx
- ADR-006 — MessagingChannel boundary
- Phase 03 — Scope manifest
- attention.test.ts
- Phase 13 — Design lock
- Phase 00 decision register
- contracts/src/index.ts
- provision-supabase-test-user.ts
- scripts
- Phase 02 — Scope manifest
- dependencies
- Follow-up execution and suppression
- ADR-NNN — Decision title
- availability-slots.ts
- Phase 01 — Closure report
- Phase 05 — Local TEI operations
- Phase 06 — Closure report
- Phase 11 — Closure report
- FakeEmbeddingProvider
- Phase 13 closure
- Phase 13 — Discovery report
- PRE-P14 LOCAL MODEL CAPABILITY SEARCH
- PRE-P14 REAL LLM ZERO-COST STATUS
- analytics/page.tsx
- Options
- Phase 00 disposable database compatibility spike
- Phase 00 WhatsApp discovery record
- Phase 05 — Scope manifest
- Phase 05 — TEI operational baseline
- Phase 07 — Closure report
- Multi-Business Platform — Detailed Phase Breakdown
- phase05-knowledge.test.ts
- inbox/page.tsx
- channels/page.tsx
- offers.ts
- ADR-001 — Modular monolith
- ADR-002 — PostgreSQL as primary store
- ADR-003 — pgvector for approved knowledge
- ADR-004 — BullMQ with durable database intent
- ADR-005 — Backend-controlled tools
- ADR-008 — Shared schema with scoped commands and RLS
- ADR-009 — Internal booking authority
- ADR-010 — Explicit outbound uncertainty
- Phase 00 repository and documentation audit
- Phase 00 product boundary review
- Phase 00 multi-tenancy validation
- Phase 05 — Pre-migration review gate
- navigation.ts
- Phase 12 — Discovery report
- ZERO-COST LIVE DISCOVERY REPORT
- loadDemoCliEnv
- verify.ts
- devDependencies
- .get
- channels/[[...path]]/route.ts
- conversations/[[...path]]/route.ts
- follow-ups/[[...path]]/route.ts
- knowledge/[[...path]]/route.ts
- leads/[[...path]]/route.ts
- message-templates/[[...path]]/route.ts
- Tool tests
- Unit tests
- Webhook tests
- Phase 02 — Closure report
- PRE-P14 REAL LLM PATH B E2E STATUS
- validate_docs.py
- MB-03 — Dynamic Dashboard Navigation Implementation
- next-env.d.ts
- bookings/[[...path]]/route.ts
- knowledge-jobs.ts
- profile/route.ts
- OperatorNav.tsx
- Assumptions and decisions needed
- dependency-map.md
- whatsapp.md
- Phase 00 pilot metric dictionary
- Phase 07 — Scope manifest
- Phase 08 — Scope manifest
- Phase 10 — Scope manifest
- src/server.ts
- MB-06 — Business Policies Implementation
- dependencies
- devDependencies
- Disposable database compatibility spike
- tei-ops-baseline.sh
- rules/graphify.md
- workflows/graphify.md
- AGENTS.md
- phase-03-pre-migration-gate.md
- in-image-inspect.sh
- tei-compose.sh
- RunStorePort
- Phase 05 — Closure report
- compilerOptions
- agent-adapters/src/index.ts
- offers/page.tsx
- Phase 06 — Lead management and qualification
- MB-15 — External / Live Provider Acceptance
- Phase 10 — Closure report
- Lead
- PoliciesPage
- MB-15A Meta Simulator Acceptance Evidence
- react
- MB-04 — Generic Business Catalog Implementation
- db-provision-runtime-role.ts
- catalog/[[...path]]/route.ts
- offers/[[...path]]/route.ts
- policies/[[...path]]/route.ts
- templates/page.tsx
- schedule/[[...path]]/route.ts
- Phase 13 — Findings register
- 4. Organization Model Audit
- BACKUP-RESTORE.md
- ENVIRONMENTS.md
- INCIDENT-RUNBOOK.md
- SECURITY-CHECKLIST.md

## God Nodes (most connected - your core abstractions)
1. `ActorContext` - 157 edges
2. `AuthenticatedRequest` - 131 edges
3. `@nestjs/common` - 69 edges
4. `scripts` - 54 edges
5. `TenantContextService` - 49 edges
6. `createSupabaseServerClient()` - 45 edges
7. `Entity catalog` - 39 edges
8. `TenantTxClient` - 37 edges
9. `next` - 32 edges
10. `BookingsService` - 31 edges

## Surprising Connections (you probably didn't know these)
- `Security review` --references--> `AuthModule`  [INFERRED]
  docs/ai-sales-agent/14-roadmap/phase-02-closure.md → apps/api/src/auth/auth.module.ts
- `Layer ownership (P01 reconciliation)` --references--> `JwtVerifierService`  [INFERRED]
  docs/ai-sales-agent/07-api/auth-api.md → apps/api/src/auth/jwt-verifier.service.ts
- `Harness fixes applied during closure` --references--> `createAppPool()`  [INFERRED]
  docs/ai-sales-agent/14-roadmap/phase-03-closure.md → apps/api/src/database/pg-pool.ts
- `Persistence, authorization and evidence` --references--> `TenantContextService`  [INFERRED]
  docs/ai-sales-agent/14-roadmap/phase-02-scope-manifest.md → apps/api/src/database/tenant-context.service.ts
- `Lead invariants (locked)` --references--> `deriveQualificationState()`  [INFERRED]
  docs/ai-sales-agent/14-roadmap/phase-06-scope-manifest.md → apps/api/src/domain/lead-state.ts

## Import Cycles
- None detected.

## Communities (286 total, 25 thin omitted)

### Community 0 - "@nestjs/common"
Cohesion: 0.06
Nodes (45): AnalyticsModule, Module, AuthGuard, Injectable, AuthModule, Module, BookingsModule, Module (+37 more)

### Community 1 - "ai-sales-agent/README.md"
Cohesion: 0.05
Nodes (22): Problem statement, Terminology, Container architecture, Domain model, Value objects, Model provider abstraction, Tool execution loop, Future integrations (+14 more)

### Community 2 - "prisma.service.ts"
Cohesion: 0.05
Nodes (29): AuthController, Controller, AuthService, Injectable, JwtVerifierService, Injectable, VerifiedIdentity, ConfigModule (+21 more)

### Community 3 - "agent-core/src/ports.ts"
Cohesion: 0.07
Nodes (39): AGENT_DECISION_CONTRACT, buildContextMessages(), formatOrganizationContextBlock(), formatWorkingStateBlock(), POLICY_BLOCK_FOR_TEST, WORKFLOW_GUIDANCE, FakeScenario, parseAgentDecision() (+31 more)

### Community 4 - "requirements-traceability.md"
Cohesion: 0.05
Nodes (31): Agent architecture, Observability and explainability, Durable ordering authority, Queue and conversation concurrency, Worker ownership, Knowledge ingestion and retrieval, Agent runtime, Context builder (+23 more)

### Community 5 - "bookings.service.ts"
Cohesion: 0.05
Nodes (43): enumerateDates(), secToTime(), ServiceRow, timeToSec(), apps_api_src_domain_booking_time_applyexceptionstoday, apps_api_src_domain_booking_time_formatlocaldateinzone, apps_api_src_domain_booking_time_formatlocaltimeinzone, apps_api_src_domain_booking_time_intervalcontained (+35 more)

### Community 6 - "master-plan.md"
Cohesion: 0.10
Nodes (8): Testing strategy, AI risks, Product risks, Technical risks, Future roadmap, Phase 12 — Metric definitions lock, Phase closure evidence template, Roadmap navigation

### Community 7 - "scripts"
Cohesion: 0.04
Nodes (54): scripts, auth:provision-test-user, bakeoff:embeddings, build, db:migrate, db:provision-runtime-role, db:reset:test, db:seed (+46 more)

### Community 8 - "TenantContextService"
Cohesion: 0.08
Nodes (18): ALLOWED_TOOL_SET, DEFAULT_ALLOWLIST, EvalFixture, AGENT_EVAL_FIXTURES, MemberRow, PAUSE_REASON_CODES, PauseReasonCode, ConversationEventsHub (+10 more)

### Community 9 - "Phase 00 — Discovery and architecture validation"
Cohesion: 0.10
Nodes (20): 10. Business Rules, 11. Implementation Tasks, 12. Testing Requirements, 13. Observability Requirements, 14. Security Considerations, 15. Acceptance Criteria, 16. Exit Criteria, 17. Dependencies (+12 more)

### Community 10 - "blob-store.ts"
Cohesion: 0.12
Nodes (16): Local development, Production (required), Storage integration, ALLOWED_MIME, assertTenantObjectKey(), BlobObjectMeta, BlobStore, BlobStoreError (+8 more)

### Community 11 - "information-architecture.md"
Cohesion: 0.05
Nodes (30): Frontend architecture, Acceptance, Agent settings, Data and failure behavior, Purpose and interaction, Acceptance, Analytics workspace, Data and failure behavior (+22 more)

### Community 12 - "Entity catalog"
Cohesion: 0.05
Nodes (39): AgentConfig, AgentRun, AuditLog, AvailabilityOverride, Booking, BookingHistory, BookingProposal, ChannelConnection (+31 more)

### Community 13 - "organizations.service.ts"
Cohesion: 0.09
Nodes (25): CapabilityCard(), OnboardingPage(), STEP_TITLES, StepNumber, packages_contracts_dist_index_addmemberrequest, packages_contracts_dist_index_business_type_presets, packages_contracts_dist_index_completeonboardingresponse, packages_contracts_dist_index_createorganizationrequest (+17 more)

### Community 14 - "agent-adapters/src/messaging/messaging-channel.ts"
Cohesion: 0.09
Nodes (32): ALLOWED, canTransitionDelivery(), contentDigest(), DeliveryState, evaluateFreeFormWindow(), META_WHATSAPP_PROVIDER, NormalizedInboundMessage, NormalizedStatusEvent (+24 more)

### Community 15 - "api/src/messaging/messaging-channel.ts"
Cohesion: 0.06
Nodes (41): apps_api_src_messaging_meta_whatsapp_channel_metawhatsappchannel, SYSTEM_ACTOR, Injectable, WhatsAppWebhookService, owner, runtime, ClaimRow, packages_agent_adapters_dist_index (+33 more)

### Community 16 - "local-model-capability-search.ts"
Cohesion: 0.10
Nodes (33): aggregate(), approxFreeGb(), ARABIC_UTTERANCES, Attempt, BASE_URL, Candidate, CandidateReport, CANDIDATES (+25 more)

### Community 17 - "api-principles.md"
Cohesion: 0.06
Nodes (26): Agent and run API, Authority and base, Contracts, Invariants, failure and verification, API principles, Authentication API, Authority and base, Invariants, failure and verification (+18 more)

### Community 18 - "MB-00 — Discovery & Baseline Architecture Audit"
Cohesion: 0.06
Nodes (32): 11. Context Builder Audit, 12. Working State Audit, 13. Knowledge / RAG Audit, 14. Frontend / Dashboard Audit, 15. Onboarding Audit, 16. Conversation Style Audit, 17. Offer / Promotion Audit, 18. Order / Quote / Inventory Audit (+24 more)

### Community 19 - "agent-core/src/openai-compatible.ts"
Cohesion: 0.16
Nodes (24): assertDummyKeyLoopbackSafe(), DEEPSEEK_LIMIT_DEFAULTS, isApprovedDockerOllamaBaseUrl(), isApprovedLoopbackBaseUrl(), isDummyModelApiKey(), LOCAL_DEMO_LIMIT_DEFAULTS, LOOPBACK_HOSTS, ModelFitInput (+16 more)

### Community 20 - "ref_node_crypto"
Cohesion: 0.04
Nodes (60): DETECTION_DRILLS, Drill, createAppPool(), isHostedSupabaseUrl(), sanitizeDatabaseUrl(), domainEvent(), DomainEventEnvelope, apps_api_src_messaging_fake_channel_contentdigest (+52 more)

### Community 21 - "dashboard.service.ts"
Cohesion: 0.18
Nodes (18): DERIVATIVE_TYPES, MemberRow, ATTENTION_DERIVATIVE_CAP_WHEN_CHANNEL_UNHEALTHY, ATTENTION_GLOBAL_CAP, ATTENTION_PER_TYPE_CAP, AttentionSeverity, AttentionType, DashboardAttentionItem (+10 more)

### Community 22 - "demo/seed.ts"
Cohesion: 0.17
Nodes (21): normalizeContact(), digestText(), DEMO_CATALOG_ITEM_IDS, DEMO_CHANNEL_ID, DEMO_CUSTOMER_COUNT, DEMO_LOCATION_ID, DEMO_META_SIMULATOR_CHANNEL_ID, DEMO_META_SIMULATOR_PHONE_NUMBER_ID (+13 more)

### Community 23 - "tool-executor.ts"
Cohesion: 0.15
Nodes (24): enforcePolicy(), toolCancelBooking(), toolGetBookings(), toolRescheduleBooking(), activity(), AI_TRANSITIONS, deriveQualification(), dto() (+16 more)

### Community 24 - "loadLocalEnv"
Cohesion: 0.11
Nodes (13): main(), main(), DEMO_LOCAL_DB_SKIP_FROM_ENV_LOCAL, ENV_FILE_SKIP_KEYS, loadLocalEnv(), parseFile(), pool, createPgPool() (+5 more)

### Community 25 - "agent-adapters/package.json"
Cohesion: 0.07
Nodes (28): dependencies, @ai-sales-agent/agent-core, @ai-sales-agent/contracts, @ai-sales-agent/embeddings, pg, devDependencies, @types/node, @types/pg (+20 more)

### Community 26 - "ActorContext"
Cohesion: 0.24
Nodes (3): ActorContext, OrganizationsService, Injectable

### Community 27 - "knowledge/page.tsx"
Cohesion: 0.40
Nodes (3): Doc, KnowledgePage(), uploadAndFinalize()

### Community 28 - "booking-tools.ts"
Cohesion: 0.18
Nodes (25): applyExceptionsToDay(), formatLocalDateInZone(), formatLocalTimeInZone(), intervalContained(), isExplicitBookingConfirmation(), isoDayOfWeekInZone(), localToUtcCandidates(), LocalWindow (+17 more)

### Community 29 - "AuthenticatedRequest"
Cohesion: 0.24
Nodes (11): AuthenticatedRequest, OrganizationsController, Body, Controller, Get, Headers, Param, Patch (+3 more)

### Community 30 - "real-llm-compat-probe.ts"
Cohesion: 0.13
Nodes (28): evaluateHardwareFit(), AgentDecisionSchema, BASE_URL, chatCompletions(), __dirname, ensureOllamaInstalled(), ensureOllamaServing(), listOllamaModels() (+20 more)

### Community 31 - "real-llm-path-b-e2e.ts"
Cohesion: 0.15
Nodes (26): api(), apiBase(), asList(), assertRealProvider(), assertSafetyGates(), countRuns(), __dirname, ensureAgentConfig() (+18 more)

### Community 32 - "hosted-acceptance.ts"
Cohesion: 0.14
Nodes (20): supabaseIssuer(), supabaseJwksUrl(), ClassifiedEnv, classifyEnv(), classifyValue(), EnvClass, EXAMPLE_MARKERS, humanActionRequired() (+12 more)

### Community 33 - "ConversationsController"
Cohesion: 0.22
Nodes (12): ConversationsController, DevMessagingController, Body, Controller, Get, Headers, Param, Post (+4 more)

### Community 34 - "TenantTxClient"
Cohesion: 0.23
Nodes (4): TenantTxClient, deriveQualificationState(), LeadsService, Injectable

### Community 35 - "run-conversation-agent.ts"
Cohesion: 0.14
Nodes (23): applySelectiveToolWriteBack(), clearWorkingState(), extractSlotTokenExpiry(), loadWorkingState(), upsertWorkingStateCAS(), WorkingStateRecord, createPgRunStore(), ensureActiveAgentConfig() (+15 more)

### Community 36 - "createSupabaseServerClient"
Cohesion: 0.16
Nodes (15): GET(), GET(), GET(), proxy(), GET(), GET(), proxy(), POST() (+7 more)

### Community 37 - "ref_node_path"
Cohesion: 0.10
Nodes (14): ref_node_fs, ref_node_path, ref_prisma, owner, runtime, kept, lines, outLines (+6 more)

### Community 38 - "Phase 00 initial AI evaluation fixtures"
Cohesion: 0.10
Nodes (22): E00-001 — Service price, E00-002 — Doctor availability, E00-003 — Vague Iraqi time, E00-004 — Relative reference, E00-005 — Switch services, E00-006 — Discount request, E00-007 — Unsupported price, E00-008 — Create booking (+14 more)

### Community 39 - "phase13-fault-matrix.test.ts"
Cohesion: 0.20
Nodes (7): CRASH_MATRIX, CrashBoundary, DispatchClass, ExpectedSemantics, ProviderOutcome, REDIS_RUNTIME_LOSS_POLICY, REDIS_STARTUP_POLICY

### Community 40 - "organization.ts"
Cohesion: 0.10
Nodes (24): 4. API Specification, 5. Validation Rules, Endpoints, Contracts (`packages/contracts/src/organization.ts`), BUSINESS_TYPE_PRESETS, BusinessTypePreset, CompleteOnboardingResponse, DEFAULT_ORGANIZATION_CAPABILITIES (+16 more)

### Community 41 - "demo-scripted-provider.ts"
Cohesion: 0.15
Nodes (16): DEMO_SCENARIO_VERSION, DemoScenarioId, DemoScriptContext, extractSlotTokenFromStructuredGetAvailableSlots(), isZeroCostDemoScriptedEnabled(), MARKERS, normalizeDemoInbound(), resolveDemoScenario() (+8 more)

### Community 42 - "WhatsAppWebhookController"
Cohesion: 0.17
Nodes (8): Controller, Get, Headers, Post, Query, Req, WhatsAppWebhookController, HttpCode

### Community 44 - "web/package.json"
Cohesion: 0.09
Nodes (22): devDependencies, @types/node, @types/react, @types/react-dom, typescript, @ai-sales-agent/config, @ai-sales-agent/contracts, @supabase/supabase-js (+14 more)

### Community 45 - "Journey log"
Cohesion: 0.09
Nodes (22): AI_EMERGENCY_KILL, AI_ORCHESTRATION, AI_PAUSE_FENCE, ANALYTICS, AVAILABILITY_AND_BOOKING, CONFLICT_PROTECTION, DASHBOARD, DEDUPE (+14 more)

### Community 46 - "agent-core/package.json"
Cohesion: 0.09
Nodes (22): dependencies, @ai-sales-agent/contracts, zod, devDependencies, @types/node, typescript, exports, @ai-sales-agent/contracts (+14 more)

### Community 47 - "api/package.json"
Cohesion: 0.09
Nodes (21): @ai-sales-agent/agent-adapters, @ai-sales-agent/agent-core, @ai-sales-agent/config, @ai-sales-agent/contracts, @ai-sales-agent/embeddings, @ai-sales-agent/knowledge-chunking, @ai-sales-agent/storage, pg (+13 more)

### Community 48 - "BookingsService"
Cohesion: 0.19
Nodes (3): BookingsService, pickNearest(), Injectable

### Community 49 - "sources.md"
Cohesion: 0.12
Nodes (10): External source register, Multi-tenancy architecture, Booking state machine (P07), Booking source of truth and calendar boundary, Tenant isolation enforcement, Consistency review, Limits and next validation, Planning package validation (+2 more)

### Community 50 - "Documentation map"
Cohesion: 0.09
Nodes (22): 00-overview — Vision, scope, assumptions and external sources, 01-mind-map — System mind map, journeys and dependencies, 02-architecture — Runtime boundaries, tenancy, security and observability, 03-domain — Entities, aggregates, events and state machines, 04-agent — Bounded runtime, tools, memory, guardrails and evaluation, 05-integrations — WhatsApp, webhooks, booking and storage contracts, 06-data — Schema plan, constraints, isolation and lifecycle, 07-api — Staff, agent and webhook API contracts (+14 more)

### Community 51 - "embeddings/package.json"
Cohesion: 0.09
Nodes (21): dependencies, @ai-sales-agent/config, devDependencies, @types/node, typescript, exports, @ai-sales-agent/config, @types/node (+13 more)

### Community 52 - "reset-residual.test.ts"
Cohesion: 0.22
Nodes (16): assertLocalDemoDb(), isApprovedLocalDemoHost(), LocalDemoGateResult, LOOPBACK, parseDbHost(), requireLocalDemoDb(), DEMO_ORG_ID, DEMO_ORG_NAME (+8 more)

### Community 53 - "lead-state.ts"
Cohesion: 0.11
Nodes (24): AI_ALLOWED_TRANSITIONS, ARCHIVED_REASON_CODES, ArchivedReasonCode, DISQUALIFIED_REASON_CODES, DisqualifiedReasonCode, HUMAN_ALLOWED_TRANSITIONS, isArchivedReason(), isDisqualifiedReason() (+16 more)

### Community 54 - "Phase 00 — Technical readiness report"
Cohesion: 0.10
Nodes (21): 10. Booking concurrency evidence, 11. Prisma / custom migration findings, 12. Dependency security audit findings, 13. Authentication architecture result, 14. Authentication provider integration result, 15. Background-job tenant strategy, 16. ADR changes, 17. Remaining technical risks (+13 more)

### Community 55 - "storage/package.json"
Cohesion: 0.10
Nodes (20): dependencies, @supabase/supabase-js, devDependencies, tsx, typescript, exports, @supabase/supabase-js, tsx (+12 more)

### Community 56 - ".runAsActor"
Cohesion: 0.11
Nodes (11): counts(), Body, Get, Headers, Post, Req, UseGuards, FollowUpsService (+3 more)

### Community 57 - "BookingsController"
Cohesion: 0.27
Nodes (9): BookingsController, Body, Controller, Get, Param, Post, Query, Req (+1 more)

### Community 58 - "knowledge.service.ts"
Cohesion: 0.13
Nodes (17): ChunkRow, DocWithVersions, KNOWLEDGE_EVENT_CHUNK, KNOWLEDGE_EVENT_CLEANUP, KNOWLEDGE_EVENT_EMBED, KNOWLEDGE_EVENT_EXTRACT, searchKnowledgeChunks(), sha256() (+9 more)

### Community 59 - "KnowledgeController"
Cohesion: 0.24
Nodes (9): KnowledgeController, Body, Controller, Get, Param, Post, Req, UseGuards (+1 more)

### Community 60 - "LeadsController"
Cohesion: 0.24
Nodes (10): LeadsController, Body, Controller, Get, Param, Patch, Post, Query (+2 more)

### Community 61 - "Phase 01 — Project foundation and tenant security"
Cohesion: 0.10
Nodes (20): 10. Business Rules, 11. Implementation Tasks, 12. Testing Requirements, 13. Observability Requirements, 14. Security Considerations, 15. Acceptance Criteria, 16. Exit Criteria, 17. Dependencies (+12 more)

### Community 62 - "Phase 02 — Core domain model"
Cohesion: 0.10
Nodes (20): 10. Business Rules, 11. Implementation Tasks, 12. Testing Requirements, 13. Observability Requirements, 14. Security Considerations, 15. Acceptance Criteria, 16. Exit Criteria, 17. Dependencies (+12 more)

### Community 63 - "Phase 03 — Durable customers and conversations"
Cohesion: 0.10
Nodes (20): 10. Business Rules, 11. Implementation Tasks, 12. Testing Requirements, 13. Observability Requirements, 14. Security Considerations, 15. Acceptance Criteria, 16. Exit Criteria, 17. Dependencies (+12 more)

### Community 64 - "Phase 04 — Bounded agent core and safe tools"
Cohesion: 0.10
Nodes (20): 10. Business Rules, 11. Implementation Tasks, 12. Testing Requirements, 13. Observability Requirements, 14. Security Considerations, 15. Acceptance Criteria, 16. Exit Criteria, 17. Dependencies (+12 more)

### Community 65 - "Phase 05 — Approved knowledge and RAG"
Cohesion: 0.10
Nodes (20): 10. Business Rules, 11. Implementation Tasks, 12. Testing Requirements, 13. Observability Requirements, 14. Security Considerations, 15. Acceptance Criteria, 16. Exit Criteria, 17. Dependencies (+12 more)

### Community 66 - "Phase 07 — Services, availability and safe booking"
Cohesion: 0.10
Nodes (20): 10. Business Rules, 11. Implementation Tasks, 12. Testing Requirements, 13. Observability Requirements, 14. Security Considerations, 15. Acceptance Criteria, 16. Exit Criteria, 17. Dependencies (+12 more)

### Community 67 - "Phase 08 — WhatsApp transport integration"
Cohesion: 0.10
Nodes (20): 10. Business Rules, 11. Implementation Tasks, 12. Testing Requirements, 13. Observability Requirements, 14. Security Considerations, 15. Acceptance Criteria, 16. Exit Criteria, 17. Dependencies (+12 more)

### Community 68 - "Phase 09 — Human takeover and safe resume"
Cohesion: 0.10
Nodes (20): 10. Business Rules, 11. Implementation Tasks, 12. Testing Requirements, 13. Observability Requirements, 14. Security Considerations, 15. Acceptance Criteria, 16. Exit Criteria, 17. Dependencies (+12 more)

### Community 69 - "Phase 10 — Consent-aware follow-up engine"
Cohesion: 0.10
Nodes (20): 10. Business Rules, 11. Implementation Tasks, 12. Testing Requirements, 13. Observability Requirements, 14. Security Considerations, 15. Acceptance Criteria, 16. Exit Criteria, 17. Dependencies (+12 more)

### Community 70 - "Phase 11 — Operational UI and dashboard"
Cohesion: 0.10
Nodes (20): 10. Business Rules, 11. Implementation Tasks, 12. Testing Requirements, 13. Observability Requirements, 14. Security Considerations, 15. Acceptance Criteria, 16. Exit Criteria, 17. Dependencies (+12 more)

### Community 71 - "Phase 12 — Usage, funnel and business outcomes"
Cohesion: 0.10
Nodes (20): 10. Business Rules, 11. Implementation Tasks, 12. Testing Requirements, 13. Observability Requirements, 14. Security Considerations, 15. Acceptance Criteria, 16. Exit Criteria, 17. Dependencies (+12 more)

### Community 72 - "Phase 13 — Security, performance and resilience validation"
Cohesion: 0.10
Nodes (20): 10. Business Rules, 11. Implementation Tasks, 12. Testing Requirements, 13. Observability Requirements, 14. Security Considerations, 15. Acceptance Criteria, 16. Exit Criteria, 17. Dependencies (+12 more)

### Community 73 - "Phase 14 — Pilot readiness and controlled launch"
Cohesion: 0.10
Nodes (20): 10. Business Rules, 11. Implementation Tasks, 12. Testing Requirements, 13. Observability Requirements, 14. Security Considerations, 15. Acceptance Criteria, 16. Exit Criteria, 17. Dependencies (+12 more)

### Community 74 - "Multi-Business Platform — Roadmap"
Cohesion: 0.11
Nodes (19): Current System Mapping, MB-00 — Discovery & Baseline Audit, MB-01 — Organization Profile + Capabilities, MB-02 — Multi-Business Onboarding, MB-04 — Generic Business Catalog, MB-05 — Offers / Promotions, MB-06 — Business Policies, MB-07 — Conversation Style & Assistant Personality (+11 more)

### Community 75 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, @ai-sales-agent/agent-adapters, @ai-sales-agent/agent-core, @ai-sales-agent/config, @ai-sales-agent/contracts, @ai-sales-agent/embeddings, @ai-sales-agent/knowledge-chunking, @ai-sales-agent/storage (+11 more)

### Community 76 - "OffersService"
Cohesion: 0.15
Nodes (12): OffersController, Body, Controller, Get, Param, Patch, Post, Query (+4 more)

### Community 77 - "api/src/main.ts"
Cohesion: 0.17
Nodes (9): AppModule, Module, demoLocalPath, root, packages_config_dist_index, packages_config_dist_index_loadlocalenv, packages_config_dist_index_loadserverenv, @nestjs/core (+1 more)

### Community 78 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 79 - "product-scope.md"
Cohesion: 0.11
Nodes (11): MVP, Pilot, Product scope, Production, Vision, Product capabilities, Data architecture, Domain events (+3 more)

### Community 80 - "ref_node_child_process"
Cohesion: 0.13
Nodes (12): ref_node_child_process, ref_node_url, here, root, inspectImage(), main(), run(), smokeBoot() (+4 more)

### Community 81 - "config/package.json"
Cohesion: 0.11
Nodes (18): dependencies, zod, devDependencies, typescript, exports, typescript, zod, main (+10 more)

### Community 82 - "config/src/index.ts"
Cohesion: 0.13
Nodes (13): DEMO_LOCAL_DB_SKIP_FROM_ENV_LOCAL, ENV_FILE_SKIP_KEYS, loadLocalEnv(), loadServerEnv(), MigrationEnv, migrationEnvSchema, nodeEnv, parseEnvFile() (+5 more)

### Community 83 - "agent.ts"
Cohesion: 0.09
Nodes (22): AgentDecision, AgentDecisionType, AgentRunTerminalStatus, ALL_REGISTERED_TOOL_NAMES, FinalResponseDecision, MB05_TOOL_NAMES, MB05ToolName, MB06_TOOL_NAMES (+14 more)

### Community 84 - "embeddings/src/ports.ts"
Cohesion: 0.18
Nodes (14): LocalQwenConfig, resolveEmbeddingProvider(), TeiInfo, ACCEPTED_EMBEDDING_PROFILE, assertNormalizedEmbedding(), CANDIDATE_EMBEDDING_PROFILE, EmbeddingErrorCode, EmbeddingProfile (+6 more)

### Community 85 - "database-compatibility/package.json"
Cohesion: 0.11
Nodes (18): dependencies, pg, @prisma/adapter-pg, @prisma/client, devDependencies, prisma, pg, prisma (+10 more)

### Community 86 - "ConversationsService"
Cohesion: 0.22
Nodes (4): ConversationsService, decodeCursor(), encodeCursor(), Injectable

### Community 87 - "CustomersController"
Cohesion: 0.24
Nodes (10): CustomersController, Body, Controller, Get, Param, Patch, Post, Query (+2 more)

### Community 88 - "ChannelsController"
Cohesion: 0.27
Nodes (9): ChannelsController, Body, Controller, Get, Param, Patch, Post, Req (+1 more)

### Community 89 - "Multi-Business AI Sales Platform — Planning Hub"
Cohesion: 0.20
Nodes (10): FollowUp, Scope delivered, Multi-Business AI Sales Platform — Planning Hub, Status Tracker, What Is Explicitly NOT Being Redesigned, What Is This Initiative?, What Stays Reusable (No Redesign), What Will Become Generic / Configurable (+2 more)

### Community 90 - "run-bakeoff.ts"
Cohesion: 0.18
Nodes (13): ACCEPTANCE, casesFor(), GOLDEN_CASES, GOLDEN_DOCUMENTS, GoldenCase, GoldenDocument, LangSlice, calibrateMaxDistance() (+5 more)

### Community 91 - "phase-06-leads-crm.md"
Cohesion: 0.08
Nodes (16): Backend architecture, Aggregates and transaction boundaries, Lead state machine (P06), Booking commands (P07), Control and follow-up, Customer and lead commands, Read tools, Tool contracts (+8 more)

### Community 92 - "Domain Concepts"
Cohesion: 0.07
Nodes (27): AgentConfig (EXISTING), Booking (EXISTING), BusinessPolicy (EXISTING — IMPLEMENTED in MB-06), CatalogItem / Service Specialization (IMPLEMENTED — MB-04), Conversation / ConversationWorkingState (EXISTING), ConversationProfile (Embedded in Organization — MB-07), Customer (EXISTING), Domain Concepts (+19 more)

### Community 93 - "contracts/package.json"
Cohesion: 0.11
Nodes (17): dependencies, zod, devDependencies, typescript, exports, typescript, zod, main (+9 more)

### Community 94 - "knowledge-chunking/package.json"
Cohesion: 0.11
Nodes (17): devDependencies, tsx, typescript, exports, tsx, typescript, main, name (+9 more)

### Community 95 - "AgentController"
Cohesion: 0.25
Nodes (9): AgentController, Body, Controller, Get, Param, Post, Query, Req (+1 more)

### Community 96 - "FollowUpsController"
Cohesion: 0.21
Nodes (11): FollowUpsController, Body, Controller, Get, Headers, Param, Patch, Post (+3 more)

### Community 97 - "packages_contracts_dist_index"
Cohesion: 0.06
Nodes (36): now, bookingTypes, packages_contracts_dist_index, packages_contracts_dist_index_business_policy_statuses, packages_contracts_dist_index_business_policy_types, packages_contracts_dist_index_businesspolicydto, packages_contracts_dist_index_businesspolicystatus, packages_contracts_dist_index_businesspolicytype (+28 more)

### Community 98 - "worker/package.json"
Cohesion: 0.05
Nodes (38): dependencies, @ai-sales-agent/agent-adapters, @ai-sales-agent/agent-core, @ai-sales-agent/config, @ai-sales-agent/embeddings, @ai-sales-agent/knowledge-chunking, @ai-sales-agent/storage, bullmq (+30 more)

### Community 99 - "Requirements traceability"
Cohesion: 0.12
Nodes (17): Accurate prices, slots and confirmed bookings, Arabic, ambiguity, unsupported requests and model failures, Bounded model loop and backend-controlled tools, Channel-independent messaging and WhatsApp, Consent-aware follow-ups, Conversation FIFO, fencing and durable recovery, Customer/lead qualification and state, Funnel attendance and actual revenue (+9 more)

### Community 100 - "Risk register"
Cohesion: 0.12
Nodes (16): R01 — Cross-tenant data exposure, R02 — Duplicate or conflicting business actions, R03 — False success or invented price, R04 — Provider onboarding delays or policy mismatch, R05 — Existing calendar remains authoritative, R06 — Takeover race sends stale AI text, R07 — Prompt injection or poisoned knowledge, R08 — Sensitive clinic data collected without approved policy (+8 more)

### Community 101 - "Multi-Business Platform — Migration Strategy"
Cohesion: 0.12
Nodes (15): 1. Core Migration Principles, 2. Database Migration Sequencing, 3. Runtime & AI Context Migration, 4. Demo Fixtures & Seed Data Migration, 5. Frontend & Dynamic Dashboard Migration, 6. Rollback & Disaster Recovery Strategy, 7. Verification & Acceptance Gates, Context Builder Compatibility (+7 more)

### Community 102 - "Core UX Principles"
Cohesion: 0.12
Nodes (15): 10. Arabic/RTL Compatibility, 1. Progressive Disclosure, 2. Strong Defaults, 3. Save-and-Resume Onboarding, 4. No Technical Capability Names, 5. Dynamic Dashboard, 6. Preview Before Activation, 7. Explain Missing Setup (+7 more)

### Community 103 - "analytics.service.ts"
Cohesion: 0.18
Nodes (9): AnalyticsController, Controller, UseGuards, AnalyticsService, Group, Injectable, AnalyticsRange, parseAnalyticsRange() (+1 more)

### Community 104 - "CatalogController"
Cohesion: 0.23
Nodes (10): CatalogController, Body, Controller, Get, Param, Patch, Post, Query (+2 more)

### Community 105 - "ConversationControlService"
Cohesion: 0.39
Nodes (3): ConversationControlService, ownershipChanged(), Injectable

### Community 106 - ".getDashboard"
Cohesion: 0.16
Nodes (9): DashboardController, Controller, Get, Param, Req, UseGuards, DashboardService, Injectable (+1 more)

### Community 107 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, module, moduleResolution, outDir (+6 more)

### Community 108 - "Master implementation plan"
Cohesion: 0.13
Nodes (15): Actual completed sequence, Complete phase list and relative complexity, Critical path, Current readiness, Current regression baseline, Deferred scope, Dependency graph, Implementation order (+7 more)

### Community 109 - "Phase 05 — Embedding bake-off (local Qwen)"
Cohesion: 0.13
Nodes (14): ABSTENTION (held-out, frozen maxDistance), ACCEPTANCE CRITERIA (predeclared), BLOCKERS, By slice, Cases (sample), EXTERNAL DATA EGRESS, FAILURE EXAMPLES, FAKE PROVIDER PRODUCTION POLICY (+6 more)

### Community 110 - "TemplatesService"
Cohesion: 0.15
Nodes (11): TemplatesController, Body, Controller, Get, Param, Patch, Post, Req (+3 more)

### Community 111 - "Separation of Concerns"
Cohesion: 0.14
Nodes (14): Booking, 1. Business Identity / Profile, 2. Capabilities, 3. Structured Truth (Backend-Authoritative), 4. Knowledge / RAG, 5. Conversation Style, 6. Operational Working State, 8. Transaction State (+6 more)

### Community 112 - "demo-docker.ts"
Cohesion: 0.25
Nodes (13): ref_node_net, checkPortsForUp(), COMPOSE_FILE, composeArgs(), DEMO_PORTS, ensureEnv(), ENV_FILE, main() (+5 more)

### Community 113 - "mixed-load.ts"
Cohesion: 0.25
Nodes (12): AssumptionTag, DB_POOL_PROFILE, LOAD_DATASET_PROFILE, LOAD_TRAFFIC_PROFILE, LoadDatasetProfile, summarizeLoadLock(), concurrencyExactOne(), main() (+4 more)

### Community 114 - "policies.ts"
Cohesion: 0.08
Nodes (19): AdvanceNoticePolicyRulesSchema, BUSINESS_POLICY_STATUSES, BUSINESS_POLICY_TYPES, BusinessPolicyDto, BusinessPolicyStatus, BusinessPolicyStatusSchema, BusinessPolicyType, BusinessPolicyTypeSchema (+11 more)

### Community 115 - "Conversation ownership state machine"
Cohesion: 0.15
Nodes (11): AI eligibility cursor, Canonical modes (P09), Conversation ownership state machine, Handoff, Public API, Send race / authority epoch, Control (CAS = `expectedOwnershipEpoch`), Conversation API (+3 more)

### Community 116 - "Phase 03 closure evidence"
Cohesion: 0.15
Nodes (13): ADR-011 hosted security proof, Database runtime identity (hosted), Environment loading, Harness fixes applied during closure, Hosted acceptance (`npm run test:hosted`), P01 / P02 / P03 regression, P03 hosted migration, Phase 03 closure evidence (+5 more)

### Community 117 - "Phase 04 closure evidence"
Cohesion: 0.18
Nodes (10): Database runtime identity (hosted), Environment loading, Hosted acceptance (`npm run test:hosted`), P01 / P02 / P03 / P04 regression, P04 hosted migration, Phase 04 closure evidence, PHASE 04 STATUS, Quality gates (+2 more)

### Community 118 - "Phase 09 — Closure report"
Cohesion: 0.15
Nodes (11): Gate results, P10_AUTHORIZED, Phase 09 — Closure report, PHASE 09 STATUS: CLOSED, REMAINING BLOCKERS, Scope delivered, STOP, TECHNICALLY_READY_FOR_P10 (+3 more)

### Community 119 - "Multi-Business Platform — Target Architecture"
Cohesion: 0.14
Nodes (13): Anti-Pattern: Business-Type Branching, Architecture Layers, Context Builder Evolution, Current (Dental-Hardcoded), Current Tool Registry, Deployment Architecture (Unchanged), Future Tool Registry Evolution, MB-06 Policy Architecture (+5 more)

### Community 120 - "service-search.ts"
Cohesion: 0.26
Nodes (9): CANONICAL_ALIASES_BY_NAME_PATTERN, GENERIC_STOP_WORDS, matchServices(), normalizeSearchText(), ServiceRow, DEMO_SERVICES, scripts_demo_constants_demo_customer_id, main() (+1 more)

### Community 121 - "EmbedResult"
Cohesion: 0.24
Nodes (6): assertNotFakeInProduction(), OpenAiCompatibleEmbeddingConfig, OpenAiCompatibleEmbeddingProvider, resolveProductionEmbeddingProvider(), EmbeddingProvider, EmbedResult

### Community 122 - "AgentService"
Cohesion: 0.30
Nodes (3): AgentService, loadEvalFixtures(), Injectable

### Community 123 - "provider-simulator/package.json"
Cohesion: 0.10
Nodes (19): dependencies, @ai-sales-agent/agent-adapters, devDependencies, @types/node, typescript, @ai-sales-agent/agent-adapters, @types/node, typescript (+11 more)

### Community 125 - "value-objects.ts"
Cohesion: 0.29
Nodes (4): assertIanaTimezone(), ISO_CURRENCIES, Money, TimeRange

### Community 126 - "createSupabaseBrowserClient"
Cohesion: 0.60
Nodes (4): LoginPage(), onLogout(), onSubmit(), createSupabaseBrowserClient()

### Community 127 - "OperatorNav"
Cohesion: 0.19
Nodes (12): BookingsPage(), Activity, LeadsPage(), addNote(), openLead(), Rule, SchedulePage(), CapabilityGuard() (+4 more)

### Community 129 - "12-decisions/README.md"
Cohesion: 0.17
Nodes (9): Goals, Goals and non-goals, Non-goals, ADR-007 — Layered bounded conversation memory, Alternatives and consequences, Context, Decision, Validation and review trigger (+1 more)

### Community 130 - "Local development plan"
Cohesion: 0.17
Nodes (9): Hosted Supabase (Phase 01 closure), Local development plan, New Device Bootstrap (environment recovery), Phase 03 conversations, Synthetic Auth user (DEVELOPMENT only), ADR-011 — Narrow privileged work-claim for FORCE RLS workers, Consequences, Context (+1 more)

### Community 131 - "Phase 00 ADR review"
Cohesion: 0.17
Nodes (12): ADR-001 — Modular monolith, ADR-002 — PostgreSQL primary database, ADR-003 — pgvector for approved knowledge, ADR-004 — BullMQ with durable database intent, ADR-005 — Backend-controlled tools, ADR-006 — MessagingChannel boundary, ADR-007 — Layered bounded memory, ADR-008 — Shared schema with scoped commands and RLS (+4 more)

### Community 132 - "Phase 00 security and threat review"
Cohesion: 0.17
Nodes (12): Background-job tenant leakage, Cross-tenant RAG retrieval, Duplicate or reordered messages, Human/AI takeover race, Phase 00 security and threat review, PII and secret leakage, Price hallucination and false success, Prompt injection and malicious knowledge (+4 more)

### Community 133 - "MB-01 — Organization Profile & Capabilities Implementation"
Cohesion: 0.17
Nodes (11): 1. Executive Summary, 2. Database Schema & Migration, 3. Backward-Compatible Defaults, 6. Backend Policy Enforcement Matrix, 7. Verification & Test Evidence, 8. Known Limitations & Next Steps, Automated Unit & Integration Tests, Key Deliverables Completed (+3 more)

### Community 134 - "package.json"
Cohesion: 0.17
Nodes (11): engines, node, pg, prisma, @prisma/adapter-pg, @prisma/client, tsx, typescript (+3 more)

### Community 135 - "execute-followup.ts"
Cohesion: 0.30
Nodes (9): executeFollowUp(), FollowUpExecuteResult, withTenant(), buildMetaTemplateComponents(), civilToUtcApprox(), computeNextEligibleAt(), isInQuietHours(), localWallParts() (+1 more)

### Community 136 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, declaration, module, moduleResolution, outDir, rootDir, skipLibCheck, strict (+3 more)

### Community 137 - "valid-slot-booking-e2e.ts"
Cohesion: 0.16
Nodes (20): b64url(), canonicalJson(), fromB64url(), signSlotToken(), SLOT_TOKEN_MAX_LEN, SLOT_TOKEN_TTL_MS, SlotTokenPayloadV1, SlotTokenVerifyResult (+12 more)

### Community 138 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, declaration, module, moduleResolution, outDir, rootDir, skipLibCheck, strict (+3 more)

### Community 139 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, declaration, module, moduleResolution, outDir, rootDir, skipLibCheck, strict (+3 more)

### Community 140 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, declaration, module, moduleResolution, outDir, rootDir, skipLibCheck, strict (+3 more)

### Community 141 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, declaration, module, moduleResolution, outDir, rootDir, skipLibCheck, strict (+3 more)

### Community 143 - "next"
Cohesion: 0.14
Nodes (7): nextConfig, GET(), PATCH(), proxy(), config, next, @supabase/ssr

### Community 144 - "User journeys"
Cohesion: 0.18
Nodes (9): Customer inquiry to booking, Human escalation, Owner onboarding, Recovery and follow-up, User journeys, End-to-end tests, Evidence and failure checks, Required cases (+1 more)

### Community 145 - "security-architecture.md"
Cohesion: 0.18
Nodes (8): Privacy and abuse, Security architecture, Threat model and controls, System context, Evidence and failure checks, Required cases, Scope, Security tests

### Community 146 - "Phase 08 — Closure report"
Cohesion: 0.18
Nodes (11): Gate results, GRAPH API VERSION, P08 LIVE_PROVIDER_ACCEPTANCE: NOT_RUN, P09_AUTHORIZED, Phase 08 — Closure report, PHASE 08 ENGINEERING: CLOSED, PROVIDER, REMAINING BLOCKERS (+3 more)

### Community 147 - "Multi-Business Platform — Architecture Decision Records"
Cohesion: 0.17
Nodes (11): D001 — Multi-Business Behavior Is Capability-Driven, D002 — No Business-Type Branching in Core Agent, D003 — Structured Truth Remains Backend-Authoritative, D004 — RAG Does Not Own Transactional Truth, D006 — One Dynamic Dashboard, Not Per-Industry Apps, D007 — Organization-Specific Assistant Style Is Configuration, D008 — Existing Booking Path Must Remain Backward Compatible, D009 — Catalog Extension Over Replacement (+3 more)

### Community 148 - "MB-02 — Multi-Business Onboarding Implementation"
Cohesion: 0.15
Nodes (12): 1. Executive Summary, 2. Database Schema & Migration, 3. Contracts & Business Suggestion Presets, 4. Backend Readiness & Completion Engine, 5. Test Matrix & Verification, 6. Phase Status & Invariant Guarantees, Key Deliverables Completed, MB-02 — Multi-Business Onboarding Implementation (+4 more)

### Community 149 - "Multi-Business Platform — Risk Management & Mitigation"
Cohesion: 0.18
Nodes (10): AI & Runtime Risks, Multi-Business Platform — Risk Management & Mitigation, R-05: Prompt Explosion & Context Window Bloat, R-06: RAG Hallucination of Prices, Availability, or Discounts, R-07: Stale Organization Configuration in Runtime Memory, R-08: Multi-Tenant Data Leakage, R-09: Migration Regressions in Existing Dental Booking Flow, R-10: Dashboard UI Overwhelm for Non-Technical Owners (+2 more)

### Community 150 - "Phase 00 closure report"
Cohesion: 0.14
Nodes (14): 10. MVP boundary, 11. Pilot boundary, 12. Unresolved blockers (reclassified), 13. Recommendation, 1. Repository assessment, 2. Decisions resolved, 3. Decisions still open (pilot / product — not automatic P01 blockers), 4. Assumptions (+6 more)

### Community 151 - "PoliciesController"
Cohesion: 0.22
Nodes (10): PoliciesController, Body, Controller, Get, Param, Patch, Post, Query (+2 more)

### Community 152 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, module, moduleResolution, outDir, rootDir, skipLibCheck, strict (+2 more)

### Community 153 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, module, moduleResolution, outDir, rootDir, skipLibCheck, strict (+2 more)

### Community 154 - "chunk-v1.ts"
Cohesion: 0.44
Nodes (8): CHUNK_PROFILE_ID, CHUNK_V1, chunkText(), chunkTextV1(), ChunkV1Result, estimateTokensV1(), splitUnits(), Unit

### Community 155 - "path-b-demo.ts"
Cohesion: 0.36
Nodes (10): api(), apiBase(), asList(), getAccessToken(), loadDemoSession(), main(), sleep(), StepResult (+2 more)

### Community 156 - "main"
Cohesion: 0.24
Nodes (9): AgentModule, Module, main(), claimOutbox(), drainConversation(), markPublished(), relayOnce(), Deliverables (+1 more)

### Community 157 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, module, moduleResolution, outDir, rootDir, skipLibCheck, strict, target (+1 more)

### Community 158 - "Phase 04 — Scope manifest"
Cohesion: 0.20
Nodes (8): Explicitly not in migration, Phase 04 — Pre-migration review gate, Tables added (planned), Goal and scope, Hardening locks, Ingress watermark (authoritative P03), Phase 04 — Scope manifest, Worker privilege

### Community 159 - "Phase 13 — Ops, security, observability, backup evidence"
Cohesion: 0.20
Nodes (10): Backup / restore evidence levels, Graceful shutdown, Health, Kill switches, Migration spot-check, Observability detection drills, Phase 13 — Ops, security, observability, backup evidence, Rate / request limits (+2 more)

### Community 160 - "P13 RESILIENCE + LOAD VALIDATION REPORT"
Cohesion: 0.20
Nodes (10): 1. Canonical runtime artifact, 2. HIGH advisory disposition (final image), 3. Exactly-once / ambiguous send, 4. Redis, 5. AI emergency kill switch, 6. Load dataset + mixed load, 7. Observability drills, 8. Backup / restore (+2 more)

### Community 161 - "multi-business-platform/README.md"
Cohesion: 0.14
Nodes (9): Classification Legend, Entity Relationship Summary, Migration Classification Summary, Multi-Business Platform — Domain Model, Capability-Driven Architecture Map, Module Status Legend, Multi-Business Platform — Mind Map, System Overview (+1 more)

### Community 162 - "LocalQwenEmbeddingProvider"
Cohesion: 0.38
Nodes (3): main(), LocalQwenEmbeddingProvider, EmbeddingProviderError

### Community 163 - "AI Sales Agent"
Cohesion: 0.18
Nodes (11): AI Sales Agent, Auth boundary, Database identities, Implemented platform capabilities, Local setup, Scripts, Spike, Stack (pinned) (+3 more)

### Community 164 - "run.mjs"
Cohesion: 0.13
Nodes (10): prisma_generated_client_client, prisma_generated_client_client_prismaclient, ref_prisma_adapter_pg, spikes_database_compatibility_generated_client_client, spikes_database_compatibility_generated_client_client_prismaclient, adminPool, prisma, prismaPool (+2 more)

### Community 165 - "catalog.ts"
Cohesion: 0.12
Nodes (17): 1. Executive Summary, Key Deliverables Completed, CATALOG_ITEM_KINDS, CATALOG_ITEM_STATUSES, CatalogItemDto, CatalogItemKind, CatalogItemKindSchema, CatalogItemStatus (+9 more)

### Community 166 - "dashboard/page.tsx"
Cohesion: 0.33
Nodes (6): AttentionItem, DashboardPage(), DashboardPayload, SummaryCard(), createRefreshController(), RefreshController

### Community 167 - "ADR-006 — MessagingChannel boundary"
Cohesion: 0.22
Nodes (6): ADR-006 — MessagingChannel boundary, Consequences, Context, Decision, Supersession, MessagingChannel

### Community 168 - "Phase 03 — Scope manifest"
Cohesion: 0.22
Nodes (9): Acceptance, Commands, queries and API, Customer merge compatibility, Goal and scope, Identity resolution, Message idempotency and ordering, Phase 03 — Scope manifest, Truth layers (+1 more)

### Community 169 - "attention.test.ts"
Cohesion: 0.24
Nodes (9): attentionIdentity(), finalizeAttentionFeed(), isConversationWaitingForHuman(), isHandoffPauseReason(), isPausedUnassignedReason(), isReviewRequiredSuppression(), makeAttentionItem(), sortAttentionItems() (+1 more)

### Community 170 - "Phase 13 — Design lock"
Cohesion: 0.22
Nodes (8): Blockers, Expected migrations, Known limitations, Performance model, Phase 13 — Design lock, Resilience and operations, Resource boundaries, Security and tenancy

### Community 171 - "Phase 00 decision register"
Cohesion: 0.17
Nodes (12): D09 — Multi-tenancy architecture, D10 — Authentication and session boundary, D11 — Architecture and roadmap approval, Phase 00 decision register, Q01 — Pilot business, jurisdiction, and data boundary, Q02 — Booking source of truth, Q03 — MVP scheduling model, Q04 — Language, qualification, and coverage (+4 more)

### Community 172 - "contracts/src/index.ts"
Cohesion: 0.22
Nodes (8): AddMemberRequest, AuthMeResponse, CreateOrganizationRequest, CreateOrganizationResponse, MemberRole, MembershipDto, MemberStatus, SwitchOrganizationRequest

### Community 173 - "provision-supabase-test-user.ts"
Cohesion: 0.33
Nodes (7): ref_supabase_supabase_js, countEnvLocalKey(), main(), main(), main(), refuseProduction(), upsertEnvLocal()

### Community 174 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, lint, start, test, test:integration, typecheck

### Community 175 - "Phase 02 — Scope manifest"
Cohesion: 0.25
Nodes (6): Commands, queries and API, Goal and scope, Invariants and lifecycle, Persistence, authorization and evidence, Phase 02 — Scope manifest, Entities and invariants

### Community 176 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, @ai-sales-agent/config, @ai-sales-agent/contracts, next, react, react-dom, @supabase/ssr, @supabase/supabase-js

### Community 177 - "Follow-up execution and suppression"
Cohesion: 0.25
Nodes (7): Consent / outreach, Eligibility (execution TX), Follow-up execution and suppression, Lifecycle, Operator / agent, Scheduling, Templates

### Community 178 - "ADR-NNN — Decision title"
Cohesion: 0.25
Nodes (7): ADR-NNN — Decision title, Alternatives considered, Consequences and risks, Context and evidence, Decision, Supersession, Validation and acceptance

### Community 179 - "availability-slots.ts"
Cohesion: 0.16
Nodes (13): Commands, Expected data, Limitations, Local demo dataset, Reset behavior, Safety guards, Spend / phase, addMinutes() (+5 more)

### Community 180 - "Phase 01 — Closure report"
Cohesion: 0.25
Nodes (8): ADR, Amendment N / hosted evidence, Local quality gates (post Auth fix), Phase 01 — Closure report, Phase 01 defect fixed for hosted Nest, Phase 02 readiness, Summary, Test user provisioning

### Community 181 - "Phase 05 — Local TEI operations"
Cohesion: 0.25
Nodes (7): Compose defaults (local bake-off host), Egress, Health, Images (do not use cpu-1.7.x), Model, Network, Phase 05 — Local TEI operations

### Community 182 - "Phase 06 — Closure report"
Cohesion: 0.25
Nodes (7): Gate results, Phase 06 — Closure report, PHASE 06 STATUS: CLOSED, READY_FOR_P07, REMAINING BLOCKERS, Scope delivered, STOP

### Community 183 - "Phase 11 — Closure report"
Cohesion: 0.25
Nodes (8): Evidence, Gate results, Next phase, Phase 11 — Closure report, PHASE 11 STATUS: CLOSED, Remaining blockers, Scope delivered, Security review (brief)

### Community 184 - "FakeEmbeddingProvider"
Cohesion: 0.32
Nodes (4): Blocker resolution, Closure evidence, Phase 12 — Validation report, FakeEmbeddingProvider

### Community 185 - "Phase 13 closure"
Cohesion: 0.25
Nodes (8): Acceptance (phase template), Documentation updates, Gate checklist, Open defects/risks, Phase 13 closure, Sign-off, Task results, Test evidence

### Community 186 - "Phase 13 — Discovery report"
Cohesion: 0.25
Nodes (7): Confirmed hardening gaps, Database privilege audit, Existing resilience controls, Existing test infrastructure, Non-blocking external dependencies, Phase 13 — Discovery report, Trust boundaries and topology

### Community 187 - "PRE-P14 LOCAL MODEL CAPABILITY SEARCH"
Cohesion: 0.25
Nodes (7): Candidate: qwen2.5:1.5b, Candidate: qwen2.5:7b, Candidate: qwen3:4b, Host gate, PRE-P14 LOCAL MODEL CAPABILITY SEARCH, Probe D definition, STOP

### Community 188 - "PRE-P14 REAL LLM ZERO-COST STATUS"
Cohesion: 0.25
Nodes (7): Config gaps, Hardware-fit gate (host class), PRE-P14 REAL LLM ZERO-COST STATUS, Probe detail, Probe notes, Readiness gates, STOP

### Community 189 - "analytics/page.tsx"
Cohesion: 0.43
Nodes (5): AnalyticsPage(), Card(), Details(), iso(), Payload

### Community 190 - "Options"
Cohesion: 0.29
Nodes (7): A — Internal booking engine is authoritative, Approval evidence, B — External calendar is authoritative, C — Hybrid authority, Options, Phase 00 booking authority analysis, Recommended MVP semantics

### Community 191 - "Phase 00 disposable database compatibility spike"
Cohesion: 0.29
Nodes (7): Conflict-strategy comparison, Evidence artifact and closure, Experiments and results, Minimal spike objects, Phase 00 disposable database compatibility spike, Prisma compatibility finding, Purpose and environment

### Community 192 - "Phase 00 WhatsApp discovery record"
Cohesion: 0.29
Nodes (7): ASSUMED architecture behavior pending live test, Credential and failure contract, Phase 00 WhatsApp discovery record, Readiness, Required Phase 08 fixture pack, REQUIRES LIVE PROVIDER TEST, VERIFIED from current primary policy/documentation

### Community 193 - "Phase 05 — Scope manifest"
Cohesion: 0.29
Nodes (6): Embedding profile (accepted candidate; not schema-migrated), Entities, Goal, Hardening locks (pre-schema), P06+ exclusions, Phase 05 — Scope manifest

### Community 194 - "Phase 05 — TEI operational baseline"
Cohesion: 0.29
Nodes (6): Configuration, Container memory (cgroup / proc), Gate, Latency / throughput (warm), Phase 05 — TEI operational baseline, Restart / readiness

### Community 195 - "Phase 07 — Closure report"
Cohesion: 0.29
Nodes (7): Gate results, Phase 07 — Closure report, PHASE 07 STATUS: CLOSED, READY_FOR_P08, REMAINING BLOCKERS, Scope delivered, STOP

### Community 196 - "Multi-Business Platform — Detailed Phase Breakdown"
Cohesion: 0.29
Nodes (7): MB-00 — Discovery & Baseline Audit, MB-01 — Organization Profile + Capabilities, MB-02 — Multi-Business Onboarding, MB-03 — Dynamic Dashboard Navigation, MB-04 — Generic Business Catalog, MB-05 through MB-15, Multi-Business Platform — Detailed Phase Breakdown

### Community 197 - "phase05-knowledge.test.ts"
Cohesion: 0.12
Nodes (9): owner, runtime, owner, runtime, packages_embeddings_dist_index, packages_embeddings_dist_index_accepted_embedding_profile, packages_embeddings_dist_index_fakeembeddingprovider, packages_storage_dist_index (+1 more)

### Community 200 - "offers.ts"
Cohesion: 0.12
Nodes (16): CreateOfferRequest, CreateOfferSchema, OFFER_ELIGIBILITIES, OFFER_STATUSES, OFFER_TYPES, OfferCatalogItemDto, OfferDto, OfferEligibility (+8 more)

### Community 201 - "ADR-001 — Modular monolith"
Cohesion: 0.33
Nodes (5): ADR-001 — Modular monolith, Alternatives and consequences, Context, Decision, Validation and review trigger

### Community 202 - "ADR-002 — PostgreSQL as primary store"
Cohesion: 0.33
Nodes (5): ADR-002 — PostgreSQL as primary store, Alternatives and consequences, Context, Decision, Validation and review trigger

### Community 203 - "ADR-003 — pgvector for approved knowledge"
Cohesion: 0.33
Nodes (5): ADR-003 — pgvector for approved knowledge, Alternatives and consequences, Context, Decision, Validation and review trigger

### Community 204 - "ADR-004 — BullMQ with durable database intent"
Cohesion: 0.33
Nodes (5): ADR-004 — BullMQ with durable database intent, Alternatives and consequences, Context, Decision, Validation and review trigger

### Community 205 - "ADR-005 — Backend-controlled tools"
Cohesion: 0.33
Nodes (5): ADR-005 — Backend-controlled tools, Alternatives and consequences, Context, Decision, Validation and review trigger

### Community 206 - "ADR-008 — Shared schema with scoped commands and RLS"
Cohesion: 0.33
Nodes (5): ADR-008 — Shared schema with scoped commands and RLS, Alternatives and consequences, Context, Decision, Validation and review trigger

### Community 207 - "ADR-009 — Internal booking authority"
Cohesion: 0.33
Nodes (5): ADR-009 — Internal booking authority, Consequences, Context, Decision, Supersession

### Community 208 - "ADR-010 — Explicit outbound uncertainty"
Cohesion: 0.33
Nodes (5): ADR-010 — Explicit outbound uncertainty, Alternatives and consequences, Context, Decision, Validation and review trigger

### Community 209 - "Phase 00 repository and documentation audit"
Cohesion: 0.33
Nodes (6): Audit conclusion, Existing evidence versus missing evidence, Internal consistency review, Phase 00 repository and documentation audit, Phase 00 task status, Repository assessment

### Community 210 - "Phase 00 product boundary review"
Cohesion: 0.33
Nodes (6): Explicitly excluded, MVP included, Phase 00 product boundary review, Pilot boundary, Provisional vertical, Validation needed

### Community 211 - "Phase 00 multi-tenancy validation"
Cohesion: 0.33
Nodes (6): Authorization and application scope, Ownership model, Phase 00 multi-tenancy validation, PostgreSQL defense in depth, Prisma, pooling, and jobs, Required acceptance tests

### Community 212 - "Phase 05 — Pre-migration review gate"
Cohesion: 0.33
Nodes (5): Explicit non-goals until later GO, Hardening checklist, Locked embedding profile, Phase 05 — Pre-migration review gate, Schema review (final)

### Community 213 - "navigation.ts"
Cohesion: 0.23
Nodes (10): Key Deliverables Completed, ALWAYS_AVAILABLE_MODULE_IDS, DASHBOARD_NAV_ITEMS, DashboardNavItem, MemberRole, ModuleImplementationStatus, NavGroup, NavigationFilterOptions (+2 more)

### Community 214 - "Phase 12 — Discovery report"
Cohesion: 0.33
Nodes (5): Adequacy and gaps, Authoritative sources, Non-goals and blockers, Phase 12 — Discovery report, Time, retention and performance

### Community 215 - "ZERO-COST LIVE DISCOVERY REPORT"
Cohesion: 0.33
Nodes (6): Cost classification, Evidence basis, LIVE JOURNEY READINESS, Report, STOP, ZERO-COST LIVE DISCOVERY REPORT

### Community 216 - "loadDemoCliEnv"
Cohesion: 0.24
Nodes (10): applyOverlayFile(), DEMO_OVERLAY_KEYS, loadDemoCliEnv(), prismaCli, result, Checkpoint, fail(), main() (+2 more)

### Community 217 - "verify.ts"
Cohesion: 0.67
Nodes (5): api(), apiBase(), asList(), getAccessToken(), main()

### Community 218 - "devDependencies"
Cohesion: 0.40
Nodes (5): devDependencies, @types/express, @types/node, @types/pg, typescript

### Community 219 - ".get"
Cohesion: 0.40
Nodes (4): Get, Param, Query, Req

### Community 220 - "channels/[[...path]]/route.ts"
Cohesion: 0.70
Nodes (4): GET(), PATCH(), POST(), proxy()

### Community 221 - "conversations/[[...path]]/route.ts"
Cohesion: 0.70
Nodes (4): GET(), PATCH(), POST(), proxy()

### Community 222 - "follow-ups/[[...path]]/route.ts"
Cohesion: 0.70
Nodes (4): GET(), PATCH(), POST(), proxy()

### Community 223 - "knowledge/[[...path]]/route.ts"
Cohesion: 0.70
Nodes (4): DELETE(), GET(), POST(), proxy()

### Community 224 - "leads/[[...path]]/route.ts"
Cohesion: 0.70
Nodes (4): GET(), PATCH(), POST(), proxy()

### Community 225 - "message-templates/[[...path]]/route.ts"
Cohesion: 0.70
Nodes (4): GET(), PATCH(), POST(), proxy()

### Community 226 - "Tool tests"
Cohesion: 0.40
Nodes (4): Evidence and failure checks, Required cases, Scope, Tool tests

### Community 227 - "Unit tests"
Cohesion: 0.40
Nodes (4): Evidence and failure checks, Required cases, Scope, Unit tests

### Community 228 - "Webhook tests"
Cohesion: 0.40
Nodes (4): Evidence and failure checks, Required cases, Scope, Webhook tests

### Community 229 - "Phase 02 — Closure report"
Cohesion: 0.40
Nodes (5): Acceptance evidence, Delivered boundary, Phase 02 — Closure report, Phase 03 readiness, Security review

### Community 230 - "PRE-P14 REAL LLM PATH B E2E STATUS"
Cohesion: 0.40
Nodes (4): Notes, PRE-P14 REAL LLM PATH B E2E STATUS, Provider evidence, STOP

### Community 231 - "validate_docs.py"
Cohesion: 0.40
Nodes (4): Validate the planning package, not the unimplemented application. Run from any…, pathlib, re, sys

### Community 232 - "MB-03 — Dynamic Dashboard Navigation Implementation"
Cohesion: 0.22
Nodes (8): 1. Executive Summary, 2. Navigation Architecture & Information Hierarchy, 3. Module Visibility & Route Access Mapping, 4. Test Matrix & Verification, 5. Phase Status & Invariant Guarantees, MB-03 — Dynamic Dashboard Navigation Implementation, Test Coverage Summary, filterNavItems()

### Community 233 - "next-env.d.ts"
Cohesion: 0.50
Nodes (3): NOTE: This file should not be edited, apps_web_next_types_root_params_d, apps_web_next_types_routes_d

### Community 234 - "bookings/[[...path]]/route.ts"
Cohesion: 0.83
Nodes (3): GET(), POST(), proxy()

### Community 235 - "knowledge-jobs.ts"
Cohesion: 0.21
Nodes (11): apps_worker_src_chunk_text_chunk_profile_id, chunkText(), handleKnowledgeOutboxEvent(), KNOWLEDGE_EVENT_CHUNK, KNOWLEDGE_EVENT_CLEANUP, KNOWLEDGE_EVENT_EMBED, KNOWLEDGE_EVENT_EXTRACT, vectorLiteral() (+3 more)

### Community 236 - "profile/route.ts"
Cohesion: 0.83
Nodes (3): GET(), PATCH(), proxy()

### Community 237 - "OperatorNav.tsx"
Cohesion: 0.29
Nodes (6): OperatorNavProps, packages_contracts_dist_index_always_available_module_ids, packages_contracts_dist_index_dashboard_nav_items, packages_contracts_dist_index_dashboardnavitem, packages_contracts_dist_index_evaluaterouteaccess, packages_contracts_dist_index_filternavitems

### Community 238 - "Assumptions and decisions needed"
Cohesion: 0.50
Nodes (4): Assumptions and decisions needed, Planning defaults, Product decisions (owner: product lead; close in P00), Repository evidence

### Community 240 - "whatsapp.md"
Cohesion: 0.11
Nodes (13): Messaging architecture, Messaging channel contract, Webhook ingestion lifecycle, WhatsApp first integration, Commands, External send boundary, Idempotency and uncertainty, Inbound and internal delivery (+5 more)

### Community 241 - "Phase 00 pilot metric dictionary"
Cohesion: 0.50
Nodes (4): Business outcome metrics, Collection and baseline protocol, Phase 00 pilot metric dictionary, System reliability metrics

### Community 242 - "Phase 07 — Scope manifest"
Cohesion: 0.50
Nodes (3): Design lock (summary), Non-goals, Phase 07 — Scope manifest

### Community 243 - "Phase 08 — Scope manifest"
Cohesion: 0.50
Nodes (3): Design lock (summary), Non-goals, Phase 08 — Scope manifest

### Community 244 - "Phase 10 — Scope manifest"
Cohesion: 0.50
Nodes (3): Design lock (FINAL HARDENED), Non-goals, Phase 10 — Scope manifest

### Community 245 - "src/server.ts"
Cohesion: 0.24
Nodes (9): port, simulator, body(), createMetaSimulator(), json(), RecordedSend, SimulatorScenario, packages_agent_adapters_dist_index_metawhatsappchannel (+1 more)

### Community 246 - "MB-06 — Business Policies Implementation"
Cohesion: 0.17
Nodes (11): AI retrieval, API and permissions, Audit and boundary, Demo and limitations, Deterministic resolution, MB-06 — Business Policies Implementation, Model and lifecycle, Status (+3 more)

### Community 247 - "dependencies"
Cohesion: 0.50
Nodes (4): dependencies, pg, @prisma/adapter-pg, @prisma/client

### Community 248 - "devDependencies"
Cohesion: 0.50
Nodes (4): devDependencies, prisma, tsx, typescript

### Community 249 - "Disposable database compatibility spike"
Cohesion: 0.50
Nodes (3): Commands, Disposable database compatibility spike, What is proved

### Community 261 - "Phase 05 — Closure report"
Cohesion: 0.33
Nodes (6): EMBEDDING PROFILE, Gate results (post-audit), Phase 05 — Closure report, PHASE 05 STATUS: CLOSED, READY_FOR_P06: YES, REMAINING BLOCKERS

### Community 262 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, module, moduleResolution, outDir, rootDir, skipLibCheck, strict, target (+1 more)

### Community 263 - "agent-adapters/src/index.ts"
Cohesion: 0.36
Nodes (5): AiKillOrgRow, isGlobalAiEmergencyDisabled(), isOrgAiEmergencyDisabled(), shouldBlockNewAgentRuns(), AGENT_SYSTEM_USER_ID

### Community 264 - "offers/page.tsx"
Cohesion: 0.22
Nodes (4): OffersPage(), packages_contracts_dist_index_offerdto, packages_contracts_dist_index_offereligibility, packages_contracts_dist_index_offertype

### Community 265 - "Phase 06 — Lead management and qualification"
Cohesion: 0.22
Nodes (9): 10. Business rules, 1. Objective, 2–3. Why / Entry, 4. Scope, 5. Out of Scope, 6–8. Architecture / model, 9. APIs / tools, Acceptance (summary) (+1 more)

### Community 266 - "MB-15 — External / Live Provider Acceptance"
Cohesion: 0.25
Nodes (8): Message, Audited boundary, Closure rule, Evidence completed in this checkout, Honest limitations, Live gate, MB-15 — External / Live Provider Acceptance, Status

### Community 267 - "Phase 10 — Closure report"
Cohesion: 0.25
Nodes (8): Gate results, LIVE_TEMPLATE_ACCEPTANCE: NOT_RUN, P11_AUTHORIZED, Phase 10 — Closure report, PHASE 10 ENGINEERING: CLOSED, REMAINING BLOCKERS, STOP, TECHNICALLY_READY_FOR_P11

### Community 268 - "Lead"
Cohesion: 0.29
Nodes (7): Lead, 7. Sales State, D005 — Customer and Lead Are Separate Concepts, 1. Executive Summary, 8. Customer Model Audit, Key Findings, Status Report

### Community 269 - "PoliciesPage"
Cohesion: 0.38
Nodes (4): PoliciesPage(), resetForm(), rules(), save()

### Community 270 - "MB-15A Meta Simulator Acceptance Evidence"
Cohesion: 0.29
Nodes (6): Available simulator controls, Executed evidence, Limits, MB-15A Meta Simulator Acceptance Evidence, Remaining full-runtime evidence, Result

### Community 272 - "MB-04 — Generic Business Catalog Implementation"
Cohesion: 0.33
Nodes (5): 2. Catalog Architecture & Entity Model, 3. Source of Truth & Field Ownership Matrix, 4. API Endpoints, 5. Verification and Quality Gates, MB-04 — Generic Business Catalog Implementation

### Community 273 - "db-provision-runtime-role.ts"
Cohesion: 0.60
Nodes (5): appendOrReplaceEnvLocal(), buildDatabaseUrl(), main(), parsePgUrl(), percentEncodePassword()

### Community 274 - "catalog/[[...path]]/route.ts"
Cohesion: 0.70
Nodes (4): GET(), PATCH(), POST(), proxy()

### Community 275 - "offers/[[...path]]/route.ts"
Cohesion: 0.70
Nodes (4): GET(), PATCH(), POST(), proxy()

### Community 276 - "policies/[[...path]]/route.ts"
Cohesion: 0.70
Nodes (4): GET(), PATCH(), POST(), proxy()

### Community 278 - "schedule/[[...path]]/route.ts"
Cohesion: 0.83
Nodes (3): GET(), POST(), proxy()

### Community 279 - "Phase 13 — Findings register"
Cohesion: 0.50
Nodes (4): Current validation evidence, Dependency path evidence, External limitations, Phase 13 — Findings register

### Community 280 - "4. Organization Model Audit"
Cohesion: 0.67
Nodes (3): 4. Organization Model Audit, Detailed Evidence, Status Report

## Knowledge Gaps
- **1914 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+1909 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 2312 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ActorContext` connect `ActorContext` to `@nestjs/common`, `PoliciesService`, `prisma.service.ts`, `bookings.service.ts`, `TenantContextService`, `organizations.service.ts`, `CatalogService`, `api/src/messaging/messaging-channel.ts`, `ref_node_crypto`, `dashboard.service.ts`, `TenantTxClient`, `Phase 00 initial AI evaluation fixtures`, `.runInTenantContext`, `BookingsService`, `.runAsActor`, `knowledge.service.ts`, `OffersService`, `ConversationsService`, `ChannelsController`, `packages_contracts_dist_index`, `analytics.service.ts`, `ConversationControlService`, `.getDashboard`, `TemplatesService`, `AgentService`, `CustomersService`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Why does `AuthenticatedRequest` connect `AuthenticatedRequest` to `@nestjs/common`, `prisma.service.ts`, `organizations.service.ts`, `PoliciesController`, `ConversationsController`, `.runAsActor`, `BookingsController`, `KnowledgeController`, `LeadsController`, `OffersService`, `CustomersController`, `ChannelsController`, `.get`, `AgentController`, `FollowUpsController`, `packages_contracts_dist_index`, `CatalogController`, `.getDashboard`, `TemplatesService`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `Phase 00 initial AI evaluation fixtures` connect `Phase 00 initial AI evaluation fixtures` to `ai-sales-agent/README.md`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _1914 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `@nestjs/common` be split into smaller, more focused modules?**
  _Cohesion score 0.06406112253893623 - nodes in this community are weakly interconnected._
- **Should `ai-sales-agent/README.md` be split into smaller, more focused modules?**
  _Cohesion score 0.04972677595628415 - nodes in this community are weakly interconnected._
- **Should `prisma.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._