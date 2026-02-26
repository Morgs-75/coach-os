---
phase: 07-plan-builder-ai-generation
plan: "02"
subsystem: nutrition
tags: [nutrition, plan-builder, meal-crud, food-search, macros, api, next.js, supabase]
dependency_graph:
  requires: [07-01-SUMMARY]
  provides: [meals-api, components-api, meal-editor-ui, food-search-ui, macro-totals]
  affects:
    - apps/trainer-web/src/app/(app)/nutrition/[planId]/PlanBuilderClient.tsx
    - apps/trainer-web/src/app/api/nutrition/plans/[planId]/meals/route.ts
    - apps/trainer-web/src/app/api/nutrition/plans/[planId]/meals/[mealId]/route.ts
    - apps/trainer-web/src/app/api/nutrition/plans/[planId]/meals/[mealId]/components/route.ts
    - apps/trainer-web/src/app/api/nutrition/plans/[planId]/meals/[mealId]/components/[componentId]/route.ts
tech_stack:
  added: []
  patterns:
    - Next.js 15 async params (await params before destructuring)
    - Supabase nested select with food_item join on components
    - Optimistic local state mutation via callback lifting
    - 200ms debounced fetch for food search
    - onMouseDown handler to beat input blur in dropdown selection
key_files:
  created:
    - apps/trainer-web/src/app/api/nutrition/plans/[planId]/meals/route.ts
    - apps/trainer-web/src/app/api/nutrition/plans/[planId]/meals/[mealId]/route.ts
    - apps/trainer-web/src/app/api/nutrition/plans/[planId]/meals/[mealId]/components/route.ts
    - apps/trainer-web/src/app/api/nutrition/plans/[planId]/meals/[mealId]/components/[componentId]/route.ts
  modified:
    - apps/trainer-web/src/app/(app)/nutrition/[planId]/PlanBuilderClient.tsx
decisions:
  - All 4 API routes inline verifyPlanOwnership helper (no shared module) — consistent with days/route.ts pattern, avoids abstraction overhead
  - Component POST returns food_item join immediately — no second fetch needed to display macros on add
  - onMouseDown instead of onClick for food dropdown items — fires before input blur so item selection registers before dropdown closes
  - Local state mutation callbacks (onDayUpdated -> handleMealUpdated -> handleComponentUpdated) replace full loadPlan() reloads — avoids flicker, keeps latency low
  - 204 responses use new NextResponse(null, { status: 204 }) — consistent with Next.js pattern, not NextResponse.json({})
metrics:
  duration_seconds: 175
  completed_date: "2026-02-27"
  tasks_completed: 2
  files_created: 4
  files_modified: 1
---

# Phase 7 Plan 2: Meal CRUD + Food Search + Macro Totals Summary

**One-liner:** Interactive meal builder with AFCD food search, inline qty editing, and live macro calculation at component/meal/day level — all persisted to Supabase via 4 new API routes.

## What Was Built

**Task 1: 4 API routes for meals and components**

- `POST /api/nutrition/plans/[planId]/meals` — adds a meal to a day; verifies day belongs to the plan, auto-increments sort_order, returns the new meal row
- `PATCH /api/nutrition/plans/[planId]/meals/[mealId]` — updates meal_type, title, note, or sort_order; whitelists fields to prevent injection
- `DELETE /api/nutrition/plans/[planId]/meals/[mealId]` — removes meal (cascade deletes its components via FK); returns 204
- `POST /api/nutrition/plans/[planId]/meals/[mealId]/components` — adds a food component to a meal; returns full row with joined food_item for immediate macro display; qty_g defaults to 100
- `PATCH /api/nutrition/plans/[planId]/meals/[mealId]/components/[componentId]` — updates qty_g and/or custom_name; returns updated row with food_item join
- `DELETE /api/nutrition/plans/[planId]/meals/[mealId]/components/[componentId]` — removes component; returns 204

All routes follow the existing auth pattern: `getOrgId` → `verifyPlanOwnership` → operate. RLS on child tables enforces org isolation via EXISTS chain (component → meal → day → plan → org_id).

**Task 2: Interactive PlanBuilderClient.tsx**

- **DayPanel** (fully replaced): "+ Add Meal" button reveals inline form with meal_type select + optional custom title. Submit POSTs to meals API, appends new Meal to local state. `onDayUpdated` callback lifts changes to PlanBuilderClient without full reloads.
- **MealCard** (fully replaced): Header shows meal type label + optional title + "Remove" delete button. Body contains ComponentRow table + FoodSearchInput. Footer shows MacroBar meal total when components exist.
- **ComponentRow**: Table row per component showing food name, editable qty input, and scaled macros (kcal/protein/carb/fat). `onChange` updates local qty for live display; `onBlur` PATCHes the API if value changed. Delete button appears on row hover (group/opacity trick).
- **FoodSearchInput**: Text input with dashed border. Debounced 200ms fetch to `/api/nutrition/foods?q=...` on input ≥ 2 chars. Dropdown shows food_name + food_group. `onMouseDown` (not onClick) fires before input blur so selection isn't lost. Selecting POSTs to components API, clears input, resets results.
- **MacroBar**: Reusable bar component showing kcal, P, C, F totals. Used at both meal level and day level (highlight variant for day total).
- **computeTotals**: Helper that reduces a Component[] to MacroTotals by scaling food_item values by qty_g/100.
- **handleDayUpdated**: Top-level callback in PlanBuilderClient that replaces a day in plan.days by id, triggering re-render of MacroBars and sidebar day list.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 32ae1f5 | feat(07-02): create meals and components API routes |
| 2 | 523cf95 | feat(07-02): wire up meal editing, food search, and macro totals in PlanBuilderClient |

## Decisions Made

1. **Inline verifyPlanOwnership per route** — No shared module. Each route file copies the 10-line helper. Matches days/route.ts pattern established in Plan 01. The alternative (a shared utility) introduces an abstraction with no current benefit since there are only 4 routes.

2. **Component POST returns food_item join** — The SELECT on insert includes `food_item:food_items(...)`. This means the client gets full macro data in the POST response and can display it immediately — no second API call needed.

3. **onMouseDown for dropdown selection** — Click fires after blur. When a user clicks a dropdown item, the input loses focus first (blur), then the click fires. If the dropdown is hidden on blur, the click never lands. Using onMouseDown fires before blur, so the selection registers correctly.

4. **Local state mutation instead of loadPlan()** — Plan 01 added an `onReload` prop to DayPanel for this purpose. Plan 02 instead uses a callback chain: `handleDayUpdated` → `handleMealUpdated` → `handleComponentUpdated/Added/Deleted`. Each mutation returns the updated entity from the API (with food_item join for components) and patches local state in place. This avoids the network round-trip and flicker of a full reload.

5. **204 as `new NextResponse(null, { status: 204 })`** — `NextResponse.json({}, { status: 204 })` sends a body which some HTTP clients reject for 204. Using `new NextResponse(null, ...)` sends a true empty body.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All 5 files confirmed on disk. Both commits (32ae1f5, 523cf95) confirmed in git log.

## What's Next

- **Plan 03** (AI Generation): Add the AI generate button to the plan header that calls an LLM (likely Anthropic Claude via the API) to populate a full day or entire plan with meals and components based on client targets
- **Plan 04** (Publish + Share): Publish flow, share link, and client-facing read-only plan view
