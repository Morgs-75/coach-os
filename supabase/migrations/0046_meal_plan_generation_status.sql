-- Migration 0046: Add async generation status columns to meal_plans
-- These columns coordinate the split start/run/status endpoints.
-- generation_status: idle | generating | complete | error
-- generation_error:  non-null when status='error', null otherwise

ALTER TABLE meal_plans
  ADD COLUMN IF NOT EXISTS generation_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS generation_error text;

-- Constrain valid values so the DB rejects typos
ALTER TABLE meal_plans
  ADD CONSTRAINT meal_plans_generation_status_check
  CHECK (generation_status IN ('idle', 'generating', 'complete', 'error'));
