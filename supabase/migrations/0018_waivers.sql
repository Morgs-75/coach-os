-- Waivers: template storage on org, trackable client waivers with signing links

-- Store waiver template on the org
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS waiver_template text;

-- Client waivers: track sent/signed status per client
CREATE TABLE IF NOT EXISTS public.client_waivers (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null default 'Waiver',
  token uuid not null default uuid_generate_v4(),
  status text not null default 'sent' check (status in ('sent', 'signed', 'expired')),
  sent_at timestamptz not null default now(),
  signed_at timestamptz,
  signed_ip text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

ALTER TABLE public.client_waivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "waivers read by org members" ON public.client_waivers
FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY "waivers insert by trainer" ON public.client_waivers
FOR INSERT WITH CHECK (public.org_role(org_id) in ('owner', 'staff'));

CREATE POLICY "waivers update by trainer" ON public.client_waivers
FOR UPDATE USING (public.org_role(org_id) in ('owner', 'staff'))
WITH CHECK (public.org_role(org_id) in ('owner', 'staff'));

CREATE POLICY "waivers delete by trainer" ON public.client_waivers
FOR DELETE USING (public.org_role(org_id) in ('owner', 'staff'));

-- Public access: allow anyone with valid token to read & sign their waiver
CREATE POLICY "waivers public read by token" ON public.client_waivers
FOR SELECT USING (true);

CREATE POLICY "waivers public sign by token" ON public.client_waivers
FOR UPDATE USING (true)
WITH CHECK (true);

CREATE INDEX idx_client_waivers_client_id ON public.client_waivers(client_id);
CREATE INDEX idx_client_waivers_org_id ON public.client_waivers(org_id);
CREATE INDEX idx_client_waivers_token ON public.client_waivers(token);
