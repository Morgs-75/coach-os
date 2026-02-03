-- Platform-as-merchant payment model
-- All payments go to platform, then paid out to PTs minus 5% commission

-- Remove Stripe Connect columns (not needed anymore)
ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS stripe_account_id;

-- Track payouts to each org
CREATE TABLE IF NOT EXISTS public.org_payouts (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  gross_amount_cents int not null,
  commission_cents int not null,
  net_amount_cents int not null,
  currency text not null default 'aud',
  status text not null default 'pending' check (status in ('pending', 'processing', 'paid', 'failed')),
  paid_at timestamptz,
  payout_method text, -- 'bank_transfer', 'paypal', etc.
  payout_reference text, -- bank transfer ref or PayPal transaction ID
  notes text,
  created_at timestamptz not null default now()
);

ALTER TABLE public.org_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payouts read by org owner" ON public.org_payouts
FOR SELECT USING (public.org_role(org_id) = 'owner' OR public.is_platform_admin());

CREATE POLICY "payouts managed by platform admin" ON public.org_payouts
FOR ALL USING (public.is_platform_admin());

-- Track which payments belong to which payout
ALTER TABLE public.money_events ADD COLUMN IF NOT EXISTS payout_id uuid references public.org_payouts(id);

-- Org payout settings (bank details)
CREATE TABLE IF NOT EXISTS public.org_payout_settings (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade unique,
  payout_method text not null default 'bank_transfer' check (payout_method in ('bank_transfer', 'paypal')),
  bank_account_name text,
  bank_bsb text,
  bank_account_number text,
  paypal_email text,
  minimum_payout_cents int not null default 5000, -- $50 minimum
  payout_frequency text not null default 'weekly' check (payout_frequency in ('weekly', 'fortnightly', 'monthly')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

ALTER TABLE public.org_payout_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payout settings read by org members" ON public.org_payout_settings
FOR SELECT USING (public.is_org_member(org_id) OR public.is_platform_admin());

CREATE POLICY "payout settings update by org owner" ON public.org_payout_settings
FOR UPDATE USING (public.org_role(org_id) = 'owner');

CREATE POLICY "payout settings insert by org owner" ON public.org_payout_settings
FOR INSERT WITH CHECK (public.org_role(org_id) = 'owner');

-- Platform commission rate (can be changed per org for special deals)
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS commission_rate numeric not null default 0.05;

-- Platform revenue tracking view
CREATE OR REPLACE VIEW public.platform_revenue AS
SELECT
  date_trunc('month', event_date) as month,
  SUM(amount_cents) as gross_revenue_cents,
  SUM(amount_cents * 0.05) as commission_cents,
  COUNT(*) as transaction_count
FROM public.money_events
WHERE type = 'INCOME' AND payment_status = 'succeeded'
GROUP BY date_trunc('month', event_date)
ORDER BY month DESC;

-- Org earnings view (what each PT has earned)
CREATE OR REPLACE VIEW public.org_earnings AS
SELECT
  o.id as org_id,
  o.name as org_name,
  COALESCE(SUM(CASE WHEN me.payment_status = 'succeeded' THEN me.amount_cents ELSE 0 END), 0) as gross_earnings_cents,
  COALESCE(SUM(CASE WHEN me.payment_status = 'succeeded' THEN me.amount_cents * o.commission_rate ELSE 0 END), 0) as commission_cents,
  COALESCE(SUM(CASE WHEN me.payment_status = 'succeeded' THEN me.amount_cents * (1 - o.commission_rate) ELSE 0 END), 0) as net_earnings_cents,
  COALESCE(SUM(CASE WHEN me.payout_id IS NOT NULL THEN me.amount_cents * (1 - o.commission_rate) ELSE 0 END), 0) as paid_out_cents,
  COALESCE(SUM(CASE WHEN me.payout_id IS NULL AND me.payment_status = 'succeeded' THEN me.amount_cents * (1 - o.commission_rate) ELSE 0 END), 0) as pending_payout_cents
FROM public.orgs o
LEFT JOIN public.money_events me ON me.org_id = o.id AND me.type = 'INCOME'
GROUP BY o.id, o.name;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_payouts_org_id ON public.org_payouts(org_id);
CREATE INDEX IF NOT EXISTS idx_org_payouts_status ON public.org_payouts(status);
CREATE INDEX IF NOT EXISTS idx_money_events_payout_id ON public.money_events(payout_id);
