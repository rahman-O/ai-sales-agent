# MB-13 — Multi-Business Analytics & Dashboards Implementation

## 1. Executive Overview
- **Phase**: MB-13 — MULTI-BUSINESS ANALYTICS & DASHBOARDS
- **Status**: CLOSED
- **Core Principle**: Analytics is **derived data** computed strictly from authoritative backend structured state and immutable historical snapshots. Operational systems remain the sole source of truth. Analytics never mutates operational state, computes prices, authorizes transactions, or infers business outcomes from unstructured LLM text.

---

## 2. Metric Catalog & Sources of Truth

| Metric ID | Name | Category | Source Tables / Events | Date Filter Field | Status Semantics & Exclusions | Preview Excluded |
|---|---|---|---|---|---|---|
| `TOTAL_CONVERSATIONS` | Total Conversations | CONVERSATIONS | `conversations` | `created_at` | Count of unique conversations in `[from, to)` | Yes |
| `AI_HANDLED_CONVERSATIONS` | AI-Handled Conversations | CONVERSATIONS | `conversations`, `messages`, `audit_logs` | `conversations.created_at` | Conversations with AI outbound responses and zero human takeover / operator messages | Yes |
| `HUMAN_TAKEOVER_CONVERSATIONS` | Human Takeover Conversations | CONVERSATIONS | `conversations`, `audit_logs`, `messages` | `conversations.created_at` | Conversations where operator intervention occurred (`conversation.takeover` or `origin = 'OPERATOR'`) | Yes |
| `HANDOFF_RATE` | Handoff Rate | CONVERSATIONS | `conversations`, `audit_logs` | `conversations.created_at` | Ratio of human takeover conversations to total conversations; `null` if denominator is 0 | Yes |
| `INTENT_COUNTS` | Intent Counts | INTENTS | `conversation_working_state`, `tool_calls` | `updated_at` / `created_at` | Aggregated counts of validated enum intents (`BOOKING_INTENT`, `QUOTE_INTENT`, `PURCHASE_INTENT`, etc.) | Yes |
| `UNKNOWN_INTENT_RATE` | Unknown Intent Rate | INTENTS | `conversation_working_state` | `updated_at` | `UNKNOWN` intent count / total intent detections; `null` if denominator is 0 | Yes |
| `LEADS_CREATED` | Leads Created | LEADS | `leads` | `created_at` | New leads created in period; capability-gated on `supportsLeads` | Yes |
| `DIRECT_BOOKING_CONVERSION` | Direct Booking Conversion | LEADS | `leads`, `bookings`, `booking_activities` | `leads.created_at` | Leads with confirmed booking within 30-day cohort observation window; `null` if 0 leads | Yes |
| `BOOKINGS_CREATED` | Bookings Created | BOOKINGS | `bookings` | `created_at` | Total booking records created; capability-gated on `supportsBooking` | Yes |
| `BOOKINGS_CONFIRMED` | Bookings Confirmed | BOOKINGS | `bookings` | `created_at` | Bookings with `status = 'CONFIRMED'`; capability-gated on `supportsBooking` | Yes |
| `BOOKING_CONVERSION_RATE` | Booking Conversion Rate | BOOKINGS | `bookings`, `conversations`, `tool_calls` | `created_at` | `bookingsConfirmed / bookingInquiries`; `null` if denominator is 0 | Yes |
| `QUOTES_CREATED` | Quotes Created | QUOTES | `quotes` | `created_at` | All quote records created; capability-gated on `supportsQuotes` | Yes |
| `QUOTES_PRESENTED` | Quotes Presented | QUOTES | `quotes` | `created_at` | Quotes with status in `SENT`, `ACCEPTED`, `REJECTED`, `CANCELLED`, `EXPIRED` | Yes |
| `QUOTES_ACCEPTED` | Quotes Accepted | QUOTES | `quotes` | `created_at` | Quotes with status `ACCEPTED` | Yes |
| `QUOTE_ACCEPTANCE_RATE` | Quote Acceptance Rate | QUOTES | `quotes` | `created_at` | `quotesAccepted / quotesPresented`; `null` if denominator is 0 | Yes |
| `ACCEPTED_QUOTE_VALUE` | Accepted Quote Value | VALUE | `quotes` | `created_at` | Sum of `total_amount_minor` (BigInt) for `ACCEPTED` quotes grouped by currency; never mixed | Yes |
| `ORDERS_CREATED` | Orders Created | ORDERS | `orders` | `created_at` | All order records created; capability-gated on `supportsOrders` | Yes |
| `ORDERS_CONFIRMED` | Orders Confirmed | ORDERS | `orders` | `created_at` | Orders with status in `CONFIRMED`, `FULFILLED` | Yes |
| `ORDER_CONFIRMATION_RATE` | Order Confirmation Rate | ORDERS | `orders` | `created_at` | `ordersConfirmed / ordersCreated`; `null` if denominator is 0 | Yes |
| `CONFIRMED_ORDER_VALUE` | Confirmed Order Value | VALUE | `orders` | `created_at` | Sum of `total_amount_minor` (BigInt) for `CONFIRMED`/`FULFILLED` orders grouped by currency; never mixed | Yes |
| `MOST_BOOKED_SERVICES` | Most Booked Services | CATALOG | `bookings`, `services`, `catalog_items` | `bookings.created_at` | Top catalog items with `kind = 'SERVICE'` sorted by confirmed booking count | Yes |
| `MOST_QUOTED_ITEMS` | Most Quoted Items | CATALOG | `quote_line_items`, `quotes`, `catalog_items` | `quotes.created_at` | Top catalog items sorted by frequency in quotes with total monetary value | Yes |
| `MOST_ORDERED_ITEMS` | Most Ordered Items | CATALOG | `order_line_items`, `orders`, `catalog_items` | `orders.created_at` | Top catalog items sorted by frequency in orders with total monetary value | Yes |

