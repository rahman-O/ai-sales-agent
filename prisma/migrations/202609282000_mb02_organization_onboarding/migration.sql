-- MB-02: Organization Onboarding State

CREATE TABLE organization_onboarding (
  organization_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'NOT_STARTED',
  current_step text NOT NULL DEFAULT 'IDENTITY',
  completed_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id),
  CONSTRAINT organization_onboarding_org_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

GRANT SELECT, INSERT, UPDATE, DELETE ON organization_onboarding TO app_runtime;
ALTER TABLE organization_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_onboarding FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON organization_onboarding
  FOR ALL
  TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

-- Backfill existing organizations as COMPLETED so existing active orgs are never blocked
INSERT INTO organization_onboarding (
  organization_id, status, current_step, completed_steps, started_at, completed_at, created_at, updated_at
)
SELECT
  id,
  'COMPLETED',
  'REVIEW',
  '["IDENTITY","CAPABILITIES","BASIC_SETUP","OPERATIONS","REVIEW"]'::jsonb,
  created_at,
  created_at,
  now(),
  now()
FROM organizations
ON CONFLICT (organization_id) DO NOTHING;
