-- MB-08: Knowledge Setup refinements

ALTER TABLE knowledge_documents
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'FILE'
    CHECK (source_type IN ('TEXT', 'FAQ', 'FILE', 'URL', 'MANUAL_NOTE')),
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'CUSTOMER_VISIBLE'
    CHECK (visibility IN ('CUSTOMER_VISIBLE', 'INTERNAL_ONLY')),
  ADD COLUMN IF NOT EXISTS metadata_json jsonb;

CREATE INDEX IF NOT EXISTS knowledge_documents_source_type_idx
  ON knowledge_documents (organization_id, source_type, visibility);
