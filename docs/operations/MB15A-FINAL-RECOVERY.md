# MB-15A final recovery

Status: PASS — final simulator VERIFIED. This report supersedes the prior recovery's authentication blocker once final verification completes. The user confirmed the exposed key was revoked and a replacement was corrected privately. Worker recreation affected only the worker. Configuration verification emitted provider and key-presence boolean only; minimal authentication returned HTTP 200. No credential or provider response body was displayed in this recovery.

## Preserved baseline

At entry: 320 unit tests, 27 integration tests, build and demo production check passed. Normalized schema drift was NONE, with 306 intentional SQL differences and 43 cosmetic raw operations plus one previously repaired history checksum. Schema, RLS, tool authorization, provider adapter, retry protocol, booking mutations and confirmation trust model were preserved.

## Root cause and ordered calls

The exact failing request was reproduced independently using real deepseek-chat. Before evidence is saved in MB15A-MULTI-INTENT-BEFORE.json, with target inbound, conversation/run IDs, six types of safe audit information and sampled working-state transitions. Raw provider responses were not captured.

1. searchServices: required to resolve the exact catalog service; OK.
2. getServicePrice: required because searchServices returns only ID/name, not price; OK.
3. getActiveOffers: required for discount truth; OK.
4. getCustomer: redundant for identity because the snapshot already supplies customerId; OK.
5. ensureLead: legitimate lead qualification under the existing workflow guidance; OK. Availability discovery itself can proceed without this optional call.

There were no duplicate tools, policy lookups or repeated identical inputs. After these calls, availability was missing and the shared model-call budget left no final-response opportunity. Working state progressed from discovery to lead capture. The stored terminal model_calls field remained zero on this existing non-success path; usage_events proved five DeepSeek model calls. No mutation semantics or history schema was altered to repair that unrelated telemetry limitation.

Minimum mandatory discovery plan: service discovery, structured price, active offers, availability, then final response. Lead qualification adds a legitimate operational call when needed by the booking workflow. Customer identity is already authoritative. Five operational calls plus one finalization call are therefore justified.

## Fix and bounds

The system context now explicitly exposes the authoritative snapshot customer ID and says not to recover it via getCustomer unless additional details are needed. Successful facts must be consumed rather than rediscovered. Topic-resume guidance treats resuming a booking as distinct from selecting/confirming a slot and requires canonical JSON for conversational replies.

The original maxModelCalls=5 operational limit remains. One finalization-only reserve is allowed after successful tool work. It advertises no tools and rejects a tool_request before execution. It can produce final_response or safe_stop, with the existing parser/claim/authority/post-mutation safeguards. There is no additional retry or schema-repair opportunity beyond that one reserve; total provider.generate calls cannot exceed six. The 45-second run deadline, tool cap and identical normalized-input loop guard remain unchanged. Provider adapter recovery can make its existing one internal structured repair HTTP request per generate call; it is not a separate orchestrator budget turn.

Four meaningful regressions cover successful finalization after five operations, denial of reserve tool execution, no seventh repair call, and unchanged identical-tool loop detection. Different inputs remain allowed.

## Targeted evidence

The initial fixed multi-intent run used searchServices, getServicePrice, getActiveOffers, ensureLead, getAvailableSlots, then final_response: six audited DeepSeek calls, no duplicate tool and no booking mutation. It persisted three candidate slots and entered BOOKING/AWAITING_SLOT_SELECTION. The simulator received the persisted provider message ID. After evidence is saved in MB15A-MULTI-INTENT-AFTER.json.

Policy, knowledge, booking discovery and confirmation, and topic start/offer turns passed. A topic resume failed closed twice with unparseable_provider_json at its first model call. It was retained as evidence and prompted explicit canonical topic-resume guidance; final regression outcomes remain pending.

The normalized gate was repeated against fresh isolated migration replay. A reference-only function-body whitespace mismatch was corrected to the exact documented local bootstrap body; live schema was untouched. The gate then returned NONE.

Final quality and complete simulator results will be recorded below before delivery.

## Completed targeted checks and quality gates

Multi-intent after the final prompt update passed with four successful tools (searchServices, getServicePrice, getActiveOffers, getAvailableSlots) followed by final_response: five audited calls. See MB15A-MULTI-INTENT-LATEST.json. The earlier six-call result independently exercised the bounded reserve.

Policy, knowledge, booking discovery and confirmation passed. The original acceptance topic-switch sequence was then run in fresh synthetic conversations; start, offers, resume and zero-slot handling passed. An additional availability-before-detour stress variant repeatedly failed closed on provider JSON formatting. That extra variant remains a limitation; it was not substituted for the original acceptance fixture or counted as a pass.

UNIT_TESTS: PASS (324/324)
INTEGRATION_TESTS: PASS (27/27)
BUILD: PASS
PROD_CHECK: PASS
PRISMA_VALIDATE: PASS
PRISMA_GENERATE: PASS
HARNESS_STRICT_TYPECHECK: PASS
NORMALIZED_SCHEMA_DRIFT: NONE

The complete simulator suite is running. Its handoff check now correlates the existing HANDOFF_REQUESTED backend acknowledgment through OutboundMessageReady rather than assuming a nonexistent HANDOFF status/final_outbound_message_id. It requires the successful handoff tool and actual AI_PAUSED state. No backend handoff semantics changed.

## Final root-cause refinement

The first complete rerun correctly remained PARTIAL: knowledge and handoff emitted replies without successful tool use, and multi-intent repeated getServicePrice before exhausting operational turns. Its unchanged failure evidence is retained in MB15A-RECOVERY-SIMULATOR-ATTEMPT1.md.

