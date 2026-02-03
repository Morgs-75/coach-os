-- Calendar and booking system for PTs
-- Supports: PT-created bookings, client self-booking, recurring availability

-- PT availability windows (when they're available to take bookings)
CREATE TABLE IF NOT EXISTS public.availability (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, -- the PT

  -- Recurring availability (e.g., Mon 9am-5pm)
  day_of_week int not null check (day_of_week between 0 and 6), -- 0=Sunday, 6=Saturday
  start_time time not null,
  end_time time not null,

  -- Optional: specific date override (for holidays, special hours)
  specific_date date,
  is_available boolean default true, -- false = blocked/unavailable

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "availability read by anyone" ON public.availability
FOR SELECT USING (true); -- Clients need to see when PT is available

CREATE POLICY "availability managed by org members" ON public.availability
FOR ALL USING (public.is_org_member(org_id));

-- Bookings/appointments
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,

  -- When
  start_time timestamptz not null,
  end_time timestamptz not null,
  duration_mins int not null default 60,

  -- What type of session
  offer_id uuid references public.offers(id), -- links to pricing
  session_type text not null default 'pt_session', -- 'pt_session', 'group_class', 'assessment', 'consultation'

  -- If using a session pack
  purchase_id uuid references public.client_purchases(id),

  -- Location
  location_type text not null default 'in_person' check (location_type in ('in_person', 'online', 'outdoor')),
  location_details text, -- address, video link, park name, etc.

  -- Status
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id),
  cancellation_reason text,

  -- Who booked it
  booked_by uuid not null references auth.users(id), -- PT or client
  booking_source text not null default 'trainer' check (booking_source in ('trainer', 'client', 'system')),

  -- Notes
  notes text,
  client_notes text, -- notes from client when they book

  -- Reminders
  reminder_sent boolean default false,
  reminder_24h_sent boolean default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookings read by org members" ON public.bookings
FOR SELECT USING (public.is_org_member(org_id) OR public.is_platform_admin());

CREATE POLICY "bookings managed by org members" ON public.bookings
FOR ALL USING (public.is_org_member(org_id));

-- Clients can view their own bookings
CREATE POLICY "bookings read by client" ON public.bookings
FOR SELECT USING (
  client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
);

-- Clients can create bookings (self-book)
CREATE POLICY "bookings insert by client" ON public.bookings
FOR INSERT WITH CHECK (
  client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
);

-- Clients can cancel their own bookings
CREATE POLICY "bookings update by client" ON public.bookings
FOR UPDATE USING (
  client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
);

-- Recurring booking templates (for weekly sessions)
CREATE TABLE IF NOT EXISTS public.recurring_bookings (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,

  -- When (recurring)
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  duration_mins int not null default 60,

  -- Type
  offer_id uuid references public.offers(id),
  session_type text not null default 'pt_session',
  location_type text not null default 'in_person',
  location_details text,

  -- Active period
  start_date date not null default current_date,
  end_date date, -- null = ongoing
  is_active boolean default true,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

ALTER TABLE public.recurring_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring bookings read by org members" ON public.recurring_bookings
FOR SELECT USING (public.is_org_member(org_id) OR public.is_platform_admin());

CREATE POLICY "recurring bookings managed by org members" ON public.recurring_bookings
FOR ALL USING (public.is_org_member(org_id));

-- Client booking settings (per org - can clients self-book?)
CREATE TABLE IF NOT EXISTS public.booking_settings (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade unique,

  -- Self-booking options
  allow_client_booking boolean default true,
  min_notice_hours int default 24, -- minimum hours in advance
  max_advance_days int default 30, -- how far in advance can they book

  -- Cancellation policy
  allow_client_cancel boolean default true,
  cancel_notice_hours int default 24, -- minimum hours notice for cancellation

  -- Booking slots
  slot_duration_mins int default 60,
  buffer_between_mins int default 15, -- buffer between appointments

  -- Notifications
  send_confirmation_email boolean default true,
  send_reminder_24h boolean default true,
  send_reminder_1h boolean default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

ALTER TABLE public.booking_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "booking settings read by anyone" ON public.booking_settings
FOR SELECT USING (true); -- Clients need to know the rules

CREATE POLICY "booking settings managed by org members" ON public.booking_settings
FOR ALL USING (public.is_org_member(org_id));

-- Function to check if a time slot is available
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
  -- Check for conflicting bookings
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

-- View for upcoming bookings
CREATE OR REPLACE VIEW public.upcoming_bookings AS
SELECT
  b.*,
  c.full_name as client_name,
  c.email as client_email,
  c.phone as client_phone,
  o.name as offer_name,
  o.price_cents as offer_price_cents
FROM public.bookings b
JOIN public.clients c ON c.id = b.client_id
LEFT JOIN public.offers o ON o.id = b.offer_id
WHERE b.start_time >= now()
  AND b.status NOT IN ('cancelled')
ORDER BY b.start_time ASC;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_availability_org_id ON public.availability(org_id);
CREATE INDEX IF NOT EXISTS idx_availability_day_of_week ON public.availability(day_of_week);
CREATE INDEX IF NOT EXISTS idx_bookings_org_id ON public.bookings(org_id);
CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON public.bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_start_time ON public.bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_recurring_bookings_org_id ON public.recurring_bookings(org_id);
CREATE INDEX IF NOT EXISTS idx_recurring_bookings_client_id ON public.recurring_bookings(client_id);
