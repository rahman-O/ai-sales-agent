# Terminology

- **Organization / tenant:** isolation and billing boundary; not a messaging account.
- **User:** global authenticated staff identity. **OrganizationMember:** tenant-specific role and membership; a user may belong to multiple tenants.
- **Customer:** tenant-owned person/contact. **CustomerIdentity:** channel-specific address; matching phone numbers across tenants never merges people.
- **Conversation:** customer-channel thread with one ownership mode and ordered ingress sequence.
- **Lead:** one sales opportunity, not the customer record. Qualification is a business policy with evidence.
- **Booking:** committed allocation of one staff resource to a service and customer for a time interval.
- **AgentRun:** bounded processing attempt over an input watermark. **ToolCall:** validated action request and recorded result.
- **Operation key:** durable identity of a business command across retries. **Provider message ID:** transport identity, not a booking key.
- **Inbox receipt:** durable accepted provider event. **Outbox:** transactionally recorded intent to perform an asynchronous effect.
- **Ownership epoch:** monotonically increasing conversation control version; invalidates stale runs and sends.
- **Fence:** monotonically increasing worker lease token checked at commit.
- **Summary watermark:** highest message sequence represented by a conversation summary.
- **RAG:** retrieval of approved unstructured evidence; not a price or slot database.
- **Attendance:** observed post-booking outcome. **Revenue:** separately verified monetary outcome.
