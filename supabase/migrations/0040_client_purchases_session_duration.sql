-- Migration 0040: add session_duration_mins to client_purchases
-- Stores the purchased session duration at purchase time so bookings
-- always enforce the correct duration, independent of org-wide settings.

ALTER TABLE client_purchases
  ADD COLUMN IF NOT EXISTS session_duration_mins integer;
