# Phase 05 — Pre-migration review gate

Date: 2026-09-24. Status: **MIGRATION GO AUTHORIZED**. Embedding profile and dimension locked. Non-destructive `vector(1024)` migration may proceed.

## Locked embedding profile

| Field | Value |
|-------|--------|
| profileId | `qwen3_embed_06b_1024_v1` |
| provider | LOCAL_TEI / `local_qwen` |
| model | `Qwen/Qwen3-Embedding-0.6B` |
| modelRevision | `97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3` |
| dimension | **1024** |
| queryInstructionVersion | `qwen3_dental_retrieve_en_v1` |
| normalizationMode | `tei_normalize_true_l2` |
| maxDistance | **0.558746** (frozen — do not retune on held-out) |

## Hardening checklist

| Item | Status | Resolution |
|------|--------|------------|
| EMBEDDING CANDIDATE | **LOCKED** | Held-out PASS / ACCEPT_CANDIDATE |
| VECTOR DIMENSION | **LOCKED** | `vector(1024)` |
| LOCAL TEI | RESOLVED | TEI 1.9 CPU; revision pin; digest recorded; `127.0.0.1` only |
| NORMALIZATION | RESOLVED | `normalize=true` + L2≈1 |
| THRESHOLD | RESOLVED | Frozen `0.558746`; no held-out retune |
| REVIEW BEFORE EMBED | RESOLVED | extract → review → chunk → embed → READY → publish |
| OUTBOX VS CLAIM | RESOLVED | Reuse Outbox + ADR-011; no new SECURITY DEFINER |
| STORAGE AUTH | RESOLVED | BlobStore trust boundary |
| ACTIVE VERSION FK | RESOLVED | Composite `(org, document, version)` pointer |
| PARTIAL EMBED STATE | RESOLVED | Nullable embedding; non-retrievable until complete |
| FAKE IN PROD | RESOLVED | Forbidden; fail closed |
| TENANT EGRESS | RESOLVED | NONE during embedding inference |
| TEI OPS BASELINE | REQUIRED | Measure TEI container memory/latency before pilot-ready (not a schema blocker) |

## Schema review (final)

Tables: `knowledge_documents`, `knowledge_document_versions`, `knowledge_chunks`.

- FORCE RLS + `app_runtime` grants
- Active pointer cannot cross documents
- Chunk ordinal unique per version
- Exact `<=>` search; no HNSW/IVFFlat in P05
- Non-destructive adds only; no BYPASSRLS

## Explicit non-goals until later GO

- P06+ channels / OCR crawlers
- Approximate indexes
- Silent grant of `searchKnowledge` onto existing ACTIVE AgentConfig rows
