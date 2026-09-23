# Future roadmap

No deferred item is approved or scheduled. Promote only after pilot evidence and an ADR identifies value, operational impact and acceptance tests.

- Instagram (L): reuse MessagingChannel; validate account permissions, identity mapping, policy and receipt differences. Depends on stable P08/P09.
- Public Web Chat (L): widget/session identity, abuse limits, reconnect and optional authenticated customer access. Depends on tested channel/ownership contracts.
- External calendar integration (XL): bidirectional source ownership, conflict/reconciliation and provider replay. Must move earlier if Q02 requires it.
- Multi-location/resource and recurring booking (XL): new allocation constraints, capacity/recurrence semantics and partial-failure UX. Do not stretch one-resource rules silently.
- Payments/deposits (XL): financial ledger, signed webhooks, refund/cancellation policy and payment-versus-booking state distinction.
- Advanced CRM (L): pipeline customization, imports, merge governance and external field ownership; justify beyond current lead module.
- Voice (XL): realtime interruption, recording/privacy, latency and human escalation; separate evaluation and operating costs.
- Advanced automation (XL): versioned workflow definitions, replay and consent limits only after simple follow-ups show demand.
- Advanced evaluation (M/L): larger adversarial datasets, calibrated monitoring and controlled experiments. Baseline AI evaluation already belongs in MVP.

Dedicated tenant infrastructure, warehouses and microservices need contractual or measured scale/team pressure. A future-roadmap label is not a requirement to build abstraction layers now.
