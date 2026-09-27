# PRE-P14 LOCAL MODEL CAPABILITY SEARCH

Date: 2026-09-25T22:22:10.422Z

```text
DOCKER LOCAL MODEL CAPABILITY SEARCH: FAIL
OLLAMA_RUNTIME: DOCKER
CANDIDATES_TESTED: qwen2.5:1.5b, qwen3:4b, qwen2.5:7b
SELECTED_MODEL: NONE
HARDWARE_FIT: FAIL
PROBE_A: FAIL
PROBE_B: FAIL
PROBE_C: FAIL
PROBE_D_REAL_CONTEXT_ARABIC: FAIL
ARABIC_SCHEMA_SUCCESS_RATE: n/a
EMPTY_OBJECT_COUNT: 3
MALFORMED_JSON_COUNT: 28
TIMEOUT_COUNT: 21
AVG_WALL_LATENCY: n/a
MODEL_CAPABILITY: INSUFFICIENT
E2E_ELIGIBLE: NO
TOTAL_NEW_SPEND: 0
EXTERNAL_META: NOT_RUN
P14_AUTHORIZED: NO
```

## Host gate

- HOST_CLASS: MacBookPro15,2_16GB_Intel
- MAX_PARAMETER_BILLIONS: 7
- MAX_EXPECTED_MEMORY_GB: 10
- approx free at search start: see notes

## Probe D definition

Real orchestrator policy system prompt only (no AgentDecision coaching).
Arabic user turns + tools[] + response_format=json_object.
Valid AgentDecision in message.content required. Native tool_calls-only = fail.

## Candidate: qwen2.5:1.5b

- hostFit: PASS
- pulled: true
- e2eEligible: false
- arabicSchemaSuccessRate: 0%
- Probe A: passRate=100% schemaFail=0 toolFail=0 timeouts=0 avgWallMs=11458
  - PASS 21851ms final_response
  - PASS 8890ms final_response
  - PASS 3633ms final_response
- Probe B: passRate=100% schemaFail=0 toolFail=0 timeouts=0 avgWallMs=8143
  - PASS 9501ms tool_request
  - PASS 8610ms tool_request
  - PASS 6317ms tool_request
- Probe C: passRate=100% schemaFail=0 toolFail=0 timeouts=0 avgWallMs=15500
  - PASS 14253ms tool_then_final
  - PASS 18174ms tool_then_final
  - PASS 14073ms tool_then_final
