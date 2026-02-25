-- Portal self-bookings have no auth.users record for the client.
-- Make booked_by nullable so portal-originated bookings can set it to NULL.
ALTER TABLE public.bookings ALTER COLUMN booked_by DROP NOT NULL;
