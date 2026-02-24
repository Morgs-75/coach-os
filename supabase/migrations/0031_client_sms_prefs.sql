ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS sms_reminder_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sms_followup_enabled boolean NOT NULL DEFAULT true;
