# Requirements traceability

This map links each requirement group to its canonical design and verification owner. API/UI leaf documents add interaction details; they do not redefine these invariants.

## Tenant ownership across APIs/data/queues/storage/search

Design: [multi-tenancy](../02-architecture/multi-tenancy.md); [tenant-isolation](../06-data/tenant-isolation.md). Owning phases: P01 then each phase. Evidence: Two-tenant adversarial suite and pooled-session reuse.

## Channel-independent messaging and WhatsApp

Design: [messaging-channel-contract](../05-integrations/messaging-channel-contract.md); [whatsapp](../05-integrations/whatsapp.md). Owning phases: P03/P08. Evidence: Fake and provider sandbox contract tests.

## Webhook verification, duplicate/out-of-order events

Design: [webhooks](../05-integrations/webhooks.md); [idempotency](../06-data/idempotency.md). Owning phases: P03/P08. Evidence: Crash/replay/mixed-batch and late-receipt fixtures.

## Conversation FIFO, fencing and durable recovery

Design: [queue-architecture](../02-architecture/queue-architecture.md); [integration-tests](../09-testing/integration-tests.md). Owning phases: P03/P13. Evidence: Lease-expiry and Redis-loss fault injection.

## Bounded model loop and backend-controlled tools

Design: [agent-runtime](../04-agent/agent-runtime.md); [tool-contracts](../04-agent/tool-contracts.md). Owning phases: P04/P06/P07. Evidence: Schema/authority/idempotency/limit tests.

## Layered memory and bounded context

Design: [context-builder](../04-agent/context-builder.md); [memory-strategy](../04-agent/memory-strategy.md). Owning phases: P04. Evidence: Budget trimming and summary-watermark race tests.

## Knowledge publishing, RAG and poisoning prevention

Design: [rag-architecture](../02-architecture/rag-architecture.md); [guardrails](../04-agent/guardrails.md). Owning phases: P05. Evidence: Unpublish/deletion/isolation and injection evaluation.

## Customer/lead qualification and state

Design: [lead-state-machine](../03-domain/lead-state-machine.md); [lead-api](../07-api/lead-api.md). Owning phases: P02/P06. Evidence: Evidence requirements and duplicate-interest race.

## Accurate prices, slots and confirmed bookings

Design: [booking-state-machine](../03-domain/booking-state-machine.md); [tool-contracts](../04-agent/tool-contracts.md). Owning phases: P07. Evidence: Concurrent slot and stale proposal tests.

## Human pause, claim, resume and closed mode

Design: [conversation-state-machine](../03-domain/conversation-state-machine.md); [conversations](../08-frontend/conversations.md). Owning phases: P03/P09. Evidence: Takeover at model/tool/dispatch boundaries.

## Consent-aware follow-ups

Design: [phase-10-followups](../14-roadmap/phase-10-followups.md); [whatsapp](../05-integrations/whatsapp.md). Owning phases: P10. Evidence: Opt-out, generation race and send-time eligibility.

## Traceability, token/cost and outcomes

Design: [observability](../02-architecture/observability.md); [ai-cost-metrics](../11-product-metrics/ai-cost-metrics.md). Owning phases: P04/P12. Evidence: Evidence manifests and usage reconciliation.

## Retention, PII, secrets and audit

Design: [security-architecture](../02-architecture/security-architecture.md); [retention-policy](../06-data/retention-policy.md). Owning phases: P01/P13/P14. Evidence: Leak scans and multi-store deletion/restore drill.

## Funnel attendance and actual revenue

Design: [funnel](../11-product-metrics/funnel.md); [business-outcomes](../11-product-metrics/business-outcomes.md). Owning phases: P12. Evidence: Replay counts and verified outcome reconciliation.

## Arabic, ambiguity, unsupported requests and model failures

Design: [evaluation-strategy](../04-agent/evaluation-strategy.md); [failure-handling](../04-agent/failure-handling.md). Owning phases: P04/P14. Evidence: Versioned repeated evaluation plus deterministic failure tests.

## Production release, backup, monitoring and load

Design: [backup-and-recovery](../10-devops/backup-and-recovery.md); [monitoring](../10-devops/monitoring.md). Owning phases: P13/P14. Evidence: Measured SLO/load/recovery and go/no-go evidence.
