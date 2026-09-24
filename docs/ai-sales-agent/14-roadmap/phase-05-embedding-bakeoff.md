# Phase 05 — Embedding bake-off (local Qwen)

Status: **PASS**

## PHASE 05 LOCAL EMBEDDING BAKE-OFF

PROVIDER: LOCAL_TEI

MODEL: Qwen/Qwen3-Embedding-0.6B

MODEL REVISION: `97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3`

TEI VERSION: 1.9.4

TEI IMAGE DIGEST: `ghcr.io/huggingface/text-embeddings-inference@sha256:2538ea1c9640d3763b15af668039d24172d063b42337b0c27796fc2be180c78d`

CANDIDATE DIMENSION: 1024

QUERY INSTRUCTION VERSION: `qwen3_dental_retrieve_en_v1`

QUERY INSTRUCTION:

```
Instruct: Given a customer question, retrieve relevant passages from a dental clinic knowledge base that help answer the question.
Query: <customer query>
```

NORMALIZATION VERIFIED: **PASS**

## ACCEPTANCE CRITERIA (predeclared)

| Metric | Minimum |
|--------|---------|
| Hit@1 | ≥ 0.6 |
| Hit@3 | ≥ 0.8 |
| Hit@6 | ≥ 0.9 |
| MRR | ≥ 0.6 |
| Slice Hit@3 | ≥ 0.75 |
| No-result correctness | ≥ 0.9 |

## RESULTS (held-out ranking — before threshold)

| Metric | Value |
|--------|-------|
| Hit@1 | 97.0% (32/33) |
| Hit@3 | 100.0% (33/33) |
| Hit@6 | 100.0% (33/33) |
| MRR | 0.985 |

### By slice

| Slice | Hit@1 | Hit@3 | Hit@6 | MRR |
|-------|-------|-------|-------|-----|
| iraqi | 8/8 | 8/8 (100.0%) | 8/8 | 1.000 |
| msa | 8/9 | 9/9 (100.0%) | 9/9 | 0.944 |
| en | 8/8 | 8/8 (100.0%) | 8/8 | 1.000 |
| iraqi_to_msa | 8/8 | 8/8 (100.0%) | 8/8 | 1.000 |

## ABSTENTION (held-out, frozen maxDistance)

CALIBRATION SET SIZE: 14

HELD-OUT SET SIZE: 43

SELECTED maxDistance: **0.558746** (pos_n=10 neg_n=4 pos_p50=0.3578 neg_p50=0.6919)

| Metric | Value |
|--------|-------|
| No-result correctness | 90.0% (9/10) |
| FALSE POSITIVE RATE | 10.0% (1/10) |
| FALSE NEGATIVE RATE (rel. filtered) | 3.0% (1/33) |

## PERFORMANCE (environment-specific; not a universal benchmark)

| Metric | Value |
|--------|-------|
| Model load / health wait | 50 ms |
| Cold query | 524 ms |
| Warm query | 581 ms |
| Batch throughput | 0.78 docs/s (17 docs in 21785 ms) |
| Process RSS | 50.1 MB |
| Hardware | darwin x64 cpus=8 |

## FAILURE EXAMPLES

- ho_msa_4: miss@1 top=doc_en_whitening,doc_whitening,doc_cleaning
- ho_nr_5: FP evidence doc_cleaning d=0.5362

## Cases (sample)

