# Value objects

- TenantContext: server-resolved organization ID, actor type/ID, permissions, request correlation; not an LLM argument.
- Money: signed integer minor units plus ISO currency; service price nonnegative, refunds separate signed outcomes. Serialize large integers as decimal strings to avoid JavaScript precision loss.
- TimeRange: UTC start/end, exclusive end, start < end; preserve display IANA timezone and original user expression for clarification, not execution.
- ContactAddress: channel plus normalized address; E.164 normalization where applicable, not an identity merge across tenants.
- ResourceSlot: staff ID, service ID, start/end, schedule version and expiring quote reference; availability is rechecked at commit.
- ConfirmationEvidence: proposal ID, customer message sequence, exact proposed fields/hash, expiry, and consumed operation reference. A model-supplied boolean is not confirmation.
- OperationKey: server-issued opaque identity for a semantic command; canonical input hash detects incompatible reuse.
- Version: monotonic optimistic-lock value; stale writes return CONFLICT rather than silently overwriting newer state.
- ConsentRecord: purpose, channel, status, source message/operator, collected_at and revoked_at; consent is not inferred from model sentiment.

Validate at transport and command boundaries. Reject ambiguous local dates and unsupported currency instead of coercing silently.
