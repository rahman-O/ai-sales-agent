-- Phase 06 leads / CRM (non-destructive). No WON/BOOKED.
-- OPEN = NEW|ENGAGED|QUALIFIED|NURTURE

CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  customer_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'NEW'
    CHECK (status IN ('NEW', 'ENGAGED', 'QUALIFIED', 'NURTURE', 'DISQUALIFIED', 'ARCHIVED')),
  primary_service_id uuid,
  location_id uuid,
  assigned_user_id uuid,
  assigned_at timestamptz,
  assigned_by_user_id uuid,
  preferred_contact_channel text,
  language text,
  urgency text
    CHECK (urgency IS NULL OR urgency IN ('LOW', 'NORMAL', 'HIGH')),
  need_summary text,
  source_type text NOT NULL DEFAULT 'INBOUND_CONVERSATION'
    CHECK (source_type IN ('INBOUND_CONVERSATION', 'MANUAL', 'IMPORT', 'SYSTEM')),
  source_conversation_id uuid,
  source_message_id uuid,
  created_by_user_id uuid REFERENCES users(id),
  created_by_agent_run_id uuid,
  status_reason_code text,
  status_reason_text text,
  status_changed_at timestamptz NOT NULL DEFAULT now(),
  status_changed_by_type text
    CHECK (status_changed_by_type IS NULL OR status_changed_by_type IN ('USER', 'AGENT', 'SYSTEM')),
  status_changed_by_id uuid,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, customer_id)
    REFERENCES customers (organization_id, id),
  FOREIGN KEY (organization_id, primary_service_id)
    REFERENCES services (organization_id, id),
  FOREIGN KEY (organization_id, location_id)
    REFERENCES locations (organization_id, id),
  FOREIGN KEY (organization_id, source_conversation_id)
    REFERENCES conversations (organization_id, id),
  FOREIGN KEY (organization_id, source_message_id)
    REFERENCES messages (organization_id, id),
  FOREIGN KEY (organization_id, assigned_user_id)
    REFERENCES organization_members (organization_id, user_id),
  FOREIGN KEY (organization_id, assigned_by_user_id)
    REFERENCES organization_members (organization_id, user_id),
  FOREIGN KEY (organization_id, created_by_agent_run_id)
    REFERENCES agent_runs (organization_id, id)
);

CREATE UNIQUE INDEX leads_one_generic_open
  ON leads (organization_id, customer_id)
  WHERE primary_service_id IS NULL
    AND status IN ('NEW', 'ENGAGED', 'QUALIFIED', 'NURTURE');

CREATE UNIQUE INDEX leads_one_service_open
  ON leads (organization_id, customer_id, primary_service_id)
  WHERE primary_service_id IS NOT NULL
    AND status IN ('NEW', 'ENGAGED', 'QUALIFIED', 'NURTURE');

CREATE INDEX leads_org_status_updated
  ON leads (organization_id, status, updated_at DESC);

CREATE INDEX leads_org_customer
  ON leads (organization_id, customer_id);

CREATE TABLE lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  lead_id uuid NOT NULL,
  type text NOT NULL
    CHECK (type IN (
      'LEAD_CREATED',
      'STATUS_CHANGED',
      'QUALIFICATION_UPDATED',
      'SERVICE_INTEREST_CHANGED',
      'ASSIGNED',
      'UNASSIGNED',
      'NOTE_ADDED',
      'CONVERSATION_LINKED',
      'MERGED_DUPLICATE'
    )),
  actor_type text NOT NULL
    CHECK (actor_type IN ('USER', 'AGENT', 'SYSTEM')),
  actor_id uuid,
  source_conversation_id uuid,
  source_agent_run_id uuid,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, lead_id)
    REFERENCES leads (organization_id, id),
  FOREIGN KEY (organization_id, source_conversation_id)
    REFERENCES conversations (organization_id, id),
  FOREIGN KEY (organization_id, source_agent_run_id)
    REFERENCES agent_runs (organization_id, id),
  CONSTRAINT lead_activities_metadata_size
    CHECK (pg_column_size(metadata_json) <= 4096)
);

CREATE INDEX lead_activities_lead_created
  ON lead_activities (organization_id, lead_id, created_at);

GRANT SELECT, INSERT, UPDATE ON leads TO app_runtime;
GRANT SELECT, INSERT ON lead_activities TO app_runtime;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['leads', 'lead_activities']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;

CREATE POLICY tenant_leads ON leads
  FOR ALL TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

CREATE POLICY tenant_lead_activities ON lead_activities
  FOR ALL TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());
