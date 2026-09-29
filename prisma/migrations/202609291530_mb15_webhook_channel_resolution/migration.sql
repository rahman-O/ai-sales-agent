-- Resolve a signed provider webhook to its tenant before tenant RLS context exists.
-- Return identifiers only; all subsequent reads and writes remain tenant-scoped.
CREATE OR REPLACE FUNCTION resolve_active_channel_connection(
  p_provider text,
  p_external_channel_id text
)
RETURNS TABLE (id uuid, organization_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT cc.id, cc.organization_id
  FROM public.channel_connections cc
  WHERE cc.provider = p_provider
    AND cc.external_channel_id = p_external_channel_id
    AND cc.status = 'ACTIVE'
    AND length(p_provider) BETWEEN 1 AND 64
    AND length(p_external_channel_id) BETWEEN 1 AND 320
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION resolve_active_channel_connection(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_active_channel_connection(text, text) TO app_runtime;
