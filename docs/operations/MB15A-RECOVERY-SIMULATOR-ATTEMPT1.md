# MB-15A Meta Simulator Acceptance Evidence

## Acceptance Summary

Status: **PARTIAL**
BOOKING_MODEL_MODE: DEEPSEEK
Generated at: 2026-10-02T00:20:50.249Z
Execution mode: Meta Simulator Loopback / Private Container Network

## Acceptance Evidence Matrix

| Run ID | Timestamp (UTC) | Scenario | Organization | Provider Inbound ID | Internal Msg ID | Conversation ID | Agent Run ID | Outbound Internal ID | Simulated Provider ID | Final State | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| f9c5f3ab | 2026-10-02T00:17:41.324Z | REAL_DEEPSEEK_AVAILABLE | a0111111... | - | -... | -... | -... | -... | - | AI_PROVIDER=deepseek DEEPSEEK_API_KEY_CONFIGURED=true | **PASS** |
| 1b4ba323 | 2026-10-02T00:17:41.325Z | KNOWLEDGE_EMBEDDING_AVAILABLE | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| a0cfba1a | 2026-10-02T00:17:41.325Z | INFRASTRUCTURE_PREFLIGHT | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| bcbd0b05 | 2026-10-02T00:17:41.346Z | WEBHOOK_VERIFICATION_SIMULATED | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| 3b87513e | 2026-10-02T00:17:41.403Z | VALID_SIGNATURE | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| 1d944686 | 2026-10-02T00:17:41.403Z | INVALID_SIGNATURE | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| d4138146 | 2026-10-02T00:17:41.403Z | MISSING_SIGNATURE_REJECTED | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| 7107545f | 2026-10-02T00:17:41.403Z | MODIFIED_BODY_REJECTED | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| 6488709f | 2026-10-02T00:17:41.430Z | INBOUND_TEXT | a0111111... | wamid.SIM_TXT_3452b6d9 | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| 8a2744a9 | 2026-10-02T00:17:41.433Z | TENANT_RESOLUTION | a0111111... | - | cd4be6ee... | 2565115e... | -... | -... | - | COMPLETED | **PASS** |
| b5fa17cc | 2026-10-02T00:17:41.433Z | CUSTOMER_RESOLUTION | a0111111... | - | cd4be6ee... | 2565115e... | -... | -... | - | COMPLETED | **PASS** |
| 78296bb6 | 2026-10-02T00:17:41.433Z | CONVERSATION_RESOLUTION | a0111111... | - | cd4be6ee... | 2565115e... | -... | -... | - | COMPLETED | **PASS** |
| 481b9ae7 | 2026-10-02T00:17:41.445Z | INBOUND_IDEMPOTENCY | a0111111... | wamid.SIM_TXT_3452b6d9 | cd4be6ee... | -... | -... | -... | - | COMPLETED | **PASS** |
| dc1a5e56 | 2026-10-02T00:17:41.487Z | CONCURRENT_DUPLICATE | a0111111... | wamid.SIM_CONC_3452b6d9 | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| a135731e | 2026-10-02T00:17:41.555Z | FIFO | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| 6aaf1554 | 2026-10-02T00:17:49.623Z | REAL_DEEPSEEK_AGENT_EXECUTION | a0111111... | - | -... | e329549e... | 552d3af4... | b1ee432a... | - | provider=deepseek model=deepseek-chat model_calls=1 audited=true status=SUCCEEDED | **PASS** |
| bc05e8ff | 2026-10-02T00:17:49.628Z | OUTBOUND_REQUEST_RECEIVED_BY_SIMULATOR | a0111111... | - | -... | -... | -... | -... | wamid.SIM_123c51d5-d504-46f5-8719-ed1080b4da7e | COMPLETED | **PASS** |
| fc8e6b83 | 2026-10-02T00:17:49.628Z | SIMULATED_PROVIDER_MESSAGE_ID_PERSISTED | a0111111... | - | -... | -... | -... | b1ee432a... | wamid.SIM_123c51d5-d504-46f5-8719-ed1080b4da7e | COMPLETED | **PASS** |
| 2de3d2ba | 2026-10-02T00:17:49.680Z | DELIVERY_CALLBACK | a0111111... | - | -... | -... | -... | b1ee432a... | - | COMPLETED | **PASS** |
| 893e4460 | 2026-10-02T00:17:49.726Z | READ_CALLBACK | a0111111... | - | -... | -... | -... | b1ee432a... | - | COMPLETED | **PASS** |
| 696776b5 | 2026-10-02T00:17:49.774Z | DUPLICATE_STATUS_CALLBACK | a0111111... | - | -... | -... | -... | b1ee432a... | - | COMPLETED | **PASS** |
| 3083501b | 2026-10-02T00:17:50.821Z | OUT_OF_ORDER_STATUS | a0111111... | - | -... | -... | -... | 686ee4ba... | - | COMPLETED | **PASS** |
| 9cc63a71 | 2026-10-02T00:17:50.845Z | FAILED_CALLBACK | a0111111... | - | -... | -... | -... | 5edccd60... | - | COMPLETED | **PASS** |
| 347ce995 | 2026-10-02T00:18:04.943Z | RATE_LIMIT_RETRY | a0111111... | - | -... | -... | -... | 06e961dc... | wamid.SIM_a4d699df-8e26-4a10-8c06-fabe31629dff | COMPLETED | **PASS** |
| 628bfb82 | 2026-10-02T00:18:20.052Z | SERVER_ERROR_RETRY | a0111111... | - | -... | -... | -... | 608bfe62... | wamid.SIM_dacd3c47-12f6-453d-b951-cf7b5133841b | COMPLETED | **PASS** |
| 5b6b58de | 2026-10-02T00:18:30.157Z | AUTH_FAILURE_HANDLING | a0111111... | - | -... | -... | -... | 41001c70... | - | COMPLETED | **PASS** |
| 70b06df9 | 2026-10-02T00:18:30.174Z | TIMEOUT_BEFORE_ACCEPT | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| b777333e | 2026-10-02T00:18:30.174Z | TIMEOUT_AFTER_ACCEPT | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| 698da472 | 2026-10-02T00:18:30.174Z | AMBIGUOUS_SEND_SAFETY | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| e7378c05 | 2026-10-02T00:18:30.175Z | PROVIDER_RETRY_MAX_ATTEMPTS | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| 37bba00b | 2026-10-02T00:18:30.175Z | PROVIDER_FAILURE_METRICS | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| 4b019ca3 | 2026-10-02T00:18:30.261Z | CROSS_TENANT_PROVIDER_ROUTING | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| 09a1d6d9 | 2026-10-02T00:18:30.271Z | UNKNOWN_CHANNEL_SAFETY | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| 559d19dc | 2026-10-02T00:18:40.447Z | GENERAL_INQUIRY_FLOW | a0111111... | - | -... | fcc7b12f... | f64b759f... | 3f089b87... | wamid.SIM_f3779cd4-e9f2-4579-80b9-c854bace7b75 | COMPLETED | **PASS** |
| 936c7f42 | 2026-10-02T00:18:49.574Z | CATALOG_FLOW | a0111111... | - | -... | -... | 8203c923... | 22cccb9a... | - | COMPLETED | **PASS** |
| 937defdd | 2026-10-02T00:18:59.734Z | OFFER_FLOW | a0111111... | - | -... | -... | 7cf15d5d... | 1a968e6c... | - | COMPLETED | **PASS** |
| b7fd99d7 | 2026-10-02T00:19:09.879Z | POLICY_FLOW | a0111111... | - | -... | -... | 24c0d4b7... | 3cb9c77d... | - | COMPLETED | **PASS** |
| 4b3b1069 | 2026-10-02T00:19:20.062Z | KNOWLEDGE_FLOW | a0111111... | - | -... | -... | 4107dc07... | 439edfd9... | - | COMPLETED | **FAIL** |
| c01755a3 | 2026-10-02T00:19:20.068Z | BOOKING_PREFLIGHT | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| 6cd770fb | 2026-10-02T00:19:40.332Z | BOOKING_FLOW | a0111111... | - | -... | 841ac6e4... | a254d892... | 1df362a3... | - | status=CONFIRMED BOOKING_MODEL_MODE=DEEPSEEK | **PASS** |
| f8905ed9 | 2026-10-02T00:19:42.365Z | DUPLICATE_BOOKING_CONFIRMATION | a0111111... | wamid.SIM_CONFIRM_105d57dc | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| 43141af8 | 2026-10-02T00:19:49.496Z | ZERO_SLOT_FLOW | a0111111... | - | -... | -... | ef89b047... | 5b764a25... | - | COMPLETED | **PASS** |
| 6a286b26 | 2026-10-02T00:20:24.910Z | TOPIC_SWITCH_FLOW | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **PASS** |
| a29d63eb | 2026-10-02T00:20:40.098Z | MULTI_INTENT_FLOW | a0111111... | - | -... | -... | b8041f00... | 1ac306d8... | - | COMPLETED | **FAIL** |
| 02f4787a | 2026-10-02T00:20:40.098Z | QUOTE_FLOW | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **NOT_ENABLED** |
| a9ed0070 | 2026-10-02T00:20:40.098Z | ORDER_FLOW | a0111111... | - | -... | -... | -... | -... | - | COMPLETED | **NOT_ENABLED** |
| 67413c32 | 2026-10-02T00:20:50.247Z | HUMAN_HANDOFF_FLOW | a0111111... | - | -... | -... | ed4de152... | 86a3c019... | - | COMPLETED | **FAIL** |
| 07b9d1e5 | 2026-10-02T00:20:50.248Z | BUSINESS_MUTATION_DUPLICATION | a0111111... | - | -... | -... | -... | -... | - | DUPLICATES_NO | **PASS** |

## Operational Invariants Under Test

- Bounded provider retry policy: MAX ATTEMPTS = 4, exponential backoff with 5000ms base.
- Ambiguous send safety: Network timeouts transition attempt/message to UNKNOWN; no blind duplicate resend.
- Out of order status safety: READ status is monotonic; later delivered callback does not regress state.
- Cross tenant strict isolation: Tenant A never resolves to Tenant B; customer identities and conversations are tenant-scoped.
- Unknown channel safety: Webhook with unmapped phone_number_id returns 200 without creating any tenant state.
- Business mutations idempotency: Confirmed bookings cannot be duplicated by replaying provider confirmation webhooks.
- DeepSeek data boundary: Only synthetic demo conversation context was sent to DeepSeek.
- Zero real Meta calls: No network request was made to graph.facebook.com or any external Meta endpoint.
