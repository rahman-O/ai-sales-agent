-- Phase 02 core customer/contact and catalog/reference domain.

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  display_name text,
  preferred_locale text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  archived_at timestamptz,
  merged_into_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, merged_into_id) REFERENCES customers(organization_id, id) ON DELETE RESTRICT,
  CHECK (merged_into_id IS NULL OR merged_into_id <> id)
);
CREATE INDEX customers_org_updated_idx ON customers (organization_id, updated_at, id);

CREATE TABLE customer_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel = lower(channel) AND channel ~ '^[a-z][a-z0-9_-]{1,31}$'),
  external_address text NOT NULL CHECK (external_address = lower(btrim(external_address)) AND length(external_address) BETWEEN 1 AND 320),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, channel, external_address),
  FOREIGN KEY (organization_id, customer_id) REFERENCES customers(organization_id, id) ON DELETE RESTRICT
);
CREATE INDEX customer_identities_customer_idx ON customer_identities (organization_id, customer_id);

CREATE TABLE locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  timezone text NOT NULL CHECK (length(timezone) BETWEEN 1 AND 100),
  address text,
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);
CREATE INDEX locations_org_active_idx ON locations (organization_id, active);

CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  location_id uuid NOT NULL,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  buffer_before_minutes integer NOT NULL DEFAULT 0 CHECK (buffer_before_minutes >= 0),
  buffer_after_minutes integer NOT NULL DEFAULT 0 CHECK (buffer_after_minutes >= 0),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency char(3) NOT NULL CHECK (currency = upper(currency)),
  pricing_version integer NOT NULL DEFAULT 1 CHECK (pricing_version > 0),
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, location_id) REFERENCES locations(organization_id, id) ON DELETE RESTRICT
);
CREATE INDEX services_org_active_name_idx ON services (organization_id, active, name);

CREATE TABLE staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  location_id uuid NOT NULL,
  member_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 160),
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, location_id) REFERENCES locations(organization_id, id) ON DELETE RESTRICT
);
CREATE INDEX staff_members_org_location_active_idx ON staff_members (organization_id, location_id, active);

CREATE TABLE service_staff (
  organization_id uuid NOT NULL,
  service_id uuid NOT NULL,
  staff_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, service_id, staff_id),
  FOREIGN KEY (organization_id, service_id) REFERENCES services(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, staff_id) REFERENCES staff_members(organization_id, id) ON DELETE RESTRICT
);
CREATE INDEX service_staff_org_staff_idx ON service_staff (organization_id, staff_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON customers, customer_identities, locations, services, staff_members, service_staff TO app_runtime;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['customers','customer_identities','locations','services','staff_members','service_staff']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I FOR ALL TO app_runtime USING (organization_id = current_tenant_id()) WITH CHECK (organization_id = current_tenant_id())',
      table_name
    );
  END LOOP;
END $$;
