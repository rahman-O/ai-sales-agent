# PRE-P14 Zero-cost PATH B live demo evidence

Date: 2026-09-24T17:41:04.412Z

```text
DEMO_DB_TARGET: LOCAL
DEMO_REDIS_TARGET: LOCAL
MESSAGING TRANSPORT: FAKE_TEST
MODEL PROVIDER: FAKE_TEST (ZERO_COST_DEMO scripted)
EMBEDDING: NOT_RUN_IN_THIS_PASS
```

## Layered verdict (binding)

```text
APPLICATION E2E: PASS
AGENT TOOL ORCHESTRATION: PASS
LOCAL QUEUE/OUTBOX: PASS
UI/API READBACK: LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED
EXTERNAL META E2E: NOT_RUN
EXTERNAL LLM E2E: NOT_RUN
REAL META/TEMPLATE ACCEPTANCE: NOT_RUN
TOTAL NEW SPEND: 0
P14_AUTHORIZED: NO
```

## Preflight / fixtures

```text
HOSTED_AUTH_SUBJECT: resolved
LOCAL_USER_MAPPING: PASS
LOCAL_MEMBERSHIP: PASS
PROVISION_WRITES_TO: Auth only (User via GET /v1/auth/me)
CATALOG + TENANT AgentConfig: PASS (fixtures phase)
TRIPLE GATE: NODE_ENV=development + AI_ALLOW_FAKE=true + ZERO_COST_DEMO=1
```

## Journey log

### INBOUND
- INPUT: Hi, what services do you offer?
- OBSERVED UI: LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED
- AUTHORITATIVE: conversation=5eb25593 status=201
- RESULT: PASS
- TRANSPORT: FAKE_TEST_TRANSPORT

### AI_ORCHESTRATION
- INPUT: worker process FAQ scenario
- OBSERVED UI: LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED
- AUTHORITATIVE: agentRun=true outbound=true
- RESULT: PASS
- TRANSPORT: FAKE_TEST_TRANSPORT

### LEAD
- INPUT: [demo:intent-book] phrase
- OBSERVED UI: LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED
- AUTHORITATIVE: leads=1 inbound2=201
- RESULT: PASS
- TRANSPORT: FAKE_TEST_TRANSPORT

### AVAILABILITY_AND_BOOKING
- INPUT: Book the first available appointment. (CONFIRM_BOOKING script)
- OBSERVED UI: LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED
- AUTHORITATIVE: bookings=2 status=CONFIRMED in3=201
- RESULT: PASS
- TRANSPORT: FAKE_TEST_TRANSPORT

### CONFLICT_PROTECTION
- INPUT: second customer same confirm phrase
- OBSERVED UI: LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED
- AUTHORITATIVE: bookings_before=2 after=2 conflict_inbound=201
- RESULT: PASS
- TRANSPORT: FAKE_TEST_TRANSPORT

### HUMAN_TAKEOVER
- INPUT: POST takeover
- OBSERVED UI: LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED
- AUTHORITATIVE: mode=AI_PAUSED status=201
- RESULT: PASS
- TRANSPORT: LOCAL_REAL_STACK

### OPERATOR_REPLY
- INPUT: human reply
- OBSERVED UI: LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED
- AUTHORITATIVE: status=201
- RESULT: PASS
- TRANSPORT: FAKE_TEST_TRANSPORT

### AI_PAUSE_FENCE
- INPUT: inbound while AI_PAUSED
- OBSERVED UI: LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED
- AUTHORITATIVE: runs_before=4 after=4
- RESULT: PASS
- TRANSPORT: LOCAL_REAL_STACK

### RESUME_AI
- INPUT: resume-ai + new FAQ inbound
- OBSERVED UI: LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED
- AUTHORITATIVE: resume=201
- RESULT: PASS
- TRANSPORT: LOCAL_REAL_STACK

### DEDUPE
- INPUT: replay same providerMessageId
- OBSERVED UI: LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED
- AUTHORITATIVE: first=201 second=201
- RESULT: PASS
- TRANSPORT: FAKE_TEST_TRANSPORT

### DASHBOARD
- INPUT: GET dashboard
- OBSERVED UI: LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED
- AUTHORITATIVE: status=200
- RESULT: PASS
- TRANSPORT: LOCAL_REAL_STACK

