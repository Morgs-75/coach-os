-- Apply previously missing migrations: measurements (0008), referrals (0012),
-- and create generated_newsletters table (was used in code but never migrated).

-- ============================================================
-- FROM 0008: client_measurements + measurement_types
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_measurements (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  measurement_type text not null,
  value numeric not null,
  unit text not null,
  notes text,
  measured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.measurement_types (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  unit text not null,
  category text not null,
  sort_order int default 0
);

INSERT INTO public.measurement_types (name, unit, category, sort_order) VALUES
  ('Weight', 'kg', 'body', 1),
  ('Body Fat %', '%', 'body', 2),
  ('Chest', 'cm', 'circumference', 3),
  ('Waist', 'cm', 'circumference', 4),
  ('Hips', 'cm', 'circumference', 5),
  ('Left Arm', 'cm', 'circumference', 6),
  ('Right Arm', 'cm', 'circumference', 7),
  ('Left Thigh', 'cm', 'circumference', 8),
  ('Right Thigh', 'cm', 'circumference', 9),
  ('Left Calf', 'cm', 'circumference', 10),
  ('Right Calf', 'cm', 'circumference', 11),
  ('Neck', 'cm', 'circumference', 12),
  ('Shoulders', 'cm', 'circumference', 13),
  ('Resting Heart Rate', 'bpm', 'vitals', 14),
  ('Blood Pressure Systolic', 'mmHg', 'vitals', 15),
  ('Blood Pressure Diastolic', 'mmHg', 'vitals', 16),
  ('Bench Press 1RM', 'kg', 'strength', 17),
  ('Squat 1RM', 'kg', 'strength', 18),
  ('Deadlift 1RM', 'kg', 'strength', 19),
  ('5K Run Time', 'min', 'cardio', 20),
  ('VO2 Max', 'ml/kg/min', 'cardio', 21)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.client_measurements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "measurements read by org members" ON public.client_measurements
  FOR SELECT USING (public.is_org_member(org_id) OR public.is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "measurements insert by org members" ON public.client_measurements
  FOR INSERT WITH CHECK (public.is_org_member(org_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "measurements update by org members" ON public.client_measurements
  FOR UPDATE USING (public.is_org_member(org_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "measurements delete by org members" ON public.client_measurements
  FOR DELETE USING (public.is_org_member(org_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  money_event_id uuid references public.money_events(id) on delete cascade,
  stripe_payment_intent_id text,
  amount_cents int not null,
  currency text not null default 'aud',
  status text not null check (status in ('succeeded', 'failed', 'pending', 'requires_action')),
  failure_code text,
  failure_message text,
  attempted_at timestamptz not null default now()
);

ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "payment attempts read by org members" ON public.payment_attempts
  FOR SELECT USING (public.is_org_member(org_id) OR public.is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.money_events ADD COLUMN IF NOT EXISTS payment_status text CHECK (payment_status IN ('succeeded', 'failed', 'pending', 'refunded'));
ALTER TABLE public.money_events ADD COLUMN IF NOT EXISTS failure_reason text;
ALTER TABLE public.money_events ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;
ALTER TABLE public.money_events ADD COLUMN IF NOT EXISTS stripe_invoice_id text;
ALTER TABLE public.money_events ADD COLUMN IF NOT EXISTS retry_count int default 0;
ALTER TABLE public.money_events ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_client_measurements_client_id ON public.client_measurements(client_id);
CREATE INDEX IF NOT EXISTS idx_client_measurements_type ON public.client_measurements(measurement_type);
CREATE INDEX IF NOT EXISTS idx_client_measurements_measured_at ON public.client_measurements(measured_at);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_client_id ON public.payment_attempts(client_id);
CREATE INDEX IF NOT EXISTS idx_money_events_payment_status ON public.money_events(payment_status);

-- ============================================================
-- FROM 0012: referral_links + referrals
-- (skips leads table which doesn't exist in this schema)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.referral_links (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  code text not null unique,
  name text not null,
  description text,
  reward_type text default 'discount' check (reward_type in ('discount', 'free_session', 'credit', 'none')),
  reward_value int,
  referrer_reward_type text default 'credit' check (referrer_reward_type in ('credit', 'free_session', 'none')),
  referrer_reward_value int,
  clicks int default 0,
  signups int default 0,
  conversions int default 0,
  is_active boolean default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

ALTER TABLE public.referral_links ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "referral links read by anyone" ON public.referral_links
  FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "referral links managed by org members" ON public.referral_links
  FOR ALL USING (public.is_org_member(org_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  referral_link_id uuid not null references public.referral_links(id) on delete cascade,
  referrer_client_id uuid references public.clients(id) on delete set null,
  referred_email text not null,
  referred_name text,
  referred_client_id uuid references public.clients(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'signed_up', 'converted', 'rewarded', 'expired')),
  referrer_rewarded boolean default false,
  referrer_reward_cents int,
  referred_rewarded boolean default false,
  referred_reward_cents int,
  clicked_at timestamptz not null default now(),
  signed_up_at timestamptz,
  converted_at timestamptz,
  rewarded_at timestamptz,
  created_at timestamptz not null default now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "referrals read by org members" ON public.referrals
  FOR SELECT USING (public.is_org_member(org_id) OR public.is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "referrals managed by org members" ON public.referrals
  FOR ALL USING (public.is_org_member(org_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS referral_id uuid references public.referrals(id);
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS referral_code text;

CREATE OR REPLACE FUNCTION public.generate_referral_code(p_org_id uuid, p_length int default 8)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_code text; v_exists boolean;
BEGIN
  LOOP
    v_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for p_length));
    SELECT EXISTS(SELECT 1 FROM public.referral_links WHERE code = v_code) INTO v_exists;
    IF NOT v_exists THEN RETURN v_code; END IF;
  END LOOP;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_referral_links_org_id ON public.referral_links(org_id);
CREATE INDEX IF NOT EXISTS idx_referral_links_code ON public.referral_links(code);
CREATE INDEX IF NOT EXISTS idx_referrals_org_id ON public.referrals(org_id);
CREATE INDEX IF NOT EXISTS idx_referrals_link_id ON public.referrals(referral_link_id);

-- ============================================================
-- generated_newsletters (newsletter AI feature, no prior migration)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.generated_newsletters (
  id uuid primary key default uuid_generate_v4(),
  subject text not null,
  preheader text,
  theme text,
  audience_level text,
  frequency text,
  angle_used text,
  sections jsonb,
  call_to_action jsonb,
  status text not null default 'draft' check (status in ('draft', 'approved', 'sent')),
  generated_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

ALTER TABLE public.generated_newsletters ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "newsletters read by platform admins" ON public.generated_newsletters
  FOR SELECT USING (public.is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "newsletters managed by platform admins" ON public.generated_newsletters
  FOR ALL USING (public.is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
