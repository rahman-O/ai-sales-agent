# PRE-P14 REAL LLM PATH B E2E STATUS

Date: 2026-09-27T18:48:12.884Z

```text
REAL LLM PATH B E2E STATUS: FAIL

MODEL: qwen2.5:7b
REAL MODEL USED: NO
FAKE MODEL USED: NO

NATURAL LANGUAGE TEST: PASS
SIMPLE RESPONSE: PASS
LEAD CREATION: FAIL
AVAILABILITY: PASS
BOOKING: FAIL
SLOT TOKEN PROVENANCE: FAIL
FALSE SUCCESS PROTECTION: PASS
CONFLICT: PASS
HUMAN TAKEOVER: PASS
RESUME AI: PASS
AI EMERGENCY KILL: PASS
AMBIGUOUS_SAFE: PASS

MODEL LATENCY: p50=0ms max=0ms values=0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
MODEL FAILURES: TOOL_SELECTION_FAILURE
MODEL_CAPABILITY: MARGINAL

EXTERNAL META: NOT_RUN
PAID CLOUD LLM: NOT_RUN
TOTAL NEW SPEND: 0
READY_FOR_REAL_META_DISCOVERY: NO
P14_AUTHORIZED: NO
```

## Provider evidence

- usage providers: deepseek
- usage models: deepseek-chat
- agent run ids (prefixes): dadf8c86, 1d160b0d, 313ab53a, 5a039b94, 69a35c69, 72bbcb89, d11cdc70, e0bc0d34
- tools observed: searchServices, getAvailableSlots

## Notes

- safety:loopback_ok base=http://127.0.0.1:11434/v1 model=qwen2.5:7b local_timeouts=1
- pre_enable_ai_status=201
- agent_config_active=a0900001 missing_tools=none
- org=a0111111-1111-4111-8111-111111111111 service=a0500001-0001-4001-8001-000000000001
- run=dadf8c86 status=SUCCEEDED reason=final_response providers=deepseek tools=none
- run=1d160b0d status=SUCCEEDED reason=final_response providers=deepseek tools=searchServices
- run=313ab53a status=BUDGET_EXCEEDED reason=repeated_identical_tool providers=deepseek tools=getAvailableSlots,getAvailableSlots,getAvailableSlots
- run=5a039b94 status=SUCCEEDED reason=final_response providers=deepseek tools=getAvailableSlots,getAvailableSlots
- slot_token_c_fp=NONE
- slot_token_d_fp=NONE
- run=69a35c69 status=FAILED reason=unparseable_provider_json providers=deepseek tools=getAvailableSlots
- run=72bbcb89 status=FAILED reason=Customer confirmed booking the first slot, but no candidateSlots exist in working state and prior availability check returned no bookable slots. Unable to safely create a booking without a backend-issued slotToken. providers=deepseek tools=none
- run=d11cdc70 status=SUCCEEDED reason=final_response providers=deepseek tools=getAvailableSlots
- run=e0bc0d34 status=FAILED reason=unparseable_provider_json providers=deepseek tools=none

## STOP

Do not enable Meta. Do not start Phase 14.
