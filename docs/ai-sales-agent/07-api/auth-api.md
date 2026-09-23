# Authentication API

Status: Phase 01 implemented with **session ownership reconciliation**.

Shared transport/error/version rules: [API principles](api-principles.md).

## Authority and base

Browser-facing Supabase SSR session lifecycle is owned by **Next.js** (`apps/web`), not NestJS.

NestJS base: `/v1/auth` — identity and organization authorization only. Nest is **stateless** regarding browser cookies; it accepts `Authorization: Bearer <access_token>` and verifies JWT (JWKS by default).

## Layer ownership (P01 reconciliation)

| Concern | Owner |
|---------|-------|
| Login / callback / logout / SSR cookies | Next.js + Supabase SSR (`proxy.ts`, `/auth/callback`) |
| Forward access token to API | Next BFF (`/api/backend/*`) |
| JWT signature / iss / exp / sub verification | NestJS `JwtVerifierService` (prefer JWKS ES256/RS256; `SUPABASE_JWT_SECRET` = local HS256 fallback only) |
| User JIT by `authSubject` | NestJS (only after verified JWT) |
| Membership / switch organization | NestJS + PostgreSQL |

Do **not** implement a second Nest login/session system.

DEVELOPMENT Auth URL configuration must allow Site URL `http://localhost:3000` and redirect `http://localhost:3000/auth/callback`.

## Nest contracts

- `GET /v1/auth/me` — verified identity + memberships; optional `x-organization-id` must be an ACTIVE membership
- `POST /v1/auth/switch-organization` — body `{ organizationId }`; rejects non-ACTIVE membership without leaking other tenants

## Invariants, failure and verification

Browser-supplied `userId` / `organizationId` / `role` never authorize. Expired/invalid Bearer → 401. REVOKED membership cannot switch. Live Supabase Auth provider E2E remains `BLOCKED_EXTERNAL_ACCESS` until project credentials exist; local HS256 is test/compat fallback only.
