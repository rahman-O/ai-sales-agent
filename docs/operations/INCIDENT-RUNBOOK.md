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

### Incident D: Bad Deployment / Schema Migration Regression

1. **Assess Impact**:
   Determine whether code rollback is sufficient without touching the database schema.
2. **Execute Code Rollback**:
   Roll back container tags to the previous stable release.
3. **Evaluate Database Forward-Fix**:
   If a migration added a column or table, existing code ignoring the new column will function normally. If a constraint or column was dropped mistakenly, apply a targeted forward-fix migration.
