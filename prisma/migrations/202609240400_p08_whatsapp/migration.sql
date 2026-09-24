-- Phase 08 WhatsApp transport (non-destructive). No template tables.

ALTER TABLE channel_connections
  ADD COLUMN IF NOT EXISTS display_phone_number text
    CHECK (display_phone_number IS NULL OR length(btrim(display_phone_number)) BETWEEN 1 AND 32),
  ADD COLUMN IF NOT EXISTS waba_id text
    CHECK (waba_id IS NULL OR length(btrim(waba_id)) BETWEEN 1 AND 64),
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS health_status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (health_status IN ('ACTIVE', 'MISCONFIGURED', 'AUTH_FAILED', 'DISABLED'));

-- Projection / cache for customer-care window; authority remains inbound Messages.
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS last_customer_inbound_at timestamptz;

COMMENT ON COLUMN conversations.last_customer_inbound_at IS
  'Projection of latest accepted customer inbound; authority is messages table. Updated only on new inbound accept.';

COMMENT ON COLUMN channel_connections.credential_ref IS
  'Opaque server-side secret reference key; never stores secret material.';

COMMENT ON COLUMN channel_connections.external_channel_id IS
  'For meta_whatsapp: Meta phone_number_id. Globally unique with provider.';
