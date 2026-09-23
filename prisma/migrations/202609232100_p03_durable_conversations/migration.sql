-- Phase 03 durable conversations / messaging foundation.

-- Extend outbox for publication / claim (id remains domain event identity).
ALTER TABLE outbox_events
  ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS publication_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS available_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS claimed_until timestamptz;

UPDATE outbox_events
SET publication_status = 'PUBLISHED',
    available_at = created_at
WHERE publication_status = 'PENDING'
  AND created_at < now();

-- Align legacy rows: if payload carries eventId and differs from id, leave as-is (already committed).
-- New writes use id = envelope.eventId.

ALTER TABLE outbox_events
  ADD CONSTRAINT outbox_events_publication_status_chk
  CHECK (publication_status IN ('PENDING', 'CLAIMED', 'PUBLISHED', 'DEAD'));

CREATE UNIQUE INDEX IF NOT EXISTS outbox_events_org_id_uidx ON outbox_events (organization_id, id);
CREATE INDEX IF NOT EXISTS outbox_events_pending_due_idx
  ON outbox_events (available_at)
  WHERE publication_status IN ('PENDING', 'CLAIMED');

CREATE TABLE channel_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  provider text NOT NULL CHECK (provider = lower(provider) AND provider ~ '^[a-z][a-z0-9_-]{1,31}$'),
  external_channel_id text NOT NULL CHECK (length(btrim(external_channel_id)) BETWEEN 1 AND 320),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED', 'REVOKED')),
  credential_ref text,
  policy_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (provider, external_channel_id)
);
CREATE INDEX channel_connections_org_status_idx ON channel_connections (organization_id, status);

-- Backfill fixture ChannelConnections from existing CustomerIdentity channel keys.
INSERT INTO channel_connections (id, organization_id, provider, external_channel_id, status)
SELECT gen_random_uuid(), d.organization_id, d.channel, 'fixture:' || d.organization_id::text || ':' || d.channel, 'ACTIVE'
FROM (SELECT DISTINCT organization_id, channel FROM customer_identities) d;

ALTER TABLE customer_identities ADD COLUMN channel_connection_id uuid;

UPDATE customer_identities ci
SET channel_connection_id = cc.id
FROM channel_connections cc
WHERE cc.organization_id = ci.organization_id
  AND cc.provider = ci.channel
  AND cc.external_channel_id = 'fixture:' || ci.organization_id::text || ':' || ci.channel;

ALTER TABLE customer_identities ALTER COLUMN channel_connection_id SET NOT NULL;

ALTER TABLE customer_identities DROP CONSTRAINT IF EXISTS customer_identities_organization_id_channel_external_address_key;
ALTER TABLE customer_identities
  ADD CONSTRAINT customer_identities_org_connection_address_key
  UNIQUE (organization_id, channel_connection_id, external_address);
ALTER TABLE customer_identities
  ADD CONSTRAINT customer_identities_channel_connection_fk
  FOREIGN KEY (organization_id, channel_connection_id)
  REFERENCES channel_connections (organization_id, id) ON DELETE RESTRICT;

CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL,
  channel_connection_id uuid NOT NULL,
  identity_id uuid NOT NULL,
  mode text NOT NULL DEFAULT 'AI_ACTIVE' CHECK (mode IN ('AI_ACTIVE', 'AI_PAUSED', 'HUMAN_ACTIVE', 'CLOSED')),
  owner_member_id uuid,
  ownership_epoch integer NOT NULL DEFAULT 0 CHECK (ownership_epoch >= 0),
  next_sequence integer NOT NULL DEFAULT 1 CHECK (next_sequence >= 1),
  processed_sequence integer NOT NULL DEFAULT 0 CHECK (processed_sequence >= 0),
  next_timeline_sequence integer NOT NULL DEFAULT 1 CHECK (next_timeline_sequence >= 1),
  lease_owner text,
  lease_fence integer NOT NULL DEFAULT 0 CHECK (lease_fence >= 0),
  lease_expires_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  last_message_at timestamptz,
  provider_event_watermark_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, channel_connection_id, identity_id),
  FOREIGN KEY (organization_id, customer_id) REFERENCES customers (organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, channel_connection_id) REFERENCES channel_connections (organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, identity_id) REFERENCES customer_identities (organization_id, id) ON DELETE RESTRICT,
  CHECK (processed_sequence < next_sequence)
);
CREATE INDEX conversations_inbox_idx ON conversations (organization_id, mode, last_message_at DESC, id);
CREATE INDEX conversations_lease_expiry_idx ON conversations (organization_id, lease_expires_at);

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  conversation_id uuid NOT NULL,
  channel_connection_id uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
  origin text NOT NULL CHECK (origin IN ('CUSTOMER', 'SYSTEM', 'OPERATOR', 'AI')),
  provider_message_id text,
  ingress_sequence integer,
  timeline_sequence integer NOT NULL,
  late_flag boolean NOT NULL DEFAULT false,
  content_type text NOT NULL DEFAULT 'text',
  content_text text NOT NULL,
  content_digest text NOT NULL,
  provider_event_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  delivery_state text NOT NULL DEFAULT 'ACCEPTED'
    CHECK (delivery_state IN ('DRAFT', 'PENDING', 'DISPATCHING', 'ACCEPTED', 'DELIVERED', 'READ', 'FAILED', 'SUPPRESSED', 'UNKNOWN')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (conversation_id, timeline_sequence),
  FOREIGN KEY (organization_id, conversation_id) REFERENCES conversations (organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, channel_connection_id) REFERENCES channel_connections (organization_id, id) ON DELETE RESTRICT,
  CHECK (
    (direction = 'INBOUND' AND ingress_sequence IS NOT NULL)
    OR (direction = 'OUTBOUND' AND ingress_sequence IS NULL)
  )
);
CREATE UNIQUE INDEX messages_provider_dedup_uidx
  ON messages (channel_connection_id, provider_message_id)
  WHERE provider_message_id IS NOT NULL;
CREATE UNIQUE INDEX messages_ingress_uidx
  ON messages (conversation_id, ingress_sequence)
  WHERE ingress_sequence IS NOT NULL;
CREATE INDEX messages_timeline_idx ON messages (organization_id, conversation_id, timeline_sequence, id);

CREATE TABLE webhook_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  channel_connection_id uuid NOT NULL,
  event_identity text NOT NULL,
  payload_digest text NOT NULL,
  status text NOT NULL DEFAULT 'ACCEPTED' CHECK (status IN ('ACCEPTED', 'DUPLICATE', 'CONFLICT', 'REJECTED')),
  message_id uuid,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (channel_connection_id, event_identity),
  FOREIGN KEY (organization_id, channel_connection_id) REFERENCES channel_connections (organization_id, id) ON DELETE RESTRICT
);
CREATE INDEX webhook_receipts_org_received_idx ON webhook_receipts (organization_id, received_at);

CREATE TABLE consumer_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  consumer_name text NOT NULL CHECK (length(btrim(consumer_name)) BETWEEN 1 AND 120),
  event_id uuid NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (consumer_name, event_id),
  FOREIGN KEY (organization_id, event_id) REFERENCES outbox_events (organization_id, id) ON DELETE RESTRICT
);

CREATE TABLE outbound_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  message_id uuid NOT NULL,
  attempt_number integer NOT NULL CHECK (attempt_number >= 1),
  ownership_epoch integer NOT NULL CHECK (ownership_epoch >= 0),
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'DISPATCHING', 'ACCEPTED', 'FAILED', 'SUPPRESSED', 'UNKNOWN')),
  provider_message_id text,
  error_text text,
  dispatched_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (message_id, attempt_number),
  FOREIGN KEY (organization_id, message_id) REFERENCES messages (organization_id, id) ON DELETE RESTRICT
);

GRANT SELECT, INSERT, UPDATE, DELETE ON
  channel_connections, conversations, messages, webhook_receipts, consumer_receipts, outbound_attempts
  TO app_runtime;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'channel_connections','conversations','messages','webhook_receipts','consumer_receipts','outbound_attempts'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I FOR ALL TO app_runtime USING (organization_id = current_tenant_id()) WITH CHECK (organization_id = current_tenant_id())',
      table_name
    );
  END LOOP;
END $$;

