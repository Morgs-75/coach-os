-- Migration 0043: Meal plan versioning + AI draft storage
-- Adds parent_plan_id to meal_plans for version chaining (Phase 9 Plan 01)
-- Adds ai_draft_* columns to meal_plan_feedback for Claude-suggested swaps

-- 1. Self-referential FK: links a versioned plan back to its original (v1)
ALTER TABLE public.meal_plans
  ADD COLUMN IF NOT EXISTS parent_plan_id uuid REFERENCES public.meal_plans(id) ON DELETE SET NULL;

-- Index for efficient "give me all versions of plan X" queries
CREATE INDEX IF NOT EXISTS idx_meal_plans_parent_plan_id ON public.meal_plans(parent_plan_id);

-- 2. AI draft columns on meal_plan_feedback: store the Claude-suggested food swap
ALTER TABLE public.meal_plan_feedback
  ADD COLUMN IF NOT EXISTS ai_draft_food_item_id uuid REFERENCES public.food_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_draft_qty_g numeric(8,2),
  ADD COLUMN IF NOT EXISTS ai_draft_reasoning text;

-- Notes:
-- parent_plan_id = NULL on original (v1) plans; set on Plans 02+ (versioned children)
-- ai_draft_food_item_id = AFCD food item Claude suggests as replacement
-- ai_draft_qty_g = adjusted quantity to match original macros
-- ai_draft_reasoning = plain-text explanation from Claude (e.g. "Swapping chicken for salmon for omega-3; 120g matches 22g protein target")
-- All ai_draft_* columns nullable — populated only after coach triggers AI draft endpoint (Plan 02)
