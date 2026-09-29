# Multi-Business AI Sales Platform — Planning Hub

Provider acceptance evidence and its current limitations are tracked in [MB-15-IMPLEMENTATION.md](./MB-15-IMPLEMENTATION.md). Operational controls are under [`docs/operations`](../operations/PRODUCTION-RELEASE-CHECKLIST.md).

> **This folder is the single source of truth for the multi-business platform evolution.**
> No implementation code lives here — only planning, architecture, and decision documentation.

---

## What Is This Initiative?

The AI Sales Agent platform was born as a **dental-clinic-first** product. Its core engine — multi-tenant agent orchestration, tool execution, booking, leads, knowledge, human takeover, kill switch, follow-ups, working state, and WhatsApp integration — is already production-proven.

The **Multi-Business Platform** initiative is the deliberate, phased transition from a dental-specific product into a **generic, configurable AI sales assistant** that can serve **any service or product business** through organization-level configuration rather than hardcoded industry branching.

---

## Why Evolve Beyond Dental?

| Reason | Detail |
|--------|--------|
| **Market opportunity** | Clinics, salons, real estate, restaurants, repair shops, training centers, ecommerce — all need AI-driven customer engagement |
| **Architecture readiness** | The core engine is already multi-tenant, tool-authorized, and capability-scoped |
| **Minimal duplication risk** | A well-designed capability system avoids per-industry forks |
| **Iraqi-market friendly** | Arabic/RTL, Baghdad timezone defaults, and conversational Iraqi dialect support already exist |

---

## What Stays Reusable (No Redesign)

These modules are **reusable as-is** or with minor generalization:

- Multi-tenant Organization, User, OrganizationMember models
- Customer, CustomerIdentity, Conversation, Message models
- Agent orchestrator (`agent-core/orchestrator.ts`)
- Tool execution framework (`agent-adapters/tool-executor.ts`)
- AgentConfig (version, tool allowlist, model profile)
- AgentRun, ToolCall, CommandOperation, UsageEvent
- Working state (`ConversationWorkingState`)
- Booking pipeline (remains as a **capability**, not a universal requirement)
- Lead pipeline (`Lead`, `LeadActivity`)
- Knowledge pipeline (`KnowledgeDocument`, `KnowledgeChunk`, embeddings)
- Human takeover (conversation mode + ownership epoch)
- Kill switch (`aiEmergencyDisabledAt`)
- Follow-ups (`FollowUp`, `OrganizationFollowUpPolicy`)
- Message templates
- Outbox event system
- Idempotency, audit logging
- WhatsApp channel connection
- DeepSeek runtime provider integration

---

## What Will Become Generic / Configurable

| Area | Current State | Target State |
|------|---------------|--------------|
| **Organization Profile** | Name only | Profile with business type, description, capabilities |
| **Catalog** | `Service` (dental-oriented, location-bound) | Generic `CatalogItem` (SERVICE / PRODUCT / LISTING / PACKAGE) |
| **Context Builder** | Hardcoded dental clinic persona | Organization-driven persona + workflow guidance |
| **Dashboard Navigation** | Static nav links | Dynamic nav based on org capabilities |
| **Offers / Promotions** | Not implemented | Generic structured offer model |
| **Business Policies** | Not implemented (only follow-up policy) | Configurable structured policies |
| **Conversation Style** | Hardcoded Arabic dental receptionist | Organization-level style profile |
| **Workflows / Intents** | Booking-only workflow chain | Capability-driven workflow registry |
| **Orders / Quotes** | Not implemented | Future transaction types |
| **Analytics** | Exists but minimal | Per-capability analytics |

---

## What Is Explicitly NOT Being Redesigned

- **Agent orchestrator loop** — the run→decide→tool→finalize loop is stable
- **Tool authorization model** — AgentConfig allowlist stays
- **RLS / tenancy** — proven multi-tenant isolation stays
- **Working state persistence** — `ConversationWorkingState` stays
- **Idempotency / command operations** — proven and stays
- **DeepSeek provider integration** — stays
- **Booking pipeline internals** — `createBooking`, slot tokens, availability — stays as-is; becomes a capability
- **Knowledge pipeline** — chunking, embeddings, search — stays

