-- Phase 04 agent core (non-destructive). Ingress watermark = messages.ingress_sequence / conversations.next_sequence only.

CREATE TABLE agent_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'ACTIVE', 'RETIRED')),
  prompt_version text NOT NULL,
  model_profile text NOT NULL,
  tool_allowlist jsonb NOT NULL,
  budgets_json jsonb NOT NULL,
  locale_default text,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  UNIQUE (organization_id, version),
  UNIQUE (organization_id, id)
);

CREATE UNIQUE INDEX agent_configs_one_active_per_org
  ON agent_configs (organization_id)
  WHERE status = 'ACTIVE';

CREATE TABLE agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  conversation_id uuid NOT NULL,
  run_key text NOT NULL,
  target_ingress_sequence integer NOT NULL,
  ownership_epoch integer NOT NULL,
  lease_fence integer NOT NULL,
  agent_config_id uuid NOT NULL,
  prompt_version text NOT NULL,
  model_profile text NOT NULL,
  status text NOT NULL DEFAULT 'RUNNING'
    CHECK (status IN (
      'RUNNING', 'SUCCEEDED', 'FAILED', 'TIMED_OUT', 'CANCELLED',
      'STALE', 'SUPERSEDED', 'BUDGET_EXCEEDED', 'HANDOFF_REQUESTED'
    )),
  terminal_reason text,
  model_calls integer NOT NULL DEFAULT 0,
  tool_calls integer NOT NULL DEFAULT 0,
  final_outbound_message_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (organization_id, run_key),
  UNIQUE (organization_id, id),
  UNIQUE (final_outbound_message_id),
  FOREIGN KEY (organization_id, conversation_id)
    REFERENCES conversations (organization_id, id),
  FOREIGN KEY (organization_id, agent_config_id)
    REFERENCES agent_configs (organization_id, id),
  FOREIGN KEY (organization_id, final_outbound_message_id)
    REFERENCES messages (organization_id, id)
);

CREATE INDEX agent_runs_org_conversation_started
  ON agent_runs (organization_id, conversation_id, started_at);

CREATE TABLE tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  agent_run_id uuid NOT NULL,
  ordinal integer NOT NULL,
  tool_name text NOT NULL,
  tool_version text NOT NULL,
  args_hash text NOT NULL,
  authz_result text NOT NULL,
  operation_id uuid,
  result_code text NOT NULL,
  duration_ms integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_run_id, ordinal),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, agent_run_id)
    REFERENCES agent_runs (organization_id, id)
);

CREATE TABLE command_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  operation_key text NOT NULL,
  agent_run_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'IN_PROGRESS'
    CHECK (status IN ('IN_PROGRESS', 'SUCCEEDED', 'FAILED')),
  result_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (organization_id, operation_key),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, agent_run_id)
    REFERENCES agent_runs (organization_id, id)
);

CREATE TABLE usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  agent_run_id uuid NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  input_tokens integer,
  output_tokens integer,
  estimated boolean NOT NULL DEFAULT true,
  latency_ms integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, agent_run_id)
    REFERENCES agent_runs (organization_id, id)
);

CREATE INDEX usage_events_org_run ON usage_events (organization_id, agent_run_id);

CREATE TABLE conversation_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  conversation_id uuid NOT NULL,
  version integer NOT NULL,
  source_watermark integer NOT NULL,
  summary_text text NOT NULL,
  policy_version text NOT NULL,
  model_profile text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, version),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, conversation_id)
    REFERENCES conversations (organization_id, id)
);

CREATE INDEX conversation_summaries_lookup
  ON conversation_summaries (organization_id, conversation_id, version DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON
  agent_configs, agent_runs, tool_calls, command_operations, usage_events, conversation_summaries
  TO app_runtime;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'agent_configs', 'agent_runs', 'tool_calls', 'command_operations',
    'usage_events', 'conversation_summaries'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;

CREATE POLICY tenant_agent_configs ON agent_configs FOR ALL TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

CREATE POLICY tenant_agent_runs ON agent_runs FOR ALL TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

CREATE POLICY tenant_tool_calls ON tool_calls FOR ALL TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

CREATE POLICY tenant_command_operations ON command_operations FOR ALL TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

CREATE POLICY tenant_usage_events ON usage_events FOR ALL TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

CREATE POLICY tenant_conversation_summaries ON conversation_summaries FOR ALL TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());