### ANALYTICS
- INPUT: GET analytics overview
- OBSERVED UI: LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED
- AUTHORITATIVE: status=200
- RESULT: PASS
- TRANSPORT: LOCAL_REAL_STACK

### AI_EMERGENCY_KILL
- INPUT: disable → inbound → enable
- OBSERVED UI: LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED
- AUTHORITATIVE: kill=201 enable=201 runs=5->5
- RESULT: PASS
- TRANSPORT: LOCAL_REAL_STACK

### FOLLOW-UP_CORE
- INPUT: deferred — requires template + FollowUpDue sweep timing
- OBSERVED UI: NOT_RUN
- AUTHORITATIVE: not executed in this automated pass
- RESULT: SKIPPED
- TRANSPORT: LOCAL_REAL_STACK

### KNOWLEDGE
- INPUT: deferred after core per amendment
- OBSERVED UI: NOT_RUN
- AUTHORITATIVE: TEI not required for core PATH B
- RESULT: SKIPPED
- TRANSPORT: LOCAL_REAL_STACK

### REDIS_VISUAL_RECOVERY
- INPUT: optional local outage
- OBSERVED UI: NOT_RUN
- AUTHORITATIVE: skipped to avoid disrupting demo session
- RESULT: SKIPPED
- TRANSPORT: LOCAL_REAL_STACK

## Final report

