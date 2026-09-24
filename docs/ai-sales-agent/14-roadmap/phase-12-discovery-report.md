# Phase 12 — Discovery report

Date: 2026-09-24. Status: LOCKED.

## Authoritative sources

- Leads: `leads.created_at/status` for cohort/current state; append-only `lead_activities` for event transitions.
- Bookings: explicit `bookings.lead_id/source_conversation_id/source_message_id`; `booking_activities` for CONFIRMED/CANCELLED history.
- Conversations/messages: timeline sequence, direction, origin, delivery state and timestamps.
- Handoff: audited structured actions (`conversation.takeover`, claim/reassign/release/resume) plus conversation ownership fields. No transcript inference.
- Follow-ups: status, executed timestamp, linked outbound message, customer/lead/conversation/booking references.
- Runtime: `agent_runs`, `tool_calls`, `usage_events`; tool arguments are unavailable by design.
- Tenant/time: transaction-local organization context; UTC persistence. Organization has no timezone policy, so reports require an explicit IANA timezone.

## Adequacy and gaps

Direct bounded SQL is sufficient for current-state counts, event counts, direct lead-to-booking attribution, handling workload, follow-up transport/outcome associations, current delivery state, agent/tool/token usage and response latency. No analytics warehouse, cache or migration is justified.

Unavailable truth: attendance/no-show, verified revenue, historical lead snapshots, historical delivery transition timing and versioned provider cost. Current booking state supports only CONFIRMED/CANCELLED. Cost and knowledge-effectiveness claims are deferred. Follow-up-to-booking is ASSOCIATED within a locked window, never causal.

## Time, retention and performance

UTC half-open ranges are derived from explicit local dates plus IANA timezone, bounded to 365 days. Existing source retention is assumed for the requested window; responses expose an `asOf` timestamp and limitation codes. Queries are tenant-filtered, grouped in SQL, bounded by indexed timestamps, and return aggregates rather than PII. No customer names, transcripts, prompts, tool arguments or employee rankings are returned.

## Non-goals and blockers

No revenue or attendance workflow, pricing ledger, causal AI/follow-up attribution, historical snapshots, employee ranking, generic report builder, export, realtime stream, cache, warehouse or P13 hardening. Blockers: none for the locked MVP metrics; unsupported sections return `UNAVAILABLE`.
