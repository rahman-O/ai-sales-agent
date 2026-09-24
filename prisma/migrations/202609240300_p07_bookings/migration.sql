-- Phase 07 bookings / availability (non-destructive).
-- btree_gist verified on hosted migration DB before this migration.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS booking_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS minimum_lead_minutes integer NOT NULL DEFAULT 60
    CHECK (minimum_lead_minutes >= 0 AND minimum_lead_minutes <= 10080),
  ADD COLUMN IF NOT EXISTS maximum_advance_days integer NOT NULL DEFAULT 30
    CHECK (maximum_advance_days >= 1 AND maximum_advance_days <= 365);

CREATE TABLE staff_availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  staff_member_id uuid NOT NULL,
  location_id uuid NOT NULL,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  local_start_time time NOT NULL,
  local_end_time time NOT NULL,
  effective_from date,
  effective_to date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  CHECK (local_start_time < local_end_time),
  CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from),
  FOREIGN KEY (organization_id, staff_member_id)
    REFERENCES staff_members (organization_id, id),
  FOREIGN KEY (organization_id, location_id)
    REFERENCES locations (organization_id, id)
);

CREATE UNIQUE INDEX staff_availability_rules_exact_uidx
  ON staff_availability_rules (
    organization_id, staff_member_id, location_id, day_of_week,
    local_start_time, local_end_time,
    COALESCE(effective_from, DATE '0001-01-01'),
    COALESCE(effective_to, DATE '9999-12-31')
  )
  WHERE is_active = true;

CREATE INDEX staff_availability_rules_staff_idx
  ON staff_availability_rules (organization_id, staff_member_id, day_of_week)
  WHERE is_active = true;

CREATE TABLE staff_availability_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  staff_member_id uuid NOT NULL,
  location_id uuid NOT NULL,
  local_date date NOT NULL,
  local_start_time time,
  local_end_time time,
  type text NOT NULL CHECK (type IN ('AVAILABLE', 'UNAVAILABLE')),
  reason_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  CHECK (
    (local_start_time IS NULL AND local_end_time IS NULL)
    OR (local_start_time IS NOT NULL AND local_end_time IS NOT NULL AND local_start_time < local_end_time)
  ),
  FOREIGN KEY (organization_id, staff_member_id)
    REFERENCES staff_members (organization_id, id),
  FOREIGN KEY (organization_id, location_id)
    REFERENCES locations (organization_id, id)
);

CREATE INDEX staff_availability_exceptions_staff_date_idx
  ON staff_availability_exceptions (organization_id, staff_member_id, local_date);

CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  customer_id uuid NOT NULL,
  service_id uuid NOT NULL,
  location_id uuid NOT NULL,
  staff_member_id uuid NOT NULL,
  lead_id uuid,
  source_conversation_id uuid,
  source_message_id uuid,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  occupied_starts_at timestamptz NOT NULL,
  occupied_ends_at timestamptz NOT NULL,
  timezone text NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 480),
  buffer_before_minutes integer NOT NULL DEFAULT 0 CHECK (buffer_before_minutes >= 0 AND buffer_before_minutes <= 240),
  buffer_after_minutes integer NOT NULL DEFAULT 0 CHECK (buffer_after_minutes >= 0 AND buffer_after_minutes <= 240),
  status text NOT NULL DEFAULT 'CONFIRMED'
    CHECK (status IN ('CONFIRMED', 'CANCELLED')),
  cancellation_reason_code text
    CHECK (cancellation_reason_code IS NULL OR cancellation_reason_code IN (
      'CUSTOMER_REQUEST', 'CLINIC_REQUEST', 'DUPLICATE_BOOKING', 'OTHER'
    )),
  cancellation_reason_text text,
  service_name_snapshot text,
  staff_display_name_snapshot text,
  created_by_type text NOT NULL CHECK (created_by_type IN ('USER', 'AGENT', 'SYSTEM')),
  created_by_user_id uuid REFERENCES users(id),
  created_by_agent_run_id uuid,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  CHECK (starts_at < ends_at),
  CHECK (occupied_starts_at < occupied_ends_at),
  CHECK (occupied_starts_at <= starts_at AND occupied_ends_at >= ends_at),
  FOREIGN KEY (organization_id, customer_id)
    REFERENCES customers (organization_id, id),
  FOREIGN KEY (organization_id, service_id)
    REFERENCES services (organization_id, id),
  FOREIGN KEY (organization_id, location_id)
    REFERENCES locations (organization_id, id),
  FOREIGN KEY (organization_id, staff_member_id)
    REFERENCES staff_members (organization_id, id),
  FOREIGN KEY (organization_id, lead_id)
    REFERENCES leads (organization_id, id),
  FOREIGN KEY (organization_id, source_conversation_id)
    REFERENCES conversations (organization_id, id),
  FOREIGN KEY (organization_id, source_message_id)
    REFERENCES messages (organization_id, id),
  FOREIGN KEY (organization_id, created_by_agent_run_id)
    REFERENCES agent_runs (organization_id, id)
);

