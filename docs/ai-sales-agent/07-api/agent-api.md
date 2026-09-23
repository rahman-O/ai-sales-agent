# Agent and run API

Proposed routes; none are implemented. Shared transport/error/version rules: [API principles](api-principles.md).

## Authority and base

Base: `/v1/organizations/{organizationId}/agent`. ADMIN/OWNER publish configuration; OPERATOR inspects permitted conversation traces.

## Contracts

GET /config; POST /config/versions validates allowed tools/model/budgets; POST /config/versions/{version}/activate uses expected active version; POST /test-runs executes sandbox-only dry runs; GET /runs?conversationId=&cursor= and /runs/{id}/tool-calls return redacted evidence; POST /disable pauses new agent work. Test runs use isolated fixtures and never mutate live bookings or send to customers.

## Invariants, failure and verification

Reject unknown tools, unsupported model capabilities and budget expansion above platform caps. Activating configuration stores audit/release evidence. Disable invalidates active output authority. Test malicious tenant prompts, trace-role access and dry-run side-effect isolation.
