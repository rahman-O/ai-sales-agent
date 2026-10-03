-- Recover publication claims after relay interruption; consumer receipts preserve event idempotency.
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
    WHERE o.publication_status IN ('PENDING', 'CLAIMED')
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

