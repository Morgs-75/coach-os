-- ============================================
-- SMS Schedules table and insert_sms_direct function
-- Migration: 0030_sms_schedules.sql
-- ============================================

-- Per-org configurable reminder/followup schedules
CREATE TABLE IF NOT EXISTS public.sms_schedules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,

  -- 'pre_session' = send before booking.start_time
  -- 'post_session' = send after booking.end_time
  type text NOT NULL CHECK (type IN ('pre_session', 'post_session')),

  label text NOT NULL,          -- e.g. "60 min reminder"
  mins_offset int NOT NULL DEFAULT 60, -- minutes before/after session
  body text NOT NULL,           -- supports {{client_name}}, {{session_datetime}}, etc.
  enabled boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sms_schedules read by org members" ON public.sms_schedules
  FOR SELECT USING (public.is_org_member(org_id) OR public.is_platform_admin());

CREATE POLICY "sms_schedules managed by org members" ON public.sms_schedules
  FOR ALL USING (public.is_org_member(org_id));

CREATE INDEX IF NOT EXISTS idx_sms_schedules_org_type
  ON public.sms_schedules(org_id, type) WHERE enabled = true;


-- ============================================
-- insert_sms_direct: like insert_sms_from_service but accepts
-- a pre-rendered body instead of a template key.
-- Used by cron-sms-reminders edge function.
-- ============================================
CREATE OR REPLACE FUNCTION public.insert_sms_direct(
  p_org_id uuid,
  p_client_id uuid,
  p_body text,
  p_scheduled_for timestamptz,
  p_related_entity_type text,
  p_related_entity_id uuid,
  p_idempotency_key text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message_id uuid;
  v_client record;
  v_settings record;
  v_from_phone text;
BEGIN
  -- Get client
  SELECT * INTO v_client FROM public.clients WHERE id = p_client_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Validate phone
  IF v_client.phone IS NULL THEN RETURN NULL; END IF;

  -- Check suppression
  IF public.is_phone_suppressed(p_org_id, v_client.phone) THEN RETURN NULL; END IF;

  -- Get settings
  SELECT * INTO v_settings FROM public.sms_settings WHERE org_id = p_org_id;
  IF NOT FOUND OR NOT v_settings.enabled THEN RETURN NULL; END IF;

  -- Determine sender (Messaging Service SID preferred over phone number)
  v_from_phone := COALESCE(v_settings.twilio_messaging_service_sid, v_settings.twilio_phone_number);
  IF v_from_phone IS NULL THEN RETURN NULL; END IF;

  -- Insert message (idempotent — duplicate keys are silently ignored)
  INSERT INTO public.sms_messages (
    org_id,
    client_id,
    to_phone,
    from_phone,
    body,
    related_entity_type,
    related_entity_id,
    scheduled_for,
    idempotency_key,
    status
  ) VALUES (
    p_org_id,
    p_client_id,
    v_client.phone,
    v_from_phone,
    p_body,
    p_related_entity_type,
    p_related_entity_id,
    p_scheduled_for,
    p_idempotency_key,
    'pending'
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_message_id;

  RETURN v_message_id;
END;
$$;
