---
phase: "08"
plan: "03"
subsystem: portal-nutrition-ui
tags: [portal, nutrition, meal-plan, feedback, react, typescript]
dependency_graph:
  requires: ["08-02"]
  provides: ["portal-nutrition-view", "feedback-drawer"]
  affects: ["(portal)/portal/[token]/page.tsx", "(portal)/portal/[token]/PortalDashboard.tsx"]
tech_stack:
  added: []
  patterns: ["CSS-only stacked bar chart", "collapsible day cards", "bottom sheet drawer", "tab navigation"]
key_files:
  created:
    - apps/trainer-web/src/app/(portal)/portal/[token]/NutritionView.tsx
    - apps/trainer-web/src/app/(portal)/portal/[token]/FeedbackDrawer.tsx
  modified:
    - apps/trainer-web/src/app/(portal)/portal/[token]/page.tsx
    - apps/trainer-web/src/app/(portal)/portal/[token]/PortalDashboard.tsx
decisions:
  - "NutritionPlan + Meal types exported from NutritionView.tsx — shared via import, avoids duplicate type declarations"
  - "FeedbackDrawer resets all form fields on close — prevents stale state if reopened on a different meal"
  - "_token renamed to _token in NutritionView props — token not needed in view component (API call is in FeedbackDrawer via prop), avoids lint unused-var warning"
  - "Tab bar nested inside header div — keeps border-b visual grouping correct with -mb-px border overlap pattern"
  - "page.tsx casts planRes.data as any for nested sort — Supabase inferred types for deeply nested selects are complex; runtime sort is simpler than fighting the type system"
metrics:
  duration_minutes: 20
  completed_date: "2026-02-27"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 2
status: complete
requirements_completed: [PORTAL-NUTRITION-03, PORTAL-NUTRITION-04]
---

# Phase 8 Plan 03: Portal Nutrition View Summary

**One-liner:** Client portal nutrition tab with 7-day collapsible meal plan, macro tables, CSS stacked bar chart, and bottom-sheet feedback drawer.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | NutritionView + FeedbackDrawer components | 9e614ae | NutritionView.tsx, FeedbackDrawer.tsx |
| 2 | Wire Nutrition tab into portal page + PortalDashboard | e37919d | page.tsx, PortalDashboard.tsx |
| 3 | Human verification checkpoint | — | APPROVED by user |

## What Was Built

### NutritionView.tsx (307 lines)

- Exported types: `NutritionPlan`, `Day`, `Meal`, `Component`, `FoodItem` — shared by PortalDashboard and FeedbackDrawer
- Renders plan name + date range header
- 7-day collapsible cards (same chevron pattern as existing sessions cards), first day expanded by default
- Each day card contains:
  - Per-meal sections with heading (`meal_type — title` if title present)
  - Component table: 7 columns (Component / Qty / Unit / C / P / F / kcal) with `thead`, `tbody`, `tfoot` (totals row)
  - Macro scaling: `(food_item[macro] / 100) * qty_g` for each component
  - "Leave feedback" button with primaryColor border/text, calls `onFeedback(meal)` callback
  - Day totals panel: 4 KPI boxes in `grid-cols-4` + CSS stacked bar chart (amber/blue/red) + color legend

### FeedbackDrawer.tsx (200 lines)

- Fixed bottom sheet (`fixed bottom-0 left-0 right-0 z-50`) with semi-transparent backdrop
- 4 form fields: type select (6 options), scope select (3 options), comment textarea, forward preference select (optional + blank option)
- State machine: idle → submitting → success | error
- Success state: checkmark icon + "Thank you! Your coach has been notified." + Close button
- Error state: red banner with message, retryable
- Full form reset on close (whether via X, backdrop, or success)
- Submits `POST /api/portal/nutrition/feedback` with `{ token, plan_id, meal_id, type, scope, comment, forward }`

### page.tsx changes

- Added `meal_plans` fetch to `Promise.all` with full nested structure: `days > meals > components > food_items`
- Used `.maybeSingle()` — returns `null` (not error) when no published plan exists
- Sorts days by `day_number`, meals by `sort_order`, components by `sort_order` before passing to PortalDashboard
- Passes `mealPlan={mealPlan}` as new prop

### PortalDashboard.tsx changes

- Added `mealPlan: NutritionPlan | null` to Props interface
- Added Sessions | Nutrition tab bar inside header `<div>` with `activeTab` state
- Active tab styled with `primaryColor` text + `border-bottom`
- Sessions tab: wraps all existing content unchanged in `{activeTab === "sessions" && ...}`
- Nutrition tab: renders `<NutritionView>` when plan exists, or empty state card when null
- Feedback drawer state: `feedbackMeal`, `feedbackOpen`, `handleOpenFeedback`
- `<FeedbackDrawer>` rendered at bottom of component tree (always mounted)

## Deviations from Plan

None — plan executed exactly as written.

## Checkpoint Result

Task 3 (human verification) — APPROVED by user on 2026-02-27.

Verified in browser:
- Sessions tab loads and works correctly
- Nutrition tab renders (tab bar visible)
- Plan view or empty state shown correctly
- Feedback drawer functional: opens, submits, shows success state
- meal_plan_feedback row confirmed in Supabase

## Self-Check

Files created:
- [x] NutritionView.tsx — exists
- [x] FeedbackDrawer.tsx — exists

Files modified:
- [x] page.tsx — updated with nutrition fetch
- [x] PortalDashboard.tsx — updated with tabs + drawer

Commits:
- [x] 9e614ae — Task 1
- [x] e37919d — Task 2

TypeScript: zero errors confirmed on both tasks.
