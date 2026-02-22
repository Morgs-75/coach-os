-- Add client confirmation tracking columns to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS client_confirmed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz;