---

## 3. Key Architectural Safeguards

1. **Deterministic Backend Queries & Zero LLM Dependency**:
   - Analytics are computed via deterministic parameterized SQL and Prisma aggregations.
   - DeepSeek/LLM is never called to summarize, infer, or hallucinate metrics.

2. **No Fake Revenue & Precise Terminology**:
   - Quotes are labelled **Accepted Quote Value**, and orders are labelled **Confirmed Order Value**.
   - No financial claims are labelled "Revenue" unless settled payment processing exists.

3. **Multi-Currency Isolation**:
   - Currency values are represented strictly in integer minor units (`amountMinor: string`, `currency: string`).
   - Iraqi Dinars (IQD) and US Dollars (USD) are grouped into distinct currency buckets and never summed across currencies into a single scalar.

4. **Zero-Denominator Safety**:
   - Any rate or conversion where the denominator is zero returns `rate: null` (displayed as `N/A` on the frontend), preventing division-by-zero crashes or misleading 0% figures.

5. **Preview Execution Mode Exclusion**:
   - MB-09 / MB-12 preview simulation executes in-memory with fake preview IDs and inserts zero rows into Postgres. All production queries automatically exclude preview sessions.

6. **Timezone-Aware Half-Open Date Bucketing**:
   - Local dates (`from`, `to`) are converted to half-open UTC intervals `[from, to)` using the organization's `defaultTimezone` (e.g. `Asia/Baghdad`), respecting midnight local transitions.

7. **Capability-Driven Dashboards**:
   - The UI and API dynamically render sections based on `OrganizationCapabilities` (`supportsBooking`, `supportsQuotes`, `supportsOrders`, `supportsLeads`).
   - Zero `businessType` runtime branching.

---

## 4. API Endpoints

- `GET /organizations/:organizationId/analytics/overview` — Comprehensive capability-aware overview payload with backward-compatible top-level keys.
- `GET /organizations/:organizationId/analytics/funnels` — Workflow funnel stages, conversions, and drop-offs.
- `GET /organizations/:organizationId/analytics/catalog` — Top booked services, quoted items, and ordered items.
- `GET /organizations/:organizationId/analytics/transactions` — Quote, order, and multi-currency commercial value metrics.
- `GET /organizations/:organizationId/analytics/intents` — Customer intent distribution and top inquiry frequencies.

---

## 5. Verification Matrix

- Unit tests for contracts, rate calculations, and funnel progression (`packages/contracts/src/analytics.test.ts`).
- Integration tests for multi-business analytics, capability gating, multi-currency isolation, and RLS tenant boundaries (`apps/api/test/integration/mb13-analytics.test.ts`).
- Regression verification for legacy overview queries (`apps/api/test/integration/phase12-analytics.test.ts`).
- Full monorepo build and test suite execution passing with 100% success.
- Clean execution of `npm run demo:reseed`.
