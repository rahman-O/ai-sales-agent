# Phase 05 — TEI operational baseline

Captured: 2026-09-24 (local Docker Desktop). Measurements are of the **TEI container**, not the Node bake-off process.

## Configuration

| Field | Value |
|-------|--------|
| Image | `ghcr.io/huggingface/text-embeddings-inference:cpu-1.9` |
| Digest (bake-off) | `sha256:2538ea1c9640d3763b15af668039d24172d063b42337b0c27796fc2be180c78d` |
| Model | `Qwen/Qwen3-Embedding-0.6B` @ `97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3` |
| dtype | float32 |
| max-batch-tokens | 2048 |
| max-concurrent-requests | 4 |
| Configured Docker memory limit | **12884901888** bytes (**12 GiB**) |

## Container memory (cgroup / proc)

| Sample | Value |
|--------|--------|
| After model load + warm queries + batch (cgroup `memory.current`) | **2755911680** bytes (~**2.57 GiB**) |
| Process VmRSS (`/proc/1/status`) | **2641404 kB** (~**2.52 GiB**) |
| Process VmPeak | **6561264 kB** (~**6.26 GiB**) |

Idle-before-load not separately frozen in this capture (container already warmed). Peak observed via VmPeak ≈ 6.3 GiB under 12 GiB limit — headroom remains; do not treat ~50 MB Node RSS as TEI model memory.

## Latency / throughput (warm)

| Metric | Value |
|--------|--------|
| Warm query p50 | **617.3 ms** |
| Warm query p95 | **1818.8 ms** |
| Sustainable queries/sec (serial) | **1.33** |
| Batch docs (4×6 with 0.5s pacing) | 24 docs |
| Sustainable docs/sec (paced) | **1.78** |

Notes: Unpaced large batches can hit TEI HTTP 429 (`max_concurrent_requests=4`). Production ingest must keep client batch/concurrency bounded (adapter default batch size 4).

## Restart / readiness

- Prior OOM (exit 137) observed when mem_limit was 8G during warmup — mitigated by **12G** + lower batch tokens.
- After recreate, `/info` becomes ready after model load (~60–90s on this host).
- Manual OOM restart drill: lower mem_limit below VmPeak, confirm exit 137, restore 12G, confirm `/info` recovers.

## Gate

**TEI OPERATIONAL BASELINE: PASS** for local pilot sizing on this host (12 GiB). Re-measure on target pilot hardware before production.
