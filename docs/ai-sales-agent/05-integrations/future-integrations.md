# Future integrations

Instagram requires adapter-specific identity, permission review, messaging-policy and receipt tests; it must not fork the agent runtime. Web Chat requires public session identity, abuse prevention, customer authentication options and reconnect semantics. Neither is necessary to prove WhatsApp MVP.

External CRM sync needs field ownership, conflict policy, delta checkpoints and durable external IDs. Payments require an independent financial ledger and signed idempotent webhooks; booking success must not silently mean payment success. Voice needs explicit recording/consent policy, interruption and latency budgets and escalation UX.

Integrate only after a measured pilot need and an ADR. Reuse current domain commands and channel/provider boundaries, adding provider-specific contracts where required rather than a universal connector framework. Each integration must specify replay behavior, credentials, retention, failure recovery and tenant isolation tests before release.
