-- ============================================
-- SMS COMMUNICATIONS INFRASTRUCTURE
-- Migration: 0021_sms_communications.sql
-- ============================================

-- SMS Templates (multi-tenant, versioned)
CREATE TABLE IF NOT EXISTS public.sms_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,

  -- Template identification
  template_key text NOT NULL, -- 'booking_confirmation', 'session_reminder', 'feedback_request'
  name text NOT NULL,
  description text,

  -- Content
  body text NOT NULL, -- Max 1600 chars, supports {{variable}} syntax

  -- Variables schema (JSON Schema for validation)
  variables_schema jsonb NOT NULL DEFAULT '[]'::jsonb, -- ["client_name", "session_date", "coach_name"]

  -- Status
  is_active boolean NOT NULL DEFAULT true,
  version int NOT NULL DEFAULT 1,

  -- Audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Ensure one active template per key per org
  CONSTRAINT unique_active_template_key UNIQUE (org_id, template_key, version)
);

ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sms_templates read by org members" ON public.sms_templates
FOR SELECT USING (public.is_org_member(org_id) OR public.is_platform_admin());

CREATE POLICY "sms_templates managed by org members" ON public.sms_templates
FOR ALL USING (public.is_org_member(org_id));


-- SMS Messages Queue (outbound messages)
CREATE TABLE IF NOT EXISTS public.sms_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,

  -- Recipient
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  to_phone text NOT NULL, -- E.164 format: +61412345678

  -- Sender (Twilio phone number or Messaging Service SID)
  from_phone text NOT NULL, -- E.164 or MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

  -- Content
  template_id uuid REFERENCES public.sms_templates(id),
  template_key text, -- denormalized for reporting
  body text NOT NULL, -- fully rendered message
  variables jsonb, -- variables used for rendering

  -- Related entity (for context)
  related_entity_type text, -- 'booking', 'payment', 'habit'
  related_entity_id uuid,

  -- Queue management
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- created, not yet queued
    'queued',       -- ready to send
    'sending',      -- dequeued by worker, sending in progress
    'sent',         -- accepted by Twilio
    'delivered',    -- confirmed delivered
    'failed',       -- permanent failure
    'cancelled'     -- cancelled before sending
  )),

  -- Scheduling
  scheduled_for timestamptz NOT NULL DEFAULT now(), -- when to send (for reminders)
  sent_at timestamptz, -- when actually sent to Twilio
  delivered_at timestamptz,
  failed_at timestamptz,

  -- Idempotency
  idempotency_key text UNIQUE, -- prevents duplicate sends

  -- Error tracking
  error_code text,
  error_message text,

  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb, -- quiet_hours_override, priority, etc.

  -- Audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Worker visibility timeout (for concurrent dequeue safety)
  locked_until timestamptz
);

ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sms_messages read by org members" ON public.sms_messages
FOR SELECT USING (public.is_org_member(org_id) OR public.is_platform_admin());

CREATE POLICY "sms_messages managed by org members" ON public.sms_messages
FOR ALL USING (public.is_org_member(org_id));


-- SMS Delivery Attempts (retry tracking)
CREATE TABLE IF NOT EXISTS public.sms_attempts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id uuid NOT NULL REFERENCES public.sms_messages(id) ON DELETE CASCADE,

  attempt_number int NOT NULL, -- 1, 2, 3...

  -- Provider details
  provider text NOT NULL DEFAULT 'twilio',
  provider_message_id text, -- Twilio Message SID (SMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX)

  -- Request/Response
  request_payload jsonb NOT NULL, -- full Twilio API request
  response_payload jsonb, -- full Twilio API response
  response_status int, -- HTTP status code

  -- Result
  status text NOT NULL CHECK (status IN ('success', 'transient_error', 'permanent_error')),
  error_code text,
  error_message text,

  -- Timing
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sms_attempts read by org members" ON public.sms_attempts
FOR SELECT USING (
  message_id IN (SELECT id FROM public.sms_messages WHERE public.is_org_member(org_id))
);


