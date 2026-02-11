-- Add preferred_time_windows column to clients table
-- This stores an array of JSON objects like: [{"day": "monday", "start": "06:00", "end": "09:00"}]
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS preferred_time_windows jsonb;
