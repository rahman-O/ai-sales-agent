-- Phase 10: follow-ups + versioned message templates
-- Durable timer = outbox available_at (FollowUpDue); DISPATCHED ≠ SENT

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS send_mode text NOT NULL DEFAULT 'FREE_FORM',
  ADD COLUMN IF NOT EXISTS template_version_id uuid,
  ADD COLUMN IF NOT EXISTS template_params_json jsonb;

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_send_mode_check;
ALTER TABLE messages
  ADD CONSTRAINT messages_send_mode_check
  CHECK (send_mode IN ('FREE_FORM', 'TEMPLATE'));

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_template_params_size;
ALTER TABLE messages
  ADD CONSTRAINT messages_template_params_size
  CHECK (template_params_json IS NULL OR pg_column_size(template_params_json) <= 4096);

CREATE TABLE message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  channel_type text NOT NULL DEFAULT 'whatsapp'
    CHECK (channel_type IN ('whatsapp')),
  provider text NOT NULL DEFAULT 'meta_whatsapp'
    CHECK (provider IN ('meta_whatsapp')),
  internal_name text NOT NULL,
  internal_status text NOT NULL DEFAULT 'DRAFT'
    CHECK (internal_status IN ('DRAFT', 'APPROVED', 'DISABLED')),
  active_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, internal_name)
);

CREATE TABLE message_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  template_id uuid NOT NULL,
  version integer NOT NULL,
  provider_template_name text NOT NULL,
  provider_language_code text NOT NULL DEFAULT 'ar',
  category text,
  parameter_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  body_preview text,
  provider_status text NOT NULL DEFAULT 'UNKNOWN'
    CHECK (provider_status IN (
      'UNKNOWN', 'PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED'
    )),
  provider_last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (template_id, version),
  FOREIGN KEY (organization_id, template_id)
    REFERENCES message_templates (organization_id, id),
  CONSTRAINT mtv_parameter_schema_size
    CHECK (pg_column_size(parameter_schema) <= 8192)
);

ALTER TABLE message_templates
  ADD CONSTRAINT message_templates_active_version_fk
  FOREIGN KEY (organization_id, active_version_id)
  REFERENCES message_template_versions (organization_id, id);

ALTER TABLE messages
  ADD CONSTRAINT messages_template_version_fk
  FOREIGN KEY (organization_id, template_version_id)
  REFERENCES message_template_versions (organization_id, id);

