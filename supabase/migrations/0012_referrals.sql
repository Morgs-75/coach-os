-- Referral system for PTs
-- Each PT gets unique referral links, tracks who referred whom, and rewards

-- Referral links table
CREATE TABLE IF NOT EXISTS public.referral_links (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,

  -- Unique code for the link
  code text not null unique,

  -- Link settings
  name text not null, -- e.g., "Instagram Bio", "Facebook Group"
  description text,

  -- Reward settings
  reward_type text default 'discount' check (reward_type in ('discount', 'free_session', 'credit', 'none')),
  reward_value int, -- percentage discount, or cents for credit
  referrer_reward_type text default 'credit' check (referrer_reward_type in ('credit', 'free_session', 'none')),
  referrer_reward_value int, -- cents for credit

  -- Tracking
  clicks int default 0,
  signups int default 0,
  conversions int default 0, -- became paying clients

  -- Status
  is_active boolean default true,
  expires_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

ALTER TABLE public.referral_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referral links read by anyone" ON public.referral_links
FOR SELECT USING (true);

CREATE POLICY "referral links managed by org members" ON public.referral_links
FOR ALL USING (public.is_org_member(org_id));

-- Referrals tracking (who referred whom)
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,

  -- The referral link used
  referral_link_id uuid not null references public.referral_links(id) on delete cascade,

  -- The referrer (existing client)
  referrer_client_id uuid references public.clients(id) on delete set null,

  -- The referred person
  referred_email text not null,
  referred_name text,
  referred_client_id uuid references public.clients(id) on delete set null, -- once they become a client

  -- Status
  status text not null default 'pending' check (status in ('pending', 'signed_up', 'converted', 'rewarded', 'expired')),

  -- Reward tracking
  referrer_rewarded boolean default false,
  referrer_reward_cents int,
  referred_rewarded boolean default false,
  referred_reward_cents int,

  -- Timestamps
  clicked_at timestamptz not null default now(),
  signed_up_at timestamptz,
  converted_at timestamptz, -- when they made first payment
  rewarded_at timestamptz,

  created_at timestamptz not null default now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals read by org members" ON public.referrals
FOR SELECT USING (public.is_org_member(org_id) OR public.is_platform_admin());

CREATE POLICY "referrals managed by org members" ON public.referrals
FOR ALL USING (public.is_org_member(org_id));

-- Add referral source to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS referral_id uuid references public.referrals(id);
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS referral_code text;

-- Add referral source to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS referral_id uuid references public.referrals(id);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS referral_code text;

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code(p_org_id uuid, p_length int default 8)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_code text;
  v_exists boolean;
BEGIN
  LOOP
    -- Generate random alphanumeric code
    v_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for p_length));

    -- Check if it exists
    SELECT EXISTS(SELECT 1 FROM public.referral_links WHERE code = v_code) INTO v_exists;

    IF NOT v_exists THEN
      RETURN v_code;
    END IF;
  END LOOP;
END;
$$;

-- Function to track referral click
CREATE OR REPLACE FUNCTION public.track_referral_click(p_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_link_id uuid;
BEGIN
  -- Find the link and increment clicks
  UPDATE public.referral_links
  SET clicks = clicks + 1
  WHERE code = p_code AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  RETURNING id INTO v_link_id;

  RETURN v_link_id;
END;
$$;

-- Function to process referral signup
CREATE OR REPLACE FUNCTION public.process_referral_signup(
  p_code text,
  p_email text,
  p_name text default null
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_link record;
  v_referral_id uuid;
BEGIN
  -- Get the referral link
  SELECT * INTO v_link
  FROM public.referral_links
  WHERE code = p_code AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());

  IF v_link IS NULL THEN
    RETURN NULL;
  END IF;

  -- Create referral record
  INSERT INTO public.referrals (
    org_id,
    referral_link_id,
    referred_email,
    referred_name,
    status,
    signed_up_at
  ) VALUES (
    v_link.org_id,
    v_link.id,
    p_email,
    p_name,
    'signed_up',
    now()
  )
  RETURNING id INTO v_referral_id;

  -- Update link stats
  UPDATE public.referral_links
  SET signups = signups + 1
  WHERE id = v_link.id;

  RETURN v_referral_id;
END;
$$;

-- View for referral stats per org
CREATE OR REPLACE VIEW public.referral_stats AS
SELECT
  rl.org_id,
  rl.id as link_id,
  rl.name as link_name,
  rl.code,
  rl.clicks,
  rl.signups,
  rl.conversions,
  CASE WHEN rl.clicks > 0 THEN (rl.signups::float / rl.clicks * 100) ELSE 0 END as signup_rate,
  CASE WHEN rl.signups > 0 THEN (rl.conversions::float / rl.signups * 100) ELSE 0 END as conversion_rate,
  rl.is_active,
  rl.created_at
FROM public.referral_links rl
ORDER BY rl.created_at DESC;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_referral_links_org_id ON public.referral_links(org_id);
CREATE INDEX IF NOT EXISTS idx_referral_links_code ON public.referral_links(code);
CREATE INDEX IF NOT EXISTS idx_referrals_org_id ON public.referrals(org_id);
CREATE INDEX IF NOT EXISTS idx_referrals_link_id ON public.referrals(referral_link_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_email ON public.referrals(referred_email);
