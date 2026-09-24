# Phase 09 — Scope manifest

Status: **CLOSED**. Human takeover control plane on P03/P04/P08. No P10.

## Design lock (FINAL)

- Human ownership: **`AI_PAUSED` + `owner_member_id`** (not `HUMAN_ACTIVE`)
- `HUMAN_ACTIVE`: **LEGACY_NON_AI** — DB CHECK retained; app never transitions into it; public APIs reject it
- Control CAS: **`expectedOwnershipEpoch`** only → `OWNERSHIP_CHANGED` on stale
- `owner_member_id` stores `organization_members.user_id`; composite FK `(organization_id, owner_member_id)`
- Resume: set **`ai_eligible_after_sequence`** = current ingress max; do **not** misuse `processed_sequence`; no catch-up AgentRuns
- AI outbound: stamp **`authority_epoch`**; pre-dispatch require `AI_ACTIVE` + epoch match else `SUPPRESSED`
- Takeover suppresses `PENDING` AI; in-flight `DISPATCHING` not recallable
- Public `POST .../mode` **HARDENED** — no arbitrary mode mutation; use takeover/claim/reassign/release/resumeAI
- Handoff: extend P04 `finalizeHandoff` pause metadata (no second path)
- Human reply: `Idempotency-Key` scoped org+conversation+actor+`conversation.human_reply`
- Roles: MEMBER self-claim/reply/release own; ADMIN/OWNER reassign/force/resume
- No `takeoverAndReply`; no P10 templates/follow-ups

## Non-goals

Automatic timed resume, skill-based routing, WFM/SLA engines, P10 campaigns/templates, inventing `expectedVersion` as primary CAS.
