# Observability and explainability

Correlate request_id, event_id, organization_id, conversation_id, ingress sequence, run_id, tool_call_id, operation_key, outbound_id and provider_message_id. Store IDs in structured logs/traces; avoid tenant/customer IDs as unbounded metric labels. Use approved access-controlled drill-down for tenant reports.

AgentRun records provider/model identifier, adapter version, prompt and config versions, input watermark, summary version, retrieved chunk references/scores, tool schema versions, timestamps, result state and usage estimates. Persist a redacted context manifest; raw prompt capture is opt-in with restricted retention. This explains available evidence and chosen actions without requesting or storing hidden model chain-of-thought.

ToolCall records requested and normalized arguments (redacted), actor authorization outcome, action reference, result code, timeout/retry count and latency. Successful mutations have matching AuditLog and operation-ledger entries. Separate model latency, queue delay, tool duration, database latency and send delay.

Metrics: acknowledged receipts, dedup hits, oldest pending input, lease expiry, stale-write rejection, UNKNOWN send count, slot conflicts, takeover delay, model tokens/cost, tool denial, retrieval abstention and attributed lead/booking outcomes. Alert thresholds belong in [monitoring](../10-devops/monitoring.md).

OpenTelemetry-compatible trace IDs allow optional Langfuse integration behind a redacting exporter. A telemetry outage must not block ordinary reads; failure to write a required mutation audit in PostgreSQL rolls back that mutation. Business truth must never depend on a trace vendor being available.
