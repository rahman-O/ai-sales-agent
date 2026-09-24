#!/usr/bin/env bash
# Measure TEI container operational baseline (not Node process RSS).
# Usage: ./scripts/tei-ops-baseline.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CID="$(docker ps -qf name=ai-sales-agent-tei || true)"
if [[ -z "$CID" ]]; then
  echo "TEI container not running. Start with: ./scripts/tei-compose.sh up -d tei"
  exit 1
fi

MEM_LIMIT="$(docker inspect "$CID" --format '{{.HostConfig.Memory}}')"
echo "configured_docker_memory_bytes=$MEM_LIMIT"

sample() {
  docker stats "$CID" --no-stream --format '{{.MemUsage}}|{{.CPUPerc}}'
}

echo "idle_sample=$(sample)"
curl -sf http://127.0.0.1:8080/info >/dev/null
echo "after_info_sample=$(sample)"

# Warm query latency p50/p95 (10 queries)
python3 - <<'PY'
import json, time, urllib.request, statistics
lat=[]
payload=json.dumps({"inputs":"Instruct: Given a customer question, retrieve relevant passages from a dental clinic knowledge base that help answer the question.\nQuery: Are you open Friday?","normalize":True}).encode()
for i in range(10):
  t0=time.perf_counter()
  req=urllib.request.Request("http://127.0.0.1:8080/embed", data=payload, headers={"content-type":"application/json"})
  with urllib.request.urlopen(req, timeout=120) as r:
    r.read()
  lat.append((time.perf_counter()-t0)*1000)
lat.sort()
print(f"warm_query_p50_ms={lat[4]:.1f}")
print(f"warm_query_p95_ms={lat[9]:.1f}")
print(f"sustainable_queries_per_sec={1000/statistics.mean(lat):.2f}")
PY

echo "peak_after_queries_sample=$(sample)"

# Batch docs
python3 - <<'PY'
import json, time, urllib.request
docs=["Clinic hours Saturday Thursday","Free parking for patients","Whitening shade not guaranteed"]*8
payload=json.dumps({"inputs":docs,"normalize":True}).encode()
t0=time.perf_counter()
req=urllib.request.Request("http://127.0.0.1:8080/embed", data=payload, headers={"content-type":"application/json"})
with urllib.request.urlopen(req, timeout=300) as r:
  r.read()
elapsed=time.perf_counter()-t0
print(f"batch_docs={len(docs)}")
print(f"batch_elapsed_ms={elapsed*1000:.1f}")
print(f"sustainable_docs_per_sec={len(docs)/elapsed:.2f}")
PY

echo "peak_after_batch_sample=$(sample)"
echo "NOTE: restart-after-OOM / readiness recovery — exercise manually by lowering mem_limit if needed."
echo "TEI_OPS_BASELINE_CAPTURED"
