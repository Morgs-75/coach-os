-- Add coach-editable notes field to meal_plans
-- Used in the nutrition viewer right rail
ALTER TABLE public.meal_plans
  ADD COLUMN IF NOT EXISTS notes text;
