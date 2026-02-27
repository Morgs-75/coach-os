---
phase: 09-ai-feedback-loop-versioning
plan: "02"
subsystem: api
tags: [api, nutrition, ai, versioning, claude, supabase]

# Dependency graph
requires:
  - phase: 09-ai-feedback-loop-versioning
    plan: "01"
    provides: ai_draft_* columns on meal_plan_feedback; parent_plan_id FK on meal_plans
  - phase: 06-nutrition-foundation
    provides: meal_plans, meal_plan_days, meal_plan_meals, meal_plan_components, food_items tables
  - phase: 08-client-portal-nutrition-view
    provides: meal_plan_feedback table (0042)
provides:
  - GET /api/nutrition/feedback/[id]: feedback detail with meal/component/food_item join + resolved draft_food_item
  - PATCH /api/nutrition/feedback/[id]: mark feedback status (pending | reviewed)
  - POST /api/nutrition/feedback/[id]/draft: Claude AI food swap suggestion → writes ai_draft_* columns
  - POST /api/nutrition/plans/[planId]/version: deep-copy plan with version increment + component swap
affects:
  - 09-03 (coach review UI — reads these endpoints for the feedback queue and version publish flow)
  - 09-04 (batch runner — uses parent_plan_id structure created by version endpoint)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-query pattern for non-standard FK join: fetch feedback row first, then food_items by ai_draft_food_item_id separately"
    - "Claude REST fetch pattern (existing): fetch to api.anthropic.com/v1/messages with x-api-key header"
    - "max_tokens: 512 for focused single-food suggestion (not 8192 like generate/route.ts)"
    - "Sequential INSERT loop for deep-copy: days → meals → components (~84 inserts max for 7-day plan)"
    - "No rollback on partial failure — acceptable for coach-triggered action; coach can delete and retry"
    - "ILIKE food search with first-word fallback for Claude-suggested food name"

key-files:
  created:
    - apps/trainer-web/src/app/api/nutrition/feedback/[id]/route.ts
    - apps/trainer-web/src/app/api/nutrition/feedback/[id]/draft/route.ts
    - apps/trainer-web/src/app/api/nutrition/plans/[planId]/version/route.ts
  modified: []

key-decisions:
  - "[09-02] Two-query approach for draft_food_item: fetch feedback first, then food_items by ai_draft_food_item_id — avoids fighting Supabase join naming for non-standard FK field"
  - "[09-02] max_tokens: 512 for draft endpoint — focused single-food suggestion needs far less context than full plan generation"
  - "[09-02] ILIKE + first-word fallback for food matching — Claude may suggest 'Chicken breast, skinless' but AFCD has 'Chicken, breast'; first-word search catches this"
  - "[09-02] No rollback on deep-copy failure — Supabase JS client lacks transaction support; partial plans acceptable for coach-triggered action"
  - "[09-02] Return 422 (not 500) when Claude suggests a food name that cannot be found in AFCD — this is an expected data mismatch, not an infrastructure error"

# Metrics
duration: 3min
completed: 2026-02-27
---

# Phase 9 Plan 02: AI Draft + Version API Endpoints Summary

**Three new API routes enabling Claude-powered food swap suggestions and deep-copy plan versioning for the coach feedback review workflow**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-27T07:26:45Z
- **Completed:** 2026-02-27T07:29:06Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments

### Task 1: Feedback detail + AI draft endpoints

**`GET /api/nutrition/feedback/[id]`**
- Returns the full feedback row with nested `meal_plan_meals` join (meal_type, title) and `meal_plan_components` join (with `food_items` for each component)
- Fetches `draft_food_item` (the Claude-suggested replacement) in a second query keyed on `ai_draft_food_item_id` — two-query pattern avoids non-standard FK join naming issues in Supabase
- Auth: verifies feedback belongs to coach's org via `meal_plans.org_id` check
- Returns 401 for unauthenticated requests, 404 if not found

**`PATCH /api/nutrition/feedback/[id]`**
- Updates `status` field only (`pending` | `reviewed`) — narrow PATCH for coach review actions
- Same org ownership check as GET

