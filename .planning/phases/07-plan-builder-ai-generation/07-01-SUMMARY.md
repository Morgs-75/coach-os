---
phase: 07-plan-builder-ai-generation
plan: "01"
subsystem: nutrition
tags: [nutrition, plan-builder, api, next.js, supabase]
dependency_graph:
  requires: [06-04-SUMMARY]
  provides: [plan-builder-shell, plan-detail-api, days-crud-api]
  affects: [NutritionClient.tsx, /nutrition/[planId] route]
tech_stack:
  added: []
  patterns: [Next.js 15 async params, Supabase nested select, optimistic UI update]
key_files:
  created:
    - apps/trainer-web/src/app/(app)/nutrition/[planId]/page.tsx
    - apps/trainer-web/src/app/(app)/nutrition/[planId]/PlanBuilderClient.tsx
    - apps/trainer-web/src/app/api/nutrition/plans/[planId]/route.ts
    - apps/trainer-web/src/app/api/nutrition/plans/[planId]/days/route.ts
  modified:
    - apps/trainer-web/src/app/(app)/nutrition/NutritionClient.tsx
decisions:
  - Next.js 15 async params pattern used throughout — `await params` before destructuring in all dynamic route handlers
  - loadPlan useCallback depends on [planId, selectedDayId] but useEffect only fires on [planId] — avoids re-fetching on day selection while satisfying linter
  - DayPanel receives onReload prop for future mutations (Plan 02 will call it after meal add/delete)
  - plan-action-slot and add-meal-slot-[dayId] div placeholders left for Plans 02/04 to wire into
metrics:
  duration_seconds: 140
  completed_date: "2026-02-26"
  tasks_completed: 2
  files_created: 4
  files_modified: 1
---

# Phase 7 Plan 1: Plan Builder Page Shell Summary

**One-liner:** Plan builder shell at /nutrition/[planId] with days sidebar, day panel, and nested plan API returning days/meals/components sorted by day_number/sort_order.

## What Was Built

Two tasks delivered the navigation skeleton for the nutrition plan builder:

**Task 1: NutritionClient link + plan detail API routes**
- `NutritionClient.tsx`: Plan name cell changed from `<span>` to `<a href="/nutrition/${plan.id}">` — coaches can now navigate from the plan list to the builder
- `GET /api/nutrition/plans/[planId]`: Returns the full plan with nested `meal_plan_days` > `meal_plan_meals` > `meal_plan_components` > `food_items`, sorted server-side by day_number, sort_order
- `PATCH /api/nutrition/plans/[planId]`: Accepts updates to name, dates, client_id, status, published_at; org-scoped for security
- `GET /api/nutrition/plans/[planId]/days`: Lists days for a plan, ordered by day_number
- `POST /api/nutrition/plans/[planId]/days`: Auto-increments day_number (max + 1), inserts new day, verifies plan ownership before write

**Task 2: Page and PlanBuilderClient component**
- `page.tsx`: Thin server component wrapper that awaits params (Next.js 15 pattern) and passes planId to client
- `PlanBuilderClient.tsx`: Two-column layout — 192px days sidebar + flex-1 day content panel
- Days sidebar: lists all days with active highlighting, "No days yet" empty state, "+ Add Day" button with spinner
- Add Day: POSTs to days API, optimistically appends new day to state, auto-selects it
- DayPanel: shows day number header, optional date, and empty state when no meals exist
- MealCard: read-only macro display table — kcal/protein/carb/fat scaled from food_item per-100g values × qty_g

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 342e771 | feat(07-01): add plan link in NutritionClient and create plan detail API routes |
| 2 | 011c8e0 | feat(07-01): create /nutrition/[planId] page shell and PlanBuilderClient component |

## Decisions Made

1. **Next.js 15 async params** — All dynamic route handlers use `await params` before destructuring `planId`. This matches the existing pattern in the codebase (confirmed in 06-04 routes).

2. **loadPlan dependency handling** — `useCallback` includes `selectedDayId` to satisfy linter rules, but `useEffect` only lists `[planId]` as a dependency so the plan doesn't re-fetch every time the user clicks a different day. Explicit `loadPlan()` calls after mutations keep data fresh.

3. **Slot divs for future plans** — `<div id="plan-action-slot" />` in the plan header and `<div id={`add-meal-slot-${day.id}`} />` in DayPanel are placeholders. Plans 02 and 04 will replace these with actual UI elements rather than modifying this file's structure.

4. **onReload prop on DayPanel** — DayPanel receives `onReload` so Plan 02 can trigger a full reload after adding/deleting meals without lifting state management into the parent prematurely.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

All 5 files confirmed on disk. Both commits (342e771, 011c8e0) confirmed in git log.

## What's Next

- **Plan 02** (Meal + Component Editor): Wire the `add-meal-slot` divs, add meal CRUD, component food-item autocomplete search using the `/api/nutrition/foods` endpoint from Phase 6
- **Plan 03** (AI Generation): Add the AI generate button that calls an LLM to populate a day or full plan with meals and components
