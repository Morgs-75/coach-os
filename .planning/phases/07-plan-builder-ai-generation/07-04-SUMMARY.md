---
phase: 07-plan-builder-ai-generation
plan: "04"
subsystem: nutrition
tags: [nutrition, plan-builder, publish, meal-plan, next.js, supabase]
dependency_graph:
  requires:
    - phase: 07-03
      provides: AI generation endpoint, GenerateModal UI, plan builder shell with days/meals/components
    - phase: 07-01
      provides: PATCH /api/nutrition/plans/[planId] endpoint that accepts status and published_at
  provides:
    - Publish button in PlanBuilderClient.tsx that PATCHes plan status to published
    - Optimistic UI update on publish (no page reload required)
    - Disabled publish state with tooltip when plan has no days
    - Error banner display for publish failures
  affects:
    - apps/trainer-web/src/app/(app)/nutrition/[planId]/PlanBuilderClient.tsx
tech_stack:
  added: []
  patterns:
    - Optimistic state update via setPlan callback after successful PATCH — avoids full reload
    - Conditional render pattern (published ? badge : button) replaces placeholder div
    - Disabled-with-tooltip pattern for action gates (days.length === 0)
key_files:
  created: []
  modified:
    - apps/trainer-web/src/app/(app)/nutrition/[planId]/PlanBuilderClient.tsx
key-decisions:
  - "Optimistic update via setPlan callback not full loadPlan() reload — status change is atomic, no need to refetch entire nested plan"
  - "Publish button disabled (not hidden) when no days — clear visual affordance with tooltip explaining the gate"
  - "plan-action-slot placeholder div removed and replaced inline — cleaner than injecting into an empty div"
requirements-completed: [NUTR-11]
duration: 3min
completed: "2026-02-27"
---

# Phase 7 Plan 4: Publish Button Summary

**Publish button in plan builder PATCHes meal_plans.status to published with optimistic UI update; disabled with tooltip when plan has no days**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-26T23:27:05Z
- **Completed:** 2026-02-26T23:30:00Z
- **Tasks:** 1 auto + 1 checkpoint (human-verify)
- **Files modified:** 1

## Accomplishments

- PlanBuilderClient.tsx now has a Publish button that calls PATCH /api/nutrition/plans/[planId] with status=published and published_at=now()
- On success, plan status updates instantly via optimistic state mutation (no page reload needed)
- Button is disabled with an explanatory tooltip when the plan has no days
- Published plans show a green checkmark and "Published" text instead of the button
- Error banner appears below the header on publish failure (PATCH non-OK response or network error)
- plan-action-slot placeholder div removed

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Publish button to PlanBuilderClient** - `9d00abd` (feat)

**Plan metadata:** (created in final commit)

## Files Created/Modified

- `apps/trainer-web/src/app/(app)/nutrition/[planId]/PlanBuilderClient.tsx` — Added publishing/publishError state, handlePublish function, Publish/Published conditional render, error banner; removed plan-action-slot placeholder

## Decisions Made

1. **Optimistic update via setPlan callback** — After a successful PATCH, only the status and published_at fields change on the plan. Using a setPlan callback to update those two fields is sufficient and faster than re-fetching the entire nested plan structure.

2. **Disabled button over hidden button** — Hiding the Publish button entirely when there are no days could confuse coaches. A disabled button with a tooltip makes the affordance visible while explaining the gate condition.

3. **plan-action-slot placeholder removed inline** — The placeholder was a comment-only convention from Plan 01. Plan 04 replaces it with the actual conditional render, which is cleaner than inserting a React tree into an empty div via a slot pattern.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 7 (Plan Builder + AI Generation) is fully complete: manual build, AI generation, and publish all working
- Phase 8 (Client Portal — Nutrition View) can now read meal_plans WHERE status = 'published' to show clients their assigned nutrition plans
- The published_at timestamp is set at publish time and persists across page reloads

---
*Phase: 07-plan-builder-ai-generation*
*Completed: 2026-02-27*

## Self-Check: PASSED

Files confirmed on disk:
- apps/trainer-web/src/app/(app)/nutrition/[planId]/PlanBuilderClient.tsx — FOUND (modified)
- .planning/phases/07-plan-builder-ai-generation/07-04-SUMMARY.md — FOUND

Commits confirmed in git log:
- 9d00abd feat(07-04): add Publish button to PlanBuilderClient — FOUND
