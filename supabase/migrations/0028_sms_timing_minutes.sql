-- Switch SMS reminder timing from hours to minutes for finer control.
-- reminder_mins_before: how many minutes before session to send reminder (default 60)
-- feedback_mins_after: how many minutes after session to send follow-up (default 90)

ALTER TABLE public.sms_settings
  ADD COLUMN IF NOT EXISTS reminder_mins_before int DEFAULT 60,
  ADD COLUMN IF NOT EXISTS feedback_mins_after int DEFAULT 90;

-- Migrate existing rows: convert old hour values to minutes
UPDATE public.sms_settings
SET
  reminder_mins_before = COALESCE(reminder_mins_before, reminder_hours_before * 60, 60),
  feedback_mins_after   = COALESCE(feedback_mins_after,  feedback_hours_after  * 60, 90);
