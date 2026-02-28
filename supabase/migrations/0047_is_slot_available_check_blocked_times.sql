-- Update is_slot_available to also check blocked_times table
-- Blocked times can be recurring (day_of_week) or specific date blocks

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
  v_block_count int;
  v_date date;
  v_dow int;
  v_start_local time;
  v_end_local time;
  v_tz text;
BEGIN
  -- Check booking conflicts
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

  IF v_conflict_count > 0 THEN
    RETURN false;
  END IF;

  -- Get org timezone for blocked_times comparison
  SELECT COALESCE(timezone, 'Australia/Brisbane') INTO v_tz
  FROM public.booking_settings
  WHERE org_id = p_org_id;

  v_tz := COALESCE(v_tz, 'Australia/Brisbane');

  -- Convert slot times to local date/time/dow in coach timezone
  v_date := (p_start_time AT TIME ZONE v_tz)::date;
  v_dow := EXTRACT(DOW FROM p_start_time AT TIME ZONE v_tz)::int;
  v_start_local := (p_start_time AT TIME ZONE v_tz)::time;
  v_end_local := (p_end_time AT TIME ZONE v_tz)::time;

  -- Check blocked_times conflicts (both specific date and recurring day_of_week)
  SELECT COUNT(*) INTO v_block_count
  FROM public.blocked_times
  WHERE org_id = p_org_id
    AND (
      date = v_date OR day_of_week = v_dow
    )
    AND (
      (start_time <= v_start_local AND end_time > v_start_local) OR
      (start_time < v_end_local AND end_time >= v_end_local) OR
      (start_time >= v_start_local AND end_time <= v_end_local)
    );

  RETURN v_block_count = 0;
END;
$$;