Tool history previously serialized only type/toolName and omitted the executed arguments. The corrected history preserves the complete canonical decision so subsequent generations consume the actual call provenance. Successful results receive an explicit system reminder to reuse evidence and prioritize unhandled intents within remaining operational turns. Price/offer guidance forbids a redundant price refresh after discount retrieval. Clear location/hours and human-request guidance requires the corresponding existing tool, rather than a conversational promise. No adapter, retrieval implementation, schema, tool authorization or mutation behavior changed.

The final targeted multi-intent run uses five successful distinct tools plus final_response, six audited DeepSeek calls, BOOKING state and three candidate slots, no duplicate tool, unchanged bookings, persisted provider ID and simulator receipt. All targeted policy/knowledge/booking/topic/zero-slot checks pass with this worker. Actual handoff also passes: successful handoffToHuman, HANDOFF_REQUESTED, AI_PAUSED, one audited DeepSeek call and correlated simulator acknowledgment.

UNIT_TESTS: PASS (325/325, including the new executed-argument provenance regression)
INTEGRATION_TESTS: PASS (27/27)
BUILD: PASS
PROD_CHECK: PASS

The complete final simulator rerun is now underway.

## Budget and scope summary

BUDGET_CHANGED: YES (total bounded opportunity only)
OLD_BUDGET: 5 model calls including finalization
NEW_BUDGET: 5 operational model calls + 1 finalization-only call; at most 6
FINALIZATION_RESERVE_ADDED: YES
LOOP_GUARD_CHANGED: NO
REDUNDANT_CALLS_FOUND: YES (customer identity recovery; later repeated price lookup)
MIGRATIONS_CREATED: NONE

Recovery source changes: packages/agent-core/src/context-builder.ts, orchestrator.ts, index.test.ts; scripts/mb15/simulator-acceptance.ts; new scripts/mb15/multi-intent-recovery.ts, business-recovery.ts, handoff-recovery.ts; operational evidence/report files. Earlier uncommitted project work is preserved.

DEEPSEEK_AUTH: PASS
HTTP_STATUS: 200
CREDENTIAL_ROTATION: PASS (user confirmed revocation; new credential authenticated and audited runs succeeded)
DEEPSEEK_KEY_CONFIGURED_IN_WORKER: YES
DEEPSEEK_KEY_PRINTED: NO during this recovery; the previous example-file exposure remains acknowledged in the historical report.
REAL_META_CREDENTIALS_USED: NO
REAL_META_MESSAGES_SENT: NO
P14_AUTHORIZED: NO

## Final MB-15A report

MB-15A FINAL RECOVERY: PASS
CREDENTIAL_ROTATION: PASS
DEEPSEEK_AUTH: PASS
HTTP_STATUS: 200
DEEPSEEK_KEY_CONFIGURED_IN_WORKER: YES
DEEPSEEK_KEY_PRINTED: NO (this recovery)
TARGETED_DEEPSEEK_PROBE: PASS
REAL_DEEPSEEK_AGENT_EXECUTION: PASS
MULTI_INTENT_ROOT_CAUSE: redundant identity/price lookup, missing executed arguments in tool history, and no finalization opportunity after five legitimate operational calls
MULTI_INTENT_CALL_SEQUENCE: searchServices -> getServicePrice -> getActiveOffers -> ensureLead -> getAvailableSlots -> final_response
REDUNDANT_CALLS_FOUND: YES; absent in final targeted regression
BUDGET_SEMANTICS: provider.generate attempts count; tool execution does not increment model-call count; repairs/retries/final_response consume model turns; adapter's existing bounded internal recovery stays unchanged
BUDGET_CHANGED: YES (bounded finalization reserve only)
OLD_BUDGET: 5 model calls including finalization
NEW_BUDGET: 5 operational calls + at most 1 finalization-only call
FINALIZATION_RESERVE_ADDED: YES
LOOP_GUARD_CHANGED: NO
UNIT_TESTS: PASS (325/325)
INTEGRATION_TESTS: PASS (27/27)
BUILD: PASS
PROD_CHECK: PASS
PRISMA_VALIDATE: PASS
PRISMA_GENERATE: PASS
NORMALIZED_SCHEMA_DRIFT: NONE
SCHEMA_DRIFT: NONE
RAW_PRISMA_DIFF: FOUND (existing intentional/cosmetic representation differences)
MIGRATIONS_CREATED: NONE
BOOKING_MODEL_MODE: DEEPSEEK
MULTI_INTENT_FLOW: PASS
BUSINESS_MUTATION_DUPLICATION: NO
FULL_PLATFORM_REGRESSION: PASS
SIMULATOR_ACCEPTANCE: VERIFIED
QUOTE_FLOW: NOT_ENABLED
ORDER_FLOW: NOT_ENABLED
HUMAN_HANDOFF_FLOW: PASS
READY_FOR_REAL_META: YES (required local acceptance gates passed; live Meta is still untested)
REAL_META_CREDENTIALS_USED: NO
REAL_META_MESSAGES_SENT: NO
MB15_STATUS: NOT_CLOSED
NEXT_STEP: REAL_META_LIVE_ACCEPTANCE, when separately authorized
P14_AUTHORIZED: NO

The complete final evidence matrix is in MB15-SIMULATOR-ACCEPTANCE-REPORT.md. No required scenario was skipped or counted as passed after failure. Earlier exploratory failures are retained as historical evidence; they do not alter the final full-run result. No real Meta acceptance was attempted.
