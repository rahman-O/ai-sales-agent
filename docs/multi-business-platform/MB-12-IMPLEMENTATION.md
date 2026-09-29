# MB-12 — Orders, Quotes, and Non-Booking Transactions Implementation Summary

## 1. Executive Overview

Phase **MB-12** introduces the first generic, non-booking transactional capabilities into the multi-business platform:
1. **Quote & QuoteLineItem**: Formal commercial estimates, proposals, and quotations that can be presented, accepted, rejected, cancelled, or expired.
2. **Order & OrderLineItem**: Authoritative purchase requests with confirmation lifecycle and minimum order policy enforcement.

The implementation strictly maintains the platform's core architectural invariants:
- **Backend Authoritative Pricing & Money**: All pricing calculations, line item math, offer applications, and discounts are computed strictly backend-side in integer minor units (BigInt). The LLM is never the pricing engine and cannot invent totals or discounts.
- **No Monolith / No Fake Claims**: No payment gateway processing, no inventory reservations, no fulfillment/shipping engine.
- **Capability Gated**: Quotes require `supportsQuotes === true`, and Orders require `supportsOrders === true`.
- **Server-Authoritative Confirmation**: Model boolean flags (`customerConfirmed: true`) are never trusted. Transaction mutations require explicit server-verified customer actions. Changing items or totals invalidates pending confirmations (`CONFIRMATION_STALE`).
- **Zero Business-Type Runtime Branching**: Generic workflow routing and pricing evaluation operate without branching on industry or business type.
- **Preview Simulation**: MB-09 preview mode simulates quote and order mutations without persisting production database rows.

---

## 2. Core Domain Models

### 2.1 Quotes & Quote Line Items

```prisma
model Quote {
  id                  String          @id @default(uuid()) @db.Uuid
  organizationId      String          @map("organization_id") @db.Uuid
  customerId          String?         @map("customer_id") @db.Uuid
  leadId              String?         @map("lead_id") @db.Uuid
  status              String          @default("DRAFT")
  currency            String          @default("IQD") @db.VarChar(3)
  subtotalAmountMinor BigInt          @default(0) @map("subtotal_amount_minor")
  discountAmountMinor BigInt          @default(0) @map("discount_amount_minor")
  totalAmountMinor    BigInt          @default(0) @map("total_amount_minor")
  expiresAt           DateTime?       @map("expires_at") @db.Timestamptz(6)
  notes               String?
  version             Int             @default(1)
  metadataJson        Json?           @default("{}") @map("metadata_json")
  presentedAt         DateTime?       @map("presented_at") @db.Timestamptz(6)
  acceptedAt          DateTime?       @map("accepted_at") @db.Timestamptz(6)
  rejectedAt          DateTime?       @map("rejected_at") @db.Timestamptz(6)
  cancelledAt         DateTime?       @map("cancelled_at") @db.Timestamptz(6)
  createdAt           DateTime        @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt           DateTime        @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  lineItems           QuoteLineItem[]
}

model QuoteLineItem {
  id                   String       @id @default(uuid()) @db.Uuid
  organizationId       String       @map("organization_id") @db.Uuid
  quoteId              String       @map("quote_id") @db.Uuid
  catalogItemId        String?      @map("catalog_item_id") @db.Uuid
  descriptionSnapshot  String       @map("description_snapshot") @db.VarChar(300)
  quantity             Int          @default(1)
  unitAmountMinor      BigInt       @map("unit_amount_minor")
  discountAmountMinor  BigInt       @default(0) @map("discount_amount_minor")
  lineTotalAmountMinor BigInt       @map("line_total_amount_minor")
  metadataJson         Json?        @default("{}") @map("metadata_json")
  createdAt            DateTime     @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt            DateTime     @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
}
```

### 2.2 Orders & Order Line Items

