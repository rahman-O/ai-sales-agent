# Environments & Execution Policies

This document establishes the environment hierarchy, identity markers, and safety constraints for the Multi-Business Platform.

---

## 1. Environment Classification

The platform formally recognizes four application tiers:

| Environment | `APP_ENV` | `NODE_ENV` | `DB_ENV` | Target Database | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Development** | `development` | `development` | `local` | Local Docker PostgreSQL | Developer workstations running local loopback databases. |
| **Test / CI** | `test` | `test` | `local` / `remote_test` | Dedicated CI ephemeral DB | Automated test runner executing unit and integration suites. |
| **Staging** | `staging` | `production` | `staging` | Staging Supabase / Postgres | Pre-production validation, hosted acceptance, smoke testing. |
| **Production** | `production` | `production` | `production` | Production Supabase / Postgres | Live multi-tenant operational traffic. |

---

## 2. Destructive Operations Safety Gate

Commands that mutate or reset databases (`demo:reset`, `demo:reseed`, `db:reset:test`, `db:seed`, manual truncates) are guarded by `assertNonProduction()`:

1. **Automatic Refusal in Production**:
   If `APP_ENV === 'production'`, `NODE_ENV === 'production'`, or `DB_ENV === 'production'`, all destructive commands **fail closed immediately** with a `CRITICAL_SECURITY_GUARD` error.

2. **Loopback Gate**:
   Demo CLI operations require `DEMO_DB_TARGET=LOCAL` or `DEMO_FORCE_LOCAL_DB=1` and verify that the database host is a loopback address (`127.0.0.1`, `localhost`).

3. **Explicit Override for Non-Production**:
   Destructive resets require `ALLOW_DEMO_RESET=true` even in local development environments.

---

## 3. Database Role Separation

The platform strictly separates database credentials across roles:

- **Migration / Owner Role (`MIGRATION_DATABASE_URL`)**:
  - Used exclusively during deployment migrations (`prisma migrate deploy`) and administrative provisioning.
  - Possesses DDL privileges.
  - Never loaded into runtime application processes (`loadServerEnv` strips it).

- **Runtime Role (`DATABASE_URL`)**:
  - Authenticates as `app_runtime` (or non-superuser pooler connection).
  - Role attributes: `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`, `NOBYPASSRLS`.
  - Bound by Row Level Security (`FORCE ROW LEVEL SECURITY` on all tenant-owned tables).
  - Cannot bypass tenant boundaries.

---

## 4. Provider Acceptance Mode

For a controlled acceptance run, set `PROVIDER_ACCEPTANCE_MODE=true` and list exact E.164 recipients in `PROVIDER_ACCEPTANCE_ALLOWED_RECIPIENTS`. The list must be non-empty and has no wildcard behavior. Also configure `PUBLIC_WEBHOOK_URL` with the stable HTTPS endpoint. Acceptance mode retains normal RLS, workflow, capability, and business-authority checks.

MB-15A simulator mode uses `PROVIDER_MODE=meta-simulator` and `META_GRAPH_BASE_URL=http://127.0.0.1:3415` for host execution or the exact private Docker service `http://provider-simulator:3415`. The override fails closed in production and rejects every other host.
