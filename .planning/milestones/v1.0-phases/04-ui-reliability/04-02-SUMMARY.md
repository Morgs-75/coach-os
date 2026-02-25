---
phase: 04-ui-reliability
plan: 02
subsystem: ui
tags: [react, nextjs, supabase, calendar, polling, useEffect]

# Dependency graph
requires:
  - phase: 04-ui-reliability
    provides: Context and plan for UI reliability fixes
provides:
  - View-aware confirmation poll that queries correct date range per active view
  - Immediate poll fire on any navigation or view-mode switch
affects: [calendar, bookings, ui-reliability]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - pollKey state pattern for forcing useEffect resets on explicit navigation events
    - Inline range derivation function (getRangeForPoll) mirroring loadData() logic for consistency

key-files:
  created: []
  modified:
    - apps/trainer-web/src/app/(app)/calendar/page.tsx

key-decisions:
  - "Use pollKey integer state (incremented on navigation) rather than direct dep on weekStart — avoids stale closure on derived value"
  - "Include currentDate in poll useEffect deps — weekStart is derived from currentDate so currentDate dep is sufficient and avoids stale weekStart closure"
  - "Immediate doPoll() call before setInterval — ensures navigation triggers instant update, not just after 15s"
  - "No Page Visibility API — keep poll simple per CONTEXT.md discretion note"
  - "Silent failure — if doPoll throws, interval stops until next navigation reset; no warning shown"

patterns-established:
  - "pollKey pattern: increment an integer state in onClick handlers to force a useEffect reset without useCallback complexity"
  - "Mirror loadData() range logic verbatim inside poll — single source of truth for what constitutes the visible range per view"

requirements-completed: [UI-02]

# Metrics
duration: 1min
completed: 2026-02-25
---

# Phase 4 Plan 02: View-Aware Calendar Confirmation Poll Summary

**Calendar confirmation poll rewritten to query the correct day/week/month range and fire immediately on any navigation or view-mode switch**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-25T12:57:45Z
- **Completed:** 2026-02-25T12:58:45Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Replaced fixed weekStart+7 poll range with view-aware getRangeForPoll() matching loadData() logic exactly
- Poll now fires immediately on mount (instant update after navigation) before starting the 15-second interval
- Poll useEffect resets whenever orgId, viewMode, currentDate, or pollKey changes
- Added pollKey state and incremented it in all 4 navigation points: view toggle, prev, Today, next
- Trainers in day and month views now see confirmation status updates for visible bookings

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix poll useEffect — view-aware range and immediate-fire on navigation** - `90ab496` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `apps/trainer-web/src/app/(app)/calendar/page.tsx` - Added pollKey state, replaced poll useEffect with view-aware version, updated nav/view-mode buttons

## Decisions Made
- pollKey integer state chosen over direct weekStart dep — avoids stale closure on a derived (useMemo) value
- currentDate included in deps directly — weekStart is derived from currentDate so both change together; no double-dep needed
- doPoll() called before setInterval so navigation gives instant feedback, not a 15s wait
- No Page Visibility API per CONTEXT.md discretion note — keep the poll simple

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Day-view and month-view trainers now receive live confirmation status updates
- Poll behavior in week view is unchanged (backward compatible)
- Ready to continue with remaining 04-ui-reliability plans

---
*Phase: 04-ui-reliability*
*Completed: 2026-02-25*
