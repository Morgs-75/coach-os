-- Push tokens for Expo notifications
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

-- Index for quick lookup by client
create index on public.push_tokens (client_id);

-- RLS
alter table public.push_tokens enable row level security;

-- Clients can manage their own tokens (via authenticated client session)
create policy "Clients can insert own tokens"
  on public.push_tokens for insert
  with check (client_id in (
    select c.id from public.clients c
    inner join public.client_invites ci on ci.client_id = c.id
    where ci.redeemed_at is not null
    and c.id = client_id
  ));

-- Service role handles reads for push dispatch
-- No select policy needed for clients - backend reads tokens
