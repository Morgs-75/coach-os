-- ============================================
-- COACH OS - ALL MIGRATIONS COMBINED
-- Run this entire script in Supabase SQL Editor
-- ============================================

-- MIGRATION 1: TABLES
create extension if not exists "uuid-ossp";

-- ORGS + MEMBERSHIP
create table public.orgs (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  name text not null,
  slug text not null unique
);

create type public.org_role as enum ('owner','staff','accountant_readonly');

create table public.org_members (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null,
  role public.org_role not null,
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create table public.branding (
  org_id uuid primary key references public.orgs(id) on delete cascade,
  display_name text not null,
  primary_color text not null default '#111111',
  logo_path text null,
  updated_at timestamptz not null default now()
);

-- CLIENTS
create table public.clients (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  created_at timestamptz not null default now(),
  full_name text not null,
  email text null,
  phone text null,
  status text not null default 'active'
);

create table public.client_invites (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  invite_code text not null unique,
  expires_at timestamptz not null,
  redeemed_at timestamptz null,
  created_at timestamptz not null default now()
);

-- MESSAGING
create table public.message_threads (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (org_id, client_id)
);

create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  created_at timestamptz not null default now(),
  sender_type text not null check (sender_type in ('trainer','client','system')),
  sender_user_id uuid null,
  body text not null
);

