---
phase: 06-nutrition-foundation
plan: 04
subsystem: frontend
tags: [nextjs, react, supabase, nutrition, meal-plans, sidebar, api]

# Dependency graph
requires:
  - phase: 06-01
    provides: meal_plans table with org-scoped schema and RLS
  - phase: 06-03
    provides: /api/nutrition/foods food search endpoint pattern
provides:
  - Nutrition sidebar nav item linking to /nutrition
  - GET /api/nutrition/plans — list org meal plans, optional client_id filter
  - POST /api/nutrition/plans — create draft meal plan with client assignment and dates
  - /nutrition page with plan list table (client filter, status badges) and create plan modal
affects:
  - 07-nutrition-planner (plan builder links from /nutrition list into individual plan editor)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "getOrgAndUser helper (extends getOrgId to also return user.id for INSERT created_by)"
    - "Page.tsx + NutritionClient.tsx split: server wrapper + 'use client' component"
    - "useCallback wrapping loadData to satisfy useEffect dependency array"
    - "Status badge: grey for draft, green for published (clsx conditional)"

key-files:
  created:
    - apps/trainer-web/src/app/(app)/nutrition/page.tsx
    - apps/trainer-web/src/app/(app)/nutrition/NutritionClient.tsx
    - apps/trainer-web/src/app/api/nutrition/plans/route.ts
  modified:
    - apps/trainer-web/src/components/Sidebar.tsx

key-decisions:
  - "getOrgAndUser replaces getOrgId in plans route — POST needs user.id for created_by field; returning both avoids a second auth.getUser() call"
  - "Clients loaded via Supabase client-side query (not API) for filter dropdown — avoids building a separate /api/clients endpoint for this page"
  - "useCallback on loadData with selectedClientId dependency — prevents stale closure while keeping ESLint happy"

patterns-established:
  - "Nutrition API routes directory: apps/trainer-web/src/app/api/nutrition/ (foods + plans routes now both here)"

requirements-completed:
  - NUTR-05
  - NUTR-06

# Metrics
duration: 8min
completed: 2026-02-27
---

# Phase 6 Plan 04: Nutrition Scaffold Summary

**Sidebar nav entry, /nutrition plan list page with client filter and status badges, create plan modal, and GET/POST /api/nutrition/plans API — coaches can navigate to /nutrition, view all org plans, and create new draft plans**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-26T21:30:29Z
- **Completed:** 2026-02-27
- **Tasks:** 2/2 (plus checkpoint awaiting human verify)
- **Files modified:** 4

## Accomplishments

- Added Nutrition nav item to Sidebar (between Clients and Leads) with 🥗 icon
- Created /api/nutrition/plans with GET (org-scoped list, optional client_id filter) and POST (create draft plan with validation)
- Created /nutrition page: plan list table with Plan Name / Client / Date Range / Status / Created columns
- Client filter dropdown (all org active clients), "New Plan" button opens create modal
- Create plan modal: client select, required name field, optional start/end dates, inline error, spinner on submit
- Empty state renders when no plans exist; list refreshes after successful create

## Task Commits

Each task was committed atomically:

1. **Task 1: Sidebar nav + /api/nutrition/plans route** - `acd99c5` (feat)
2. **Task 2: /nutrition page + NutritionClient.tsx** - `70435b9` (feat)

## Files Created/Modified

- `apps/trainer-web/src/components/Sidebar.tsx` - Nutrition nav item inserted after Clients entry
- `apps/trainer-web/src/app/api/nutrition/plans/route.ts` - GET lists plans with optional client filter; POST creates draft plan; both org-scoped, 401 on unauth
- `apps/trainer-web/src/app/(app)/nutrition/page.tsx` - Server component wrapper
- `apps/trainer-web/src/app/(app)/nutrition/NutritionClient.tsx` - Full client component: plan list, filter, modal, create logic

## Decisions Made

- getOrgAndUser replaces getOrgId in plans route: POST handler needs user.id for the created_by column, so the helper was extended to return both org_id and user.id, avoiding a second auth.getUser() call.
- Clients loaded via Supabase client-side query for filter dropdown: avoids building a separate /api/clients endpoint. The component already has an authenticated Supabase client; a direct query is simpler and consistent with how other pages load lookup data.
- useCallback on loadData: wrapping in useCallback with selectedClientId as dependency satisfies the useEffect dependency array without triggering infinite re-renders.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Dev server verification is the next step (checkpoint:human-verify).

## Next Phase Readiness

- /nutrition page is live in codebase, ready to deploy
- Phase 07 (nutrition planner) can link to individual plan detail pages from /nutrition list
- All NUTR-05 and NUTR-06 requirements completed

---
*Phase: 06-nutrition-foundation*
*Completed: 2026-02-27*

## Self-Check: PASSED

- FOUND: apps/trainer-web/src/app/(app)/nutrition/page.tsx
- FOUND: apps/trainer-web/src/app/(app)/nutrition/NutritionClient.tsx
- FOUND: apps/trainer-web/src/app/api/nutrition/plans/route.ts
- FOUND: commit acd99c5 (feat(06-04): add Nutrition sidebar nav and GET/POST /api/nutrition/plans)
- FOUND: commit 70435b9 (feat(06-04): create /nutrition page with plan list and create modal)
- CONFIRMED: Sidebar.tsx contains /nutrition nav entry
- CONFIRMED: plans route contains meal_plans, org_id, client_id, status keywords
- CONFIRMED: NutritionClient.tsx contains use client, MealPlan, showModal, handleCreatePlan, draft, published, New Plan
