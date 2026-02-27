-- Migration 0042: meal_plan_feedback table
-- Stores client feedback on published meal plans for the coach to review.
-- Portal INSERT path uses service role (bypasses RLS).
-- Coach SELECT/UPDATE policies use org_members JOIN.

CREATE TABLE IF NOT EXISTS public.meal_plan_feedback (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id       uuid NOT NULL REFERENCES public.meal_plans(id) ON DELETE CASCADE,
  meal_id       uuid REFERENCES public.meal_plan_meals(id) ON DELETE SET NULL,
  client_id     uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type          text NOT NULL CHECK (type IN ('substitution','dislike','allergy','portion','schedule','other')),
  scope         text NOT NULL CHECK (scope IN ('this_meal','going_forward','all_occurrences')),
  comment       text,
  forward       text CHECK (forward IN ('yes','no','ask_me') OR forward IS NULL),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_meal_plan_feedback_plan_id   ON public.meal_plan_feedback(plan_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_feedback_client_id ON public.meal_plan_feedback(client_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_feedback_status    ON public.meal_plan_feedback(status);

-- RLS
ALTER TABLE public.meal_plan_feedback ENABLE ROW LEVEL SECURITY;

-- Coach SELECT: feedback belongs to plans in their org
DO $$ BEGIN
  CREATE POLICY "coach_select_feedback" ON public.meal_plan_feedback
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.meal_plans p
        JOIN public.org_members om ON om.org_id = p.org_id
        WHERE p.id = meal_plan_feedback.plan_id
          AND om.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Coach UPDATE: mark feedback as reviewed
DO $$ BEGIN
  CREATE POLICY "coach_update_feedback" ON public.meal_plan_feedback
    FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM public.meal_plans p
        JOIN public.org_members om ON om.org_id = p.org_id
        WHERE p.id = meal_plan_feedback.plan_id
          AND om.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- NOTE: Portal INSERT uses service role key (bypasses RLS) — no client INSERT policy needed.
