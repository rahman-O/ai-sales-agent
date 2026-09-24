# Phase 06 — Scope manifest

Status: CLOSED (hardened). No WON/BOOKED. No P07+ until newly authorized.

## Embedding / prior phases

P05 CLOSED. Do not weaken RLS, AgentConfig immutability, or outbox semantics.

## Lead invariants (locked)

- Customer ≠ Lead; contact fields stay on Customer.
- OPEN = NEW | ENGAGED | QUALIFIED | NURTURE.
- Partial unique: ≤1 generic OPEN `(org, customer)` where `primary_service_id IS NULL`.
- Partial unique: ≤1 OPEN `(org, customer, primary_service_id)` when service set.
- Multiple OPEN leads for different services allowed.
- Generic → service: update generic in place if no conflict; else oldest wins, archive duplicate `ARCHIVED` / `MERGED_DUPLICATE_OPEN_LEAD`.
- Customer merge: lock → resolve collisions → archive losers first (`MERGED_AFTER_CUSTOMER_MERGE`) → reparent.
- Assignment FK: `(organization_id, assigned_user_id) → organization_members(organization_id, user_id)`.
- `qualificationState` DERIVED via `deriveQualificationState` (not stored).
- getLead/ensureLead ambiguity: >1 OPEN without selector → `AMBIGUOUS_LEAD`.
- LeadActivity: app_runtime SELECT+INSERT only.
- AI cannot assign/archive/disqualify/overwrite human-owned non-null fields.
- Roles: read OWNER|ADMIN|MEMBER; mutate/assign OWNER|ADMIN.

## Tools (opt-in AgentConfig)

`ensureLead`, `updateLeadQualification`, `getLead`, `transitionLead` (non-terminal AI only).

## Non-goals

Booking, WON/BOOKED, ML scoring, campaigns, clinical data.
