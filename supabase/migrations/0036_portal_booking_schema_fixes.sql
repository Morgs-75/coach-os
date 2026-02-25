-- Fix schema gaps discovered during portal booking flow testing.
-- Production DB was initialised from all_migrations.sql which differs from
-- individual migration files in two ways:
--   1. booking_settings uses allow_self_booking (not allow_client_booking)
--   2. availability table was not created
--   3. cancel_notice_hours column is missing from booking_settings

-- 1. Add availability table (required by booking page slot generator)
CREATE TABLE IF NOT EXISTS public.availability (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  specific_date date,
  is_available boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "availability read by anyone" ON public.availability
  FOR SELECT USING (true);

CREATE POLICY "availability managed by org members" ON public.availability
  FOR ALL USING (public.is_org_member(org_id));

CREATE INDEX IF NOT EXISTS idx_availability_org_id ON public.availability(org_id);
CREATE INDEX IF NOT EXISTS idx_availability_day ON public.availability(day_of_week);

-- 2. Add allow_client_booking alias (production has allow_self_booking)
--    Add as separate column and sync via trigger, OR just add the column
--    the portal code expects.
ALTER TABLE public.booking_settings
  ADD COLUMN IF NOT EXISTS allow_client_booking boolean
  GENERATED ALWAYS AS (allow_self_booking) STORED;

-- 3. Add cancel_notice_hours (portal dashboard uses this)
ALTER TABLE public.booking_settings
  ADD COLUMN IF NOT EXISTS cancel_notice_hours int DEFAULT 24;

-- 4. Add allow_client_cancel (used by portal cancel route)
ALTER TABLE public.booking_settings
  ADD COLUMN IF NOT EXISTS allow_client_cancel boolean DEFAULT true;
