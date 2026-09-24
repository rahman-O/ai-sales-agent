# WhatsApp first integration

Use the Cloud API through the MessagingChannel adapter. Graph API version is pinned via `META_GRAPH_API_VERSION` (no `latest`; production fail-closed). Webhook GET verify uses application-level `META_WHATSAPP_VERIFY_TOKEN`. POST authenticity uses raw-body HMAC with `META_WHATSAPP_APP_SECRET`, then tenant resolution via `phone_number_id` → ChannelConnection.

The current policy permits free-form replies within 24 hours of the last customer inbound Message; outside that window free-form is **POLICY_REJECTED** (template sending deferred to P10). Proactive contact requires recorded permission, and opt-outs must be honored.

Outbound dispatch is owned by the **worker**. Application-level idempotency uses Message + OutboundAttempt — Meta send `Idempotency-Key` is not relied upon. Ambiguous HTTP outcomes (timeout after possible accept) set OutboundAttempt to UNKNOWN with no blind resend.

MVP text support: inbound text, outbound text inside the customer-care window, delivery/read/failure receipts with an explicit delivery transition table. Unsupported media is recorded as metadata without download. [Webhooks](webhooks.md) and [channel contract](messaging-channel-contract.md).

