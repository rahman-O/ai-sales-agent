# Phase 08 — Scope manifest

Status: **CLOSED**. Meta WhatsApp Cloud API transport on P03 durable pipeline. No P09+.

## Design lock (summary)

- Provider: Meta WhatsApp Cloud API only (`provider=meta_whatsapp`)
- Graph version: `META_GRAPH_API_VERSION` env (pinned at implement time; no `latest`; prod fail-closed)
- GET webhook verify: application-level `META_WHATSAPP_VERIFY_TOKEN` (not tenant-resolved)
- POST: raw-body HMAC (`META_WHATSAPP_APP_SECRET`) then `phone_number_id` → ChannelConnection → org
- Outbound dispatch owner: **worker**; API persists Message + outbox only
- Provider send Idempotency-Key: **NOT RELIED UPON**; Message + OutboundAttempt authority
- Ambiguous dispatch → OutboundAttempt UNKNOWN; no blind resend
- Delivery: explicit transition table (not rank-only)
- Customer-care window: INBOUND Messages authority; `last_customer_inbound_at` projection only
- Templates: **DEFERRED_TO_P10**; outside 24h → POLICY_REJECTED
- Media: inbound metadata only; outbound text only
- No WhatsApp agent tools; no second message store

## Non-goals

Instagram, Twilio/Evolution, media download, template/campaign infra, takeover UI (P09), assumed Meta Idempotency-Key.
