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

-- helper: is member of org
create or replace function public.is_org_member(_org uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.org_members m
    where m.org_id = _org and m.user_id = auth.uid()
  );
$$;

-- helper: role in org
create or replace function public.org_role(_org uuid)
returns public.org_role language sql stable as $$
  select m.role from public.org_members m
  where m.org_id = _org and m.user_id = auth.uid()
  limit 1
$$;

-- ORGS
create policy "orgs read by members" on public.orgs
for select using (public.is_org_member(id));

create policy "orgs write by owner" on public.orgs
for update using (public.org_role(id) = 'owner')
with check (public.org_role(id) = 'owner');

-- MEMBERS
create policy "members read by members" on public.org_members
for select using (public.is_org_member(org_id));

create policy "members write by owner" on public.org_members
for insert with check (public.org_role(org_id) = 'owner');
create policy "members update by owner" on public.org_members
for update using (public.org_role(org_id) = 'owner')
with check (public.org_role(org_id) = 'owner');

-- BRANDING
create policy "branding read by members" on public.branding
for select using (public.is_org_member(org_id));
create policy "branding write by trainer" on public.branding
for update using (public.org_role(org_id) in ('owner','staff'))
with check (public.org_role(org_id) in ('owner','staff'));

-- CLIENTS
create policy "clients read by members" on public.clients
for select using (public.is_org_member(org_id));
create policy "clients write by trainer" on public.clients
for insert with check (public.org_role(org_id) in ('owner','staff'));
create policy "clients update by trainer" on public.clients
for update using (public.org_role(org_id) in ('owner','staff'))
with check (public.org_role(org_id) in ('owner','staff'));

-- APPEND-ONLY EVENTS (insert only)
create policy "activity insert by members" on public.activity_events
for insert with check (public.is_org_member(org_id));
create policy "activity read by members" on public.activity_events
for select using (public.is_org_member(org_id));

-- MONEY EVENTS (server only) -> no client insert/update policies; use service role in Edge Function
create policy "money read by members" on public.money_events
for select using (public.is_org_member(org_id));

-- INQUIRIES
create policy "inquiries read/write by trainer" on public.inquiries
for all using (public.org_role(org_id) in ('owner','staff'))
with check (public.org_role(org_id) in ('owner','staff'));

-- AUTOMATIONS
create policy "automations read/write by trainer" on public.automations
for all using (public.org_role(org_id) in ('owner','staff'))
with check (public.org_role(org_id) in ('owner','staff'));

create policy "automation_runs read by trainer" on public.automation_runs
for select using (public.org_role(org_id) in ('owner','staff'));

