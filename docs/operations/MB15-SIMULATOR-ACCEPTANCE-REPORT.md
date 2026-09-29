# MB-15A Meta Simulator Acceptance Evidence

## Result

`PARTIAL`. The external simulator process and transport contract pass. The complete API → database → Redis → worker → DeepSeek → simulator run was not executed against rebuilt services, so business-flow fields remain failed rather than inferred from unit or earlier integration evidence.

## Executed evidence

| Scenario | Boundary | Result |
| --- | --- | --- |
| Meta outbound success | Real `MetaWhatsAppChannel` → simulator HTTP `/v25.0/:phoneNumberId/messages` | PASS |
| Provider ID | Simulator returned unique `wamid.SIM_<uuid>` | PASS |
| Request recording | Simulator control API returned one accepted send | PASS |
| Signed inbound | Simulator HTTP → independent raw-body HMAC receiver | PASS |
| Invalid/missing/modified signature | Simulator HTTP → receiver rejected each variant | PASS |
| Rate limit once | 429 with `Retry-After`, then success | PASS |
| Authentication failure | Deterministic 401 | PASS |
| Provider outage | Deterministic 503 | PASS |
| Production guard | Simulator and base URL override reject production | PASS |

No real Meta credential, endpoint, recipient, or message was used. Test payloads contain synthetic provider IDs and reserved example telephone values only.

## Available simulator controls

- `POST /simulator/inbound`
- `POST /simulator/status`
- `POST /simulator/scenario`
- `GET /simulator/messages`
- `POST /simulator/reset`

Scenarios: `SUCCESS`, `RATE_LIMIT_ONCE`, `RATE_LIMIT_ALWAYS`, `AUTH_FAILURE`, `SERVER_ERROR_ONCE`, `SERVER_ERROR_ALWAYS`, `TIMEOUT_BEFORE_ACCEPT`, and `TIMEOUT_AFTER_ACCEPT`.

## Remaining full-runtime evidence

Rebuild and start API, worker, Redis, database, and simulator with the dedicated non-production simulator profile; seed two Meta channel connections; then execute inbound, concurrent duplicate, FIFO, status, agent, booking, catalog, offer, policy, knowledge, topic-switch, multi-intent, and handoff scenarios through the real webhook endpoint. Evidence must capture only redacted IDs and UTC timestamps.

## Limits

The simulator does not prove real Meta credentials, public network reachability, account/channel status, actual delivery, actual rate limits, template approval, or Meta enforcement of the 24-hour policy. Those remain MB-15 live acceptance requirements.
