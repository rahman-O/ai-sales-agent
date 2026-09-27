# PRE-P14 REAL LLM PATH B E2E STATUS

Date: 2026-09-27T01:56:04.265Z

```text
REAL LLM PATH B E2E STATUS: FAIL

MODEL: qwen2.5:7b
REAL MODEL USED: YES
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
RESUME AI: FAIL
AI EMERGENCY KILL: PASS
AMBIGUOUS_SAFE: PASS

MODEL LATENCY: p50=0ms max=0ms values=0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
MODEL FAILURES: TOOL_SELECTION_FAILURE, DOMAIN_TOOL_FAILURE, TIMEOUT
MODEL_CAPABILITY: MARGINAL

EXTERNAL META: NOT_RUN
PAID CLOUD LLM: NOT_RUN
TOTAL NEW SPEND: 0
READY_FOR_REAL_META_DISCOVERY: NO
P14_AUTHORIZED: NO
```

## Provider evidence

- usage providers: openai_compatible
- usage models: qwen2.5:7b
- agent run ids (prefixes): 1ebe2165, 1f17fc54, 66cb7bb4, bb96ed14, 0448aec1, e3400e45, e6000603
- tools observed: searchServices, getAvailableSlots, createBooking, ensureLead, getCustomer

## Notes

- safety:loopback_ok base=http://127.0.0.1:11434/v1 model=qwen2.5:7b local_timeouts=1
- pre_enable_ai_status=201
- agent_config_active=a0900001 missing_tools=none
- org=a0111111-1111-4111-8111-111111111111 service=a0500001-0001-4001-8001-000000000001
- run=1ebe2165 status=SUCCEEDED reason=final_response providers=openai_compatible tools=none
- run=1f17fc54 status=SUCCEEDED reason=final_response providers=openai_compatible tools=searchServices
- run=66cb7bb4 status=SUCCEEDED reason=final_response providers=openai_compatible tools=getAvailableSlots
- run=bb96ed14 status=FAILED reason=Unable to safely continue. providers=openai_compatible tools=createBooking
- slot_token_c_fp=NONE
- slot_token_d_fp=NONE
- run=0448aec1 status=BUDGET_EXCEEDED reason=max_model_calls providers=openai_compatible tools=getAvailableSlots,searchServices,ensureLead,getCustomer
- run=e3400e45 status=SUCCEEDED reason=final_response providers=openai_compatible tools=getAvailableSlots,createBooking
- wait_timeout:agent_run_complete
- run=e6000603 status=SUCCEEDED reason=final_response providers=openai_compatible tools=getAvailableSlots

## STOP

Do not enable Meta. Do not start Phase 14.