```prisma
model Order {
  id                  String          @id @default(uuid()) @db.Uuid
  organizationId      String          @map("organization_id") @db.Uuid
  customerId          String?         @map("customer_id") @db.Uuid
  leadId              String?         @map("lead_id") @db.Uuid
  quoteId             String?         @map("quote_id") @db.Uuid
  status              String          @default("DRAFT")
  currency            String          @default("IQD") @db.VarChar(3)
  subtotalAmountMinor BigInt          @default(0) @map("subtotal_amount_minor")
  discountAmountMinor BigInt          @default(0) @map("discount_amount_minor")
  totalAmountMinor    BigInt          @default(0) @map("total_amount_minor")
  notes               String?
  version             Int             @default(1)
  metadataJson        Json?           @default("{}") @map("metadata_json")
  confirmedAt         DateTime?       @map("confirmed_at") @db.Timestamptz(6)
  completedAt         DateTime?       @map("completed_at") @db.Timestamptz(6)
  cancelledAt         DateTime?       @map("cancelled_at") @db.Timestamptz(6)
  createdAt           DateTime        @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt           DateTime        @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  lineItems           OrderLineItem[]
}

model OrderLineItem {
  id                   String       @id @default(uuid()) @db.Uuid
  organizationId       String       @map("organization_id") @db.Uuid
  orderId              String       @map("order_id") @db.Uuid
  catalogItemId        String?      @map("catalog_item_id") @db.Uuid
  descriptionSnapshot  String       @map("description_snapshot") @db.VarChar(300)
  quantity             Int          @default(1)
  unitAmountMinor      BigInt       @map("unit_amount_minor")
  discountAmountMinor  BigInt       @default(0) @map("discount_amount_minor")
  lineTotalAmountMinor BigInt       @map("line_total_amount_minor")
  metadataJson         Json?        @default("{}") @map("metadata_json")
  createdAt            DateTime     @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt            DateTime     @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
}
```

---

## 3. State Machines & Allowed Transitions

### 3.1 Quote State Machine
- `DRAFT` -> `PRESENTED`, `CANCELLED`
- `PRESENTED` -> `ACCEPTED`, `REJECTED`, `EXPIRED`, `CANCELLED`
- `ACCEPTED` -> (terminal)
- `REJECTED` -> (terminal)
- `EXPIRED` -> (terminal)
- `CANCELLED` -> (terminal)

### 3.2 Order State Machine
- `DRAFT` -> `PENDING_CONFIRMATION`, `CANCELLED`
- `PENDING_CONFIRMATION` -> `CONFIRMED`, `REJECTED`, `CANCELLED`
- `CONFIRMED` -> `COMPLETED`, `CANCELLED`
- `COMPLETED` -> (terminal)
- `CANCELLED` -> (terminal)
- `REJECTED` -> (terminal)

---

## 4. Pure Transaction Pricing Calculator

Implemented in `@ai-sales-agent/contracts`: `calculateTransactionPricing()`
- Deterministic BigInt minor units for subtotal, discount, line total, and grand total.
- Reuses MB-05 `calculateDiscountedPrice()` logic for offer application and stacking rules.
- Validates that all catalog items are `ACTIVE` and belong to the current tenant.
- Enforces single currency per transaction and rejects mixed currency line items.
- Snapshots item descriptions and unit amounts to guarantee historical integrity if catalog items change later.

---

## 5. Security & Multi-Tenant RLS

All four tables (`quotes`, `quote_line_items`, `orders`, `order_line_items`) are secured with PostgreSQL Row-Level Security:
- Enabled and forced (`FORCE ROW LEVEL SECURITY`).
- Tenant isolation policies: `organization_id = current_tenant_id()`.
- Cross-tenant test matrix confirms that Tenant A cannot query, update, or create transactions referencing Tenant B items.

---

## 6. Verification Matrix

| Area | Status | Notes |
|---|---|---|
| Prisma Schema & Migration | PASS | `quotes`, `quote_line_items`, `orders`, `order_line_items` |
| Contracts & Pure Calculator | PASS | BigInt minor units, offer stacking, no floating point |
| Capability Gating | PASS | `supportsQuotes` & `supportsOrders` enforced backend-side |
| Tool Allowlist & Agent Execution | PASS | `createQuote`, `presentQuote`, `acceptQuote`, `createOrder`, `confirmOrder`, etc. |
| Server-Authoritative Confirmation | PASS | Model boolean not trusted; stale total re-confirmation required |
| Preview Simulation | PASS | Simulates transaction mutations without database writes |
| API Endpoints & Proxies | PASS | Fully scoped REST endpoints and Next.js proxy routes |
| Operator UI | PASS | Responsive, capability-guarded dashboard views for Quotes and Orders |
| Regressions | PASS | Onboarding, Navigation, Catalog, Offers, Policies, Knowledge, Booking intact |
