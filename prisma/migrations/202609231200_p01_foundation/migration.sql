-- Phase 01 foundation migration (custom SQL required for roles / FORCE RLS / policies).
-- Migration owner (postgres) applies this. Runtime uses app_runtime (NOBYPASSRLS).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Role identity only. LOGIN password is provisioned outside migrations
-- via `npm run db:provision-runtime-role` (never commit runtime credentials).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$$;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_subject text NOT NULL UNIQUE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organization_members (
  organization_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid NOT NULL REFERENCES users(id),
  role text NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER')),
  status text NOT NULL CHECK (status IN ('ACTIVE', 'REVOKED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);
CREATE INDEX organization_members_org_role_status_idx
  ON organization_members (organization_id, role, status);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  actor_user_id uuid REFERENCES users(id),
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata_json jsonb,
  request_id text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_org_recorded_idx ON audit_logs (organization_id, recorded_at);

CREATE TABLE outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  event_type text NOT NULL,
  payload_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outbox_events_org_created_idx ON outbox_events (organization_id, created_at);

CREATE TABLE idempotency_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES users(id),
  operation text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED')),
  response_json jsonb,
  organization_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (actor_user_id, operation, idempotency_key)
);

GRANT USAGE ON SCHEMA public TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON users, organizations, organization_members,
  outbox_events, idempotency_records TO app_runtime;
GRANT SELECT, INSERT ON audit_logs TO app_runtime;

-- Missing/invalid setting => NULL => policies deny tenant rows.
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_organization_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION current_actor_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid
$$;

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE idempotency_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_records FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_members ON organization_members FOR ALL TO app_runtime
  USING (
    organization_id = current_tenant_id()
    OR (current_tenant_id() IS NULL AND user_id = current_actor_user_id())
  )
  WITH CHECK (
    organization_id = current_tenant_id()
  );

CREATE POLICY tenant_audit ON audit_logs FOR ALL TO app_runtime
  USING (organization_id IS NOT NULL AND organization_id = current_tenant_id())
  WITH CHECK (organization_id IS NOT NULL AND organization_id = current_tenant_id());

CREATE POLICY tenant_outbox ON outbox_events FOR ALL TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

CREATE POLICY tenant_organizations ON organizations FOR ALL TO app_runtime
  USING (
    id = current_tenant_id()
    OR (
      current_tenant_id() IS NULL
      AND EXISTS (
        SELECT 1 FROM organization_members m
        WHERE m.organization_id = organizations.id
          AND m.user_id = current_actor_user_id()
      )
    )
  )
  WITH CHECK (true);

CREATE POLICY users_self_or_tenant ON users FOR ALL TO app_runtime
  USING (true)
  WITH CHECK (true);

CREATE POLICY idempotency_actor ON idempotency_records FOR ALL TO app_runtime
  USING (actor_user_id = current_actor_user_id())
  WITH CHECK (actor_user_id = current_actor_user_id());