CREATE INDEX bookings_org_staff_starts_idx
  ON bookings (organization_id, staff_member_id, starts_at)
  WHERE status = 'CONFIRMED';

CREATE INDEX bookings_org_customer_starts_idx
  ON bookings (organization_id, customer_id, starts_at);

ALTER TABLE bookings
  ADD CONSTRAINT bookings_staff_occupied_excl
  EXCLUDE USING gist (
    organization_id WITH =,
    staff_member_id WITH =,
    tstzrange(occupied_starts_at, occupied_ends_at, '[)') WITH &&
  ) WHERE (status = 'CONFIRMED');

ALTER TABLE bookings
  ADD CONSTRAINT bookings_customer_occupied_excl
  EXCLUDE USING gist (
    organization_id WITH =,
    customer_id WITH =,
    tstzrange(occupied_starts_at, occupied_ends_at, '[)') WITH &&
  ) WHERE (status = 'CONFIRMED');

CREATE TABLE booking_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  booking_id uuid NOT NULL,
  type text NOT NULL
    CHECK (type IN ('BOOKING_CREATED', 'BOOKING_CANCELLED', 'BOOKING_RESCHEDULED')),
  actor_type text NOT NULL CHECK (actor_type IN ('USER', 'AGENT', 'SYSTEM')),
  actor_id uuid,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, booking_id)
    REFERENCES bookings (organization_id, id),
  CONSTRAINT booking_activities_metadata_size
    CHECK (pg_column_size(metadata_json) <= 4096)
);

CREATE INDEX booking_activities_booking_created_idx
  ON booking_activities (organization_id, booking_id, created_at);

-- Extend lead_activities type vocabulary for booking provenance (no BOOKED status).
ALTER TABLE lead_activities DROP CONSTRAINT IF EXISTS lead_activities_type_check;
ALTER TABLE lead_activities ADD CONSTRAINT lead_activities_type_check
  CHECK (type IN (
    'LEAD_CREATED',
    'STATUS_CHANGED',
    'QUALIFICATION_UPDATED',
    'SERVICE_INTEREST_CHANGED',
    'ASSIGNED',
    'UNASSIGNED',
    'NOTE_ADDED',
    'CONVERSATION_LINKED',
    'MERGED_DUPLICATE',
    'BOOKING_CONFIRMED',
    'BOOKING_CANCELLED',
    'BOOKING_RESCHEDULED'
  ));

GRANT SELECT, INSERT, UPDATE ON staff_availability_rules TO app_runtime;
GRANT SELECT, INSERT, UPDATE ON staff_availability_exceptions TO app_runtime;
GRANT SELECT, INSERT, UPDATE ON bookings TO app_runtime;
GRANT SELECT, INSERT ON booking_activities TO app_runtime;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'staff_availability_rules',
    'staff_availability_exceptions',
    'bookings',
    'booking_activities'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;

CREATE POLICY tenant_staff_availability_rules ON staff_availability_rules
  FOR ALL TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

CREATE POLICY tenant_staff_availability_exceptions ON staff_availability_exceptions
  FOR ALL TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

CREATE POLICY tenant_bookings ON bookings
  FOR ALL TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

CREATE POLICY tenant_booking_activities ON booking_activities
  FOR ALL TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());
