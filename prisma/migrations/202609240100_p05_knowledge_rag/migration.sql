-- Phase 05 knowledge / RAG (non-destructive).
-- Locked dimension: vector(1024). Exact search only (no HNSW/IVFFlat).
-- Embedding profile: qwen3_embed_06b_1024_v1 / maxDistance 0.558746 frozen.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  title text NOT NULL,
  active_published_version_id uuid,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  UNIQUE (organization_id, id)
);

CREATE INDEX knowledge_documents_org_updated_idx
  ON knowledge_documents (organization_id, updated_at DESC);

CREATE TABLE knowledge_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  document_id uuid NOT NULL,
  version_number integer NOT NULL,
  object_key text NOT NULL,
  content_checksum text NOT NULL,
  mime_type text NOT NULL,
  byte_size integer NOT NULL,
  extracted_text text,
  pipeline_status text NOT NULL DEFAULT 'PENDING_UPLOAD'
    CHECK (pipeline_status IN (
      'PENDING_UPLOAD',
      'UPLOADED',
      'EXTRACTING',
      'AWAITING_REVIEW',
      'CHUNKING',
      'EMBEDDING',
      'READY',
      'FAILED'
    )),
  review_status text NOT NULL DEFAULT 'PENDING'
    CHECK (review_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by_user_id uuid REFERENCES users(id),
  reviewed_at timestamptz,
  failure_reason text,
  expected_chunk_count integer,
  embedding_profile_id text NOT NULL DEFAULT 'qwen3_embed_06b_1024_v1',
  embedding_model text NOT NULL DEFAULT 'Qwen/Qwen3-Embedding-0.6B',
  embedding_model_revision text NOT NULL DEFAULT '97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3',
  embedding_dimension integer NOT NULL DEFAULT 1024
    CHECK (embedding_dimension = 1024),
  query_instruction_version text NOT NULL DEFAULT 'qwen3_dental_retrieve_en_v1',
  normalization_mode text NOT NULL DEFAULT 'tei_normalize_true_l2',
  max_distance double precision NOT NULL DEFAULT 0.558746,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, document_id, version_number),
  UNIQUE (organization_id, document_id, id),
  FOREIGN KEY (organization_id, document_id)
    REFERENCES knowledge_documents (organization_id, id)
);

CREATE INDEX knowledge_document_versions_doc_idx
  ON knowledge_document_versions (organization_id, document_id, version_number DESC);

-- Active published version must belong to the same document (same org).
ALTER TABLE knowledge_documents
  ADD CONSTRAINT knowledge_documents_active_version_fk
  FOREIGN KEY (organization_id, id, active_published_version_id)
  REFERENCES knowledge_document_versions (organization_id, document_id, id);

CREATE TABLE knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  document_id uuid NOT NULL,
  document_version_id uuid NOT NULL,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  content_hash text NOT NULL,
  token_count integer,
  embedding vector(1024),
  embedding_profile_id text NOT NULL DEFAULT 'qwen3_embed_06b_1024_v1',
  provenance_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, document_version_id, chunk_index),
  FOREIGN KEY (organization_id, document_id)
    REFERENCES knowledge_documents (organization_id, id),
  FOREIGN KEY (organization_id, document_id, document_version_id)
    REFERENCES knowledge_document_versions (organization_id, document_id, id)
);

CREATE INDEX knowledge_chunks_version_idx
  ON knowledge_chunks (organization_id, document_version_id, chunk_index);

-- Exact search support; no approximate index in P05.
CREATE INDEX knowledge_chunks_org_version_embedding_idx
  ON knowledge_chunks (organization_id, document_version_id)
  WHERE embedding IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  knowledge_documents, knowledge_document_versions, knowledge_chunks
  TO app_runtime;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'knowledge_documents',
    'knowledge_document_versions',
    'knowledge_chunks'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;

CREATE POLICY tenant_knowledge_documents ON knowledge_documents
  FOR ALL TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

CREATE POLICY tenant_knowledge_document_versions ON knowledge_document_versions
  FOR ALL TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());

CREATE POLICY tenant_knowledge_chunks ON knowledge_chunks
  FOR ALL TO app_runtime
  USING (organization_id = current_tenant_id())
  WITH CHECK (organization_id = current_tenant_id());
