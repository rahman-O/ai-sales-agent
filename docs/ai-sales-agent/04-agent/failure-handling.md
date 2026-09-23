# Failure handling and recovery

Classify failures before retry. Validation/authorization/schema-denial and terminal state conflicts do not retry automatically. Slot conflicts ask for a new proposal. PostgreSQL deadlock/serialization failures may retry the short command transaction up to three times with jitter and the same operation key.

Model 429/temporary 5xx may retry once if Retry-After and the 45-second run deadline permit; an approved fallback consumes the same total model-call budget. Malformed output allows one schema repair within budget, then safe pause. Provider refusal yields approved clarification/escalation, not an attempt to bypass refusal. A timeout may incur model cost even if no output was received.

Background jobs use up to five attempts with exponential jitter starting at two seconds, bounded at five minutes. This applies only to repeat-safe work. Exhausted work becomes a durable failed/dead-letter record with tenant, target IDs and safe reason. Operator replay creates an audited attempt against the original operation identity after fixing the cause. Permanent failures stop the conversation cursor until quarantine/skip is explicitly recorded; later messages do not silently overtake failed input.

Expired leases can be reclaimed; stale commits fail fences. Redis failure leaves database intent pending for the sweeper. Database unavailable means no webhook success acknowledgement. Unknown provider send outcomes require reconciliation; they do not use the ordinary five-attempt retry policy.

On tenant suspension, revoked consent, human takeover or channel disconnect, cancel/suppress eligible pending work at execution and dispatch time. A daily recovery review checks oldest outbox, failed jobs, orphaned runs and UNKNOWN sends. [Monitoring](../10-devops/monitoring.md).
