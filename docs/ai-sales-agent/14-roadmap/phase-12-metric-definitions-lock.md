# Phase 12 — Metric definitions lock

Metric version: `analytics_overview:v1`. All windows are tenant-scoped UTC half-open `[from,to)`, derived from explicit IANA timezone local dates, maximum 365 days.

| Metric | Definition and source | Completeness / attribution |
|---|---|---|
| Lead current state | Current `Lead.status`, plus leads created in range | COMPLETE; not a historical snapshot |
| Lead transitions | `LeadActivity` status events created in range | PARTIAL if old transitions predate activity capture |
| Event booking conversion | Distinct explicit `Booking.leadId` among bookings created in range / distinct leads created in range | DIRECT; denominator shown |
| 30-day cohort conversion | Leads created in range with explicit confirmed booking within 30 days of lead creation / cohort leads | DIRECT; `IMMATURE_COHORT` when observation extends past `asOf` |
| Booking counts | BookingActivity confirmed/cancelled events in range; current CONFIRMED count separately | COMPLETE; no completion/no-show rate |
| Follow-up transport | FollowUp status counts; delivered/read/failed from linked outbound Message current state | PARTIAL current transport state |
| Follow-up reply | DISPATCHED follow-ups whose linked outbound is ACCEPTED/DELIVERED/READ and have later CUSTOMER inbound in same conversation within 7 days / eligible dispatched | ASSOCIATED; bounded time rule |
| Booking after follow-up | Confirmed booking for same organization/customer, optionally lead, within 7 days after dispatch | ASSOCIATED, never causal |
| Workload | Outbound Message counts by AI/OPERATOR/SYSTEM origin | COMPLETE |
| No human intervention | Conversations created in range with AI outbound and neither OPERATOR outbound nor structured takeover audit / conversations with AI outbound | COMPLETE for retained audit history |
| Handoff | Structured audit action counts and distinct conversations | COMPLETE for retained audit history |
| AI response latency | CUSTOMER inbound to next AI outbound by conversation sequence; median/p90 | PARTIAL; excludes SYSTEM/follow-up outbound |
| Human response latency | CUSTOMER inbound during current/recorded human control to next OPERATOR outbound | PARTIAL; historical ownership intervals are not fully materialized |
| Delivery | Current outbound Message delivery-state counts; rate denominator excludes PENDING/SUPPRESSED/UNKNOWN | PARTIAL; `UNKNOWN_DELIVERY_OUTCOMES` reported |
| Agent runs | Started and terminal status counts; STALE separate | COMPLETE |
| Tool usage | Count and structured result-code counts by tool name | COMPLETE; no arguments returned |
| Token usage | UsageEvent model calls, input/output/total tokens and latency | PARTIAL when provider fields are null |
| Cost | No versioned tariff ledger | UNAVAILABLE; `COST_PRICING_NOT_VERSIONED` |
| Attendance/revenue | No authoritative facts | UNAVAILABLE; `OUTCOME_NOT_MODELED` |
| Knowledge effectiveness | No experiment/causal design | UNAVAILABLE; deferred |

Zero means measured zero. Unsupported truth is returned as `UNAVAILABLE`, never numeric zero. Attribution labels are `DIRECT`, `ASSOCIATED`, and `UNATTRIBUTED`.
