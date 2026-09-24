# Conversation API

Base: `/v1/organizations/{organizationId}/conversations`. Active `OWNER` / `ADMIN` / `MEMBER` membership required. Shared transport rules: [API principles](api-principles.md).

## List / read

| Method | Path | Notes |
|--------|------|-------|
| GET | `/?mode=&unassignedOnly=&assignedToMe=&cursor=&limit=` | Inbox; default sort `lastMessageAt` desc |
| GET | `/{id}` | Conversation detail |
| GET | `/{id}/messages?cursor=` | Timeline |
| GET | `/events` | SSE refetch hints only |

## Control (CAS = `expectedOwnershipEpoch`)

| Method | Path | Authz |
|--------|------|-------|
| POST | `/{id}/takeover` | MEMBER+ → claim self from `AI_ACTIVE` / unassigned pause; ADMIN/OWNER may force |
| POST | `/{id}/claim` | MEMBER+ claim unassigned `AI_PAUSED` |
| POST | `/{id}/reassign` | ADMIN/OWNER `{ ownerUserId }` |
| POST | `/{id}/release` | Owner or ADMIN/OWNER; stays `AI_PAUSED` |
| POST | `/{id}/resume-ai` | ADMIN/OWNER; sets eligibility cursor; no catch-up runs |

Body includes `expectedOwnershipEpoch`. Optional `reasonCode` / `reasonText` on takeover. Stale → **409** `OWNERSHIP_CHANGED`.

Public **`POST /{id}/mode` is hardened** — rejects arbitrary mode sets (use control ops). `HUMAN_ACTIVE` is never accepted.

## Human reply

`POST /{id}/replies` with header `Idempotency-Key` and body `{ text, expectedOwnershipEpoch }`.

- Requires `AI_PAUSED`; assignee match or ADMIN/OWNER override
- Creates `OUTBOUND` / `OPERATOR` / `PENDING` Message + `OutboundMessageReady`
- Idempotency scope: organization + conversation + actor + `conversation.human_reply`
- Same key + same payload → same Message; same key + different payload → **409 CONFLICT**

## Invariants

Claim is compare-and-swap; competing claim returns 409. Control increments epoch and suppresses stale `PENDING` AI. Pre-dispatch requires AI mode+authority epoch match. Expose `DISPATCHING` / `UNKNOWN` rather than claiming recall.
