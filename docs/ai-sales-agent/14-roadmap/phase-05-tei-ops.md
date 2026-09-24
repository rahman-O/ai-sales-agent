# Phase 05 — Local TEI operations

Private embedding inference for P05 bake-off / future knowledge ingest.

## Images (do not use cpu-1.7.x)

| Arch | Tag |
|------|-----|
| x86_64 | `ghcr.io/huggingface/text-embeddings-inference:cpu-1.9` |
| ARM64 | `ghcr.io/huggingface/text-embeddings-inference:cpu-arm64-1.9` |

After pull, record the image **digest** (`repo@sha256:…`) for reproducibility.

## Model

- Id: `Qwen/Qwen3-Embedding-0.6B`
- License: Apache-2.0 ([model card](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B))
- Native dimension: 1024
- Start with `--revision <exact HF commit>` (see bake-off report / `.env.local`)

## Network

- Bind: `127.0.0.1:8080` only — never public
- Browser must not call TEI
- Config is server-owned (`EMBEDDING_PROVIDER`, `EMBEDDING_LOCAL_BASE_URL`, `EMBEDDING_MODEL`, `EMBEDDING_MODEL_REVISION`)

## Egress

```text
TENANT DATA EGRESS DURING EMBEDDING: NONE
INFRASTRUCTURE NETWORK EGRESS: model/container download during provisioning only, unless already cached
```

## Health

Readiness must verify model identity / revision / TEI version (not only TCP). Wrong model → FAIL.

## Compose defaults (local bake-off host)

- Bind: `127.0.0.1:8080:80`
- `--dtype float32`
- `--max-batch-tokens 2048` / `--max-concurrent-requests 4` (keep peak RSS under Docker memory)
- `mem_limit: 12g` (non-swarm Compose honors this; `deploy.resources` alone does not)
- Helper: `./scripts/tei-compose.sh up -d tei` (picks `cpu-1.9` vs `cpu-arm64-1.9`)

Pinned digest from accepted bake-off (x86_64 `cpu-1.9`):

`ghcr.io/huggingface/text-embeddings-inference@sha256:2538ea1c9640d3763b15af668039d24172d063b42337b0c27796fc2be180c78d`
