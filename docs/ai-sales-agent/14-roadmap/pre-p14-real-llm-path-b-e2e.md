# PRE-P14 REAL LLM PATH B E2E STATUS

Date: 2026-09-27T23:40:33.195Z

```text
REAL LLM PATH B E2E STATUS: FAIL

MODEL: qwen2.5:7b
REAL MODEL USED: NO
FAKE MODEL USED: NO

NATURAL LANGUAGE TEST: PASS
SIMPLE RESPONSE: PASS
LEAD CREATION: PASS
AVAILABILITY: FAIL
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

- usage providers: local_ollama
- usage models: qwen2.5:7b
- agent run ids (prefixes): bc9a4d55, 580f2a63, 3e7fce36, 29dd9282, e7980bb4, 16ad7576, fda13c87, 96d78222
- tools observed: searchServices, getServiceDetails, getCustomer, ensureLead, createCustomer, getAvailableSlots

## Notes

- safety:loopback_ok base=http://127.0.0.1:11434/v1 model=qwen2.5:7b local_timeouts=1
- pre_enable_ai_status=201
- agent_config_active=a0900001 missing_tools=none
- org=a0111111-1111-4111-8111-111111111111 service=a0500001-0001-4001-8001-000000000001
- run=bc9a4d55 status=SUCCEEDED reason=final_response providers=local_ollama tools=none
- run=580f2a63 status=BUDGET_EXCEEDED reason=max_model_calls providers=local_ollama tools=searchServices,getServiceDetails,getCustomer,ensureLead,createCustomer
- run=3e7fce36 status=SUCCEEDED reason=final_response providers=local_ollama tools=searchServices
- run=29dd9282 status=SUCCEEDED reason=final_response providers=local_ollama tools=none
- slot_token_c_fp=NONE
- slot_token_d_fp=NONE
- run=e7980bb4 status=SUCCEEDED reason=final_response providers=local_ollama tools=searchServices,getAvailableSlots
- run=16ad7576 status=SUCCEEDED reason=final_response providers=local_ollama tools=none
- run=fda13c87 status=SUCCEEDED reason=final_response providers=local_ollama tools=searchServices
- run=96d78222 status=SUCCEEDED reason=final_response providers=local_ollama tools=none

## STOP

Do not enable Meta. Do not start Phase 14.
