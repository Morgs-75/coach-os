-- Add timezone field to booking_settings
ALTER TABLE public.booking_settings
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Australia/Brisbane';
