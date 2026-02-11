-- Onboarding: token-based public access for new client self-service forms

-- Add onboarding token to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS onboarding_token uuid;
CREATE INDEX IF NOT EXISTS idx_clients_onboarding_token ON public.clients(onboarding_token) WHERE onboarding_token IS NOT NULL;

-- Public SELECT on clients by onboarding token (anonymous users filling out their form)
CREATE POLICY "clients public read by onboarding token" ON public.clients
FOR SELECT USING (onboarding_token IS NOT NULL);

-- Public UPDATE on clients by onboarding token (anonymous users submitting their form)
CREATE POLICY "clients public update by onboarding token" ON public.clients
FOR UPDATE USING (onboarding_token IS NOT NULL)
WITH CHECK (onboarding_token IS NOT NULL);

-- Public SELECT on orgs (needed to load waiver template + org name for onboarding page)
CREATE POLICY "orgs public read for onboarding" ON public.orgs
FOR SELECT USING (true);

-- Public INSERT on client_waivers (onboarding form creates a signed waiver record)
CREATE POLICY "waivers public insert for onboarding" ON public.client_waivers
FOR INSERT WITH CHECK (true);
