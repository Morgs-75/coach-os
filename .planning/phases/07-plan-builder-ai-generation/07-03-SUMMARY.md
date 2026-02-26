---
phase: 07-plan-builder-ai-generation
plan: "03"
subsystem: nutrition
tags: [nutrition, ai-generation, claude, anthropic, plan-builder, meal-plan, afcd, next.js, supabase]
dependency_graph:
  requires:
    - phase: 07-02
      provides: meal CRUD API routes, PlanBuilderClient.tsx interactive foundation
  provides:
    - POST /api/nutrition/plans/[planId]/generate endpoint
    - GenerateModal component with goal/calories/macros/restrictions inputs
    - AI-generated 7-day meal plan seeded into DB via Anthropic claude-sonnet-4-6
  affects:
    - apps/trainer-web/src/app/api/nutrition/plans/[planId]/generate/route.ts
    - apps/trainer-web/src/app/(app)/nutrition/[planId]/PlanBuilderClient.tsx
tech_stack:
  added: []
  patterns:
    - Anthropic Messages API via direct fetch (same pattern as marketing/templates/generate)
    - Food sample passed in prompt as id|name|group|macros table for Claude to reference real UUIDs
    - JSON response extracted with regex /\{[\s\S]*\}/ to strip accidental markdown fences
    - All food_item_ids validated against DB before insertion — invalid IDs silently skipped
    - FK chain insert order: meal_plan_days → meal_plan_meals → meal_plan_components
    - DELETE on meal_plan_days cascades to meals and components automatically
key_files:
  created:
    - apps/trainer-web/src/app/api/nutrition/plans/[planId]/generate/route.ts
  modified:
    - apps/trainer-web/src/app/(app)/nutrition/[planId]/PlanBuilderClient.tsx
key-decisions:
  - "Fetch 250 food_items ordered by food_group+food_name for structured diversity — avoids random() unpredictability, deterministic for same food set"
  - "Validate all food_item_ids from Claude response before any DB insert — prevents foreign key errors from hallucinated UUIDs"
  - "Clear existing days before insert (DELETE + CASCADE) — simpler than diff/upsert, acceptable since generate replaces entire plan"
  - "macroSum === 100 guard in modal disables Generate Plan button and shows amber warning — prevents bad prompts from reaching API"
  - "plan reload on success uses full fetch to /api/nutrition/plans/[planId] — gets complete nested days/meals/components in one call rather than patching state"
requirements-completed: [NUTR-10]
duration: 3min
completed: "2026-02-27"
---

# Phase 7 Plan 3: AI Plan Generation Summary

**claude-sonnet-4-6 generates a complete 7-day meal plan from goal/calories/macros using real AFCD food IDs, validated and inserted into DB, with modal UI in the plan builder**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-26T23:22:04Z
- **Completed:** 2026-02-26T23:24:20Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- POST /api/nutrition/plans/[planId]/generate endpoint calls Claude with 250 AFCD food samples, validates UUIDs, clears existing days, and inserts full 7-day plan
- GenerateModal component provides coach-facing form with goal, daily calorie target, 3-field macro split (must sum to 100%), and dietary restrictions
- On success, plan builder reloads from API and auto-selects Day 1 so the coach immediately sees their generated days in the sidebar

## Task Commits

Each task was committed atomically:

1. **Task 1: Create POST /api/nutrition/plans/[planId]/generate endpoint** - `03a2062` (feat)
2. **Task 2: Add GenerateModal and Generate with AI button to PlanBuilderClient** - `6aaa5fe` (feat)

**Plan metadata:** (created in final commit)

## Files Created/Modified

- `apps/trainer-web/src/app/api/nutrition/plans/[planId]/generate/route.ts` - AI generation endpoint: authenticates, fetches food sample, builds Claude prompt, calls Anthropic API, validates IDs, clears + inserts 7-day plan
- `apps/trainer-web/src/app/(app)/nutrition/[planId]/PlanBuilderClient.tsx` - Added showGenerateModal state, "Generate with AI" button in plan header, GenerateModal render, and GenerateModal component

## Decisions Made

1. **250 food items ordered by food_group + food_name** — provides structured diversity for the prompt. Random ordering would give different results per run; ordered gives deterministic coverage of food groups.

2. **Food ID validation via Set lookup before any DB insert** — all IDs from Claude's response are fetched from food_items in one IN query, building a validFoodIds Set. Components with IDs not in the Set are silently skipped. This prevents FK violations from hallucinated UUIDs without aborting the whole generation.

3. **DELETE existing days before insert** — simpler than diffing or upserting. The user is explicitly replacing their plan with the generated one; starting clean avoids ordering conflicts and stale day numbers.

4. **macroSum validation in modal** — The Generate Plan submit button is disabled if proteinPct + carbPct + fatPct !== 100. An amber warning shows the current total. This prevents malformed prompts and gives immediate feedback to the coach.

5. **Full reload on success** — After generation, the component re-fetches the full plan (days + meals + components) via GET /api/nutrition/plans/[planId]. This avoids the complexity of constructing the full nested state from the generation response, and ensures the UI accurately reflects what was actually inserted.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

`ANTHROPIC_API_KEY` must be set in the Netlify environment (and `.env.local` for local dev). If absent, the endpoint returns 500 with "AI not configured — ANTHROPIC_API_KEY is missing".

## Next Phase Readiness

- **Plan 04** (Publish + Share): The plan builder now has full CRUD + AI generation. Plan 04 adds the publish flow, share link generation, and a client-facing read-only view of the plan.

---
*Phase: 07-plan-builder-ai-generation*
*Completed: 2026-02-27*

## Self-Check: PASSED

Files confirmed on disk:
- apps/trainer-web/src/app/api/nutrition/plans/[planId]/generate/route.ts — FOUND
- apps/trainer-web/src/app/(app)/nutrition/[planId]/PlanBuilderClient.tsx — FOUND (modified)

Commits confirmed in git log:
- 03a2062 feat(07-03): create POST /api/nutrition/plans/[planId]/generate endpoint — FOUND
- 6aaa5fe feat(07-03): add GenerateModal and Generate with AI button to PlanBuilderClient — FOUND
