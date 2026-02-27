-- Migration 0045: Add intake_data jsonb to meal_plans
-- Stores the rich intake wizard answers used to generate the plan

ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS intake_data jsonb;
