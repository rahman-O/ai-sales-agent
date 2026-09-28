-- MB-06: generic organization-owned business policies.
CREATE TABLE business_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  policy_type text NOT NULL CHECK (policy_type IN (
    'BOOKING','CANCELLATION','RESCHEDULING','PAYMENT','REFUND','RETURN','DELIVERY',
    'SERVICE_AREA','MINIMUM_ORDER','ADVANCE_NOTICE','QUOTE','HANDOFF','CUSTOM'
  )),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','ARCHIVED')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  summary text NOT NULL CHECK (length(btrim(summary)) BETWEEN 1 AND 4000),
  rules_json jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(rules_json) = 'object'),
  enforcement_mode text NOT NULL DEFAULT 'INFORMATIONAL_ONLY'
    CHECK (enforcement_mode IN ('ENFORCEABLE','INFORMATIONAL_ONLY')),
  effective_from timestamptz,
  effective_until timestamptz,
  version integer NOT NULL CHECK (version > 0),
  metadata_json jsonb CHECK (metadata_json IS NULL OR jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, policy_type, version),
  CONSTRAINT valid_policy_dates CHECK (
    effective_until IS NULL OR effective_from IS NULL OR effective_until >= effective_from
  ),
  CONSTRAINT enforceable_policy_types CHECK (
    enforcement_mode = 'INFORMATIONAL_ONLY' OR policy_type IN ('CANCELLATION','RESCHEDULING')
  )
);

CREATE INDEX business_policies_effective_lookup_idx
  ON business_policies (organization_id, policy_type, status, effective_from, effective_until, version DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON business_policies TO app_runtime;

ALTER TABLE business_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_policies FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON business_policies
  FOR ALL
  TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());
