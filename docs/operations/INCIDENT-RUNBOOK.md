# Incident Response Runbook

Operational troubleshooting and mitigation procedures for live platform incidents.

---

## 1. Severity & Incident Classification

- **P0 — Critical Outage**: Core transactional workflows down (all inbound messaging stalled, API unavailable, or data leak detected).
- **P1 — Major Degradation**: LLM provider outage, queue backlog exceeding threshold, or single tenant degraded.
- **P2 — Moderate Issue**: Background follow-up delay, non-blocking UI issue, partial analytics delay.

---

## 2. Component Runbooks

### Incident A: API Service Down or 503 on `/health/ready`

1. **Check Component Readiness**:
   Query `/health/ready` response payload. Inspect `checks.database` and `checks.redis`.
2. **Database Failure**:
   - Check connection pool saturation in PostgreSQL / Supabase pooler.
   - Check database CPU / memory / disk usage.
   - Verify network connectivity between API and PostgreSQL.
3. **Redis Failure**:
   - Verify Redis container / cluster is running and responding to `PING`.
   - Check Redis memory usage and maxclients limit.

---

### Incident B: Worker Processes Stalled / Queue Backlog Spike

1. **Inspect Worker Logs**:
   Look for `worker_job_failed`, `outbox_relay_failed`, or uncaught exceptions.
2. **Check Conversation Leases**:
   Query `conversations` with expired leases:
   ```sql
   SELECT count(*) FROM conversations WHERE lease_expires_at < now() AND mode = 'AI_ACTIVE';
   ```
3. **Reclaim Leases**:
   Worker automatically runs sweeper every 5 seconds. If worker crashed, new worker boot will reclaim leases via `reclaim_expired_conversation_leases(25)`.
4. **Restart Workers**:
   Perform rolling restart of worker pods/services.

---

### Incident C: DeepSeek / AI Provider Outage or Latency Spike

1. **Check Error Rate**:
   Inspect worker logs for `code: 'MISSING_DEEPSEEK_API_KEY'` or HTTP 429/500 from `api.deepseek.com`.
2. **Deterministic Finalization Fallback**:
   The agent architecture executes transactional mutations directly in tool execution before LLM response generation. If the LLM call fails post-mutation, the backend transaction remains committed safely and deterministic finalization takes over.
3. **Emergency AI Disable (Per-Org or Global)**:
   - **Org-level kill**:
     ```sql
     UPDATE organizations SET ai_emergency_disabled_at = now(), ai_emergency_disabled_reason = 'provider_outage' WHERE id = :org_id;
     ```
   - **Global kill switch**:
     Set environment variable `AI_EMERGENCY_DISABLE_ALL=true` and restart worker. Workers will pause starting new agent runs and hold inbound messages in durable backlog without dropping data.

---

### Incident D: Messaging Provider Incident & Failures

1. Stop new sends by setting the affected `ChannelConnection` inactive or unhealthy through the authorized operator path.
2. Preserve messages, webhook receipts, outbound attempts, request IDs, and provider IDs. Do not delete or replay evidence.
3. Classify the failure: signature/authentication, rate limit, provider outage, invalid recipient/content, or ambiguous dispatch.
4. For a credential incident, revoke and rotate at Meta, update the secret store referenced by `credentialRef`, restart affected workloads, and verify with an authorized test target. Never paste the secret into logs or chat.
5. For ambiguous dispatch, leave the message `UNKNOWN`; reconcile with provider evidence or an operator before any replacement send.
6. For 401/403, keep the channel `AUTH_FAILED` and do not retry indefinitely. For 429/5xx, use bounded backoff and provider guidance.
7. Confirm business mutations remain authoritative and deduplicated, then document customer remediation if delivery was uncertain.
8. Restore service gradually, monitor error/dedup/status metrics, and close only after cause, impact, rotation/repair, and regression evidence are recorded.
