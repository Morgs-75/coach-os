-- Restore is_slot_available function (was in 0011 but not applied to production)
-- Also formally records the sessions_remaining generated column add (applied ad-hoc previously)

ALTER TABLE public.client_purchases
  ADD COLUMN IF NOT EXISTS sessions_remaining int
  GENERATED ALWAYS AS (sessions_total - sessions_used) STORED;

CREATE OR REPLACE FUNCTION public.is_slot_available(
  p_org_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_exclude_booking_id uuid DEFAULT null
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conflict_count int;
BEGIN
  SELECT COUNT(*) INTO v_conflict_count
  FROM public.bookings
  WHERE org_id = p_org_id
    AND status NOT IN ('cancelled')
    AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id)
    AND (
      (start_time <= p_start_time AND end_time > p_start_time) OR
      (start_time < p_end_time AND end_time >= p_end_time) OR
      (start_time >= p_start_time AND end_time <= p_end_time)
    );

  RETURN v_conflict_count = 0;
END;
$$;
