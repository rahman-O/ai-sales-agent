# API principles

Staff base: /v1/organizations/{organizationId}. Resolve identity and active membership independently of the path. JSON DTOs reject unknown properties; schemas are versioned and documented with generated OpenAPI during implementation. Dates are RFC3339 instants plus explicit display timezone; money minor units serialize as strings.

Responses use {data,meta:{requestId,nextCursor?}}; errors use {error:{code,message,details?},requestId}. Never return secrets or internal exception traces. 400 malformed input; 401 unauthenticated; 403 insufficient role within known tenant; 404 absent or out-of-scope resource; 409 version/idempotency/slot conflict; 422 valid shape but invalid business transition; 429 quota; 503 transient dependency unavailable.

Use opaque cursor pagination with stable ID tie-breaker, default 25/max 100; allowlist sorting/filtering. Writes require expectedVersion or If-Match for existing aggregates. POST commands accept Idempotency-Key; conflicting key reuse returns 409. Async ingestion/export returns 202 with a scoped status resource, never an untracked fire-and-forget.

Role capabilities are in [security architecture](../02-architecture/security-architecture.md). Cookie sessions require CSRF and origin validation. Audit privileged reads/exports and every sensitive mutation. SSE uses session auth and tenant-checked subscriptions with resumable event IDs; durable state is fetched via normal APIs. No direct browser access to database service credentials.
