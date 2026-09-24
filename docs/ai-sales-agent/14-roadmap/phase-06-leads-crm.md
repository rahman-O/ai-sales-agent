# Phase 06 — Lead management and qualification

Status: CLOSED (hardened). Relative complexity: M.

## 1. Objective

Capture and qualify durable sales opportunities per customer/service interest with evidence-linked history. No WON/BOOKED in this phase.

## 2–3. Why / Entry

Conversation-to-booking needs explicit lead state. Entry: P05 CLOSED; design lock in [phase-06-scope-manifest.md](phase-06-scope-manifest.md) and [lead-state-machine.md](../03-domain/lead-state-machine.md).

## 4. Scope

Lead + LeadActivity, OPEN dedup, generic→service promotion, customer-merge collision order, derived qualificationState, Nest API, P06 opt-in tools, minimal operator UI.

## 5. Out of Scope

Booking/slots, WON/BOOKED, ML scoring, campaigns, WhatsApp, payments, clinical data, CRM boards.

## 6–8. Architecture / model

Flat `apps/api/src/leads/`. Partial unique OPEN indexes. Assignment FK to `organization_members(organization_id, user_id)`. Activities append-only (SELECT+INSERT).

## 9. APIs / tools

See [lead-api.md](../07-api/lead-api.md) and [tool-contracts.md](../04-agent/tool-contracts.md): `ensureLead`, `updateLeadQualification`, `getLead`, `transitionLead`.

## 10. Business rules

OPEN uniqueness; AI cannot archive/disqualify/assign; merge archives with `MERGED_AFTER_CUSTOMER_MERGE`; duplicate open interest archives with `MERGED_DUPLICATE_OPEN_LEAD`; expectedVersion → 409.

## Acceptance (summary)

- No duplicate OPEN per open-key; ambiguity contracts enforced
- Qualification derived consistently
- Tools opt-in only; old configs deny P06 tools
- P01–P05 regressions green
