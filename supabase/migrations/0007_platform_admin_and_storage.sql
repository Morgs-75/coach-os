-- Platform admins (you) who can access all orgs
CREATE TABLE IF NOT EXISTS public.platform_admins (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'admin' check (role in ('admin', 'support', 'readonly')),
  created_at timestamptz not null default now(),
  unique(user_id)
);

-- Function to check if user is platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = auth.uid()
  );
$$;

-- Platform admin can read all orgs
CREATE POLICY "platform admin reads all orgs" ON public.orgs
FOR SELECT USING (public.is_platform_admin());

-- Platform admin can read all clients
CREATE POLICY "platform admin reads all clients" ON public.clients
FOR SELECT USING (public.is_platform_admin());

-- Platform admin can read all subscriptions
CREATE POLICY "platform admin reads all subscriptions" ON public.subscriptions
FOR SELECT USING (public.is_platform_admin());

-- Platform admin can read all money_events
CREATE POLICY "platform admin reads all money_events" ON public.money_events
FOR SELECT USING (public.is_platform_admin());

-- Platform admin can read all org_members
CREATE POLICY "platform admin reads all org_members" ON public.org_members
FOR SELECT USING (public.is_platform_admin());

-- Platform metrics view for admin dashboard
CREATE OR REPLACE VIEW public.platform_metrics AS
SELECT
  (SELECT COUNT(*) FROM public.orgs) as total_orgs,
  (SELECT COUNT(*) FROM public.clients) as total_clients,
  (SELECT COUNT(*) FROM public.clients WHERE status = 'active') as active_clients,
  (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'active') as active_subscriptions,
  (SELECT COALESCE(SUM(amount_cents), 0) FROM public.money_events WHERE type = 'INCOME' AND event_date >= date_trunc('month', now())) as mtd_revenue_cents,
  (SELECT COALESCE(SUM(amount_cents), 0) FROM public.money_events WHERE type = 'INCOME' AND event_date >= date_trunc('month', now()) - interval '1 month' AND event_date < date_trunc('month', now())) as last_month_revenue_cents;

-- Storage buckets for photos
-- Note: Run these in Supabase dashboard Storage settings or via API
-- Bucket: avatars - for client profile photos
-- Bucket: progress-photos - for check-in progress photos

-- Photo attachments for activity events
ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS photo_paths text[];

-- Check-in photos table for detailed tracking
CREATE TABLE IF NOT EXISTS public.checkin_photos (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  activity_event_id uuid references public.activity_events(id) on delete cascade,
  storage_path text not null,
  photo_type text check (photo_type in ('front', 'side', 'back', 'other')),
  notes text,
  taken_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

ALTER TABLE public.checkin_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkin photos read by org members" ON public.checkin_photos
FOR SELECT USING (public.is_org_member(org_id) OR public.is_platform_admin());

CREATE POLICY "checkin photos insert by trainer" ON public.checkin_photos
FOR INSERT WITH CHECK (public.org_role(org_id) IN ('owner', 'staff'));

-- Client can view their own photos (for mobile app)
CREATE POLICY "checkin photos read by client" ON public.checkin_photos
FOR SELECT USING (
  client_id IN (
    SELECT id FROM public.clients
    WHERE auth_user_id = auth.uid()
  )
);

-- Client can upload their own photos
CREATE POLICY "checkin photos insert by client" ON public.checkin_photos
FOR INSERT WITH CHECK (
  client_id IN (
    SELECT id FROM public.clients
    WHERE auth_user_id = auth.uid()
  )
);

-- Add auth_user_id to clients for mobile app authentication
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS auth_user_id uuid references auth.users(id);

-- Client can read their own profile
CREATE POLICY "client reads own profile" ON public.clients
FOR SELECT USING (auth_user_id = auth.uid());

-- Client can update their own profile (limited fields)
CREATE POLICY "client updates own profile" ON public.clients
FOR UPDATE USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_clients_auth_user_id ON public.clients(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_checkin_photos_client_id ON public.checkin_photos(client_id);
CREATE INDEX IF NOT EXISTS idx_platform_admins_user_id ON public.platform_admins(user_id);
