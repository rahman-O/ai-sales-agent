# Webhook API

Base: `/v1/webhooks/whatsapp/meta`. Public transport route authenticated by Meta signature / verify token — not staff session.

## Contracts

### GET /

Subscription challenge. Application-level `META_WHATSAPP_VERIFY_TOKEN` only (not ChannelConnection-scoped). Return `hub.challenge` only when `hub.mode=subscribe` and token matches; otherwise 403. Never echo challenge on failure.

### POST /

1. Verify `X-Hub-Signature-256` against **raw request body bytes** + `META_WHATSAPP_APP_SECRET` (constant-time).
2. Parse JSON only after signature success.
3. Extract `phone_number_id` → ChannelConnection (`provider=meta_whatsapp`) → organizationId.
4. Normalize inbound/status events; persist via P03 `persistInbound` / delivery apply.
5. ACK after durable acceptance (or bounded unknown-channel diagnostic). No LLM in request path.

Unknown `phone_number_id`: no tenant Message; bounded structured log/diagnostic only.

## Invariants

Missing/invalid signatures → 401/403; oversize → 413; DB failure → 503. Signed duplicates succeed after dedup. Templates deferred (P10); outside 24h free-form → POLICY_REJECTED at dispatch.
