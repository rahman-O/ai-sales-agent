# Phase 05 — Scope manifest

Status: **CLOSED** — bake-off PASS, migration GO applied (`vector(1024)`), knowledge pipeline + `searchKnowledge` opt-in shipped. See `phase-05-closure.md`.

Source priority: `phase-05-knowledge-rag.md` → hardened plan → `rag-architecture.md` → ADR-003/005/011 → knowledge/tool/storage docs → P04 patterns.

## Goal

Tenant-safe approved knowledge: extract → **operator review** → chunk → embed → atomic publish pointer → exact pgvector retrieval → `searchKnowledge` (read-only) for P04 agent. RAG never overrides structured domain truth.

## Embedding profile (accepted candidate; not schema-migrated)

| Field | Value |
|-------|--------|
| Provider | `local_qwen` → Hugging Face Text Embeddings Inference (TEI) |
| Model | `Qwen/Qwen3-Embedding-0.6B` (Apache-2.0) |
| Profile id | `qwen3_embed_06b_1024_v1` |
| Dimension | **1024** (FINAL DIMENSION PROPOSAL — await migration GO) |
| Query instruction | `qwen3_dental_retrieve_en_v1` (English instruct; query language unchanged) |
| Normalization | TEI `normalize=true` + L2≈1 validation |
| TEI images | `cpu-1.9` (x86_64) / `cpu-arm64-1.9` (ARM64); digest in bake-off report |
| Model revision | `97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3` |
| maxDistance (frozen) | `0.558746` |
| API key | **NONE** for local path |
| TENANT DATA EGRESS DURING EMBEDDING | **NONE** |
| INFRASTRUCTURE NETWORK EGRESS | Model/container download during provisioning only (unless cached) |

Do **not** create `vector(1024)` until **migration GO**.

## Hardening locks (pre-schema)

| Item | Resolution |
|------|------------|
| EMBEDDING PROFILE | **ACCEPT_CANDIDATE** after held-out PASS — see `phase-05-embedding-bakeoff.md` |
| LOCAL PROVIDER | `EMBEDDING_PROVIDER=local_qwen`; fail closed if TEI unreachable; never Fake/OpenAI fallback |
| REVIEW ORDER | extract → AWAITING_REVIEW → approve → CHUNKING → EMBEDDING → READY → publish |
| WORK DISCOVERY | OutboxEvent + existing ADR-011 relay; **no** new claim function by default |
| STORAGE TRUST | Server-generated keys; signed upload; finalize verify; worker server-only Storage credential in BlobStore |
| ACTIVE POINTER FK | `(org, document_id, active_published_version_id) → versions(org, document_id, id)` |
| VERSION IMMUTABILITY | Content/object/checksum/profiles immutable; pipeline/review metadata mutable |
| PARTIAL CHUNKS | Insert text with nullable embedding; publish requires full embed count |
| SCORE CONTRACT | `distance = <=>`; `similarity = 1 - distance`; `maxDistance` calibrated then frozen |
| FAKE EMBEDDINGS | Never in production; no escape hatch |
| UNPUBLISH / DELETE / ARCHIVE | Distinct semantics; publication derived from active pointer |
| PDF SAFETY | Bounds + magic + timeout; not full AV (deferred) |

## Entities

`KnowledgeDocument`, `KnowledgeDocumentVersion`, `KnowledgeChunk` (+ outbox events for ingest/cleanup).

## P06+ exclusions

Leads, booking/slots, WhatsApp, full takeover UX, follow-ups, analytics.
