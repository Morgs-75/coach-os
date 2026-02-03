-- myAccounts Cashbook Feature
-- Bank connection, transaction coding, AI categorization, P&L/Ledger views

-- =====================
-- BASIQ CONNECTIONS
-- =====================
CREATE TABLE IF NOT EXISTS public.basiq_connections (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade unique,
  basiq_user_id text not null,
  consent_id text,
  consent_status text default 'pending' check (consent_status in ('pending', 'active', 'expired', 'revoked')),
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

ALTER TABLE public.basiq_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "basiq_connections read by org members" ON public.basiq_connections
FOR SELECT USING (public.is_org_member(org_id) OR public.is_platform_admin());

CREATE POLICY "basiq_connections manage by org owner" ON public.basiq_connections
FOR ALL USING (public.org_role(org_id) = 'owner');

-- =====================
-- BANK ACCOUNTS
-- =====================
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  basiq_account_id text not null,
  institution_name text not null,
  account_name text not null,
  account_number_masked text, -- e.g. "****1234"
  bsb text,
  account_type text, -- 'transaction', 'savings', 'credit'
  currency text not null default 'AUD',
  current_balance_cents int,
  available_balance_cents int,
  is_active boolean not null default true,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, basiq_account_id)
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_accounts read by org members" ON public.bank_accounts
FOR SELECT USING (public.is_org_member(org_id) OR public.is_platform_admin());

CREATE POLICY "bank_accounts manage by org owner" ON public.bank_accounts
FOR ALL USING (public.org_role(org_id) = 'owner');

CREATE INDEX IF NOT EXISTS idx_bank_accounts_org_id ON public.bank_accounts(org_id);

-- =====================
-- CHART OF ACCOUNTS
-- =====================
CREATE TYPE account_category AS ENUM ('income', 'expense', 'other');
CREATE TYPE tax_treatment AS ENUM ('gst', 'gst_free', 'bas_excluded');

CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references public.orgs(id) on delete cascade, -- null = system preset
  code text not null,
  name text not null,
  category account_category not null,
  tax_treatment tax_treatment not null default 'gst',
  is_system boolean not null default false,
  is_active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  unique(org_id, code)
);

ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

-- System accounts visible to all, org accounts visible to org members
CREATE POLICY "chart_of_accounts read" ON public.chart_of_accounts
FOR SELECT USING (
  org_id IS NULL -- system accounts
  OR public.is_org_member(org_id)
  OR public.is_platform_admin()
);

CREATE POLICY "chart_of_accounts manage by org owner" ON public.chart_of_accounts
FOR ALL USING (org_id IS NOT NULL AND public.org_role(org_id) = 'owner');

-- =====================
-- BANK TRANSACTIONS
-- =====================
CREATE TYPE transaction_status AS ENUM ('uncoded', 'ai_suggested', 'coded', 'excluded');
CREATE TYPE transaction_direction AS ENUM ('credit', 'debit');

CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  bank_account_id uuid not null references public.bank_accounts(id) on delete cascade,
  basiq_transaction_id text not null,

  -- Transaction details
  transaction_date date not null,
  post_date date,
  amount_cents int not null, -- always positive
  direction transaction_direction not null,
  description text not null,
  merchant_name text,
  merchant_category text,
  reference text,

  -- Coding
  status transaction_status not null default 'uncoded',
  account_id uuid references public.chart_of_accounts(id),
  is_split boolean not null default false,

  -- AI categorization
  ai_suggested_account_id uuid references public.chart_of_accounts(id),
  ai_confidence numeric(3,2), -- 0.00 to 1.00
  ai_reasoning text,

  -- Platform matching
  matched_money_event_id uuid references public.money_events(id),
  match_type text, -- 'exact', 'fuzzy', 'aggregated'

  -- Tax
  tax_treatment tax_treatment,
  gst_cents int default 0,

  -- Notes
  notes text,
  coded_by uuid references auth.users(id),
  coded_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, basiq_transaction_id)
);

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_transactions read by org members" ON public.bank_transactions
FOR SELECT USING (public.is_org_member(org_id) OR public.is_platform_admin());

CREATE POLICY "bank_transactions manage by org members" ON public.bank_transactions
FOR ALL USING (public.is_org_member(org_id));

