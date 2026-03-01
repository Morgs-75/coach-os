-- Returns the number of sessions a client can still BOOK for a given purchase.
-- This is sessions_remaining minus the count of future confirmed/pending bookings
-- already using that purchase. Prevents overbooking when multiple bookings are
-- made before the trainer marks sessions as used.

CREATE OR REPLACE FUNCTION bookable_sessions_remaining(p_purchase_id uuid)
RETURNS int AS $$
  SELECT GREATEST(0,
    (SELECT sessions_remaining FROM client_purchases WHERE id = p_purchase_id)
    - (SELECT count(*)::int FROM bookings
       WHERE purchase_id = p_purchase_id
         AND status IN ('confirmed', 'pending')
         AND start_time > now())
  );
$$ LANGUAGE sql STABLE;
