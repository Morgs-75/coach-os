-- Promo codes for offers/pricing
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  code text not null,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric not null,
  valid_from date,
  valid_until date,
  max_uses int,
  times_used int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Each code must be unique within an org
  UNIQUE(org_id, code)
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promo_codes read by org members" ON public.promo_codes
FOR SELECT USING (public.is_org_member(org_id) OR public.is_platform_admin());

CREATE POLICY "promo_codes managed by org owner" ON public.promo_codes
FOR ALL USING (public.org_role(org_id) IN ('owner', 'staff'));

-- Clients can validate a promo code (read-only by code)
CREATE POLICY "promo_codes validate by anyone" ON public.promo_codes
FOR SELECT USING (is_active = true);

CREATE INDEX IF NOT EXISTS idx_promo_codes_org_id ON public.promo_codes(org_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON public.promo_codes(org_id, code);

-- Link promo codes to purchases
ALTER TABLE public.client_purchases ADD COLUMN IF NOT EXISTS promo_code_id uuid references public.promo_codes(id);
ALTER TABLE public.client_purchases ADD COLUMN IF NOT EXISTS discount_cents int default 0;
