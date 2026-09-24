# Phase 08 — Closure report

Date: 2026-09-24.

## PHASE 08 ENGINEERING: CLOSED

## P08 LIVE_PROVIDER_ACCEPTANCE: NOT_RUN

Reason: Meta sandbox/provider action remains pending with a human owner. This does not reopen the engineering closure. It is carried forward as a P13/P14 pilot-readiness dependency.

## PROVIDER
Meta WhatsApp Cloud API (`provider=meta_whatsapp`)

## GRAPH API VERSION
`v25.0` via `META_GRAPH_API_VERSION` (pinned from Meta Cloud API docs at implementation time; no `latest`)

## Scope delivered

- Application-level GET webhook verify (`META_WHATSAPP_VERIFY_TOKEN`)
- POST raw-body HMAC (`META_WHATSAPP_APP_SECRET`) then `phone_number_id` → ChannelConnection → org
- `persistInbound` reuse; `last_customer_inbound_at` projection on new inbound only
- Worker-owned outbound dispatch (`OutboundMessageReady` → OutboundAttempt → Meta send)
- Provider Idempotency-Key **not** used; Message + OutboundAttempt authoritative
- AMBIGUOUS_DISPATCH → UNKNOWN; no blind resend
- Explicit delivery transition table
- Templates **DEFERRED_TO_P10**; outside 24h → POLICY_REJECTED
- Operator `/v1/organizations/:id/channels` + `/settings/channels` UI (no secrets)
- ADR-006 ACCEPTED; migration `202609240400_p08_whatsapp`

## Gate results

| Gate | Result |
|------|--------|
| WEBHOOK GET VERIFICATION | **PASS** (unit) |
| WEBHOOK POST SIGNATURE / RAW BODY | **PASS** (unit) |
| TENANT RESOLUTION | **PASS** (unique phone_number_id; unknown channel no Message) |
| INBOUND DEDUP / WINDOW PROJECTION | **PASS** |
| OUTBOUND ADAPTER | **PASS** |
| OUTBOUND IDEMPOTENCY / AMBIGUOUS | **PASS** |
| DELIVERY TRANSITIONS | **PASS** |
| ERROR / RETRY CLASSES | **PASS** |
| CUSTOMER-CARE POLICY | **PASS** |
| TEMPLATE SUPPORT | **DEFERRED_TO_P10** |
| MEDIA | **DEFERRED** (inbound metadata only) |
| SECRET BOUNDARY | **PASS** |
| MINIMAL UI | **PASS** |
| LIVE_PROVIDER_ACCEPTANCE | **NOT_RUN** (human Meta sandbox/provider action pending) |
| P01–P07 REGRESSIONS | **PASS** — 17/17 integration (incl. phase08) |
| BUILD / TYPECHECK (api, worker, web, adapters) | **PASS** |

## REMAINING BLOCKERS

NONE (engineering). Live Meta sandbox/provider acceptance is a P13/P14 readiness dependency only.

## TECHNICALLY_READY_FOR_P09

**YES** — transport foundation is in place; P09 takeover UI not started.

## P09_AUTHORIZED

**NO**

## STOP

No Phase 09+ work starts in this closure.
