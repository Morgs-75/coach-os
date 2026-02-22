-- MIGRATION 0025: Fix infinite recursion in org_members RLS
--
-- Migration 0023 enabled RLS on org_members, but the SELECT policy
-- uses is_org_member() which queries org_members — causing infinite
-- recursion. Fix by making the helper functions SECURITY DEFINER
-- so they bypass RLS when doing their internal lookups.

CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER as $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members m
    WHERE m.org_id = _org AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.org_role(_org uuid)
RETURNS public.org_role LANGUAGE sql STABLE SECURITY DEFINER as $$
  SELECT m.role FROM public.org_members m
  WHERE m.org_id = _org AND m.user_id = auth.uid()
  LIMIT 1;
$$;
