# Messaging channel contract

MessagingChannel methods: verifyWebhook(rawBody,headers,connectionContext), normalizeEvents(verifiedPayload), getCapabilities(connection), evaluateSendPolicy(intent,currentState), send(intent,credentialRef), normalizeDeliveryEvent(payload), and reconcile(attempt) where supported. Verification/challenge behavior may be adapter-specific; domain messages remain channel-neutral.

Inbound event: connection reference, provider event/message ID, external sender identity, occurredAt, receivedAt, type, text or media metadata and replyTo ID. Trusted server mapping supplies organization; external sender is a customer address, never a staff actor. Invalid/unknown event types go to a bounded quarantine.

Outbound intent: internal message ID, recipient identity reference, semantic purpose, text/template variables, ownership epoch, operation key and deadline. Adapter returns ACCEPTED with provider ID, REJECTED with normalized error, or UNKNOWN. Never normalize unknown acceptance to a retryable rejection.

Capabilities describe text/media/template/receipt support and limits. Future channels implement contract tests before registration. A fake adapter simulates duplicates, timeouts and receipt reordering during P03/P04; it remains test-only, not a public Web Chat feature. [Messaging architecture](../02-architecture/messaging-architecture.md).
