# Phase 04 — Bounded agent core and safe tools

Status: NOT STARTED. Relative complexity: XL. Proposed accountable owner: engineering lead with product reviewer. Dates and staffing are unestimated.

## 1. Objective

Run a bounded context-aware model/tool loop whose actions are authorized, replay-safe and observable.

## 2. Why This Phase Exists

The AI must propose actions without becoming an unrestricted business-state writer.

## 3. Entry Criteria

P03 CLOSED; fake channel, fenced processing, modes and outbox exist.

## 4. Scope

Provider abstraction/fake adapter, context builder, summaries, registry/executor, read tools and safe customer/control tools, run/tool/usage traces and budget enforcement.

## 5. Out of Scope

Live booking mutation before P07, document RAG before P05, unrestricted autonomy and production provider traffic.

## 6. Architecture Impact

Add agent and usage modules; exported domain commands remain the only mutation route. Register lead/booking tools only as their phases close.

## 7. Files / Modules Expected

Likely implementation locations: apps/api/src/modules/agent and usage; apps/worker/agent; packages/contracts/tools; tests/agent-fixtures.

## 8. Data Model Changes

AgentConfig, AgentRun, ToolCall, CommandOperation, UsageEvent and ConversationSummary with immutable version references.

## 9. APIs

Agent config/version/test-run/run-inspection APIs and normalized ModelProvider/ToolRegistry contracts.

## 10. Business Rules

Max four tool rounds/eight tool calls/five model calls and 45-second deadline; server-injected scope; successful mutation result required for action claims.

## 11. Implementation Tasks

- [ ] P04-T001: Implement fake and approved primary ModelProvider adapters. Verification: Capability/schema/error/usage contract tests pass without provider-specific domain imports.
- [ ] P04-T002: Build token-bounded context and versioned summary publication. Verification: Critical policy and current request survive trimming; stale summaries cannot publish.
- [ ] P04-T003: Implement registry schema validation and permission intersection. Verification: Unknown/extra/foreign tool inputs never reach handlers.
- [ ] P04-T004: Implement bounded orchestrator with stale-run output checks. Verification: Limit exhaustion and new inbound/takeover invalidate output safely.
- [ ] P04-T005: Persist command/run/tool usage and cost reservations. Verification: Retry recovers prior command result and concurrent runs respect spend cap.
- [ ] P04-T006: Create evaluation harness and operator trace view. Verification: Fixture run explains source IDs/tool outcomes without leaking secrets or hidden reasoning.

## 12. Testing Requirements

- Unit: Context trimming, tool schema/authorization, loop counters, failure classification and action-claim gating.
- Integration: Crash after command commit, stale fence/epoch at mutation, usage reservation race and summary compare-and-swap.
- E2E: Fake-channel multi-turn inquiry calls permitted tools and produces a traceable response; injected prompt cannot mutate forbidden state.
- Failure scenarios: Malformed model output, provider timeout/refusal/429, repeated failing tool and cost cap exhaustion.

## 13. Observability Requirements

Context manifest, prompt/model versions, token estimates/actuals, latency spans, tool denials and final run reason.

## 14. Security Considerations

No arbitrary code/network/DB tools; tenant/actor injection from server only; redacted traces and approved provider processing.

## 15. Acceptance Criteria

- [ ] All tool arguments are validated and authorized before execution.
- [ ] Model cannot directly mutate business tables.
- [ ] Limits and timeout behavior are deterministic and observable.
- [ ] Action success is never claimed without committed backend evidence in release fixtures.

## 16. Exit Criteria

All P04 tasks are implemented or formally removed through reviewed scope change; required tests and acceptance checks pass; linked architecture/API/data documents match actual behavior; evidence and reviewer sign-off are recorded using the [closure template](phase-closure-template.md). No critical unresolved defect in this phase's boundary remains. A list of created files alone is not closure evidence.

## 17. Dependencies

Requires P03; unblocks P05/P06 and supplies runtime for P07/P09.

## 18. Risks

R03, R07, R09, R11; provider fallback cannot replay business mutations.

## 19. Deliverables

Orchestrator, provider adapters, context/memory, registry, trace viewer and evaluation baseline.

Canonical context: [master plan](master-plan.md), [test strategy](../09-testing/testing-strategy.md), [risk register](../13-risks/risk-register.md).
