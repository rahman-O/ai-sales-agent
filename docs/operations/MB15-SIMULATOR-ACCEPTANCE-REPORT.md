# MB-15A Meta Simulator Acceptance Evidence

## Acceptance Summary

Status: **VERIFIED**
BOOKING_MODEL_MODE: DEEPSEEK
Generated at: 2026-10-02T21:58:54.601Z
Execution mode: Meta Simulator Loopback / Private Container Network

## Acceptance Evidence Matrix

| Run ID | Timestamp (UTC) | Scenario | Organization | Provider Inbound ID | Internal Msg ID | Conversation ID | Agent Run ID | Outbound Internal ID | Simulated Provider ID | Final State | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 39510095 | 2026-10-02T21:55:41.817Z | REAL_DEEPSEEK_AVAILABLE | a0111111... | - | -... | -... | -... | -... | - | AI_PROVIDER=deepseek DEEPSEEK_API_KEY_CONFIGURED=true | **PASS** |
| 62413597 | 2026-10-02T21:55:41.818Z | KNOWLEDGE_EMBEDDING_AVAILABLE | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| e33be5d6 | 2026-10-02T21:55:41.818Z | INFRASTRUCTURE_PREFLIGHT | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| 1a9f9906 | 2026-10-02T21:55:41.850Z | WEBHOOK_VERIFICATION_SIMULATED | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| 3066e655 | 2026-10-02T21:55:41.921Z | VALID_SIGNATURE | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| b1cb300d | 2026-10-02T21:55:41.921Z | INVALID_SIGNATURE | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| 30bfea28 | 2026-10-02T21:55:41.921Z | MISSING_SIGNATURE_REJECTED | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| fb1f5724 | 2026-10-02T21:55:41.921Z | MODIFIED_BODY_REJECTED | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| 0ea1daad | 2026-10-02T21:55:41.948Z | INBOUND_TEXT | a0111111... | wamid.SIM_TXT_5c0744d3 | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| bd5777d5 | 2026-10-02T21:55:41.951Z | TENANT_RESOLUTION | a0111111... | - | 3c9db570... | f2fae588... | -... | -... | - | COMPLETED | **PASS** |
| 49c52428 | 2026-10-02T21:55:41.952Z | CUSTOMER_RESOLUTION | a0111111... | - | 3c9db570... | f2fae588... | -... | -... | - | COMPLETED | **PASS** |
| da6055a0 | 2026-10-02T21:55:41.952Z | CONVERSATION_RESOLUTION | a0111111... | - | 3c9db570... | f2fae588... | -... | -... | - | COMPLETED | **PASS** |
| 3258841a | 2026-10-02T21:55:41.967Z | INBOUND_IDEMPOTENCY | a0111111... | wamid.SIM_TXT_5c0744d3 | 3c9db570... | -... | -... | -... | - | COMPLETED | **PASS** |
| 83f87680 | 2026-10-02T21:55:41.998Z | CONCURRENT_DUPLICATE | a0111111... | wamid.SIM_CONC_5c0744d3 | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| 3d1cc2ea | 2026-10-02T21:55:42.082Z | FIFO | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| 32981622 | 2026-10-02T21:55:49.149Z | REAL_DEEPSEEK_AGENT_EXECUTION | a0111111... | - | -... | 937729bd... | 4b098150... | c73bca3c... | - | provider=deepseek model=deepseek-chat model_calls=1 audited=true status=SUCCEEDED | **PASS** |
| ff47e108 | 2026-10-02T21:55:49.152Z | OUTBOUND_REQUEST_RECEIVED_BY_SIMULATOR | a0111111... | - | -... | -... | -... | -... | wamid.SIM_9a8e3717-b339-40af-a572-b07aebfe5fd7 | COMPLETED | **PASS** |
| e5c8f12e | 2026-10-02T21:55:49.152Z | SIMULATED_PROVIDER_MESSAGE_ID_PERSISTED | a0111111... | - | -... | -... | -... | c73bca3c... | wamid.SIM_9a8e3717-b339-40af-a572-b07aebfe5fd7 | COMPLETED | **PASS** |
| c186dfd1 | 2026-10-02T21:55:49.169Z | DELIVERY_CALLBACK | a0111111... | - | -... | -... | -... | c73bca3c... | - | COMPLETED | **PASS** |
| 4bf067fc | 2026-10-02T21:55:49.182Z | READ_CALLBACK | a0111111... | - | -... | -... | -... | c73bca3c... | - | COMPLETED | **PASS** |
| c6278bf1 | 2026-10-02T21:55:49.199Z | DUPLICATE_STATUS_CALLBACK | a0111111... | - | -... | -... | -... | c73bca3c... | - | COMPLETED | **PASS** |
| 491fbbba | 2026-10-02T21:55:50.233Z | OUT_OF_ORDER_STATUS | a0111111... | - | -... | -... | -... | a8839c66... | - | COMPLETED | **PASS** |
| 4620c382 | 2026-10-02T21:55:50.255Z | FAILED_CALLBACK | a0111111... | - | -... | -... | -... | e49011cb... | - | COMPLETED | **PASS** |
| 9b6e07af | 2026-10-02T21:56:04.361Z | RATE_LIMIT_RETRY | a0111111... | - | -... | -... | -... | 0286e159... | wamid.SIM_10dee100-a51e-4839-8a55-241f627dc6a8 | COMPLETED | **PASS** |
| 06fa6834 | 2026-10-02T21:56:19.483Z | SERVER_ERROR_RETRY | a0111111... | - | -... | -... | -... | 3a438d06... | wamid.SIM_e4810b31-46ac-4f65-b356-831958ab637e | COMPLETED | **PASS** |
| acffbabe | 2026-10-02T21:56:29.568Z | AUTH_FAILURE_HANDLING | a0111111... | - | -... | -... | -... | 7b3e6033... | - | COMPLETED | **PASS** |
| 5489475e | 2026-10-02T21:56:29.586Z | TIMEOUT_BEFORE_ACCEPT | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| 9c867acf | 2026-10-02T21:56:29.586Z | TIMEOUT_AFTER_ACCEPT | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| 0c8c0d09 | 2026-10-02T21:56:29.586Z | AMBIGUOUS_SEND_SAFETY | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| cabf35b4 | 2026-10-02T21:56:29.586Z | PROVIDER_RETRY_MAX_ATTEMPTS | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| 668b76ba | 2026-10-02T21:56:29.586Z | PROVIDER_FAILURE_METRICS | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| bfd533ef | 2026-10-02T21:56:29.663Z | CROSS_TENANT_PROVIDER_ROUTING | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| cc446c07 | 2026-10-02T21:56:29.676Z | UNKNOWN_CHANNEL_SAFETY | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| 7434760d | 2026-10-02T21:56:39.821Z | GENERAL_INQUIRY_FLOW | a0111111... | - | -... | 0ec4a0c1... | dd1ac414... | 87d0b805... | wamid.SIM_37a9af03-a567-48ab-89f7-ec44195a0c11 | COMPLETED | **PASS** |
| 87bf20d0 | 2026-10-02T21:56:49.967Z | CATALOG_FLOW | a0111111... | - | -... | -... | 9d30677f... | 55bd5e74... | - | COMPLETED | **PASS** |
| 98c2507d | 2026-10-02T21:56:59.093Z | OFFER_FLOW | a0111111... | - | -... | -... | 6dac0610... | 18ac0fa0... | - | COMPLETED | **PASS** |
| e946a90a | 2026-10-02T21:57:09.233Z | POLICY_FLOW | a0111111... | - | -... | -... | ffe94002... | 4cd038a7... | - | COMPLETED | **PASS** |
| f4cc5c68 | 2026-10-02T21:57:19.362Z | KNOWLEDGE_FLOW | a0111111... | - | -... | -... | 5d6a61e8... | 8c9e0ec8... | - | COMPLETED | **PASS** |
| 1a4419d9 | 2026-10-02T21:57:19.368Z | BOOKING_PREFLIGHT | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| b2d8bbdf | 2026-10-02T21:57:44.640Z | BOOKING_FLOW | a0111111... | - | -... | 926311a2... | f7af0e05... | 151fb8a0... | - | status=CONFIRMED BOOKING_MODEL_MODE=DEEPSEEK | **PASS** |
| b441855d | 2026-10-02T21:57:46.677Z | DUPLICATE_BOOKING_CONFIRMATION | a0111111... | wamid.SIM_CONFIRM_ea566926 | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| 6783fcb1 | 2026-10-02T21:57:54.817Z | ZERO_SLOT_FLOW | a0111111... | - | -... | -... | 2ba468c0... | b8055e81... | - | COMPLETED | **PASS** |
| bd1b2764 | 2026-10-02T21:58:30.285Z | TOPIC_SWITCH_FLOW | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| 7298b932 | 2026-10-02T21:58:44.452Z | MULTI_INTENT_FLOW | a0111111... | - | -... | -... | d61387a4... | 51fa300a... | - | COMPLETED | **PASS** |
| a5760336 | 2026-10-02T21:58:44.452Z | QUOTE_FLOW | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **NOT_ENABLED** |
| 4c704729 | 2026-10-02T21:58:44.452Z | ORDER_FLOW | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **NOT_ENABLED** |
| 70de22ea | 2026-10-02T21:58:54.598Z | HUMAN_HANDOFF_FLOW | a0111111... | - | -... | -... | 374f2395... | 9e2e6dc7... | - | COMPLETED | **PASS** |
| 231800a9 | 2026-10-02T21:58:54.600Z | BUSINESS_MUTATION_DUPLICATION | a0111111... | - | -... | -... | -... | -... | - | DUPLICATES_NO | **PASS** |

## Operational Invariants Under Test

- Bounded provider retry policy: MAX ATTEMPTS = 4, exponential backoff with 5000ms base.
- Ambiguous send safety: Network timeouts transition attempt/message to UNKNOWN; no blind duplicate resend.
- Out of order status safety: READ status is monotonic; later delivered callback does not regress state.
- Cross tenant strict isolation: Tenant A never resolves to Tenant B; customer identities and conversations are tenant-scoped.
- Unknown channel safety: Webhook with unmapped phone_number_id returns 200 without creating any tenant state.
- Business mutations idempotency: Confirmed bookings cannot be duplicated by replaying provider confirmation webhooks.
- DeepSeek data boundary: Only synthetic demo conversation context was sent to DeepSeek.
- Zero real Meta calls: No network request was made to graph.facebook.com or any external Meta endpoint.
