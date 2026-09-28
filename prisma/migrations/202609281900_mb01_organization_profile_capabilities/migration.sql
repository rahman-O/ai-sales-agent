-- MB-01: Organization Profile and Capabilities

CREATE TABLE organization_profiles (
  organization_id uuid NOT NULL,
  display_name text,
  business_type text,
  description text,
  country text DEFAULT 'IQ',
  timezone text NOT NULL DEFAULT 'Asia/Baghdad',
  default_language text NOT NULL DEFAULT 'ar',
  default_currency text NOT NULL DEFAULT 'IQD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id),
  CONSTRAINT organization_profiles_org_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

GRANT SELECT, INSERT, UPDATE, DELETE ON organization_profiles TO app_runtime;
ALTER TABLE organization_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON organization_profiles
  FOR ALL
  TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

CREATE TABLE organization_capabilities (
  organization_id uuid NOT NULL,
  supports_leads boolean NOT NULL DEFAULT true,
  lead_required_before_booking boolean NOT NULL DEFAULT false,
  auto_create_lead_on_intent boolean NOT NULL DEFAULT true,
  supports_booking boolean NOT NULL DEFAULT true,
  supports_offers boolean NOT NULL DEFAULT false,
  supports_quotes boolean NOT NULL DEFAULT false,
  supports_orders boolean NOT NULL DEFAULT false,
  supports_inventory boolean NOT NULL DEFAULT false,
  supports_staff boolean NOT NULL DEFAULT true,
  supports_locations boolean NOT NULL DEFAULT true,
  supports_products boolean NOT NULL DEFAULT false,
  supports_services boolean NOT NULL DEFAULT true,
  supports_listings boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id),
  CONSTRAINT organization_capabilities_org_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

GRANT SELECT, INSERT, UPDATE, DELETE ON organization_capabilities TO app_runtime;
ALTER TABLE organization_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_capabilities FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON organization_capabilities
  FOR ALL
  TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

-- Backfill existing organizations with defaults
INSERT INTO organization_profiles (organization_id, display_name, country, timezone, default_language, default_currency)
SELECT id, name, 'IQ', 'Asia/Baghdad', 'ar', 'IQD' FROM organizations
ON CONFLICT (organization_id) DO NOTHING;

INSERT INTO organization_capabilities (
  organization_id, supports_leads, lead_required_before_booking, auto_create_lead_on_intent,
  supports_booking, supports_offers, supports_quotes, supports_orders, supports_inventory,
  supports_staff, supports_locations, supports_products, supports_services, supports_listings
)
SELECT id, true, false, true, true, false, false, false, false, true, true, false, true, false FROM organizations
ON CONFLICT (organization_id) DO NOTHING;
