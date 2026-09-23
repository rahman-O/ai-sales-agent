# Controlled tool registry

Each registry entry defines name, semantic version, concise purpose, JSON input schema, normalized result schema, read/mutate classification, required capability, handler, timeout, retry class, audit policy and confirmation requirement. Reject unknown properties and tool names; bound every string, list, date range and search limit. Registry is code-owned, not tenant-uploaded executable code.

Backend injects organization, actor, customer/conversation binding, run/fence/epoch, operation key and trace. The model cannot override them. Tool access is the intersection of platform allowlist, tenant-enabled capabilities, channel/customer context, conversation mode and actor authorization; generating a schema is not authorization.

Every invocation checks role/state again immediately before committing. Read tools restrict customer access to the conversation's bound customer; mutation tools call domain commands. No generic SQL, HTTP fetch, filesystem, script execution or arbitrary calendar tool is exposed.

Normalized envelope: {ok, code, data, retryable, operationId, evidenceRefs, safeMessage}. Error codes include INVALID_INPUT, FORBIDDEN, NOT_FOUND, CONFLICT, CONFIRMATION_REQUIRED, STALE_PROPOSAL, RATE_LIMITED, TIMEOUT and TEMPORARY_UNAVAILABLE. ToolCall records denials as well as successes, with redacted arguments. [Contracts](tool-contracts.md) is the schema planning source of truth.
