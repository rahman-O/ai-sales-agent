# Phase 00 WhatsApp discovery record

Review date: 2026-09-23. No Meta account, credentials, provider console, test number, or live callback was available. Requirements are classified below; Phase 08 is not implemented.

## VERIFIED from current primary policy/documentation

- The WhatsApp Business Platform requires business/provider onboarding and technical configuration; a business may automate replies but must provide clear escalation paths.
- Business-initiated conversations use approved message templates. A business may send non-template replies within 24 hours of the last user message; outside that service window an approved template is required.
- Contact permission/opt-out and applicable-law responsibilities remain with the business. Dental/health-related use needs a specific policy and jurisdiction review.
- Webhook subscription uses a verification challenge/token flow. POST authenticity must be checked against the raw body with the provider signature/app secret as defined for the selected current API setup; the challenge token is not POST authentication.
- Provider acceptance, delivery, and read status are distinct; the application must store provider IDs/status events and must not call acceptance “delivered.”

Sources: [WhatsApp Business Messaging Policy](https://whatsappbusiness.com/policy/) and current [Cloud API webhook documentation](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks). Exact payloads and selected API version still require live verification.

## ASSUMED architecture behavior pending live test

- A clinic-owned WhatsApp business identity/number maps to one ChannelConnection and one organization.
- Each canonical inbound message supplies a stable provider message ID suitable for connection-scoped deduplication; status callbacks reference outbound provider IDs.
- The adapter can classify sends as ACCEPTED, REJECTED, or UNKNOWN after timeouts; automatic retry is allowed only when provider evidence makes duplication safe.
- Text inbound/outbound and approved templates are enough for MVP. Unsupported media is persisted as metadata and handed off or receives approved fallback wording.
- Credentials can be rotated without exposing values to browsers/logs, and revoked credentials produce an actionable disabled connection state.

These are design assumptions, not claims about an untested account or API version.

## REQUIRES LIVE PROVIDER TEST

- Meta developer/business account ownership, app review/permissions, clinic/dental policy eligibility, phone-number/test-number access, app subscription, and selected Graph API version.
- Exact GET challenge and POST signature header/algorithm behavior on captured raw requests.
- Actual inbound text, reply, status, mixed-batch, duplicate delivery, retry timing, out-of-order status, unsupported event, and provider message-ID fixtures.
- Outbound free-form text within the service window, approved template outside it, template approval/rejection/paused behavior, locale variables, rate/quota responses, credential revocation, and reconnect.
- Timeout after possible acceptance and whether the selected API/account exposes a reliable reconciliation path. Do not invent exactly-once delivery.
- Current pricing/usage fields and retention obligations. These must be dated because provider behavior changes.

## Required Phase 08 fixture pack

Store sanitized raw body plus relevant headers, expected verification result, normalized canonical events, dedup identity, expected database effects, acknowledgement status, and outbound/result classification. Required cases: challenge success/failure; valid/invalid signature; single text; multiple messages; message plus statuses; duplicate batch; duplicate message in a new batch; late message; status before local provider-ID association; delivery/read/failure; unknown phone/account; unsupported media; outbound accepted/rejected/429/5xx/timeout; approved and unavailable template; revoked token. Remove customer PII and secrets.

## Credential and failure contract

Keep app secret, verification token, access token, business/phone IDs, and template configuration as distinct typed secrets/configuration. Envelope-encrypt tenant credentials or store vault references; log versions/last validation only. Persist receipt/message/outbox before success acknowledgement. On database failure, return a provider-retryable error. Deduplicate by provider message identity, not whole payload hash. An outbound timeout after possible acceptance becomes UNKNOWN and is not blindly resent. Provider outage leaves durable pending work and triggers circuit/alert behavior.

## Readiness

BLOCKED — HUMAN ACTION REQUIRED. Provide the owner of Meta business assets, a test app/number and permitted recipient, credentials through the approved secret mechanism, at least one approved test template, and authorization to run the sandbox protocol. Until dated sanitized fixtures and results exist, P00-T003 and provider readiness remain incomplete.

