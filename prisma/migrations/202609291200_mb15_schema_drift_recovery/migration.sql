-- MB-15 recovery: restore narrowly proven schema invariants when migration
-- history exists but a restored/demo database has drifted from that history.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_eligible_after_sequence integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS pause_reason_code text,
  ADD COLUMN IF NOT EXISTS pause_reason_text text,
  ADD COLUMN IF NOT EXISTS resumed_at timestamptz;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS authority_epoch integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'services'::regclass
      AND pg_get_constraintdef(oid) =
        'FOREIGN KEY (organization_id, location_id) REFERENCES locations(organization_id, id) ON DELETE RESTRICT'
  ) THEN
    ALTER TABLE services
      ADD CONSTRAINT services_org_location_mb15_recovery_fk
      FOREIGN KEY (organization_id, location_id)
      REFERENCES locations(organization_id, id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'knowledge_documents'::regclass
      AND pg_get_constraintdef(oid) =
        'FOREIGN KEY (organization_id, id, active_published_version_id) REFERENCES knowledge_document_versions(organization_id, document_id, id)'
  ) THEN
    ALTER TABLE knowledge_documents
      ADD CONSTRAINT knowledge_documents_active_version_mb15_recovery_fk
      FOREIGN KEY (organization_id, id, active_published_version_id)
      REFERENCES knowledge_document_versions(organization_id, document_id, id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'leads'::regclass
      AND pg_get_constraintdef(oid) =
        'FOREIGN KEY (organization_id, assigned_user_id) REFERENCES organization_members(organization_id, user_id)'
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT leads_assigned_member_mb15_recovery_fk
      FOREIGN KEY (organization_id, assigned_user_id)
      REFERENCES organization_members(organization_id, user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'conversations'::regclass
      AND conname = 'conversations_owner_member_fk'
  ) THEN
    ALTER TABLE conversations
      ADD CONSTRAINT conversations_owner_member_fk
      FOREIGN KEY (organization_id, owner_member_id)
      REFERENCES organization_members(organization_id, user_id);
  END IF;
END $$;

ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_pause_reason_code_check;
ALTER TABLE conversations
  ADD CONSTRAINT conversations_pause_reason_code_check
  CHECK (
    pause_reason_code IS NULL OR pause_reason_code IN (
      'CUSTOMER_REQUESTED_HUMAN', 'AI_UNCERTAIN', 'POLICY_REQUIRES_HUMAN',
      'BOOKING_EXCEPTION', 'OPERATOR_MANUAL_TAKEOVER', 'OTHER'
    )
  );

ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_pause_reason_text_len_check;
ALTER TABLE conversations
  ADD CONSTRAINT conversations_pause_reason_text_len_check
  CHECK (pause_reason_text IS NULL OR char_length(pause_reason_text) <= 500);

CREATE INDEX IF NOT EXISTS conversations_org_mode_owner_last_msg_idx
  ON conversations (organization_id, mode, owner_member_id, last_message_at DESC NULLS LAST, id);