CREATE TABLE organization_follow_up_policies (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id),
  follow_up_enabled boolean NOT NULL DEFAULT false,
  default_no_response_delay_minutes integer NOT NULL DEFAULT 1440
    CHECK (default_no_response_delay_minutes BETWEEN 60 AND 10080),
  max_pending_per_customer integer NOT NULL DEFAULT 3
    CHECK (max_pending_per_customer BETWEEN 1 AND 10),
  quiet_hours_start_minute integer NOT NULL DEFAULT 1200
    CHECK (quiet_hours_start_minute BETWEEN 0 AND 1439),
  quiet_hours_end_minute integer NOT NULL DEFAULT 540
    CHECK (quiet_hours_end_minute BETWEEN 0 AND 1439),
  timezone text NOT NULL DEFAULT 'Asia/Baghdad',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  customer_id uuid NOT NULL,
  lead_id uuid,
  conversation_id uuid,
  booking_id uuid,
  channel_connection_id uuid,
  template_version_id uuid,
  status text NOT NULL DEFAULT 'SCHEDULED'
    CHECK (status IN (
      'SCHEDULED', 'PROCESSING', 'DISPATCHED', 'CANCELLED', 'SUPPRESSED', 'FAILED'
    )),
  trigger_type text NOT NULL
    CHECK (trigger_type IN (
      'LEAD_NO_RESPONSE', 'MANUAL_SCHEDULED', 'BOOKING_REMINDER'
    )),
  origin_kind text NOT NULL
    CHECK (origin_kind IN ('AUTOMATED', 'OPERATOR_SCHEDULED')),
  outreach_basis text NOT NULL
    CHECK (outreach_basis IN (
      'CUSTOMER_INITIATED_CONVERSATION',
      'TRANSACTIONAL_BOOKING',
      'EXPLICIT_OPT_IN',
      'OPERATOR_SCHEDULED'
    )),
  send_mode text NOT NULL DEFAULT 'TEMPLATE'
    CHECK (send_mode IN ('FREE_FORM', 'TEMPLATE')),
  scheduled_for timestamptz NOT NULL,
  next_eligible_at timestamptz NOT NULL,
  timezone text NOT NULL,
  dedup_key text NOT NULL,
  operation_key text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  baseline_inbound_sequence integer,
  baseline_last_customer_inbound_at timestamptz,
  baseline_ownership_epoch integer,
  expected_booking_starts_at timestamptz,
  expected_booking_version integer,
  payload_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  outbound_message_id uuid,
  processing_owner text,
  processing_started_at timestamptz,
  lease_until timestamptz,
  executed_at timestamptz,
  cancelled_at timestamptz,
  suppressed_at timestamptz,
  result_reason_code text,
  created_by_type text NOT NULL
    CHECK (created_by_type IN ('USER', 'AGENT', 'SYSTEM')),
  created_by_user_id uuid REFERENCES users(id),
  created_by_agent_run_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, operation_key),
  UNIQUE (organization_id, outbound_message_id),
  FOREIGN KEY (organization_id, customer_id)
    REFERENCES customers (organization_id, id),
  FOREIGN KEY (organization_id, lead_id)
    REFERENCES leads (organization_id, id),
  FOREIGN KEY (organization_id, conversation_id)
    REFERENCES conversations (organization_id, id),
  FOREIGN KEY (organization_id, booking_id)
    REFERENCES bookings (organization_id, id),
  FOREIGN KEY (organization_id, channel_connection_id)
    REFERENCES channel_connections (organization_id, id),
  FOREIGN KEY (organization_id, template_version_id)
    REFERENCES message_template_versions (organization_id, id),
  FOREIGN KEY (organization_id, outbound_message_id)
    REFERENCES messages (organization_id, id),
  FOREIGN KEY (organization_id, created_by_agent_run_id)
    REFERENCES agent_runs (organization_id, id),
  CONSTRAINT follow_ups_payload_size
    CHECK (pg_column_size(payload_data) <= 4096),
  CONSTRAINT follow_ups_automated_epoch
    CHECK (
      origin_kind <> 'AUTOMATED'
      OR baseline_ownership_epoch IS NOT NULL
    )
);

CREATE UNIQUE INDEX follow_ups_active_dedup
  ON follow_ups (organization_id, dedup_key)
  WHERE status IN ('SCHEDULED', 'PROCESSING');

CREATE INDEX follow_ups_org_status_eligible
  ON follow_ups (organization_id, status, next_eligible_at);

CREATE INDEX follow_ups_org_customer
  ON follow_ups (organization_id, customer_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON message_templates TO app_runtime;
GRANT SELECT, INSERT, UPDATE ON message_template_versions TO app_runtime;
GRANT SELECT, INSERT, UPDATE ON organization_follow_up_policies TO app_runtime;
GRANT SELECT, INSERT, UPDATE ON follow_ups TO app_runtime;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'message_templates',
    'message_template_versions',
    'organization_follow_up_policies',
    'follow_ups'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;

CREATE POLICY tenant_message_templates ON message_templates
  FOR ALL TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

CREATE POLICY tenant_message_template_versions ON message_template_versions
  FOR ALL TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

CREATE POLICY tenant_follow_up_policies ON organization_follow_up_policies
  FOR ALL TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

CREATE POLICY tenant_follow_ups ON follow_ups
  FOR ALL TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());
