CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE ROLE app_runtime LOGIN PASSWORD 'compat_runtime_only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;

CREATE TABLE organizations (
  id uuid PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE users (
  id uuid PRIMARY KEY,
  subject text NOT NULL UNIQUE
);

CREATE TABLE organization_members (
  organization_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid NOT NULL REFERENCES users(id),
  role text NOT NULL,
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE test_resources (
  id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  value text NOT NULL,
  PRIMARY KEY (organization_id, id)
);

CREATE TABLE staff (
  id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  PRIMARY KEY (organization_id, id)
);

CREATE TABLE bookings (
  id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  staff_id uuid NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status text NOT NULL,
  PRIMARY KEY (organization_id, id),
  CONSTRAINT booking_interval_valid CHECK (start_at < end_at),
  CONSTRAINT booking_staff_tenant_fk FOREIGN KEY (organization_id, staff_id)
    REFERENCES staff(organization_id, id),
  CONSTRAINT booking_no_confirmed_overlap EXCLUDE USING gist (
    organization_id WITH =,
    staff_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  ) WHERE (status = 'CONFIRMED')
);
CREATE INDEX bookings_tenant_staff_start_idx ON bookings(organization_id, staff_id, start_at);

CREATE TABLE vector_records (
  id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  label text NOT NULL,
  embedding vector(3) NOT NULL,
  PRIMARY KEY (organization_id, id)
);

CREATE TABLE audit_events (
  id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  action text NOT NULL,
  PRIMARY KEY (organization_id, id)
);

CREATE TABLE outbox_events (
  id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  event_type text NOT NULL,
  PRIMARY KEY (organization_id, id)
);

GRANT USAGE ON SCHEMA public TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON organizations, users, organization_members,
  test_resources, staff, bookings, vector_records, audit_events, outbox_events TO app_runtime;

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members FORCE ROW LEVEL SECURITY;
ALTER TABLE test_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_resources FORCE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff FORCE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE vector_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE vector_records FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;

CREATE FUNCTION current_tenant_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_organization_id', true), '')::uuid
$$;

CREATE POLICY tenant_members ON organization_members TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());
CREATE POLICY tenant_resources ON test_resources TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());
CREATE POLICY tenant_staff ON staff TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());
CREATE POLICY tenant_bookings ON bookings TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());
CREATE POLICY tenant_vectors ON vector_records TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());
CREATE POLICY tenant_audit ON audit_events TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());
CREATE POLICY tenant_outbox ON outbox_events TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

