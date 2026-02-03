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
  status text not null default 'none', -- active|past_due|canceled|none
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
  amount_cents bigint not null, -- +in / -out
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

