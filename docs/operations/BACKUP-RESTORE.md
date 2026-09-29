# Backup & Disaster Recovery Runbook

This document defines the backup schedule, point-in-time recovery expectations, and step-by-step restoration drill procedure.

---

## 1. Backup Architecture & Policies

- **Provider-Managed Backups (Supabase / AWS RDS)**:
  - Daily full automated snapshots.
  - Continuous WAL archiving for Point-In-Time-Recovery (PITR) up to 7 or 14 days (depending on plan).
- **Manual Release Snapshots (`pg_dump`)**:
  - Before high-risk schema migrations or major version releases, create an immutable snapshot dump:
    ```bash
    pg_dump -Fc --no-owner --no-privileges -d "$MIGRATION_DATABASE_URL" -f "release_backup_$(date +%Y%m%d_%H%M%S).dump"
    ```
- **Storage / Blob Backups**:
  - Document uploads and knowledge artifacts in Supabase Storage with bucket versioning enabled.

---

## 2. Restoration Procedure (Disaster Recovery)

> **CRITICAL RULE**: Never perform a restore drill against the live production database. Always restore into an isolated recovery target database.

### Step 1: Provision Recovery Target Database
Create a clean target PostgreSQL instance or staging branch.

### Step 2: Restore Schema & Data
Using `pg_restore`:
```bash
pg_restore --clean --if-exists --no-owner --no-privileges -d "$RECOVERY_DATABASE_URL" release_backup_xxxx.dump
```

### Step 3: Reconcile Role Permissions & RLS
Verify that `app_runtime` exists and permissions are intact:
```sql
-- Ensure app_runtime role exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$$;

-- Verify FORCE RLS on all tenant tables
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'organization_id' AND NOT a.attisdropped);
```

### Step 4: Run Production Readiness Check
Execute against the restored database:
```bash
DATABASE_URL="$RECOVERY_RUNTIME_URL" MIGRATION_DATABASE_URL="$RECOVERY_MIGRATE_URL" npm run prod:check
```

### Step 5: Boot Application & Verify Smoke Tests
Start API and Worker against recovery instance and verify `/health/ready` and smoke queries.

---

## 3. Restore Drill Verification Status

- **Procedure Status**: Documented and verified in local/staging test environments.
- **Production Drill Status**: Non-destructive validation via `prod:check` and staging restore rehearsal. Live production restore drill is scheduled during planned maintenance windows.
