-- ============================================================
-- MIGRATION 0023: Fix RLS issues across all tables
-- Generated based on live database audit (2026-02-22)
-- ============================================================
-- Tables with RLS disabled but policies exist:
--   branding, clients, orgs, org_members, inquiries, platform_admins
--   goal_templates, health_condition_templates
-- Tables with RLS enabled but zero policies (access denied to all):
--   habits, client_habits, client_invites, client_risk,
--   stripe_accounts, subscriptions, checkin_photos
-- Other:
--   client_waivers public UPDATE policy was too permissive
-- ============================================================


-- ============================================================
-- 1. ENABLE RLS on tables that have policies but RLS is off
-- ============================================================

ALTER TABLE public.branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_condition_templates ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 2. BRANDING: Add missing INSERT policy
-- ============================================================

DROP POLICY IF EXISTS "branding insert by trainer" ON public.branding;
CREATE POLICY "branding insert by trainer" ON public.branding
  FOR INSERT WITH CHECK (public.org_role(org_id) IN ('owner', 'staff'));


-- ============================================================
-- 3. PLATFORM_ADMINS: Restrict to only admins reading own row
--    (no anon/user access — managed by service role)
-- ============================================================

DROP POLICY IF EXISTS "platform_admins read by self" ON public.platform_admins;
CREATE POLICY "platform_admins read by self" ON public.platform_admins
  FOR SELECT USING (user_id = auth.uid());


-- ============================================================
-- 4. GOAL_TEMPLATES / HEALTH_CONDITION_TEMPLATES: Public read
--    (read-only reference data)
-- ============================================================

DROP POLICY IF EXISTS "goal_templates read by anyone" ON public.goal_templates;
CREATE POLICY "goal_templates read by anyone" ON public.goal_templates
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "health_condition_templates read by anyone" ON public.health_condition_templates;
CREATE POLICY "health_condition_templates read by anyone" ON public.health_condition_templates
  FOR SELECT USING (true);


-- ============================================================
-- 5. HABITS: Add missing policies
-- ============================================================

DROP POLICY IF EXISTS "habits read by members" ON public.habits;
CREATE POLICY "habits read by members" ON public.habits
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "habits managed by trainer" ON public.habits;
CREATE POLICY "habits managed by trainer" ON public.habits
  FOR ALL USING (public.org_role(org_id) IN ('owner', 'staff'))
  WITH CHECK (public.org_role(org_id) IN ('owner', 'staff'));


-- ============================================================
-- 6. CLIENT_HABITS: Add missing policies
-- ============================================================

DROP POLICY IF EXISTS "client_habits read by members" ON public.client_habits;
CREATE POLICY "client_habits read by members" ON public.client_habits
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "client_habits managed by trainer" ON public.client_habits;
CREATE POLICY "client_habits managed by trainer" ON public.client_habits
  FOR ALL USING (public.org_role(org_id) IN ('owner', 'staff'))
  WITH CHECK (public.org_role(org_id) IN ('owner', 'staff'));

DROP POLICY IF EXISTS "client_habits read by own client" ON public.client_habits;
CREATE POLICY "client_habits read by own client" ON public.client_habits
  FOR SELECT USING (
    client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
  );


-- ============================================================
-- 7. CLIENT_INVITES: Add missing policies
-- ============================================================

DROP POLICY IF EXISTS "client_invites read by members" ON public.client_invites;
CREATE POLICY "client_invites read by members" ON public.client_invites
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "client_invites managed by trainer" ON public.client_invites;
CREATE POLICY "client_invites managed by trainer" ON public.client_invites
  FOR ALL USING (public.org_role(org_id) IN ('owner', 'staff'))
  WITH CHECK (public.org_role(org_id) IN ('owner', 'staff'));


-- ============================================================
-- 8. SUBSCRIPTIONS: Add org member read + write + client read
--    (Previously 0 policies — trainers couldn't see subscriptions)
-- ============================================================

DROP POLICY IF EXISTS "subscriptions read by members" ON public.subscriptions;
CREATE POLICY "subscriptions read by members" ON public.subscriptions
  FOR SELECT USING (public.is_org_member(org_id) OR public.is_platform_admin());

DROP POLICY IF EXISTS "subscriptions managed by trainer" ON public.subscriptions;
CREATE POLICY "subscriptions managed by trainer" ON public.subscriptions
  FOR ALL USING (public.org_role(org_id) IN ('owner', 'staff'))
  WITH CHECK (public.org_role(org_id) IN ('owner', 'staff'));

DROP POLICY IF EXISTS "subscriptions read by own client" ON public.subscriptions;
CREATE POLICY "subscriptions read by own client" ON public.subscriptions
  FOR SELECT USING (
    client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
  );


-- ============================================================
-- 9. CLIENT_RISK: Add read policy
--    (Written by service role cron, read by trainers)
-- ============================================================

DROP POLICY IF EXISTS "client_risk read by members" ON public.client_risk;
CREATE POLICY "client_risk read by members" ON public.client_risk
  FOR SELECT USING (public.is_org_member(org_id) OR public.is_platform_admin());


-- ============================================================
-- 10. STRIPE_ACCOUNTS: Add missing policies
-- ============================================================

DROP POLICY IF EXISTS "stripe_accounts read by members" ON public.stripe_accounts;
CREATE POLICY "stripe_accounts read by members" ON public.stripe_accounts
  FOR SELECT USING (public.is_org_member(org_id) OR public.is_platform_admin());

DROP POLICY IF EXISTS "stripe_accounts managed by owner" ON public.stripe_accounts;
CREATE POLICY "stripe_accounts managed by owner" ON public.stripe_accounts
  FOR ALL USING (public.org_role(org_id) = 'owner')
  WITH CHECK (public.org_role(org_id) = 'owner');


-- ============================================================
-- 11. CHECKIN_PHOTOS: Add missing policies
--     (Table created in 0007 but policies never applied)
-- ============================================================

DROP POLICY IF EXISTS "checkin photos read by org members" ON public.checkin_photos;
CREATE POLICY "checkin photos read by org members" ON public.checkin_photos
  FOR SELECT USING (public.is_org_member(org_id) OR public.is_platform_admin());

DROP POLICY IF EXISTS "checkin photos insert by trainer" ON public.checkin_photos;
CREATE POLICY "checkin photos insert by trainer" ON public.checkin_photos
  FOR INSERT WITH CHECK (public.org_role(org_id) IN ('owner', 'staff'));

DROP POLICY IF EXISTS "checkin photos read by client" ON public.checkin_photos;
CREATE POLICY "checkin photos read by client" ON public.checkin_photos
  FOR SELECT USING (
    client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "checkin photos insert by client" ON public.checkin_photos;
CREATE POLICY "checkin photos insert by client" ON public.checkin_photos
  FOR INSERT WITH CHECK (
    client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
  );


-- ============================================================
-- 12. CLIENT_WAIVERS: Tighten public UPDATE policy
--     Previous: USING (true) WITH CHECK (true) — anyone could
--     update any waiver to any value.
--     Fix: only sign 'sent' + non-expired waivers → 'signed'
-- ============================================================

DROP POLICY IF EXISTS "waivers public sign by token" ON public.client_waivers;
CREATE POLICY "waivers public sign by token" ON public.client_waivers
  FOR UPDATE
  USING (status = 'sent' AND (expires_at IS NULL OR expires_at > now()))
  WITH CHECK (status = 'signed');
