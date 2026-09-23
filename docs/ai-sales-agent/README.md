# AI Sales Agent — technical source of truth and roadmap

Planning package — 2026-09-23. Documentation only. No application code, final Prisma schema, dependencies, infrastructure or production features have been implemented. Phase 00 analysis is IN REVIEW — BLOCKED; all implementation phases remain NOT STARTED.

## Start here

1. Review [scope](00-overview/product-scope.md) and [assumptions/questions](00-overview/assumptions.md).
2. Inspect the [system mind map](01-mind-map/system-mind-map.md), [container architecture](02-architecture/container-architecture.md) and [entity catalog](03-domain/entities.md).
3. Review the critical contracts: [tenant isolation](06-data/tenant-isolation.md), [ordering/fencing](02-architecture/queue-architecture.md), [safe tools](04-agent/tool-contracts.md), [booking](03-domain/booking-state-machine.md), [takeover](03-domain/conversation-state-machine.md) and [idempotency](06-data/idempotency.md).
4. Read [master plan](14-roadmap/master-plan.md), [ADRs](12-decisions/README.md) and [risk register](13-risks/risk-register.md).
5. Complete [P00 discovery/review](14-roadmap/phase-00-discovery.md) and record approval before P01 implementation.

## Repository assessment

Inspection found an empty workspace and no Git repository, manifests, source code, tests, migrations or existing conventions. There is no existing architecture or application migration. All paths described for implementation are proposed; only the documentation tree below exists after this task. No evidence contradicted the requested stack, but no implementation evidence validates it yet.

## Recommended architecture

Next.js/TypeScript/shadcn/ui/TanStack Query staff application; NestJS/TypeScript modular monolith with HTTP and worker entrypoints; PostgreSQL/Prisma and optional pgvector for approved unstructured knowledge; Redis/BullMQ with durable database outbox; private storage; provider-neutral model and channel adapters. Begin with WhatsApp and internal one-resource booking authority, subject to product review.

Invariant: LLM decides; backend validates and executes. All tenant-owned data is server-scoped; structured prices/slots stay relational. Durable command identities, fenced conversation processing, expiring confirmed proposals, ownership epochs and explicit uncertain sends make failure behavior reviewable.

## Documentation map

### 00-overview — Vision, scope, assumptions and external sources

- [assumptions.md](00-overview/assumptions.md)
- [goals-and-non-goals.md](00-overview/goals-and-non-goals.md)
- [problem-statement.md](00-overview/problem-statement.md)
- [product-scope.md](00-overview/product-scope.md)
- [sources.md](00-overview/sources.md)
- [terminology.md](00-overview/terminology.md)
- [vision.md](00-overview/vision.md)

### 01-mind-map — System mind map, journeys and dependencies

- [dependency-map.md](01-mind-map/dependency-map.md)
- [product-capabilities.md](01-mind-map/product-capabilities.md)
- [system-mind-map.md](01-mind-map/system-mind-map.md)
- [user-journeys.md](01-mind-map/user-journeys.md)

### 02-architecture — Runtime boundaries, tenancy, security and observability

- [followup-architecture.md](02-architecture/followup-architecture.md)

- [agent-architecture.md](02-architecture/agent-architecture.md)
- [backend-architecture.md](02-architecture/backend-architecture.md)
- [container-architecture.md](02-architecture/container-architecture.md)
- [data-architecture.md](02-architecture/data-architecture.md)
- [frontend-architecture.md](02-architecture/frontend-architecture.md)
- [messaging-architecture.md](02-architecture/messaging-architecture.md)
- [multi-tenancy.md](02-architecture/multi-tenancy.md)
- [observability.md](02-architecture/observability.md)
- [queue-architecture.md](02-architecture/queue-architecture.md)
- [rag-architecture.md](02-architecture/rag-architecture.md)
- [security-architecture.md](02-architecture/security-architecture.md)
- [system-context.md](02-architecture/system-context.md)

### 03-domain — Entities, aggregates, events and state machines

- [aggregates.md](03-domain/aggregates.md)
- [booking-state-machine.md](03-domain/booking-state-machine.md)
- [conversation-state-machine.md](03-domain/conversation-state-machine.md)
- [domain-events.md](03-domain/domain-events.md)
- [domain-model.md](03-domain/domain-model.md)
- [entities.md](03-domain/entities.md)
- [lead-state-machine.md](03-domain/lead-state-machine.md)
- [value-objects.md](03-domain/value-objects.md)

### 04-agent — Bounded runtime, tools, memory, guardrails and evaluation

