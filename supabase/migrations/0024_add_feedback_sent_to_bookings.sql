-- Add feedback_sent flag to bookings table
-- Used by cron-sms-reminders to track post-session feedback SMS

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS feedback_sent boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_bookings_feedback_sent
  ON public.bookings(feedback_sent)
  WHERE feedback_sent = false AND status = 'completed';
