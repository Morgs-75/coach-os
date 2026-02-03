-- Extended client profile fields
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say'));
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS height_cm numeric;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS weight_kg numeric;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS target_weight_kg numeric;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS goals text[];
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS health_conditions text[];
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS injuries text[];
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS medications text[];
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS dietary_restrictions text[];
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS experience_level text CHECK (experience_level IN ('beginner', 'intermediate', 'advanced'));
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS preferred_training_days text[];
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS emergency_contact_name text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS emergency_contact_phone text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS avatar_path text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address_line1 text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address_line2 text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS postcode text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS country text DEFAULT 'Australia';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- Common goals reference
CREATE TABLE IF NOT EXISTS public.goal_templates (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text not null,
  sort_order int not null default 0
);

INSERT INTO public.goal_templates (name, category, sort_order) VALUES
  ('Lose weight', 'body_composition', 1),
  ('Build muscle', 'body_composition', 2),
  ('Improve body composition', 'body_composition', 3),
  ('Increase strength', 'performance', 4),
  ('Improve endurance', 'performance', 5),
  ('Run a marathon', 'performance', 6),
  ('Improve flexibility', 'performance', 7),
  ('Better energy levels', 'lifestyle', 8),
  ('Improve sleep', 'lifestyle', 9),
  ('Reduce stress', 'lifestyle', 10),
  ('Build healthy habits', 'lifestyle', 11),
  ('Post-pregnancy fitness', 'lifestyle', 12),
  ('Sports performance', 'performance', 13),
  ('Injury rehabilitation', 'health', 14),
  ('Manage health condition', 'health', 15)
ON CONFLICT DO NOTHING;

-- Health conditions reference
CREATE TABLE IF NOT EXISTS public.health_condition_templates (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  requires_clearance boolean default false
);

INSERT INTO public.health_condition_templates (name, requires_clearance) VALUES
  ('Diabetes (Type 1)', true),
  ('Diabetes (Type 2)', true),
  ('High blood pressure', true),
  ('Heart condition', true),
  ('Asthma', false),
  ('Arthritis', false),
  ('Back pain', false),
  ('Joint issues', false),
  ('Pregnancy', true),
  ('Postpartum', false),
  ('Thyroid condition', false),
  ('Anxiety/Depression', false),
  ('Eating disorder history', true),
  ('None', false)
ON CONFLICT DO NOTHING;

-- Client intake form responses (for custom questions)
CREATE TABLE IF NOT EXISTS public.client_intake_responses (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  question text not null,
  answer text not null,
  created_at timestamptz not null default now()
);

ALTER TABLE public.client_intake_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intake read by members" ON public.client_intake_responses
FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY "intake insert by trainer" ON public.client_intake_responses
FOR INSERT WITH CHECK (public.org_role(org_id) IN ('owner', 'staff'));