- [agent-runtime.md](04-agent/agent-runtime.md)
- [context-builder.md](04-agent/context-builder.md)
- [evaluation-strategy.md](04-agent/evaluation-strategy.md)
- [failure-handling.md](04-agent/failure-handling.md)
- [guardrails.md](04-agent/guardrails.md)
- [memory-strategy.md](04-agent/memory-strategy.md)
- [model-provider-abstraction.md](04-agent/model-provider-abstraction.md)
- [prompt-strategy.md](04-agent/prompt-strategy.md)
- [tool-contracts.md](04-agent/tool-contracts.md)
- [tool-execution-loop.md](04-agent/tool-execution-loop.md)
- [tool-registry.md](04-agent/tool-registry.md)

### 05-integrations — WhatsApp, webhooks, booking and storage contracts

- [calendar-booking.md](05-integrations/calendar-booking.md)
- [future-integrations.md](05-integrations/future-integrations.md)
- [messaging-channel-contract.md](05-integrations/messaging-channel-contract.md)
- [storage.md](05-integrations/storage.md)
- [webhooks.md](05-integrations/webhooks.md)
- [whatsapp.md](05-integrations/whatsapp.md)

### 06-data — Schema plan, constraints, isolation and lifecycle

- [audit-log.md](06-data/audit-log.md)
- [database-design.md](06-data/database-design.md)
- [idempotency.md](06-data/idempotency.md)
- [indexing-strategy.md](06-data/indexing-strategy.md)
- [migration-strategy.md](06-data/migration-strategy.md)
- [prisma-model-plan.md](06-data/prisma-model-plan.md)
- [retention-policy.md](06-data/retention-policy.md)
- [tenant-isolation.md](06-data/tenant-isolation.md)

### 07-api — Staff, agent and webhook API contracts

- [agent-api.md](07-api/agent-api.md)
- [api-principles.md](07-api/api-principles.md)
- [auth-api.md](07-api/auth-api.md)
- [booking-api.md](07-api/booking-api.md)
- [conversation-api.md](07-api/conversation-api.md)
- [customer-api.md](07-api/customer-api.md)
- [knowledge-api.md](07-api/knowledge-api.md)
- [lead-api.md](07-api/lead-api.md)
- [organization-api.md](07-api/organization-api.md)
- [webhook-api.md](07-api/webhook-api.md)

### 08-frontend — Operational screens and failure UX

- [agent-settings.md](08-frontend/agent-settings.md)
- [analytics.md](08-frontend/analytics.md)
- [bookings.md](08-frontend/bookings.md)
- [conversations.md](08-frontend/conversations.md)
- [dashboard.md](08-frontend/dashboard.md)
- [information-architecture.md](08-frontend/information-architecture.md)
- [knowledge-base.md](08-frontend/knowledge-base.md)
- [leads.md](08-frontend/leads.md)
- [organization-settings.md](08-frontend/organization-settings.md)

### 09-testing — Deterministic tests and probabilistic evaluations

- [agent-evaluation.md](09-testing/agent-evaluation.md)
- [e2e-tests.md](09-testing/e2e-tests.md)
- [integration-tests.md](09-testing/integration-tests.md)
- [load-tests.md](09-testing/load-tests.md)
- [security-tests.md](09-testing/security-tests.md)
- [testing-strategy.md](09-testing/testing-strategy.md)
- [tool-tests.md](09-testing/tool-tests.md)
- [unit-tests.md](09-testing/unit-tests.md)
- [webhook-tests.md](09-testing/webhook-tests.md)

### 10-devops — Environments, delivery, monitoring and recovery

- [backup-and-recovery.md](10-devops/backup-and-recovery.md)
- [ci-cd.md](10-devops/ci-cd.md)
- [deployment.md](10-devops/deployment.md)
- [docker.md](10-devops/docker.md)
- [environments.md](10-devops/environments.md)
- [local-development.md](10-devops/local-development.md)
- [monitoring.md](10-devops/monitoring.md)
- [secrets.md](10-devops/secrets.md)

### 11-product-metrics — Funnel, usage, cost and verified outcomes

- [ai-cost-metrics.md](11-product-metrics/ai-cost-metrics.md)
- [business-outcomes.md](11-product-metrics/business-outcomes.md)
- [funnel.md](11-product-metrics/funnel.md)
- [metrics-model.md](11-product-metrics/metrics-model.md)
- [usage-metrics.md](11-product-metrics/usage-metrics.md)

### 12-decisions — Proposed and accepted architecture decisions

