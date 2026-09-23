# Phase 00 security and threat review

Status: REVIEWABLE DESIGN; controls are unimplemented and untested. Risk IDs refer to the canonical [risk register](../13-risks/risk-register.md).

## Tenant leakage and IDOR

Threat: an authenticated user, job, raw query, cache, storage URL, trace, vector query, or export accesses another organization by guessed ID or missing scope. Impact: critical confidentiality/integrity breach (R01). Prevention: server-resolved membership, organization-scoped repositories, composite foreign keys, transaction-local FORCE RLS, tenant-prefixed caches/objects, scoped event subscriptions, and no model-selected tenant. Detection: denial/audit signals, policy-metadata CI check, cross-tenant canaries without PII. Recovery: disable affected path, revoke sessions/URLs, assess/export audit, notify under approved incident policy, fix and rerun complete isolation suite. Required test: two tenants with overlapping identifiers across every API/tool/job/storage/RAG/export path and reused pooled connections.

## Webhook spoofing and replay

Threat: forged, modified, replayed, or oversized provider callbacks create messages/actions. Impact: unauthorized customer state and denial of service. Prevention: raw-body signature verification, exact challenge handling, connection mapping, size/rate limits, durable event/message dedup, and no inference in request path. Detection: invalid-signature/replay counters and unknown-connection quarantine. Recovery: rotate secret if compromised, disable connection, replay only verified durable receipts. Required test: modified bytes, missing/wrong signature, repeated mixed batch, unknown number, crash after commit before acknowledgement.

## Duplicate or reordered messages

Threat: provider/queue retries or concurrent ingress produces repeated/out-of-order business effects. Impact: duplicate leads/bookings/messages (R02). Prevention: connection/provider-message uniqueness, database ingress sequence, operation ledger, outbox/consumer receipts, fenced processing, and explicit late-event semantics. Detection: dedup hits, stale-fence rejects, duplicate-effect reconciliation. Recovery: suppress replay, reconcile by operation/result references, never delete evidence silently. Required test: same event in same/new batch, two fast messages, late provider timestamp, crash/retry at each commit boundary.

## Prompt injection and malicious knowledge

Threat: customer text or uploaded document asks the model to ignore policy, reveal data, or invoke privileged tools. Impact: unauthorized action/data leakage (R07). Prevention: untrusted-context labeling, approved/versioned knowledge, sandboxed parsing, restricted registry, server authority, schema/business validation, no arbitrary network/code/SQL tools. Detection: tool denials, retrieval provenance, adversarial evaluations and abnormal tool patterns. Recovery: unpublish document, pause tenant automation, invalidate config/summaries, investigate runs and add regression fixture. Required test: direct/indirect injection in Arabic/English, cross-tenant secrets, hostile document, arbitrary URL/tool request.

## Tool abuse and unauthorized booking

Threat: model/user reuses foreign IDs, fabricated confirmation, stale proposal, or excessive tool loop to mutate state. Impact: wrong appointment/customer record and cost (R02/R03/R09). Prevention: server-injected bindings, explicit capabilities, strict schemas, action-specific proposal confirmation, expected versions, operation keys, loop/time/cost caps, and database conflict constraints. Detection: denial/result codes, operation/audit joins, limit alerts. Recovery: stop automation, preserve/repair through audited operator commands, notify affected operator/customer under policy. Required test: cross-customer/tenant IDs, ambiguous “yes,” changed terms, expired proposal, duplicate/fallback calls, concurrency.

## Price hallucination and false success

Threat: generated text invents a price, slot, booking, cancellation, or reschedule. Impact: customer harm and lost trust (R03). Prevention: relational price/availability tools, backend-rendered confirmation text from committed result, output gate, and no success before authoritative transaction. Detection: release evaluation with zero false-success tolerance and trace/result comparison. Recovery: pause model/config, operator correction, audit incident, regression case. Required test: stale/unsupported/variable price, slot conflict after offer, DB success with send failure, tool timeout/denial.

## PII and secret leakage

Threat: transcripts, phone numbers, clinical data, credentials, signed URLs, prompts, or provider errors appear in logs/UI/provider contexts. Impact: privacy/security breach (R08). Prevention: reception-only data minimization, field allowlists, redaction, restricted trace retention, encrypted/vault secrets, private storage, short signed URLs, and provider processing approval. Detection: secret/PII scans, access audits, sampled redaction checks. Recovery: revoke/rotate, expire URLs, purge permitted artifacts, execute incident/deletion workflow. Required test: secret-bearing errors, malicious filenames/content, role-limited traces, deletion across DB/vector/blob/cache/telemetry and restore ledger.

## Cross-tenant RAG retrieval

Threat: vector/lexical search returns another organization's chunks or unpublished/deleted material. Impact: critical data disclosure (R01/R07). Prevention: SQL tenant and publication filters, RLS, composite keys, version pointers, private object authorization, and context-manifest source checks. Detection: retrieval/source audit and synthetic tenant canaries. Recovery: disable search, unpublish, purge caches/index, inspect affected runs. Required test: identical text across tenants, raw vector query, unpublish/delete race, re-embedding versions.

## Background-job tenant leakage

Threat: queue payload or reused worker connection applies tenant A work under tenant B scope. Impact: cross-tenant mutation (R01). Prevention: minimal IDs in jobs, re-resolve ownership, transaction-local context per job, no session tenant state, consumer idempotency, and scoped service APIs. Detection: job/run/tenant correlation plus RLS denials. Recovery: stop workers, quarantine jobs, reconcile operations/audit, rotate runtime credentials if compromised. Required test: alternating tenants on same worker/connection, forged job organization, stale membership and duplicate job.

## Human/AI takeover race

Threat: stale AI mutation or outbound response commits after human takeover. Impact: contradictory or unsafe customer communication (R06). Prevention: ownership epoch and fenced lease checked at mutation/finalization/dispatch; pending old-epoch intents suppressed; explicit DISPATCHING exception. Detection: stale-write/intent rejection and in-flight UI alert. Recovery: operator sees already-submitted exception, sends correction if needed, reconciles UNKNOWN result. Required test: takeover during model call, tool transaction, final commit, dispatch claim, and provider request.

## Residual findings

All controls are planned, not implemented. Q01/Q05 block an approved privacy posture; Q06/D10 block secrets/auth design; Q07 blocks provider validation; P00 database spike blocks RLS/conflict proof. Any known tenant exposure, unconfirmed booking, false success, or unreconciled critical send blocks release. Existing R01–R15 cover the material risks; the register is updated below with Phase 00 evidence state rather than adding duplicate risk identities.

