---
phase: 09-ai-feedback-loop-versioning
plan: "03"
subsystem: ui
tags: [react, nextjs, supabase, ai, feedback, nutrition]

# Dependency graph
requires:
  - phase: 09-02
    provides: POST /api/nutrition/feedback/[id]/draft (Claude AI swap), POST /api/nutrition/plans/[planId]/version (deep-copy versioning), GET/PATCH /api/nutrition/feedback/[id]
  - phase: 06
    provides: GET /api/nutrition/foods (AFCD food search), meal_plan_feedback table, meal_plans/clients schema

provides:
  - GET /api/nutrition/feedback — list endpoint returning pending feedback items with joined plan/client/meal data
  - FeedbackInbox.tsx — coach feedback list with type badges, scope labels, Get AI Draft / Review Draft buttons
  - DraftReviewModal.tsx — state-machine modal with original vs AI comparison table, edit overrides, approve/reject actions
  - NutritionClient.tsx Plans/Feedback tab bar — lazy-mounts FeedbackInbox only when Feedback tab activated
affects:
  - 09-04 (batch runner or future phases referencing feedback workflow)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - State machine modal pattern (idle/drafting/draft_ready/approving/approved/rejected/error)
    - Debounced food search with onMouseDown selection (beats input blur)
    - Two-step Supabase query (get plan_ids for org, then filter feedback by plan_ids)
    - Lazy tab mount pattern (conditional render prevents fetch until tab activated)

key-files:
  created:
    - apps/trainer-web/src/app/api/nutrition/feedback/route.ts
    - apps/trainer-web/src/app/(app)/nutrition/FeedbackInbox.tsx
    - apps/trainer-web/src/app/(app)/nutrition/DraftReviewModal.tsx
  modified:
    - apps/trainer-web/src/app/(app)/nutrition/NutritionClient.tsx

key-decisions:
  - "Two-step feedback query: fetch plan_ids for org first, then .in('plan_id', planIds) — avoids Supabase filter-on-joined-column limitations"
  - "orgId stored in NutritionClient state from membership.org_id set during loadData — passed as prop to FeedbackInbox"
  - "DraftReviewModal initial state determined by item.ai_draft_food_item_id presence — jump to draft_ready if draft already exists"
  - "fetchFeedbackDetails called on modal open (for existing drafts) and after POST /draft returns — single shared function handles both cases"
  - "Feedback tab lazy-mounted with conditional render — no API call until coach navigates to the tab"

patterns-established:
  - "State machine modal: single state string drives all UI rendering, transitions are explicit, error state resets to correct prior state"
  - "Food override chip with clear button and onMouseDown selection — prevents blur from closing dropdown before click registers"

requirements-completed:
  - FEEDBACK-VERSIONING-04
  - FEEDBACK-VERSIONING-05

# Metrics
duration: 3min
completed: 2026-02-27
---

# Phase 9 Plan 03: Coach Feedback Inbox + Draft Review Modal Summary

**Coach feedback inbox with GET API, FeedbackInbox table, and DraftReviewModal state machine (idle/drafting/draft_ready/approve/reject) — full coach workflow for reviewing AI food swap suggestions with optional qty and food name overrides**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-27T07:34:12Z
- **Completed:** 2026-02-27T07:37:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- GET /api/nutrition/feedback endpoint returns pending feedback with joined plan + client + meal data using two-step org-scoped query
- FeedbackInbox renders sortable table with color-coded type badges, scope labels, truncated comments, and conditional Get AI Draft / Review Draft buttons
- DraftReviewModal implements full state machine with original vs AI comparison table, collapsible edit section (qty override + AFCD food search), approve sends overrides to version endpoint, reject PATCHes status
- NutritionClient extended with Plans/Feedback tab bar — orgId stored in state and passed to FeedbackInbox, lazy mount prevents unnecessary API calls

## Task Commits

1. **Task 1: Feedback list API + FeedbackInbox component** - `4ca18d5` (feat)
2. **Task 2: DraftReviewModal with edit override inputs + wire NutritionClient tabs** - `cb17d4a` (feat)

## Files Created/Modified

- `apps/trainer-web/src/app/api/nutrition/feedback/route.ts` — GET handler returning pending feedback with joined meal_plans/clients/meal_plan_meals data; two-step org-scoped query
- `apps/trainer-web/src/app/(app)/nutrition/FeedbackInbox.tsx` — Feedback list table; TypeBadge color-coded; Draft/Review buttons; empty state card
- `apps/trainer-web/src/app/(app)/nutrition/DraftReviewModal.tsx` — State machine modal: idle/drafting/draft_ready/approving/approved/rejected/error; comparison table; collapsible edit overrides with food search
- `apps/trainer-web/src/app/(app)/nutrition/NutritionClient.tsx` — Added Plans/Feedback tab bar; orgId state; lazy FeedbackInbox mount

## Decisions Made

- Two-step feedback query: fetch plan_ids for org first, then `.in("plan_id", planIds)` — Supabase cannot filter by joined column directly; same pattern established in Phase 8 for portal plan fetch
- DraftReviewModal initial state set by `item.ai_draft_food_item_id` presence — items that already have a draft skip idle and go to draft_ready immediately
- `fetchFeedbackDetails` called in both cases (existing draft on modal open, new draft after POST) — single shared function prevents duplication, also populates originalComponent from first component sorted by sort_order
- Feedback tab lazy-mounted with conditional render (`activeTab === "feedback"`) — no API call until coach navigates to the tab

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Full coach feedback workflow complete: GET feedback list, GET AI draft, review modal with overrides, approve (new version), reject (mark reviewed)
- Phase 9 Plan 04 (if it exists) can reference FeedbackItem interface exported from FeedbackInbox.tsx
- TypeScript clean across all 4 files — no outstanding issues

## Self-Check: PASSED

- FOUND: apps/trainer-web/src/app/api/nutrition/feedback/route.ts
- FOUND: apps/trainer-web/src/app/(app)/nutrition/FeedbackInbox.tsx
- FOUND: apps/trainer-web/src/app/(app)/nutrition/DraftReviewModal.tsx
- FOUND: apps/trainer-web/src/app/(app)/nutrition/NutritionClient.tsx (modified)
- Commits 4ca18d5 and cb17d4a confirmed in git log

---
*Phase: 09-ai-feedback-loop-versioning*
*Completed: 2026-02-27*