---

## Where Engineers Should Start Reading

| Document | Purpose |
|----------|---------|
| [MB-00-BASELINE-AUDIT.md](./MB-00-BASELINE-AUDIT.md) | Authoritative codebase & architecture baseline audit |
| [MB-01-IMPLEMENTATION.md](./MB-01-IMPLEMENTATION.md) | Implementation record for Organization Profile & Capabilities |
| [MB-02-IMPLEMENTATION.md](./MB-02-IMPLEMENTATION.md) | Implementation record for Multi-Business Onboarding |
| [MB-03-IMPLEMENTATION.md](./MB-03-IMPLEMENTATION.md) | Implementation record for Dynamic Dashboard Navigation |
| [MB-04-IMPLEMENTATION.md](./MB-04-IMPLEMENTATION.md) | Implementation record for Generic Business Catalog |
| [MB-05-IMPLEMENTATION.md](./MB-05-IMPLEMENTATION.md) | Implementation record for Offers / Promotions |
| [MB-06-IMPLEMENTATION.md](./MB-06-IMPLEMENTATION.md) | Implementation record for Generic Business Policies |
| [MB-07-IMPLEMENTATION.md](./MB-07-IMPLEMENTATION.md) | Implementation record for Conversation Style & Assistant Personality |
| [MB-08-IMPLEMENTATION.md](./MB-08-IMPLEMENTATION.md) | Implementation record for Generic Knowledge Setup |
| [MB-09-IMPLEMENTATION.md](./MB-09-IMPLEMENTATION.md) | Implementation record for Preview / Test Assistant |
| [MB-10-IMPLEMENTATION.md](./MB-10-IMPLEMENTATION.md) | Implementation record for Generic Workflow / Intent Layer |
| [MB-11-IMPLEMENTATION.md](./MB-11-IMPLEMENTATION.md) | Implementation record for Business-Type Packs & Templates |
| [MB-12-IMPLEMENTATION.md](./MB-12-IMPLEMENTATION.md) | Implementation record for Orders / Quotes / Non-Booking Transactions |
| [MB-13-IMPLEMENTATION.md](./MB-13-IMPLEMENTATION.md) | Implementation record for Multi-Business Analytics & Dashboards |
| [MB-14-IMPLEMENTATION.md](./MB-14-IMPLEMENTATION.md) | Implementation record for Production Hardening & Migration |
| [ROADMAP.md](./ROADMAP.md) | High-level phases and deliverables |
| [PHASES.md](./PHASES.md) | Detailed phase breakdown with acceptance criteria |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Target architecture and principles |
| [DOMAIN-MODEL.md](./DOMAIN-MODEL.md) | Conceptual data model evolution |
| [MIND-MAP.md](./MIND-MAP.md) | Visual system map |
| [UX-PRINCIPLES.md](./UX-PRINCIPLES.md) | Dashboard and onboarding design |
| [DECISIONS.md](./DECISIONS.md) | Architecture Decision Records |
| [RISKS.md](./RISKS.md) | Risk register with mitigations |
| [MIGRATION-STRATEGY.md](./MIGRATION-STRATEGY.md) | Safe migration from dental-first |

---

## Status Tracker

| Field | Value |
|---|---|
| **CURRENT STATUS** | IN_PROGRESS (MB-14 Complete, Ready for MB-15) |
| **CURRENT PHASE** | MB-14 (Production Hardening & Migration) |
| **NEXT PHASE** | MB-15 (External / Live Provider Acceptance) |
| **LAST COMPLETED PHASE** | MB-14 (Production Hardening & Migration) |
| **P14 STATUS** | **NOT AUTHORIZED** |

> **P14 remains NOT AUTHORIZED** unless explicitly changed by a future decision. All planning must be compatible with this constraint.

