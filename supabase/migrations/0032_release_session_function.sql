-- Atomically release (reinstate) one session from a pack.
-- Mirrors use_session() but decrements instead of incrementing.
-- Returns the updated sessions_used value, or -1 if the row was not updated
-- (sessions_used was already 0 — prevents underflow).
CREATE OR REPLACE FUNCTION public.release_session(p_purchase_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sessions_used int;
BEGIN
  UPDATE public.client_purchases
  SET sessions_used = sessions_used - 1
  WHERE id = p_purchase_id
    AND sessions_used > 0
  RETURNING sessions_used INTO v_sessions_used;

  -- If no row was updated (sessions_used was 0), return -1 as sentinel
  IF NOT FOUND THEN
    RETURN -1;
  END IF;

  RETURN v_sessions_used;
END;
$$;