-- Narrow privileged work discovery (SECURITY DEFINER). Returns identifiers only.
CREATE OR REPLACE FUNCTION claim_pending_outbox_events(batch_size integer DEFAULT 25)
RETURNS TABLE (
  organization_id uuid,
  work_kind text,
  work_id uuid,
  available_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF batch_size IS NULL OR batch_size < 1 OR batch_size > 100 THEN
    RAISE EXCEPTION 'invalid batch_size';
  END IF;
  RETURN QUERY
  WITH picked AS (
    SELECT o.id
    FROM public.outbox_events o
    WHERE o.publication_status = 'PENDING'
      AND o.available_at <= now()
      AND (o.claimed_until IS NULL OR o.claimed_until <= now())
    ORDER BY o.available_at ASC, o.id ASC
    FOR UPDATE SKIP LOCKED
    LIMIT batch_size
  ),
  updated AS (
    UPDATE public.outbox_events o
    SET publication_status = 'CLAIMED',
        publication_attempts = o.publication_attempts + 1,
        claimed_until = now() + interval '30 seconds',
        available_at = now() + interval '30 seconds'
    FROM picked p
    WHERE o.id = p.id
    RETURNING o.organization_id, o.id, o.available_at
  )
  SELECT u.organization_id, 'OUTBOX_EVENT'::text, u.id, u.available_at FROM updated u;
END;
$$;

CREATE OR REPLACE FUNCTION mark_outbox_event_published(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.outbox_events
  SET publication_status = 'PUBLISHED',
      claimed_until = NULL
  WHERE id = p_event_id
    AND publication_status IN ('CLAIMED', 'PENDING', 'PUBLISHED');
END;
$$;

CREATE OR REPLACE FUNCTION list_due_conversation_wakeups(batch_size integer DEFAULT 25)
RETURNS TABLE (
  organization_id uuid,
  work_kind text,
  work_id uuid,
  available_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF batch_size IS NULL OR batch_size < 1 OR batch_size > 100 THEN
    RAISE EXCEPTION 'invalid batch_size';
  END IF;
  RETURN QUERY
  SELECT c.organization_id, 'CONVERSATION_DRAIN'::text, c.id, now()
  FROM public.conversations c
  WHERE c.processed_sequence + 1 < c.next_sequence
    AND (c.lease_expires_at IS NULL OR c.lease_expires_at <= now())
  ORDER BY c.updated_at ASC, c.id ASC
  LIMIT batch_size;
END;
$$;

CREATE OR REPLACE FUNCTION reclaim_expired_conversation_leases(batch_size integer DEFAULT 25)
RETURNS TABLE (
  organization_id uuid,
  work_kind text,
  work_id uuid,
  available_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF batch_size IS NULL OR batch_size < 1 OR batch_size > 100 THEN
    RAISE EXCEPTION 'invalid batch_size';
  END IF;
  RETURN QUERY
  WITH picked AS (
    SELECT c.id
    FROM public.conversations c
    WHERE c.lease_owner IS NOT NULL
      AND c.lease_expires_at IS NOT NULL
      AND c.lease_expires_at <= now()
    ORDER BY c.lease_expires_at ASC, c.id ASC
    FOR UPDATE SKIP LOCKED
    LIMIT batch_size
  ),
  updated AS (
    UPDATE public.conversations c
    SET lease_owner = NULL,
        lease_expires_at = NULL,
        updated_at = now()
    FROM picked p
    WHERE c.id = p.id
    RETURNING c.organization_id, c.id
  )
  SELECT u.organization_id, 'CONVERSATION_LEASE_EXPIRED'::text, u.id, now() FROM updated u;
END;
$$;

REVOKE ALL ON FUNCTION claim_pending_outbox_events(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION mark_outbox_event_published(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION list_due_conversation_wakeups(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION reclaim_expired_conversation_leases(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_pending_outbox_events(integer) TO app_runtime;
GRANT EXECUTE ON FUNCTION mark_outbox_event_published(uuid) TO app_runtime;
GRANT EXECUTE ON FUNCTION list_due_conversation_wakeups(integer) TO app_runtime;
GRANT EXECUTE ON FUNCTION reclaim_expired_conversation_leases(integer) TO app_runtime;