| Case | Slice | Result |
|------|-------|--------|
| ho_iraqi_1 | iraqi | top1=doc_hours_iraqi d=0.4270 |
| ho_iraqi_2 | iraqi | top1=doc_parking_iraqi d=0.4378 |
| ho_iraqi_3 | iraqi | top1=doc_location d=0.3855 |
| ho_iraqi_4 | iraqi | top1=doc_cleaning d=0.4727 |
| ho_iraqi_5 | iraqi | top1=doc_whitening d=0.4037 |
| ho_iraqi_6 | iraqi | top1=doc_ortho d=0.4491 |
| ho_iraqi_7 | iraqi | top1=doc_implants d=0.5989 |
| ho_iraqi_8 | iraqi | top1=doc_consult d=0.2605 |
| ho_msa_1 | msa | top1=doc_hours_iraqi d=0.2656 |
| ho_msa_2 | msa | top1=doc_location d=0.2911 |
| ho_msa_3 | msa | top1=doc_cleaning d=0.2229 |
| ho_msa_4 | msa | top1=doc_en_whitening d=0.3103 |
| ho_msa_5 | msa | top1=doc_ortho d=0.2491 |
| ho_msa_6 | msa | top1=doc_prep d=0.3699 |
| ho_msa_7 | msa | top1=doc_aftercare d=0.2989 |
| ho_msa_8 | msa | top1=doc_payment d=0.4448 |
| ho_en_1 | en | top1=doc_en_hours d=0.2846 |
| ho_en_2 | en | top1=doc_en_hours d=0.3363 |
| ho_en_3 | en | top1=doc_en_insurance d=0.3438 |
| ho_en_4 | en | top1=doc_en_whitening d=0.3448 |
| ho_en_5 | en | top1=doc_en_whitening d=0.2309 |
| ho_en_6 | en | top1=doc_en_insurance d=0.3389 |
| ho_en_7 | en | top1=doc_en_hours d=0.2279 |
| ho_en_8 | en | top1=doc_en_insurance d=0.3266 |
| ho_i2m_1 | iraqi_to_msa | top1=doc_hours_iraqi d=0.4301 |
| ho_i2m_2 | iraqi_to_msa | top1=doc_ortho d=0.3863 |
| ho_i2m_3 | iraqi_to_msa | top1=doc_implants d=0.4600 |
| ho_i2m_4 | iraqi_to_msa | top1=doc_aftercare d=0.3367 |
| ho_i2m_5 | iraqi_to_msa | top1=doc_payment d=0.4654 |
| ho_i2m_6 | iraqi_to_msa | top1=doc_prep d=0.3842 |
| ho_i2m_7 | iraqi_to_msa | top1=doc_consult d=0.3380 |
| ho_i2m_8 | iraqi_to_msa | top1=doc_cleaning d=0.3753 |
| ho_msa_fill_vs_clean | msa | top1=doc_filling_vs_cleaning d=0.4409 |
| ho_nr_1 | no-result | PASS empty |
| ho_nr_2 | no-result | PASS empty |
| ho_nr_3 | no-result | PASS empty |
| ho_nr_4 | no-result | PASS empty |
| ho_nr_5 | no-result | FAIL doc_cleaning |
| ho_nr_6 | no-result | PASS empty |
| ho_nr_7 | no-result | PASS empty |
| ho_nr_8 | no-result | PASS empty |
| ho_nr_9 | no-result | PASS empty |
| ho_nr_10 | no-result | PASS empty |

## EXTERNAL DATA EGRESS

TENANT DATA EGRESS DURING EMBEDDING: **NONE**

INFRASTRUCTURE NETWORK EGRESS: model/container download during provisioning only, unless already cached.

## FAKE PROVIDER PRODUCTION POLICY

**PASS** — Fake never selected by `resolveEmbeddingProvider`; local_qwen fail-closed.

## RECOMMENDATION

**ACCEPT_CANDIDATE**

## FINAL PROFILE PROPOSAL

| Field | Value |
|-------|--------|
| profileId | `qwen3_embed_06b_1024_v1` |
| provider | local_qwen / LOCAL_TEI |
| model | Qwen/Qwen3-Embedding-0.6B |
| modelRevision | `97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3` |
| teiImageDigest | `ghcr.io/huggingface/text-embeddings-inference@sha256:2538ea1c9640d3763b15af668039d24172d063b42337b0c27796fc2be180c78d` |
| dimension | **1024** |
| queryInstructionVersion | `qwen3_dental_retrieve_en_v1` |
| normalizationMode | tei_normalize_true_l2 |
| maxDistance (frozen) | 0.558746 |

FINAL DIMENSION PROPOSAL: **1024**

MIGRATION READY: **YES** (await explicit migration GO — do not create vector(1024) in this step)


## BLOCKERS

NONE
