-- Phase 09: human takeover control plane
-- AI eligibility cursor, pause metadata, owner FK, message authority_epoch

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_eligible_after_sequence integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS pause_reason_code text,
  ADD COLUMN IF NOT EXISTS pause_reason_text text,
  ADD COLUMN IF NOT EXISTS resumed_at timestamptz;

ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_pause_reason_code_check;

ALTER TABLE conversations
  ADD CONSTRAINT conversations_pause_reason_code_check
  CHECK (
    pause_reason_code IS NULL
    OR pause_reason_code IN (
      'CUSTOMER_REQUESTED_HUMAN',
      'AI_UNCERTAIN',
      'POLICY_REQUIRES_HUMAN',
      'BOOKING_EXCEPTION',
      'OPERATOR_MANUAL_TAKEOVER',
      'OTHER'
    )
  );

ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_pause_reason_text_len_check;

ALTER TABLE conversations
  ADD CONSTRAINT conversations_pause_reason_text_len_check
  CHECK (pause_reason_text IS NULL OR char_length(pause_reason_text) <= 500);

-- owner_member_id stores organization_members.user_id (composite tenant membership)
ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_owner_member_fk;

ALTER TABLE conversations
  ADD CONSTRAINT conversations_owner_member_fk
  FOREIGN KEY (organization_id, owner_member_id)
  REFERENCES organization_members (organization_id, user_id);

CREATE INDEX IF NOT EXISTS conversations_org_mode_owner_last_msg_idx
  ON conversations (organization_id, mode, owner_member_id, last_message_at DESC NULLS LAST, id);

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS authority_epoch integer;

COMMENT ON COLUMN conversations.ai_eligible_after_sequence IS
  'P09: inbound ingress_sequence <= this value must not start autonomous AgentRuns after resume';
COMMENT ON COLUMN conversations.owner_member_id IS
  'P09: stores organization_members.user_id; null = unassigned pause';
COMMENT ON COLUMN messages.authority_epoch IS
  'P09: conversation.ownership_epoch snapshot at outbound create; AI dispatch requires match';
