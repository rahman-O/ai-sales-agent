# PRE-P14 REAL LLM ZERO-COST STATUS

Date: 2026-09-27. Path B local OpenAI-compatible discovery + compatibility harness.
**P14_AUTHORIZED: NO.** No Meta. No billing. Expected new spend: 0.

## Readiness gates

```text
ARCHITECTURALLY_AVAILABLE: YES
LOCAL_SERVER_INSTALLED: YES
LOCAL_SERVER_RUNNING: YES
MODEL_INSTALLED: YES
MODEL_ID: qwen2.5:7b
HARDWARE_FIT: YES
HARDWARE_FIT_REASON: fit_le_7b_mem_le_10gb
PROTOCOL_COMPATIBLE: YES
PROBE_A: PASS
PROBE_B: PASS
PROBE_C: PASS
PROBE_NATIVE_TOOL_CALLS: INCOMPATIBLE_WITH_CURRENT_ADAPTER
ZERO_COST_REAL_LLM_READY: YES
EXPECTED_NEW_SPEND: 0
P14_AUTHORIZED: NO
```

## Hardware-fit gate (host class)

| Field | Value |
|-------|--------|
| HOST_CLASS | MacBookPro15,2_16GB_Intel |
| MAX_PARAMETER_BILLIONS | 7 |
| MAX_EXPECTED_MEMORY_GB | 10 |
| PREFERRED_QUANT | Q4_K, Q4_K_M, Q5_K, Q5_K_M, Q4_0, Q5_0 |

Do not download models clearly above this gate.

## Config gaps

- IMPLEMENTED:local_timeout_override_via_AI_MODEL_LOCAL_TIMEOUTS_or_AI_MODEL_TIMEOUT_MS_on_loopback_only
- IMPLEMENTED:dummy_key_loopback_guard_in_resolveProductionProvider
- KNOWN:without_response_format_json_object_native_tool_calls_are_INCOMPATIBLE_WITH_CURRENT_ADAPTER

## Probe notes

- base_url=http://127.0.0.1:11434/v1
- probe_timeout_ms=180000
- hardware_fit_eval:fit_le_7b_mem_le_10gb
- local_server_already_running
- ollama_models:qwen2.5:7b,qwen2.5:1.5b
- running_probes_model:qwen2.5:7b
- probe_a=PASS:text=hello_probe_a:elapsed_ms=83729
- CONFIG_NOTE:probe_a_exceeded_production_15s_model_timeout
- probe_b=PASS:tool_request_searchServices:elapsed_ms=4284
- probe_c=PASS:tool_then_final:elapsed_ms=9730
- probe_native=INCOMPATIBLE_WITH_CURRENT_ADAPTER:server_returns_native_tool_calls_with_empty_content

## Probe detail

| Probe | Status | Detail |
|-------|--------|--------|
| A | PASS | text=hello_probe_a (83729ms) |
| B | PASS | tool_request_searchServices (4284ms) |
| C | PASS | tool_then_final (9730ms) |
| Native tool_calls | INCOMPATIBLE_WITH_CURRENT_ADAPTER | server_returns_native_tool_calls_with_empty_content |


## STOP

Do not enable Meta. Do not start Phase 14. Full agent E2E only after A+B+C PASS.