-- SMS Webhook Events (delivery status callbacks from Twilio)
CREATE TABLE IF NOT EXISTS public.sms_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Link to message (nullable because we might receive events for unknown messages)
  message_id uuid REFERENCES public.sms_messages(id) ON DELETE SET NULL,
  org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE, -- denormalized for RLS

  -- Provider details
  provider text NOT NULL DEFAULT 'twilio',
  provider_message_id text NOT NULL, -- Twilio MessageSid

  -- Event details
  event_type text NOT NULL, -- 'queued', 'sent', 'delivered', 'undelivered', 'failed'
  event_status text, -- Twilio MessageStatus value
  error_code text, -- Twilio ErrorCode
  error_message text,

  -- Full webhook payload (for debugging)
  event_payload jsonb NOT NULL,

  -- Idempotency (prevent duplicate webhook processing)
  dedupe_key text NOT NULL UNIQUE, -- SHA256(provider_message_id + event_type + received_at)

  -- Timing
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.sms_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sms_events read by org members" ON public.sms_events
FOR SELECT USING (
  org_id IS NULL OR public.is_org_member(org_id) OR public.is_platform_admin()
);


-- SMS Suppression List (opt-outs, invalid numbers)
CREATE TABLE IF NOT EXISTS public.sms_suppression (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,

  phone text NOT NULL, -- E.164 format

  -- Reason
  reason text NOT NULL CHECK (reason IN (
    'opt_out',           -- user requested unsubscribe (STOP keyword)
    'invalid_number',    -- number doesn't exist
    'carrier_violation', -- carrier blocked
    'manual'            -- manually added by admin
  )),

  source text NOT NULL DEFAULT 'system', -- 'webhook', 'manual', 'stop_keyword'
  notes text,

  -- Related client (optional)
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_phone_per_org UNIQUE (org_id, phone)
);

ALTER TABLE public.sms_suppression ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sms_suppression read by org members" ON public.sms_suppression
FOR SELECT USING (public.is_org_member(org_id) OR public.is_platform_admin());

CREATE POLICY "sms_suppression managed by org members" ON public.sms_suppression
FOR ALL USING (public.is_org_member(org_id));