- Probe D: passRate=0% schemaFail=3 toolFail=0 timeouts=0 avgWallMs=3380
  - SCHEMA_FAILURE 8233ms [
  {
    "code": "invalid_union",
    "errors": [],
    "note": "No matching discriminator",
    "discriminator": "type
  - EMPTY 251ms empty_or_empty_object
  - SCHEMA_FAILURE 1657ms [
  {
    "code": "invalid_union",
    "errors": [],
    "note": "No matching discriminator",
    "discriminator": "type
- Probe AR: passRate=0% schemaFail=12 toolFail=0 timeouts=0 avgWallMs=2742
  - SCHEMA_FAILURE 1984ms [
  {
    "code": "invalid_union",
    "errors": [],
    "note": "No matching discriminator",
    "discriminator": "type
  - SCHEMA_FAILURE 3171ms [
  {
    "code": "invalid_union",
    "errors": [],
    "note": "No matching discriminator",
    "discriminator": "type
  - SCHEMA_FAILURE 1334ms [
  {
    "code": "invalid_union",
    "errors": [],
    "note": "No matching discriminator",
    "discriminator": "type
  - SCHEMA_FAILURE 6158ms [
  {
    "code": "invalid_union",
    "errors": [],
    "note": "No matching discriminator",
    "discriminator": "type
  - SCHEMA_FAILURE 3580ms [
  {
    "code": "invalid_union",
    "errors": [],
    "note": "No matching discriminator",
    "discriminator": "type
  - EMPTY 221ms empty_or_empty_object
  - EMPTY 418ms empty_or_empty_object
  - SCHEMA_FAILURE 1570ms [
  {
    "code": "invalid_union",
    "errors": [],
    "note": "No matching discriminator",
    "discriminator": "type
  - SCHEMA_FAILURE 2257ms [
  {
    "code": "invalid_union",
    "errors": [],
    "note": "No matching discriminator",
    "discriminator": "type
  - SCHEMA_FAILURE 4064ms [
  {
    "code": "invalid_union",
    "errors": [],
    "note": "No matching discriminator",
    "discriminator": "type
  - SCHEMA_FAILURE 2684ms [
  {
    "code": "invalid_union",
    "errors": [],
    "note": "No matching discriminator",
    "discriminator": "type
  - SCHEMA_FAILURE 5468ms [
  {
    "code": "invalid_union",
    "errors": [],
    "note": "No matching discriminator",
    "discriminator": "type
- note: estimate size≈1GB quant=Q4_K_M param=1.5B mem≈2GB
- note: approx_free_gb=5.81
- note: already_installed

## Candidate: qwen3:4b

- hostFit: PASS
- pulled: true
- e2eEligible: false
- arabicSchemaSuccessRate: 0%
- Probe A: passRate=33% schemaFail=0 toolFail=0 timeouts=2 avgWallMs=169471
  - PASS 148396ms final_response
  - TIMEOUT 180015ms TIMEOUT:This operation was aborted
  - TIMEOUT 180002ms TIMEOUT:This operation was aborted
- Probe B: passRate=0% schemaFail=0 toolFail=0 timeouts=3 avgWallMs=180002
  - TIMEOUT 180003ms TIMEOUT:This operation was aborted
  - TIMEOUT 180003ms TIMEOUT:This operation was aborted
  - TIMEOUT 180001ms TIMEOUT:This operation was aborted
- Probe C: passRate=33% schemaFail=0 toolFail=0 timeouts=2 avgWallMs=276745
  - TIMEOUT 180007ms round1_TIMEOUT:This operation was aborted
  - PASS 340458ms tool_then_final
  - TIMEOUT 309771ms round2_TIMEOUT:This operation was aborted
- Probe D: passRate=0% schemaFail=1 toolFail=0 timeouts=2 avgWallMs=169422
  - TIMEOUT 179998ms TIMEOUT:This operation was aborted
  - TIMEOUT 180007ms TIMEOUT:This operation was aborted
  - SCHEMA_FAILURE 148262ms [
  {
    "code": "invalid_union",
    "errors": [],
    "note": "No matching discriminator",
    "discriminator": "type
- Probe AR: passRate=0% schemaFail=0 toolFail=0 timeouts=12 avgWallMs=180002
  - TIMEOUT 179998ms TIMEOUT:This operation was aborted
  - TIMEOUT 180006ms TIMEOUT:This operation was aborted
  - TIMEOUT 179999ms TIMEOUT:This operation was aborted
  - TIMEOUT 179998ms TIMEOUT:This operation was aborted
  - TIMEOUT 180004ms TIMEOUT:This operation was aborted
  - TIMEOUT 179999ms TIMEOUT:This operation was aborted
  - TIMEOUT 179999ms TIMEOUT:This operation was aborted
  - TIMEOUT 180004ms TIMEOUT:This operation was aborted
  - TIMEOUT 180006ms TIMEOUT:This operation was aborted
  - TIMEOUT 180002ms TIMEOUT:This operation was aborted
  - TIMEOUT 180005ms TIMEOUT:This operation was aborted
  - TIMEOUT 179998ms TIMEOUT:This operation was aborted
- note: estimate size≈2.5GB quant=Q4_K_M param=4B mem≈4GB
- note: approx_free_gb=5.98
- note: already_installed

## Candidate: qwen2.5:7b

- hostFit: PASS
- pulled: true
- e2eEligible: false
- arabicSchemaSuccessRate: 0%
- Probe A: passRate=100% schemaFail=0 toolFail=0 timeouts=0 avgWallMs=23185
  - PASS 48593ms final_response
  - PASS 8073ms final_response
  - PASS 12889ms final_response
- Probe B: passRate=100% schemaFail=0 toolFail=0 timeouts=0 avgWallMs=11700
  - PASS 14192ms tool_request
  - PASS 9047ms tool_request
  - PASS 11861ms tool_request
- Probe C: passRate=100% schemaFail=0 toolFail=0 timeouts=0 avgWallMs=23800
  - PASS 29944ms tool_then_final
  - PASS 21726ms tool_then_final
  - PASS 19731ms tool_then_final
- Probe D: passRate=0% schemaFail=3 toolFail=0 timeouts=0 avgWallMs=13590
  - SCHEMA_FAILURE 30092ms [
  {
    "code": "invalid_union",
    "errors": [],
    "note": "No matching discriminator",
    "discriminator": "type
  - SCHEMA_FAILURE 5621ms [
  {
    "code": "invalid_union",
    "errors": [],
    "note": "No matching discriminator",
    "discriminator": "type
  - SCHEMA_FAILURE 5058ms [
  {
    "code": "invalid_union",
    "errors": [],
    "note": "No matching discriminator",
    "discriminator": "type
- Probe AR: passRate=0% schemaFail=12 toolFail=0 timeouts=0 avgWallMs=9227
  - SCHEMA_FAILURE 6432ms [
  {
    "code": "invalid_union",
    "errors": [],
    "note": "No matching discriminator",
    "discriminator": "type
  - SCHEMA_FAILURE 5537ms [
  {
    "code": "invalid_union",
    "errors": [],
    "note": "No matching discriminator",
    "discriminator": "type
  - SCHEMA_FAILURE 6393ms [
  {
    "code": "invalid_union",
    "errors": [],
    "note": "No matching discriminator",
    "discriminator": "type
  - SCHEMA_FAILURE 7785ms [
  {
    "code": "invalid_union",
    "errors": [],
    "note": "No matching discriminator",
    "discriminator": "type
  - SCHEMA_FAILURE 6831ms [
  {
    "code": "invalid_union",
    "errors": [],
    "note": "No matching discriminator",
    "discriminator": "type
  - SCHEMA_FAILURE 5393ms [
  {
    "code": "invalid_union",
    "errors": [],
    "note": "No matching discriminator",
    "discriminator": "type
  - SCHEMA_FAILURE 21779ms [
  {
    "code": "invalid_union",
    "errors": [],
    "note": "No matching discriminator",
    "discriminator": "type
  - SCHEMA_FAILURE 16723ms [
  {
    "code": "invalid_union",
    "errors": [],
    "note": "No matching discriminator",
    "discriminator": "type
  - SCHEMA_FAILURE 17699ms [
  {
    "code": "invalid_union",
    "errors": [],
    "note": "No matching discriminator",
    "discriminator": "type
  - SCHEMA_FAILURE 6169ms [
  {
    "code": "invalid_union",
    "errors": [],
    "note": "No matching discriminator",
    "discriminator": "type
  - SCHEMA_FAILURE 4535ms [
  {
    "code": "invalid_union",
    "errors": [],
    "note": "No matching discriminator",
    "discriminator": "type
  - SCHEMA_FAILURE 5450ms [
  {
    "code": "invalid_union",
    "errors": [],
    "note": "No matching discriminator",
    "discriminator": "type
- note: estimate size≈4.7GB quant=Q4_K_M param=7B mem≈6GB
- note: approx_free_gb=5.84
- note: pulling:qwen2.5:7b

## STOP

Do not enable Meta. Do not start Phase 14.
