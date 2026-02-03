-- Flexible pricing/offers system for PTs
-- Supports: subscriptions, session packs, single sessions, packages with bonuses

CREATE TABLE IF NOT EXISTS public.offers (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  description text,
  offer_type text not null check (offer_type in ('subscription', 'session_pack', 'single_session')),

  -- Pricing
  price_cents int not null,
  currency text not null default 'aud',

  -- Subscription options (when offer_type = 'subscription')
  billing_period text check (billing_period in ('weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly')),

  -- Session pack options (when offer_type = 'session_pack')
  sessions_included int, -- e.g., 10 for a 10-pack
  bonus_sessions int default 0, -- e.g., 1 for "buy 10 get 1 free"
  pack_validity_days int, -- how long the pack is valid (null = never expires)

  -- Single session (when offer_type = 'single_session')
  session_duration_mins int default 60,

  -- Display
  is_featured boolean default false,
  sort_order int default 0,
  is_active boolean default true,

  -- Stripe
  stripe_price_id text,
  stripe_product_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "offers read by anyone" ON public.offers
FOR SELECT USING (true); -- Public so clients can see pricing

CREATE POLICY "offers managed by org owner" ON public.offers
FOR ALL USING (public.org_role(org_id) IN ('owner', 'staff'));

-- Client purchases (for session packs and single sessions)
CREATE TABLE IF NOT EXISTS public.client_purchases (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  offer_id uuid not null references public.offers(id),

  -- Purchase details
  amount_paid_cents int not null,
  currency text not null default 'aud',

  -- Session tracking (for packs)
  sessions_total int, -- total sessions (including bonus)
  sessions_used int default 0,
  sessions_remaining int generated always as (sessions_total - sessions_used) stored,

  -- Validity
  purchased_at timestamptz not null default now(),
  expires_at timestamptz, -- when the pack expires

  -- Payment
  stripe_payment_intent_id text,
  payment_status text default 'pending' check (payment_status in ('pending', 'succeeded', 'failed', 'refunded')),

  created_at timestamptz not null default now()
);

ALTER TABLE public.client_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchases read by org members" ON public.client_purchases
FOR SELECT USING (public.is_org_member(org_id) OR public.is_platform_admin());

CREATE POLICY "purchases insert by org members" ON public.client_purchases
FOR INSERT WITH CHECK (public.is_org_member(org_id));

CREATE POLICY "purchases update by org members" ON public.client_purchases
FOR UPDATE USING (public.is_org_member(org_id));

-- Client can view their own purchases
CREATE POLICY "purchases read by client" ON public.client_purchases
FOR SELECT USING (
  client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
);

-- Session usage log (track when sessions are used)
CREATE TABLE IF NOT EXISTS public.session_usage (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  purchase_id uuid references public.client_purchases(id),
  subscription_id uuid references public.subscriptions(id),

  session_date date not null,
  session_type text, -- 'pt_session', 'group_class', etc.
  notes text,

  -- If from a pack, decrement the sessions
  created_at timestamptz not null default now()
);

ALTER TABLE public.session_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session usage read by org members" ON public.session_usage
FOR SELECT USING (public.is_org_member(org_id) OR public.is_platform_admin());

CREATE POLICY "session usage insert by org members" ON public.session_usage
FOR INSERT WITH CHECK (public.is_org_member(org_id));

-- Update subscriptions table to link to offers
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS offer_id uuid references public.offers(id);

-- Function to use a session from a pack
CREATE OR REPLACE FUNCTION public.use_session(p_purchase_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sessions_remaining int;
  v_expires_at timestamptz;
BEGIN
  -- Get current state
  SELECT sessions_remaining, expires_at INTO v_sessions_remaining, v_expires_at
  FROM public.client_purchases
  WHERE id = p_purchase_id;

  -- Check if valid
  IF v_sessions_remaining IS NULL OR v_sessions_remaining <= 0 THEN
    RETURN false;
  END IF;

  -- Check if expired
  IF v_expires_at IS NOT NULL AND v_expires_at < now() THEN
    RETURN false;
  END IF;

  -- Use session
  UPDATE public.client_purchases
  SET sessions_used = sessions_used + 1
  WHERE id = p_purchase_id;

  RETURN true;
END;
$$;

-- View for client's active sessions/subscriptions
CREATE OR REPLACE VIEW public.client_session_balance AS
SELECT
  c.id as client_id,
  c.org_id,
  c.full_name,
  -- Active subscription
  (SELECT s.status FROM public.subscriptions s WHERE s.client_id = c.id ORDER BY s.created_at DESC LIMIT 1) as subscription_status,
  -- Session packs
  COALESCE(
    (SELECT SUM(cp.sessions_remaining)
     FROM public.client_purchases cp
     JOIN public.offers o ON o.id = cp.offer_id
     WHERE cp.client_id = c.id
     AND cp.payment_status = 'succeeded'
     AND o.offer_type = 'session_pack'
     AND (cp.expires_at IS NULL OR cp.expires_at > now())
    ), 0
  ) as sessions_remaining,
  -- Total sessions used
  (SELECT COUNT(*) FROM public.session_usage su WHERE su.client_id = c.id) as total_sessions_used
FROM public.clients c;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_offers_org_id ON public.offers(org_id);
CREATE INDEX IF NOT EXISTS idx_offers_is_active ON public.offers(is_active);
CREATE INDEX IF NOT EXISTS idx_client_purchases_client_id ON public.client_purchases(client_id);
CREATE INDEX IF NOT EXISTS idx_client_purchases_offer_id ON public.client_purchases(offer_id);
CREATE INDEX IF NOT EXISTS idx_session_usage_client_id ON public.session_usage(client_id);
CREATE INDEX IF NOT EXISTS idx_session_usage_purchase_id ON public.session_usage(purchase_id);
