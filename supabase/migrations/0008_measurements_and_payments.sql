-- Measurements/logs table for tracking various metrics
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

-- Common measurement types
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

-- RLS for measurements
ALTER TABLE public.client_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "measurements read by org members" ON public.client_measurements
FOR SELECT USING (public.is_org_member(org_id) OR public.is_platform_admin());

CREATE POLICY "measurements insert by org members" ON public.client_measurements
FOR INSERT WITH CHECK (public.is_org_member(org_id));

CREATE POLICY "measurements update by org members" ON public.client_measurements
FOR UPDATE USING (public.is_org_member(org_id));

CREATE POLICY "measurements delete by org members" ON public.client_measurements
FOR DELETE USING (public.is_org_member(org_id));

-- Client can view their own measurements
CREATE POLICY "measurements read by client" ON public.client_measurements
FOR SELECT USING (
  client_id IN (
    SELECT id FROM public.clients WHERE auth_user_id = auth.uid()
  )
);

-- Client can insert their own measurements
CREATE POLICY "measurements insert by client" ON public.client_measurements
FOR INSERT WITH CHECK (
  client_id IN (
    SELECT id FROM public.clients WHERE auth_user_id = auth.uid()
  )
);

-- Enhanced payment tracking
ALTER TABLE public.money_events ADD COLUMN IF NOT EXISTS payment_status text CHECK (payment_status IN ('succeeded', 'failed', 'pending', 'refunded'));
ALTER TABLE public.money_events ADD COLUMN IF NOT EXISTS failure_reason text;
ALTER TABLE public.money_events ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;
ALTER TABLE public.money_events ADD COLUMN IF NOT EXISTS stripe_invoice_id text;
ALTER TABLE public.money_events ADD COLUMN IF NOT EXISTS retry_count int default 0;
ALTER TABLE public.money_events ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

-- Payment attempts log for tracking retries
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

CREATE POLICY "payment attempts read by org members" ON public.payment_attempts
FOR SELECT USING (public.is_org_member(org_id) OR public.is_platform_admin());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_measurements_client_id ON public.client_measurements(client_id);
CREATE INDEX IF NOT EXISTS idx_client_measurements_type ON public.client_measurements(measurement_type);
CREATE INDEX IF NOT EXISTS idx_client_measurements_measured_at ON public.client_measurements(measured_at);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_client_id ON public.payment_attempts(client_id);
CREATE INDEX IF NOT EXISTS idx_money_events_payment_status ON public.money_events(payment_status);
