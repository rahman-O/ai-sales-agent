# Goals and non-goals

## Goals

- Preserve every acknowledged inbound message durably and process conversations in accepted order.
- Prevent tenant crossing at API, database, queue, cache, storage, search, and trace boundaries.
- Keep prices and appointment availability authoritative in PostgreSQL.
- Bound autonomy, latency, spend, and retry behavior; expose uncertainty to operators.
- Prove safe handoff and restart recovery before inviting external customers.
- Support Iraqi Arabic and English in evaluation; avoid assuming Arabic localization is solved by translation.

## Non-goals

No diagnosis, medical triage, clinical records, prescriptions, autonomous discounts, payment collection, custom model training, or unrestricted tool execution. No microservices, Kafka, Kubernetes, separate vector database, or general workflow builder for the initial release.

Clinic reception use requires a product/privacy decision on what data can be collected; this plan does not assert jurisdiction-specific compliance. Generic extensibility means clear domain boundaries, not arbitrary entity builders. Scope changes require updating acceptance criteria and an [ADR](../12-decisions/README.md).
