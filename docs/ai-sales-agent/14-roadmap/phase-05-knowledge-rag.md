# Phase 05 — Approved knowledge and RAG

Status: NOT STARTED. Relative complexity: L. Proposed accountable owner: engineering lead with product reviewer. Dates and staffing are unestimated.

## 1. Objective

Answer unstructured tenant questions using approved versioned evidence without replacing relational tools.

## 2. Why This Phase Exists

Business FAQs need retrieval, publication control and deletion provenance; raw uploads cannot become trusted instructions.

## 3. Entry Criteria

P04 CLOSED; model/context/usage contracts exist; selected storage and embedding providers approved.

## 4. Scope

Private upload, scanning/parsing, document review, chunk/embedding jobs, publication pointer, scoped retrieval and source display.

## 5. Out of Scope

Website crawlers, OCR-heavy formats, separate vector service and prices/slots stored as RAG truth.

## 6. Architecture Impact

Knowledge module and isolated ingestion worker; searchKnowledge registered only after tenant/deletion tests pass.

## 7. Files / Modules Expected

Likely implementation locations: apps/api/src/modules/knowledge; apps/worker/knowledge; apps/web/knowledge; prisma/migrations.

## 8. Data Model Changes

KnowledgeDocument, KnowledgeDocumentVersion and KnowledgeChunk; object lineage, embedding model/dimension and tenant search indexes.

## 9. APIs

Knowledge upload/finalize/status/review/publish/unpublish endpoints, BlobStore/EmbeddingProvider and searchKnowledge tool.

## 10. Business Rules

Only a fully processed reviewed version publishes; unpublish removes retrieval visibility immediately; document instructions never change tool authority.

## 11. Implementation Tasks

- [ ] P05-T001: Implement scoped upload/finalization with object verification. Verification: Oversize/type mismatch and foreign object keys reject.
- [ ] P05-T002: Add isolated scanning/parsing pipeline. Verification: Malicious/timeout input remains quarantined and unpublished.
- [ ] P05-T003: Build idempotent chunk/embedding ingestion. Verification: Retry creates one version/chunk set and accounts for embedding cost.
- [ ] P05-T004: Implement atomic publication and deletion visibility. Verification: Partial/old versions never appear in search; unpublish is immediate.
- [ ] P05-T005: Add tenant-filtered retrieval under context limits. Verification: Two-tenant fixtures cannot return cross-scope chunks.
- [ ] P05-T006: Evaluate bilingual grounding and conflict precedence. Verification: Structured price tools override stale document price text; weak evidence abstains.

## 12. Testing Requirements

- Unit: Chunk boundaries, publication prerequisites, query/result caps and weak-evidence handling.
- Integration: Embedding retries, model dimension versioning, publication race, object deletion and RLS vector query.
- E2E: Admin uploads/reviews/publishes FAQ; customer gets sourced answer; unpublishing prevents future retrieval.
- Failure scenarios: Parser bomb, poisoned instructions, missing blob, partial embedding batch and provider outage.

## 13. Observability Requirements

Ingest stage/duration, failed document reason, chunk/model version, retrieval IDs/scores and embedding usage.

## 14. Security Considerations

Private buckets, sandboxed parser, approved content provenance, no arbitrary URLs and immediate revoke path.

## 15. Acceptance Criteria

- [ ] Only approved current tenant documents enter model context.
- [ ] Re-ingestion and retries cannot duplicate published versions.
- [ ] Deleted/unpublished documents are excluded before cleanup completes.
- [ ] RAG does not authorize price, availability or booking facts.

## 16. Exit Criteria

All P05 tasks are implemented or formally removed through reviewed scope change; required tests and acceptance checks pass; linked architecture/API/data documents match actual behavior; evidence and reviewer sign-off are recorded using the [closure template](phase-closure-template.md). No critical unresolved defect in this phase's boundary remains. A list of created files alone is not closure evidence.

## 17. Dependencies

Requires P04; can progress alongside P06 after P04; required for external MVP.

## 18. Risks

R01, R07, R09, R11; retrieval scores require dataset calibration.

## 19. Deliverables

Knowledge pipeline/UI, search tool, isolation/deletion tests and grounding evaluation report.

Canonical context: [master plan](master-plan.md), [test strategy](../09-testing/testing-strategy.md), [risk register](../13-risks/risk-register.md).
