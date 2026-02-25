-- Client Self-Booking Portal: magic-link token
-- Mirrors the onboarding_token pattern already in the schema.
-- URL: /portal/<portal_token>  (no expiry — coach can regenerate to revoke)

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS portal_token uuid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_portal_token
  ON public.clients(portal_token)
  WHERE portal_token IS NOT NULL;

-- Allow portal API routes (using service-role key) to look up clients by token.
-- No anon/public RLS needed — all portal reads go through server-side API
-- routes that use the service-role key, scoped to the resolved client_id.
