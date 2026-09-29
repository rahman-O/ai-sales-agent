# Production Release Checklist

Use this checklist for every staging and production deployment of the multi-business sales agent platform.

---

## Pre-Deployment Phase

- [ ] **Code Quality & Verification**:
  - `npm run typecheck` passes with zero errors across all workspaces.
  - `npm test` passes 100% across all packages.
  - `npm run test:integration` passes all 26 integration suites.
- [ ] **Environment Validation**:
  - `APP_ENV=production` and `NODE_ENV=production` are set.
  - `DATABASE_URL` uses runtime role (`app_runtime`) with `NOBYPASSRLS`.
  - `MIGRATION_DATABASE_URL` is set strictly for the migration step and omitted from API/worker envs.
  - `REDIS_URL`, `SUPABASE_URL`, and `DEEPSEEK_API_KEY` are provisioned.
- [ ] **Database Backup**:
  - Snapshot or physical backup confirmed before executing new schema migrations.
  - Point-In-Time-Recovery (PITR) window verified.
- [ ] **Pre-Flight Readiness**:
  - Run `npm run prod:check` against the deployment target to verify RLS, FORCE RLS, role isolation, and connectivity.

---

## Migration Phase

- [ ] **Apply Migrations**:
  - Execute `npx prisma migrate deploy` via migration/owner credentials.
  - Verify migration status: `npx prisma migrate status`.
- [ ] **Post-Migration Verification**:
  - Confirm all newly added tenant tables have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and `ALTER TABLE ... FORCE ROW LEVEL SECURITY`.
  - Confirm grants to `app_runtime` (`SELECT, INSERT, UPDATE, DELETE`).

---

## Deployment Phase

- [ ] **Deploy API Instances**:
  - Roll out API services.
  - Verify `/health/live` returns `{ status: 'ok' }`.
  - Verify `/health/ready` returns 200 with `{ status: 'ready', checks: { database: 'ok', redis: 'ok' } }`.
- [ ] **Deploy Worker Instances**:
  - Roll out Worker background processes.
  - Check worker startup logs: `msg: 'worker_ready', queue: 'conversation-wake'`.
- [ ] **Deploy Web Dashboard**:
  - Deploy Next.js web application.
  - Verify dynamic capability navigation and dashboard load.

---

## Post-Deployment Smoke Verification

- [ ] **Production-Safe Smoke Tests**:
  - Login / Auth token exchange.
  - Read organization settings & dynamic navigation.
  - Read catalog items, offers, and policies.
  - Execute Preview Assistant session (validates intent resolution and simulated tool execution without mutating real transactional data).
  - Read analytics overview for tenant.
- [ ] **Observability Verification**:
  - Verify structured logs include `x-request-id` / `requestId`.
  - Verify no secret leaks (passwords, auth headers, API keys redacted).
  - Verify queue failure rates remain at zero or baseline.

---

## Production Provider Acceptance Checklist

- Prerequisite phase evidence, migrations, backup, restore drill, and rollback owner are current.
- `prisma validate`, `prisma generate`, unit, integration, build, and `prod:check` pass.
- Meta Graph API version is pinned; credentials resolve without printing values.
- The test organization, active channel, public HTTPS webhook, and authorized recipient are confirmed.
- Challenge verification and raw-body signatures pass; invalid, missing, and modified signatures fail closed.
- Live inbound creates one canonical message in the correct tenant; a concurrent replay creates no duplicate processing or mutation.
- Live outbound stores the provider message ID and records accepted, delivered/read, and controlled failure evidence where Meta exposes it.
- Timeout/unknown results are not blindly resent; auth failure marks the channel unhealthy; rate limits back off.
- Booking, zero-slot, quote, order, offer, policy, knowledge, topic-switch, multi-intent, and handoff flows are run only when the controlled organization supports them.
- Logs and evidence contain no credentials, full message content, or unredacted recipient identifiers.
- Channel disable, credential rotation, incident owner, stop conditions, and rollback are rehearsed.

---

## Rollback Decision Tree

1. **Application Failure, Database Compatible**:
   - Immediate rollback of API, Worker, and Web container images to previous release tag.
2. **Migration Failure / Incomplete**:
   - Stop rollout. Keep current application running on backward-compatible schema (Expand/Migrate/Contract pattern). Forward-fix migration script.
3. **Data Corruption / Catastrophic Failure**:
   - Declare incident. Initiate point-in-time restore following [BACKUP-RESTORE.md](file:///c:/Users/rahmano/Desktop/AI%20Sales%20Agent/docs/operations/BACKUP-RESTORE.md).