```json
{
  "ZERO_COST_LIVE_DEMO_STATUS": "PARTIAL",
  "note": "PARTIAL when follow-up/knowledge/redis skipped; core journeys determine APPLICATION E2E",
  "STACK_STARTUP": "PASS",
  "AUTH": "PASS",
  "CATALOG_FIXTURE": "PASS",
  "KNOWLEDGE": "SKIPPED",
  "INBOUND": "PASS",
  "AI_ORCHESTRATION": "PASS",
  "LEAD": "PASS",
  "AVAILABILITY": "PASS",
  "BOOKING": "PASS",
  "CONFLICT_PROTECTION": "PASS",
  "HUMAN_TAKEOVER": "PASS",
  "OPERATOR_REPLY": "PASS",
  "AI_PAUSE_FENCE": "PASS",
  "RESUME_AI": "PASS",
  "FOLLOW_UP_CORE": "SKIPPED",
  "FOLLOW_UP_SUPPRESSION": "SKIPPED",
  "DUPLICATE_INBOUND": "PASS",
  "DASHBOARD": "PASS",
  "ANALYTICS": "PASS",
  "AI_EMERGENCY_KILL": "PASS",
  "REDIS_VISUAL_RECOVERY": "SKIPPED",
  "REAL_META_ACCEPTANCE": "NOT_RUN",
  "REAL_TEMPLATE_ACCEPTANCE": "NOT_RUN",
  "TRANSPORT": "FAKE_TEST_TRANSPORT",
  "APPLICATION_E2E": "PASS",
  "AGENT_TOOL_ORCHESTRATION": "PASS",
  "LOCAL_QUEUE_OUTBOX": "PASS",
  "UI_API_READBACK": "LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED",
  "EXTERNAL_META_E2E": "NOT_RUN",
  "EXTERNAL_LLM_E2E": "NOT_RUN",
  "META_COST": 0,
  "LLM_COST": 0,
  "REDIS_COST": 0,
  "LOCAL_EMBEDDING_COST": 0,
  "NEW_INFRA_COST": 0,
  "TOTAL_NEW_SPEND": 0,
  "READY_FOR_P14_DISCOVERY": "YES",
  "P14_AUTHORIZED": "NO",
  "steps": [
    {
      "step": "INBOUND",
      "input": "Hi, what services do you offer?",
      "observedUi": "LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED",
      "authoritative": "conversation=5eb25593 status=201",
      "result": "PASS",
      "transport": "FAKE_TEST_TRANSPORT"
    },
    {
      "step": "AI_ORCHESTRATION",
      "input": "worker process FAQ scenario",
      "observedUi": "LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED",
      "authoritative": "agentRun=true outbound=true",
      "result": "PASS",
      "transport": "FAKE_TEST_TRANSPORT"
    },
    {
      "step": "LEAD",
      "input": "[demo:intent-book] phrase",
      "observedUi": "LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED",
      "authoritative": "leads=1 inbound2=201",
      "result": "PASS",
      "transport": "FAKE_TEST_TRANSPORT"
    },
    {
      "step": "AVAILABILITY_AND_BOOKING",
      "input": "Book the first available appointment. (CONFIRM_BOOKING script)",
      "observedUi": "LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED",
      "authoritative": "bookings=2 status=CONFIRMED in3=201",
      "result": "PASS",
      "transport": "FAKE_TEST_TRANSPORT"
    },
    {
      "step": "CONFLICT_PROTECTION",
      "input": "second customer same confirm phrase",
      "observedUi": "LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED",
      "authoritative": "bookings_before=2 after=2 conflict_inbound=201",
      "result": "PASS",
      "transport": "FAKE_TEST_TRANSPORT"
    },
    {
      "step": "HUMAN_TAKEOVER",
      "input": "POST takeover",
      "observedUi": "LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED",
      "authoritative": "mode=AI_PAUSED status=201",
      "result": "PASS",
      "transport": "LOCAL_REAL_STACK"
    },
    {
      "step": "OPERATOR_REPLY",
      "input": "human reply",
      "observedUi": "LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED",
      "authoritative": "status=201",
      "result": "PASS",
      "transport": "FAKE_TEST_TRANSPORT"
    },
    {
      "step": "AI_PAUSE_FENCE",
      "input": "inbound while AI_PAUSED",
      "observedUi": "LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED",
      "authoritative": "runs_before=4 after=4",
      "result": "PASS",
      "transport": "LOCAL_REAL_STACK"
    },
    {
      "step": "RESUME_AI",
      "input": "resume-ai + new FAQ inbound",
      "observedUi": "LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED",
      "authoritative": "resume=201",
      "result": "PASS",
      "transport": "LOCAL_REAL_STACK"
    },
    {
      "step": "DEDUPE",
      "input": "replay same providerMessageId",
      "observedUi": "LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED",
      "authoritative": "first=201 second=201",
      "result": "PASS",
      "transport": "FAKE_TEST_TRANSPORT"
    },
    {
      "step": "DASHBOARD",
      "input": "GET dashboard",
      "observedUi": "LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED",
      "authoritative": "status=200",
      "result": "PASS",
      "transport": "LOCAL_REAL_STACK"
    },
    {
      "step": "ANALYTICS",
      "input": "GET analytics overview",
      "observedUi": "LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED",
      "authoritative": "status=200",
      "result": "PASS",
      "transport": "LOCAL_REAL_STACK"
    },
    {
      "step": "AI_EMERGENCY_KILL",
      "input": "disable → inbound → enable",
      "observedUi": "LOGIC_PASS_UI_NOT_VISUALLY_VERIFIED",
      "authoritative": "kill=201 enable=201 runs=5->5",
      "result": "PASS",
      "transport": "LOCAL_REAL_STACK"
    },
    {
      "step": "FOLLOW-UP_CORE",
      "input": "deferred — requires template + FollowUpDue sweep timing",
      "observedUi": "NOT_RUN",
      "authoritative": "not executed in this automated pass",
      "result": "SKIPPED",
      "transport": "LOCAL_REAL_STACK"
    },
    {
      "step": "KNOWLEDGE",
      "input": "deferred after core per amendment",
      "observedUi": "NOT_RUN",
      "authoritative": "TEI not required for core PATH B",
      "result": "SKIPPED",
      "transport": "LOCAL_REAL_STACK"
    },
    {
      "step": "REDIS_VISUAL_RECOVERY",
      "input": "optional local outage",
      "observedUi": "NOT_RUN",
      "authoritative": "skipped to avoid disrupting demo session",
      "result": "SKIPPED",
      "transport": "LOCAL_REAL_STACK"
    }
  ]
}
```

## User visual checklist (unchecked — not browser-verified)

- [ ] Login works
- [ ] Inbox received synthetic customer message
- [ ] AI reply appeared
- [ ] Lead appeared
- [ ] Available slots were returned
- [ ] Booking appeared
- [ ] Same-slot conflict was rejected
- [ ] Booking visible in schedule
- [ ] Human takeover worked
- [ ] Human reply appeared
- [ ] AI stayed silent while paused
- [ ] Resume AI worked
- [ ] Follow-up core executed
- [ ] Dashboard reflected activity
- [ ] Analytics reflected activity
- [ ] Emergency AI disable stopped new runs
- [ ] New inbound still persisted while AI disabled

P14_AUTHORIZED: NO
