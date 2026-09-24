# Local demo dataset

Purpose: persistent, deterministic **local-only** operator demo data for Zero Cost Test Clinic so `/dashboard`, `/inbox`, `/leads`, `/bookings`, `/schedule`, `/follow-ups`, `/knowledge`, and `/analytics` are non-empty without Meta or paid LLM spend.

**P14_AUTHORIZED: NO**

## Safety guards

Commands refuse unless **all** are true:

1. `NODE_ENV !== production`
2. `DEMO_DB_TARGET=LOCAL` **or** `DEMO_FORCE_LOCAL_DB=1`
3. `DATABASE_URL` and `MIGRATION_DATABASE_URL` hosts are loopback only (`127.0.0.1` / `localhost`)
4. Hosts must not be Supabase / remote / public

`demo:reset` additionally requires `ALLOW_DEMO_RESET=true`.

If the fixed demo org UUID exists under a **different** name → **HARD FAIL** (no adopt/overwrite).

Never prints credentials or DB URLs.

## Commands

```bash
npm run demo:seed     # DB write only — API need not be running
npm run demo:status   # DB inspection only
npm run demo:verify   # authenticated API readbacks (API + Auth required)
npm run demo:reset    # org-scoped delete + POST_RESET_RESIDUAL_CHECK
npm run demo:reseed   # reset + seed
npm run demo:test     # unit/integration guards
```

Typical operator flow:

```bash
npm run demo:reseed
npm run dev:api
npm run dev:worker
npm run dev:web
npm run demo:verify
# open UI routes and visually confirm
```

## Expected data

| Area | Content |
|------|---------|
| Org | `Zero Cost Test Clinic` (`zero-cost-test-clinic`) |
| Operator | Hosted Auth test user mapped OWNER |
| Catalog | Main Test Clinic / Asia/Baghdad; 3 synthetic services; Dr Demo One/Two; Sun–Thu rules |
| Customers | 6× `Demo Customer 0N` with synthetic E.164 `+15555550NNN` |
| Conversations | AI_ACTIVE, handoff unassigned, assigned pause, FAILED outbound, multi-message |
| Leads | NEW / ENGAGED / QUALIFIED / NURTURE / DISQUALIFIED |
| Bookings | From `nextValidAvailabilitySlots()` — not blind relative dates |
| Follow-ups | SCHEDULED + legal terminal snapshots (`DISPATCHED ≠ delivered`) |
| Knowledge | Docs at `AWAITING_REVIEW` → `KNOWLEDGE_DEMO: PARTIAL` until full P05 path |
| AgentConfig | One ACTIVE with explicit tenant allowlist |

## Reset behavior

Deletes **only** rows for the demo organization UUID, then asserts:

```text
DEMO_ORG_ABSENT / DEMO_TENANT_ROWS_REMAINING: 0
POST_RESET_RESIDUAL_CHECK: PASS
```

Other organizations must survive.

## Limitations

- Knowledge is **PARTIAL** unless storage + review + publish + embedding all run.
- `demo:verify` does not claim browser visual PASS.
- Follow-up terminal rows are **schema-legal snapshots**, not a substitute for the runtime state machine.
- Analytics fuel uses one chronological AgentRun chain; do not invent disconnected usage rows.

## Spend / phase

```text
TOTAL NEW SPEND: 0
P14_AUTHORIZED: NO
```
