-- PRE-P14: Conversation Working State for multi-turn structured context persistence

CREATE TABLE conversation_working_state (
  organization_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1,
  customer_id uuid,
  lead_id uuid,
  state_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_agent_run_id uuid,
  last_tool_call_id uuid,
  PRIMARY KEY (organization_id, conversation_id),
  CONSTRAINT conversation_working_state_org_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT conversation_working_state_conv_fkey FOREIGN KEY (organization_id, conversation_id) REFERENCES conversations(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT conversation_working_state_lead_fkey FOREIGN KEY (organization_id, lead_id) REFERENCES leads(organization_id, id) ON DELETE SET NULL (lead_id),
  CONSTRAINT conversation_working_state_run_fkey FOREIGN KEY (organization_id, last_agent_run_id) REFERENCES agent_runs(organization_id, id) ON DELETE SET NULL (last_agent_run_id),
  CONSTRAINT conversation_working_state_tool_call_fkey FOREIGN KEY (organization_id, last_tool_call_id) REFERENCES tool_calls(organization_id, id) ON DELETE SET NULL (last_tool_call_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON conversation_working_state TO app_runtime;

ALTER TABLE conversation_working_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_working_state FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON conversation_working_state
  FOR ALL
  TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());
