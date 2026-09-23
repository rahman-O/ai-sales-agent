# Phase 04 — Pre-migration review gate

Date: 2026-09-23. Status: all mandatory items RESOLVED before migration generation.

| Item | Status | Resolution |
|------|--------|------------|
| AGENT RUN KEY | RESOLVED | `run_key` from org+conversation+targetIngressSequence+ownershipEpoch+configVersionId; UNIQUE(organization_id, run_key); create-or-resume |
| COMMAND OPERATION KEY | RESOLVED | hash(runKey, toolCallOrdinal, toolName, toolVersion, argsHash); UNIQUE(organization_id, operation_key); not agentRunId |
| MUTATING ACTION GATE | RESOLVED | Short TX before createCustomer/handoff: revalidate fence/epoch/mode/watermark; mutation+CommandOperation atomic |
| HANDOFF TERMINAL | RESOLVED | Epoch bump + HANDOFF_REQUESTED; no further LLM; optional CONTROL ack; no stale AI outbound |
| TARGET INGRESS WATERMARK | RESOLVED | Uses P03 `ingress_sequence` / `next_sequence` only; timeline advances do not mark stale |
| FINAL OUTBOUND DEDUP | RESOLVED | At most one final outbound per SUCCEEDED run; atomic Message+outbox+terminal+cursor; FK unique when set |
| MODE/CURSOR | RESOLVED | AI_PAUSED/HUMAN_ACTIVE/CLOSED do not auto-advance processed_sequence |
| TERMINAL/RETRY MATRIX | RESOLVED | Documented in scope/hardened plan; poison leaves cursor audited |
| AGENT CONFIG AUTH | RESOLVED | ADMIN/OWNER for version/activate/disable; OPERATOR+ read; immutable activated versions; one ACTIVE per org |
| TEST-RUN SANDBOX | RESOLVED | No real mutate/handoff/outbound; dry-run executor |
| SUMMARY TRUST | RESOLVED | Untrusted context; never authorizes; CAS; separate summary model budget |
| CREATE CUSTOMER | RESOLVED | Ensure/update bound customer only; never second customer when conversation.customer_id set |
| MODULE OWNERSHIP | RESOLVED | `packages/agent-core` pure orchestrator; API/worker adapters only |
| FAKE PROVIDER | RESOLVED | Fail closed in production without valid production provider |
| RLS / GRANTS | RESOLVED | FORCE RLS; app_runtime grants; no BYPASSRLS; no new broad SECURITY DEFINER |
| DESTRUCTIVE OPS | RESOLVED | Non-destructive adds only |

## Tables added (planned)

`agent_configs`, `agent_runs`, `tool_calls`, `command_operations`, `usage_events`, `conversation_summaries`

## Explicitly not in migration

No DROP of P01–P03 data; no RLS weaken; no lease/fence semantics change; no Customer merge change; no ADR-011 function rewrite.
