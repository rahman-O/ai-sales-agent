# Phase 04 — Scope manifest

Status: CLOSED — READY_FOR_P05. Source priority: `phase-04-agent-core.md` → hardened plan → `conversation-state-machine.md` / agent docs → ADR-005/011 → P03 patterns.

## Goal and scope

Bounded agent runtime on P03 fenced drain: LLM proposes; backend validates, authorizes, executes, persists, audits.

**In scope:** ModelProvider (Fake + OpenAI-compatible adapter), ContextBuilder, ConversationSummary (CAS), ToolRegistry + ActionGate, AgentOrchestrator + OutputGate, AgentConfig/AgentRun/ToolCall/CommandOperation/UsageEvent, role-gated agent APIs, sandbox test-run, Fake e2e acceptance.

**P04 tools only:** `searchServices`, `getServiceDetails`, `getServicePrice`, `getCustomer`, `createCustomer`, `handoffToHuman`.

**Out of scope (P05+):** RAG/embeddings, leads, booking/slots, WhatsApp, full human claim UX, follow-ups, analytics.

## Ingress watermark (authoritative P03)

- Inbound FIFO: `Message.ingress_sequence` (NOT NULL for INBOUND; NULL for OUTBOUND).
- Conversation high-water: `next_sequence` / `processed_sequence` advance **only** for ingress (inbound).
- Timeline: `timeline_sequence` / `next_timeline_sequence` for all directions — **must not** drive AgentRun staleness.
- Stale rule: if durable inbound exists with `ingress_sequence > AgentRun.target_ingress_sequence` (equivalently `conversations.next_sequence - 1 > target`), final AI response is `STALE`/`SUPERSEDED`; no outbound; leave newer work pending.

## Hardening locks

See [phase-04-pre-migration-gate.md](phase-04-pre-migration-gate.md) for runKey, ActionGate, handoff terminal, outbound dedup, mode/cursor matrix, terminal/retry matrix, config auth, sandbox, summary trust, createCustomer preconditions, `packages/agent-core` ownership, Fake fail-closed, output claim safety.

## Integration

`drainConversation` in `apps/worker` → `packages/agent-core` orchestrator. Never AI inside `persistInbound`.

## Worker privilege

Reuse ADR-011 claim functions only. No BYPASSRLS. No new broad SECURITY DEFINER.