- [ADR-001-modular-monolith.md](12-decisions/ADR-001-modular-monolith.md)
- [ADR-002-postgresql.md](12-decisions/ADR-002-postgresql.md)
- [ADR-003-pgvector.md](12-decisions/ADR-003-pgvector.md)
- [ADR-004-bullmq.md](12-decisions/ADR-004-bullmq.md)
- [ADR-005-backend-tools.md](12-decisions/ADR-005-backend-tools.md)
- [ADR-006-messaging-channel.md](12-decisions/ADR-006-messaging-channel.md)
- [ADR-007-layered-memory.md](12-decisions/ADR-007-layered-memory.md)
- [ADR-008-tenant-isolation.md](12-decisions/ADR-008-tenant-isolation.md)
- [ADR-009-booking-authority.md](12-decisions/ADR-009-booking-authority.md)
- [ADR-010-outbound-uncertainty.md](12-decisions/ADR-010-outbound-uncertainty.md)
- [ADR-template.md](12-decisions/ADR-template.md)
- [README.md](12-decisions/README.md)

### 13-risks — Risk ownership, mitigation and release blockers

- [ai-risks.md](13-risks/ai-risks.md)
- [integration-risks.md](13-risks/integration-risks.md)
- [product-risks.md](13-risks/product-risks.md)
- [risk-register.md](13-risks/risk-register.md)
- [technical-risks.md](13-risks/technical-risks.md)

### 14-roadmap — Dependencies, 15 phases, task IDs and closure gates

- [phase-00-audit.md](14-roadmap/phase-00-audit.md)
- [phase-00-decision-register.md](14-roadmap/phase-00-decision-register.md)
- [phase-00-product-boundary.md](14-roadmap/phase-00-product-boundary.md)
- [phase-00-booking-authority.md](14-roadmap/phase-00-booking-authority.md)
- [phase-00-tenancy-validation.md](14-roadmap/phase-00-tenancy-validation.md)
- [phase-00-database-spike.md](14-roadmap/phase-00-database-spike.md)
- [phase-00-whatsapp-discovery.md](14-roadmap/phase-00-whatsapp-discovery.md)
- [phase-00-threat-review.md](14-roadmap/phase-00-threat-review.md)
- [phase-00-ai-trust-boundary.md](14-roadmap/phase-00-ai-trust-boundary.md)
- [phase-00-evaluation-fixtures.md](14-roadmap/phase-00-evaluation-fixtures.md)
- [phase-00-pilot-metrics.md](14-roadmap/phase-00-pilot-metrics.md)
- [phase-00-adr-review.md](14-roadmap/phase-00-adr-review.md)
- [phase-00-closure.md](14-roadmap/phase-00-closure.md)
- [README.md](14-roadmap/README.md)
- [future-roadmap.md](14-roadmap/future-roadmap.md)
- [master-plan.md](14-roadmap/master-plan.md)
- [phase-00-discovery.md](14-roadmap/phase-00-discovery.md)
- [phase-01-foundation.md](14-roadmap/phase-01-foundation.md)
- [phase-02-core-domain.md](14-roadmap/phase-02-core-domain.md)
- [phase-03-conversations.md](14-roadmap/phase-03-conversations.md)
- [phase-04-agent-core.md](14-roadmap/phase-04-agent-core.md)
- [phase-05-knowledge-rag.md](14-roadmap/phase-05-knowledge-rag.md)
- [phase-06-leads-crm.md](14-roadmap/phase-06-leads-crm.md)
- [phase-07-booking-tools.md](14-roadmap/phase-07-booking-tools.md)
- [phase-08-whatsapp.md](14-roadmap/phase-08-whatsapp.md)
- [phase-09-human-handoff.md](14-roadmap/phase-09-human-handoff.md)
- [phase-10-followups.md](14-roadmap/phase-10-followups.md)
- [phase-11-dashboard.md](14-roadmap/phase-11-dashboard.md)
- [phase-12-analytics.md](14-roadmap/phase-12-analytics.md)
- [phase-13-hardening.md](14-roadmap/phase-13-hardening.md)
- [phase-14-pilot-readiness.md](14-roadmap/phase-14-pilot-readiness.md)
- [phase-closure-template.md](14-roadmap/phase-closure-template.md)
- [requirements-traceability.md](14-roadmap/requirements-traceability.md)

## Authority and change control

The user brief supplies required invariants. Design selections are PROPOSED unless an ADR explicitly says otherwise; ADR-005 accepts the user-mandated backend-tool rule, not production readiness. Library versions, providers, prices, jurisdiction and staffing need discovery decisions. [Source register](00-overview/sources.md) distinguishes verified platform references from design defaults and unverified provider details.

Canonical ownership: domain documents own state invariants; data documents own persistence/isolation; agent documents own tool/runtime contracts; API/frontend documents own transport/interaction; roadmap owns scheduling/closure. Cross-links avoid parallel competing definitions. Update affected references and ADRs when implementation changes a contract.

## Review and validation

[Planning validation](planning-validation.md) records document coverage, phase structure, task uniqueness, relative links and consistency review. These checks validate the package, not the proposed application's behavior. The recommended next work is P00 discovery; do not automatically begin P01.
