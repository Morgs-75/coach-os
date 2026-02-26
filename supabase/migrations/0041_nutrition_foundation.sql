-- Migration 0041: nutrition foundation tables (food_items, meal_plans, meal_plan_days, meal_plan_meals, meal_plan_components)

-- Enable pg_trgm for trigram-based ILIKE search on food names
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- food_items: Global AFCD food library (no org_id — shared across all orgs)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.food_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  afcd_food_id  text UNIQUE,           -- AFCD internal ID for dedup on re-seed
  food_name     text NOT NULL,
  food_group    text,
  energy_kcal   numeric(8,2),
  protein_g     numeric(8,2),
  fat_g         numeric(8,2),
  carb_g        numeric(8,2),
  fibre_g       numeric(8,2),
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.food_items ENABLE ROW LEVEL SECURITY;

-- Public SELECT: food search must work without org context (coaches and portal clients)
DO $$ BEGIN
  CREATE POLICY "food items are publicly readable" ON public.food_items
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- INSERT/UPDATE/DELETE only via service role key (seed script) — no explicit policy needed

-- Full-text search index on food_name
CREATE INDEX IF NOT EXISTS food_items_name_gin ON public.food_items USING gin(to_tsvector('english', food_name));

-- Trigram index for fast ILIKE / prefix queries (fallback for short search terms)
CREATE INDEX IF NOT EXISTS food_items_name_trgm ON public.food_items USING gin(food_name gin_trgm_ops);

-- ============================================================
-- meal_plans: Org-scoped meal plans, assigned per client
-- ============================================================

CREATE TABLE IF NOT EXISTS public.meal_plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  client_id     uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name          text NOT NULL,
  start_date    date,
  end_date      date,
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  version       integer NOT NULL DEFAULT 1,
  published_at  timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "org members can manage meal plans" ON public.meal_plans
    FOR ALL USING (public.is_org_member(org_id) OR public.is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_meal_plans_org_id ON public.meal_plans(org_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_client_id ON public.meal_plans(client_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_status ON public.meal_plans(status);

-- ============================================================
-- meal_plan_days: Numbered days within a meal plan
-- ============================================================

CREATE TABLE IF NOT EXISTS public.meal_plan_days (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     uuid NOT NULL REFERENCES public.meal_plans(id) ON DELETE CASCADE,
  day_number  integer NOT NULL,           -- 1-based (Day 1, Day 2 etc.)
  date        date,                       -- optional calendar date
  created_at  timestamptz DEFAULT now(),
  UNIQUE(plan_id, day_number)
);

ALTER TABLE public.meal_plan_days ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "org members can manage plan days" ON public.meal_plan_days
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM public.meal_plans mp
        JOIN public.org_members om ON om.org_id = mp.org_id
        WHERE mp.id = meal_plan_days.plan_id
          AND om.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_meal_plan_days_plan_id ON public.meal_plan_days(plan_id);

-- ============================================================
-- meal_plan_meals: Individual meals within a day
-- ============================================================

CREATE TABLE IF NOT EXISTS public.meal_plan_meals (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id     uuid NOT NULL REFERENCES public.meal_plan_days(id) ON DELETE CASCADE,
  meal_type  text NOT NULL CHECK (meal_type IN ('breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'evening_snack', 'other')),
  title      text,                        -- e.g. "Pre-workout meal"
  note       text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.meal_plan_meals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "org members can manage plan meals" ON public.meal_plan_meals
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM public.meal_plan_days mpd
        JOIN public.meal_plans mp ON mp.id = mpd.plan_id
        JOIN public.org_members om ON om.org_id = mp.org_id
        WHERE mpd.id = meal_plan_meals.day_id
          AND om.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_meal_plan_meals_day_id ON public.meal_plan_meals(day_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_meals_sort ON public.meal_plan_meals(day_id, sort_order);

-- ============================================================
-- meal_plan_components: Food items within a meal (with quantity)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.meal_plan_components (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id      uuid NOT NULL REFERENCES public.meal_plan_meals(id) ON DELETE CASCADE,
  food_item_id uuid REFERENCES public.food_items(id) ON DELETE SET NULL,
  qty_g        numeric(8,2) NOT NULL DEFAULT 100,
  custom_name  text,                      -- override display name (e.g. "1 medium egg")
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.meal_plan_components ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "org members can manage plan components" ON public.meal_plan_components
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM public.meal_plan_meals mpm
        JOIN public.meal_plan_days mpd ON mpd.id = mpm.day_id
        JOIN public.meal_plans mp ON mp.id = mpd.plan_id
        JOIN public.org_members om ON om.org_id = mp.org_id
        WHERE mpm.id = meal_plan_components.meal_id
          AND om.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_meal_plan_components_meal_id ON public.meal_plan_components(meal_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_components_food_item_id ON public.meal_plan_components(food_item_id);
