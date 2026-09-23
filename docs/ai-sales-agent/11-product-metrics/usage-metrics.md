# Usage metrics

Track inbound accepted messages, deduplicated messages, outbound attempts/acceptances/deliveries, conversations, agent runs, model attempts, tool attempts/committed operations, knowledge ingestions and stored bytes. Retries consume resources even if no new business effect occurs.

UsageEvent records quantity/unit/source/reference and whether measured or estimated. Model attempts and embedding batches have separate categories. Count customer-visible messages independently from provider API attempts. Deduplicate provider usage imports with stable request identity.

Quota checks occur before expensive work with atomic reservations; release unused reservations after reconciliation. Operational quotas are not a complete billing system. SaaS subscription invoicing, taxes and metered charging are deferred until commercial policy is approved. Test concurrent quota reservations and delayed usage receipts.
