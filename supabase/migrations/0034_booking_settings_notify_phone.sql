-- Add coach notification phone to booking_settings
-- Used to SMS the coach when a client cancels via their portal
ALTER TABLE public.booking_settings
  ADD COLUMN IF NOT EXISTS notify_phone text;