-- PROGRAMS (light)
create table public.habits (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.client_habits (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (client_id, habit_id)
);

-- APPEND-ONLY ACTIVITY EVENTS
create table public.activity_events (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  type text not null check (type in ('weight','habit','workout','checkin')),
  payload jsonb not null
);

-- MICRO-CRM INQUIRIES
create type public.inquiry_status as enum ('NEW','CONTACTED','BOOKED','WON','LOST');

create table public.inquiries (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  created_at timestamptz not null default now(),
  source text not null default 'other',
  name text not null,
  email text null,
  phone text null,
  message text null,
  status public.inquiry_status not null default 'NEW',
  assigned_to uuid null,
  expected_value numeric null,
  converted_client_id uuid null references public.clients(id)
);

-- STRIPE + SUBSCRIPTIONS
create table public.stripe_accounts (
  org_id uuid primary key references public.orgs(id) on delete cascade,
  stripe_account_id text not null,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  stripe_customer_id text null,
  stripe_subscription_id text null,
  status text not null default 'none',
  manage_url text null,
  updated_at timestamptz not null default now(),
  unique (org_id, client_id)
);

-- APPEND-ONLY MONEY EVENTS (cash ledger)
create type public.money_event_type as enum ('INCOME','REFUND','FEE','PLATFORM_FEE','PAYOUT','EXPENSE','ADJUSTMENT');
create type public.tax_category as enum ('GST','GST_FREE','NONE');

create table public.money_events (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  created_at timestamptz not null default now(),
  event_date timestamptz not null,
  type public.money_event_type not null,
  amount_cents bigint not null,
  currency text not null default 'aud',
  tax_cat public.tax_category not null default 'NONE',
  tax_cents bigint not null default 0,
  source text not null check (source in ('stripe','manual')),
  reference_id text null,
  client_id uuid null references public.clients(id),
  notes text null
);

-- RISK
create table public.client_risk (
  org_id uuid not null references public.orgs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  as_of_date date not null,
  score int not null,
  tier text not null check (tier in ('green','amber','red')),
  reasons text[] not null default '{}',
  primary key (org_id, client_id, as_of_date)
);

-- AUTOMATIONS
create table public.automations (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  enabled boolean not null default true,
  trigger jsonb not null,
  conditions jsonb not null,
  actions jsonb not null,
  guardrails jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.automation_runs (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  automation_id uuid not null references public.automations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  fired_at timestamptz not null default now(),
  status text not null check (status in ('ok','skipped','failed')),
  reason text null,
  actions_fired jsonb not null default '[]'::jsonb
);

-- PUSH TOKENS
create table public.push_tokens (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  expo_token text not null,
  device_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, expo_token)
);

-- ============================================
-- MIGRATION 2: ROW LEVEL SECURITY
-- ============================================

alter table public.orgs enable row level security;
alter table public.org_members enable row level security;
alter table public.branding enable row level security;
alter table public.clients enable row level security;
alter table public.client_invites enable row level security;
alter table public.message_threads enable row level security;
alter table public.messages enable row level security;
alter table public.habits enable row level security;
alter table public.client_habits enable row level security;
alter table public.activity_events enable row level security;
alter table public.inquiries enable row level security;
alter table public.stripe_accounts enable row level security;
alter table public.subscriptions enable row level security;
alter table public.money_events enable row level security;
alter table public.client_risk enable row level security;
alter table public.automations enable row level security;
alter table public.automation_runs enable row level security;
alter table public.push_tokens enable row level security;

-- Helper functions
create or replace function public.is_org_member(_org uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.org_members m
    where m.org_id = _org and m.user_id = auth.uid()
  );
$$;

create or replace function public.org_role(_org uuid)
returns public.org_role language sql stable as $$
  select m.role from public.org_members m
  where m.org_id = _org and m.user_id = auth.uid()
  limit 1
$$;

-- ORGS policies
create policy "orgs read by members" on public.orgs
for select using (public.is_org_member(id));

create policy "orgs write by owner" on public.orgs
for update using (public.org_role(id) = 'owner')
with check (public.org_role(id) = 'owner');

-- Allow insert for new org creation during signup
create policy "orgs insert for authenticated" on public.orgs
for insert with check (auth.uid() is not null);

-- MEMBERS policies
create policy "members read by members" on public.org_members
for select using (public.is_org_member(org_id));

create policy "members write by owner" on public.org_members
for insert with check (public.org_role(org_id) = 'owner' or not exists (select 1 from public.org_members where org_id = org_members.org_id));

create policy "members update by owner" on public.org_members
for update using (public.org_role(org_id) = 'owner')
with check (public.org_role(org_id) = 'owner');

-- BRANDING policies
create policy "branding read by members" on public.branding
for select using (public.is_org_member(org_id));

create policy "branding insert by owner" on public.branding
for insert with check (public.org_role(org_id) = 'owner' or auth.uid() is not null);

create policy "branding write by trainer" on public.branding
for update using (public.org_role(org_id) in ('owner','staff'))
with check (public.org_role(org_id) in ('owner','staff'));

-- CLIENTS policies
create policy "clients read by members" on public.clients
for select using (public.is_org_member(org_id));

create policy "clients write by trainer" on public.clients
for insert with check (public.org_role(org_id) in ('owner','staff'));

create policy "clients update by trainer" on public.clients
for update using (public.org_role(org_id) in ('owner','staff'))
with check (public.org_role(org_id) in ('owner','staff'));

-- ACTIVITY EVENTS policies
create policy "activity insert by members" on public.activity_events
for insert with check (public.is_org_member(org_id));

create policy "activity read by members" on public.activity_events
for select using (public.is_org_member(org_id));

-- MONEY EVENTS policies (read only for clients, service role inserts)
create policy "money read by members" on public.money_events
for select using (public.is_org_member(org_id));

-- INQUIRIES policies
create policy "inquiries read/write by trainer" on public.inquiries
for all using (public.org_role(org_id) in ('owner','staff'))
with check (public.org_role(org_id) in ('owner','staff'));

-- AUTOMATIONS policies
create policy "automations read/write by trainer" on public.automations
for all using (public.org_role(org_id) in ('owner','staff'))
with check (public.org_role(org_id) in ('owner','staff'));

create policy "automation_runs read by trainer" on public.automation_runs
for select using (public.org_role(org_id) in ('owner','staff'));

-- ============================================
-- MIGRATION 3: INDEXES
-- ============================================

create index on public.clients (org_id, created_at desc);
create index on public.activity_events (org_id, client_id, created_at desc);
create index on public.money_events (org_id, event_date desc);
create index on public.inquiries (org_id, status, created_at desc);
create index on public.client_risk (org_id, as_of_date desc, score desc);
create index on public.automation_runs (org_id, fired_at desc);
create index on public.push_tokens (client_id);

-- ============================================
-- MIGRATION 4: VIEWS
-- ============================================

create or replace view public.finance_monthly as
select
  org_id,
  to_char(date_trunc('month', event_date), 'YYYY-MM') as period,
  sum(case when amount_cents > 0 then amount_cents else 0 end) as cash_in_cents,
  sum(case when amount_cents < 0 then -amount_cents else 0 end) as cash_out_cents,
  sum(amount_cents) as net_cents,
  sum(case when type='FEE' then -amount_cents else 0 end) as fees_cents,
  sum(case when type='PLATFORM_FEE' then -amount_cents else 0 end) as platform_fees_cents,
  sum(case when type='REFUND' then -amount_cents else 0 end) as refunds_cents,
  sum(case when type='PAYOUT' then abs(amount_cents) else 0 end) as payouts_cents
from public.money_events
group by org_id, date_trunc('month', event_date);

-- ============================================
-- DONE! Your database is ready.
-- ============================================