-- SMS Settings (per-org configuration)
CREATE TABLE IF NOT EXISTS public.sms_settings (
  org_id uuid PRIMARY KEY REFERENCES public.orgs(id) ON DELETE CASCADE,

  -- Twilio credentials
  twilio_account_sid text,
  twilio_auth_token_encrypted text, -- encrypted with Supabase Vault
  twilio_messaging_service_sid text, -- MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  twilio_phone_number text, -- fallback if not using Messaging Service, E.164

  -- Sending rules
  quiet_hours_start int DEFAULT 21 CHECK (quiet_hours_start BETWEEN 0 AND 23), -- 9 PM
  quiet_hours_end int DEFAULT 8 CHECK (quiet_hours_end BETWEEN 0 AND 23), -- 8 AM
  timezone text DEFAULT 'Australia/Sydney',

  -- Rate limiting (per org)
  max_sms_per_hour int DEFAULT 100,
  max_sms_per_client_per_day int DEFAULT 5,

  -- Feature flags
  enabled boolean NOT NULL DEFAULT true,
  send_booking_confirmations boolean DEFAULT true,
  send_session_reminders boolean DEFAULT true,
  send_feedback_requests boolean DEFAULT true,

  -- Default reminder timing
  reminder_hours_before int DEFAULT 24, -- send reminder 24h before session
  feedback_hours_after int DEFAULT 2, -- send feedback request 2h after session

  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sms_settings read by org members" ON public.sms_settings
FOR SELECT USING (public.is_org_member(org_id) OR public.is_platform_admin());

CREATE POLICY "sms_settings managed by org members" ON public.sms_settings
FOR ALL USING (public.is_org_member(org_id));


-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_sms_templates_org_key ON public.sms_templates(org_id, template_key) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_sms_messages_org_id ON public.sms_messages(org_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_client_id ON public.sms_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_status ON public.sms_messages(status);
CREATE INDEX IF NOT EXISTS idx_sms_messages_scheduled_for ON public.sms_messages(scheduled_for) WHERE status IN ('pending', 'queued');
CREATE INDEX IF NOT EXISTS idx_sms_messages_dequeue ON public.sms_messages(status, scheduled_for, locked_until)
  WHERE status = 'queued' AND (locked_until IS NULL OR locked_until < now());

CREATE INDEX IF NOT EXISTS idx_sms_attempts_message_id ON public.sms_attempts(message_id);
CREATE INDEX IF NOT EXISTS idx_sms_attempts_provider_message_id ON public.sms_attempts(provider_message_id);

CREATE INDEX IF NOT EXISTS idx_sms_events_message_id ON public.sms_events(message_id);
CREATE INDEX IF NOT EXISTS idx_sms_events_provider_message_id ON public.sms_events(provider_message_id);

CREATE INDEX IF NOT EXISTS idx_sms_suppression_org_phone ON public.sms_suppression(org_id, phone);


-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if phone is suppressed
CREATE OR REPLACE FUNCTION public.is_phone_suppressed(
  p_org_id uuid,
  p_phone text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.sms_suppression
    WHERE org_id = p_org_id
      AND phone = p_phone
  );
END;
$$;


-- Function to render SMS template
CREATE OR REPLACE FUNCTION public.render_sms_template(
  p_template_body text,
  p_variables jsonb
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_result text := p_template_body;
  v_key text;
  v_value text;
BEGIN
  -- Simple mustache-style replacement: {{variable}}
  FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_variables)
  LOOP
    v_result := replace(v_result, '{{' || v_key || '}}', COALESCE(v_value, ''));
  END LOOP;

  RETURN v_result;
END;
$$;


-- Function to automatically transition pending → queued
CREATE OR REPLACE FUNCTION public.queue_pending_sms()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated int;
BEGIN
  -- Move pending messages to queued if scheduled_for <= now
  WITH updated AS (
    UPDATE public.sms_messages
    SET
      status = 'queued',
      updated_at = now()
    WHERE status = 'pending'
      AND scheduled_for <= now()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_updated FROM updated;

  RETURN v_updated;
END;
$$;


-- Function to insert SMS from service role (bypasses RLS for cron jobs)
CREATE OR REPLACE FUNCTION public.insert_sms_from_service(
  p_org_id uuid,
  p_client_id uuid,
  p_template_key text,
  p_variables jsonb,
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
  v_template record;
  v_client record;
  v_settings record;
  v_rendered_body text;
  v_from_phone text;
BEGIN
  -- Get client
  SELECT * INTO v_client FROM public.clients WHERE id = p_client_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  -- Validate phone
  IF v_client.phone IS NULL OR NOT (v_client.phone ~ '^\+\d{10,15}$') THEN
    RAISE EXCEPTION 'Invalid or missing phone number';
  END IF;

  -- Check suppression
  IF public.is_phone_suppressed(p_org_id, v_client.phone) THEN
    RAISE EXCEPTION 'Phone number is suppressed';
  END IF;

  -- Get settings
  SELECT * INTO v_settings FROM public.sms_settings WHERE org_id = p_org_id;
  IF NOT FOUND OR NOT v_settings.enabled THEN
    RAISE EXCEPTION 'SMS not enabled for org';
  END IF;

  -- Get template
  SELECT * INTO v_template FROM public.sms_templates
  WHERE org_id = p_org_id
    AND template_key = p_template_key
    AND is_active = true
  ORDER BY version DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found';
  END IF;

  -- Render template
  v_rendered_body := public.render_sms_template(v_template.body, p_variables);

  -- Determine from phone
  v_from_phone := COALESCE(v_settings.twilio_messaging_service_sid, v_settings.twilio_phone_number);
  IF v_from_phone IS NULL THEN
    RAISE EXCEPTION 'No Twilio sender configured';
  END IF;

  -- Insert message
  INSERT INTO public.sms_messages (
    org_id,
    client_id,
    to_phone,
    from_phone,
    template_id,
    template_key,
    body,
    variables,
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
    v_template.id,
    p_template_key,
    v_rendered_body,
    p_variables,
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
