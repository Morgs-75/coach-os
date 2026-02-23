-- MIGRATION 0029: Fix blocked_times RLS policies
--
-- The existing policies use direct subqueries on org_members which can
-- fail silently due to RLS chain evaluation. Replace with is_org_member()
-- helper (SECURITY DEFINER) for consistency and reliability.

DROP POLICY IF EXISTS "Users can view blocked times for their org" ON public.blocked_times;
DROP POLICY IF EXISTS "Users can insert blocked times for their org" ON public.blocked_times;
DROP POLICY IF EXISTS "Users can update blocked times for their org" ON public.blocked_times;
DROP POLICY IF EXISTS "Users can delete blocked times for their org" ON public.blocked_times;

CREATE POLICY "blocked_times select by members"
  ON public.blocked_times FOR SELECT
  USING (public.is_org_member(org_id));

CREATE POLICY "blocked_times insert by members"
  ON public.blocked_times FOR INSERT
  WITH CHECK (public.is_org_member(org_id));

CREATE POLICY "blocked_times update by members"
  ON public.blocked_times FOR UPDATE
  USING (public.is_org_member(org_id));

CREATE POLICY "blocked_times delete by members"
  ON public.blocked_times FOR DELETE
  USING (public.is_org_member(org_id));