**`POST /api/nutrition/feedback/[id]/draft`**
- Loads feedback + verifies org ownership
- Returns 400 if `meal_id` is null (can only draft for meal-level feedback)
- Loads meal with components + food_items join
- Selects `sort_order = 0` component as the target to swap
- Builds sports dietitian prompt with: feedback type/comment/scope, meal name, component macros per serving
- Calls Claude (`claude-sonnet-4-6`, max_tokens: 512)
- Parses `{ food_name, qty_g, reasoning }` from Claude's JSON response
- Searches `food_items` via ILIKE (`%food_name%`) with first-word fallback for partial name matches
- Returns 422 if no AFCD match found (expected data gap, not infrastructure error)
- Writes `ai_draft_food_item_id`, `ai_draft_qty_g`, `ai_draft_reasoning` to feedback row via UPDATE
- Returns 201 with `{ draft: { food_item_id, food_item_name, qty_g, reasoning, component_id } }`

### Task 2: Plan versioning endpoint

**`POST /api/nutrition/plans/[planId]/version`**
- Auth: org + user, plan ownership verified
- Validates `component_id`, `new_food_item_id`, `new_qty_g` all present; validates `new_food_item_id` exists in `food_items`
- Creates new `meal_plans` row: copies org_id/client_id/name/start_date/end_date, sets `version = source.version + 1`, `parent_plan_id = planId`, `status = published`, `published_at = now()`
- Sequential INSERT loop: all source days → for each day, load and copy meals → for each meal, load and copy components
- The swap: if `component.id === component_id`, uses `new_food_item_id` + `new_qty_g`; otherwise copies original values verbatim
- If `feedback_id` provided: marks that feedback row as `status = reviewed` (best-effort, does not fail the endpoint)
- Returns 201 with `{ plan: { id: newPlan.id, version: newPlan.version } }`

## Task Commits

Each task was committed atomically:

1. **Task 1: Feedback detail + AI draft endpoints** — `6d3e754` (feat)
2. **Task 2: Plan versioning endpoint** — `e54c7d4` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/trainer-web/src/app/api/nutrition/feedback/[id]/route.ts` — GET (feedback detail with joins + draft_food_item) + PATCH (update status)
- `apps/trainer-web/src/app/api/nutrition/feedback/[id]/draft/route.ts` — POST (Claude food swap suggestion → ai_draft_* columns)
- `apps/trainer-web/src/app/api/nutrition/plans/[planId]/version/route.ts` — POST (deep-copy plan with version increment + component swap)

## Decisions Made

- Two-query approach for `draft_food_item` in GET: Supabase cannot join `ai_draft_food_item_id` as a named relation (non-standard FK field name). Fetching the feedback row first then querying `food_items` by `ai_draft_food_item_id` is simpler than fighting the Supabase join naming system.
- `max_tokens: 512` for draft endpoint. The AI generates a single food suggestion with three fields (`food_name`, `qty_g`, `reasoning`). This needs far less context window than full 7-day plan generation (which uses 8192).
- ILIKE + first-word fallback for food matching. Claude may describe foods with qualifiers (e.g., "Chicken breast, skinless, raw") but AFCD may use different naming. The first-word fallback provides a broader catch.
- No rollback on deep-copy failure. Supabase's JS client does not support transactions. Partial plans are acceptable for a coach-triggered action — the coach can delete the incomplete plan and retry.
- Return 422 (Unprocessable Entity) when Claude suggests a food not found in AFCD. This is an expected data gap (Claude knows food names AFCD doesn't have), not an infrastructure error. 422 signals to the caller that the AI suggestion needs manual review.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — these are new API routes with no additional environment variables or Supabase configuration required. `ANTHROPIC_API_KEY` is already in the environment from Phase 7.

## Next Phase Readiness

- `GET /api/nutrition/feedback/[id]` is ready for Plan 03 coach review UI
- `POST /api/nutrition/feedback/[id]/draft` is ready for Plan 03 "Generate AI Draft" button
- `POST /api/nutrition/plans/[planId]/version` is ready for Plan 03 "Publish Version" button
- All three endpoints return 401 for unauthenticated requests (correct security gate)
- TypeScript compiles with zero errors

---
*Phase: 09-ai-feedback-loop-versioning*
*Completed: 2026-02-27*

## Self-Check: PASSED

- FOUND: apps/trainer-web/src/app/api/nutrition/feedback/[id]/route.ts
- FOUND: apps/trainer-web/src/app/api/nutrition/feedback/[id]/draft/route.ts
- FOUND: apps/trainer-web/src/app/api/nutrition/plans/[planId]/version/route.ts
- FOUND: .planning/phases/09-ai-feedback-loop-versioning/09-02-SUMMARY.md
- FOUND commit: 6d3e754 (Task 1)
- FOUND commit: e54c7d4 (Task 2)
- TypeScript: zero errors (`npx tsc --noEmit` clean)
