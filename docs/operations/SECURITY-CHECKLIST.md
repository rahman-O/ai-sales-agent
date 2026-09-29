# Production Security Checklist

Comprehensive audit and security verification checklist across multi-tenant isolation, role privileges, authentication, logging, rate limiting, and messaging provider boundaries.

---

## 1. Multi-Tenant Isolation & RLS

- [x] **Row Level Security (RLS)**:
  - Every table containing `organization_id` has `ENABLE ROW LEVEL SECURITY`.
  - Every tenant table has `FORCE ROW LEVEL SECURITY` enabled (ensures table owners and privileged roles do not accidentally bypass RLS unless superuser).
- [x] **Role Separation**:
  - API and worker runtime authenticate strictly via `app_runtime` with `NOBYPASSRLS`.
  - `MIGRATION_DATABASE_URL` is stripped from server env and never accessible in runtime controllers.
- [x] **Cross-Tenant Negative Verification**:
  - Automated test suite `mb14-cross-tenant-security.test.ts` validates that Tenant A cannot read, update, or query rows belonging to Tenant B across CatalogItems, Customers, Quotes, Orders, Conversations, and Analytics.
  - Unscoped queries without tenant context return zero rows.

---

## 2. Secret Hygiene & Logging Redaction

- [x] **Structured Logging**:
  - Requests include `x-request-id` / `requestId`.
  - Sensitive headers (`Authorization`, `Cookie`, `Set-Cookie`, `x-api-key`, `apikey`) are automatically redacted in logs.
  - Database connection strings have user/password masked via `redactUrlCredentials`.
  - Log objects sanitized recursively via `sanitizeLogObject` (redacting passwords, secrets, tokens, API keys).
- [x] **Production Error Masking**:
  - Global exception filter (`GlobalHttpExceptionFilter`) intercepts unhandled exceptions in production and masks raw SQL, stack traces, and internal errors, returning `{ statusCode, code, message, requestId }`.

---

## 3. Network & Transport Security

- [x] **Security Headers**:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: no-referrer`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Cross-Origin-Opener-Policy: same-origin`
- [x] **Explicit CORS Policy**:
  - CORS origins strictly bound to `APP_URL` (no wildcard `*` with credentials).
- [x] **Rate Limiting**:
  - Middleware enforces bounded in-process buckets for mutations (30 req/min) and reads (120 req/min), returning 429 with `Retry-After` and `RateLimit-*` headers.
  - Provider webhooks use cryptographic HMAC signature verification and idempotency receipts.

---

## 4. Workflows & LLM Provider Boundaries

- [x] **Backend Authority**:
  - Pricing, quotation amounts, order totals, and booking availability calculations remain 100% authoritative in backend code (DeepSeek never computes prices or overrides status).
- [x] **Bounded LLM Costs & Context**:
  - Bounded prompt token budgets, max turns, and retrieval top-K limits.
  - Provider failure or timeout triggers safe deterministic finalization fallback for already committed mutations.

---

## 5. Messaging Provider Security & Webhook Safety

- Secrets are environment or secret-store values and are absent from source, reports, snapshots, and structured logs.
- Webhook POST uses exact raw bytes and constant-time HMAC comparison; missing, malformed, and invalid signatures fail closed.
- Payload size is bounded and content remains untrusted.
- Tenant authority comes only from the verified channel connection.
- Provider sender IDs map through explicit customer identities and never become customer primary keys.
- Provider payloads cannot enable capabilities, change tenant, forge confirmation, or mark business transactions complete.
- Duplicate and concurrent events are stopped by database uniqueness/locking, not process memory.
- Message content and full recipient identifiers are not logged by default; operational evidence uses digests and redacted IDs.
- Access tokens can be rotated and the channel can be disabled without deleting evidence.
- Live testing uses an allowlisted, authorized recipient and documented stop conditions.