CREATE INDEX IF NOT EXISTS idx_bank_transactions_org_id ON public.bank_transactions(org_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_bank_account_id ON public.bank_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_transaction_date ON public.bank_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_status ON public.bank_transactions(status);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_account_id ON public.bank_transactions(account_id);

-- =====================
-- BANK TRANSACTION SPLITS
-- =====================
CREATE TABLE IF NOT EXISTS public.bank_transaction_splits (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  transaction_id uuid not null references public.bank_transactions(id) on delete cascade,
  account_id uuid not null references public.chart_of_accounts(id),
  amount_cents int not null,
  tax_treatment tax_treatment not null default 'gst',
  gst_cents int default 0,
  description text,
  created_at timestamptz not null default now()
);

ALTER TABLE public.bank_transaction_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_transaction_splits read by org members" ON public.bank_transaction_splits
FOR SELECT USING (public.is_org_member(org_id) OR public.is_platform_admin());

CREATE POLICY "bank_transaction_splits manage by org members" ON public.bank_transaction_splits
FOR ALL USING (public.is_org_member(org_id));

CREATE INDEX IF NOT EXISTS idx_bank_transaction_splits_transaction_id ON public.bank_transaction_splits(transaction_id);

-- =====================
-- CODING RULES
-- =====================
CREATE TABLE IF NOT EXISTS public.coding_rules (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  priority int not null default 0, -- higher = applied first

  -- Match conditions
  match_description text, -- regex or contains
  match_merchant text,
  match_amount_min_cents int,
  match_amount_max_cents int,
  match_direction transaction_direction,

  -- Action
  account_id uuid not null references public.chart_of_accounts(id),
  tax_treatment tax_treatment,
  auto_apply boolean not null default false, -- if true, auto-code on sync

  -- Stats
  times_applied int not null default 0,
  last_applied_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

ALTER TABLE public.coding_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coding_rules read by org members" ON public.coding_rules
FOR SELECT USING (public.is_org_member(org_id) OR public.is_platform_admin());

CREATE POLICY "coding_rules manage by org owner" ON public.coding_rules
FOR ALL USING (public.org_role(org_id) = 'owner');

CREATE INDEX IF NOT EXISTS idx_coding_rules_org_id ON public.coding_rules(org_id);

-- =====================
-- VIEWS
-- =====================

-- P&L Summary View
CREATE OR REPLACE VIEW public.cashbook_pnl AS
SELECT
  bt.org_id,
  date_trunc('month', bt.transaction_date)::date as period,
  coa.category,
  coa.id as account_id,
  coa.code as account_code,
  coa.name as account_name,
  SUM(CASE WHEN bt.direction = 'credit' THEN bt.amount_cents ELSE -bt.amount_cents END) as net_cents,
  SUM(bt.gst_cents) as gst_cents,
  COUNT(*) as transaction_count
FROM public.bank_transactions bt
JOIN public.chart_of_accounts coa ON bt.account_id = coa.id
WHERE bt.status = 'coded' AND coa.category IN ('income', 'expense')
GROUP BY bt.org_id, date_trunc('month', bt.transaction_date), coa.category, coa.id, coa.code, coa.name;

-- General Ledger View
CREATE OR REPLACE VIEW public.cashbook_ledger AS
SELECT
  bt.id,
  bt.org_id,
  bt.transaction_date,
  ba.account_name as bank_account_name,
  bt.description,
  bt.merchant_name,
  bt.direction,
  bt.amount_cents,
  bt.gst_cents,
  coa.code as account_code,
  coa.name as account_name,
  coa.category as account_category,
  bt.status,
  bt.notes,
  bt.matched_money_event_id,
  bt.match_type
FROM public.bank_transactions bt
JOIN public.bank_accounts ba ON bt.bank_account_id = ba.id
LEFT JOIN public.chart_of_accounts coa ON bt.account_id = coa.id
WHERE bt.status = 'coded';

-- Uncoded Summary View
CREATE OR REPLACE VIEW public.cashbook_uncoded_summary AS
SELECT
  bt.org_id,
  COUNT(*) FILTER (WHERE bt.status = 'uncoded') as uncoded_count,
  COUNT(*) FILTER (WHERE bt.status = 'ai_suggested') as ai_suggested_count,
  SUM(bt.amount_cents) FILTER (WHERE bt.status = 'uncoded') as uncoded_amount_cents,
  SUM(bt.amount_cents) FILTER (WHERE bt.status = 'ai_suggested') as ai_suggested_amount_cents,
  MIN(bt.transaction_date) FILTER (WHERE bt.status IN ('uncoded', 'ai_suggested')) as oldest_uncoded_date
FROM public.bank_transactions bt
GROUP BY bt.org_id;

-- =====================
-- SEED PT-SPECIFIC CHART OF ACCOUNTS
-- =====================

-- Income accounts
INSERT INTO public.chart_of_accounts (org_id, code, name, category, tax_treatment, is_system, display_order) VALUES
(null, 'INC-001', 'Client Training Income', 'income', 'gst', true, 10),
(null, 'INC-002', 'PT Sessions', 'income', 'gst', true, 20),
(null, 'INC-003', 'Group Classes', 'income', 'gst', true, 30),
(null, 'INC-004', 'Online Coaching', 'income', 'gst', true, 40),
(null, 'INC-005', 'Nutrition Plans', 'income', 'gst', true, 50),
(null, 'INC-006', 'Merchandise Sales', 'income', 'gst', true, 60),
(null, 'INC-007', 'Supplement Sales', 'income', 'gst', true, 70),
(null, 'INC-008', 'Other Income', 'income', 'gst', true, 80)
ON CONFLICT DO NOTHING;

-- Expense accounts
INSERT INTO public.chart_of_accounts (org_id, code, name, category, tax_treatment, is_system, display_order) VALUES
(null, 'EXP-001', 'Equipment & Supplies', 'expense', 'gst', true, 100),
(null, 'EXP-002', 'Gym Rent / Space Hire', 'expense', 'gst', true, 110),
(null, 'EXP-003', 'Insurance', 'expense', 'gst_free', true, 120),
(null, 'EXP-004', 'Marketing & Social Media Ads', 'expense', 'gst', true, 130),
(null, 'EXP-005', 'Professional Development', 'expense', 'gst', true, 140),
(null, 'EXP-006', 'Software Subscriptions', 'expense', 'gst', true, 150),
(null, 'EXP-007', 'Bank Fees', 'expense', 'gst_free', true, 160),
(null, 'EXP-008', 'Motor Vehicle', 'expense', 'gst', true, 170),
(null, 'EXP-009', 'Utilities', 'expense', 'gst', true, 180),
(null, 'EXP-010', 'Cost of Goods Sold', 'expense', 'gst', true, 190),
(null, 'EXP-011', 'Accounting & Legal', 'expense', 'gst', true, 200),
(null, 'EXP-012', 'Phone & Internet', 'expense', 'gst', true, 210),
(null, 'EXP-013', 'Other Expenses', 'expense', 'gst', true, 220)
ON CONFLICT DO NOTHING;

-- Other accounts (non-P&L)
INSERT INTO public.chart_of_accounts (org_id, code, name, category, tax_treatment, is_system, display_order) VALUES
(null, 'OTH-001', 'Owner Drawings', 'other', 'bas_excluded', true, 300),
(null, 'OTH-002', 'Bank Transfers', 'other', 'bas_excluded', true, 310),
(null, 'OTH-003', 'Personal / Exclude', 'other', 'bas_excluded', true, 320),
(null, 'OTH-004', 'Loan Repayments', 'other', 'bas_excluded', true, 330),
(null, 'OTH-005', 'GST Payments', 'other', 'bas_excluded', true, 340)
ON CONFLICT DO NOTHING;

-- =====================
-- FUNCTIONS
-- =====================

-- Function to calculate GST from amount (assumes GST-inclusive)
CREATE OR REPLACE FUNCTION calculate_gst_cents(amount_cents int, tax_treatment tax_treatment)
RETURNS int AS $$
BEGIN
  IF tax_treatment = 'gst' THEN
    RETURN ROUND(amount_cents::numeric / 11);
  ELSE
    RETURN 0;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to auto-apply coding rules
CREATE OR REPLACE FUNCTION apply_coding_rules(p_transaction_id uuid)
RETURNS void AS $$
DECLARE
  v_transaction record;
  v_rule record;
BEGIN
  SELECT * INTO v_transaction FROM public.bank_transactions WHERE id = p_transaction_id;

  IF v_transaction IS NULL THEN
    RETURN;
  END IF;

  -- Find matching rule with highest priority
  SELECT * INTO v_rule
  FROM public.coding_rules
  WHERE org_id = v_transaction.org_id
    AND is_active = true
    AND auto_apply = true
    AND (match_direction IS NULL OR match_direction = v_transaction.direction)
    AND (match_amount_min_cents IS NULL OR v_transaction.amount_cents >= match_amount_min_cents)
    AND (match_amount_max_cents IS NULL OR v_transaction.amount_cents <= match_amount_max_cents)
    AND (match_description IS NULL OR v_transaction.description ILIKE '%' || match_description || '%')
    AND (match_merchant IS NULL OR v_transaction.merchant_name ILIKE '%' || match_merchant || '%')
  ORDER BY priority DESC
  LIMIT 1;

  IF v_rule IS NOT NULL THEN
    UPDATE public.bank_transactions
    SET
      account_id = v_rule.account_id,
      tax_treatment = COALESCE(v_rule.tax_treatment, (SELECT tax_treatment FROM public.chart_of_accounts WHERE id = v_rule.account_id)),
      gst_cents = calculate_gst_cents(amount_cents, COALESCE(v_rule.tax_treatment, (SELECT tax_treatment FROM public.chart_of_accounts WHERE id = v_rule.account_id))),
      status = 'coded',
      coded_at = now(),
      updated_at = now()
    WHERE id = p_transaction_id;

    UPDATE public.coding_rules
    SET times_applied = times_applied + 1, last_applied_at = now()
    WHERE id = v_rule.id;
  END IF;
END;
$$ LANGUAGE plpgsql;
