---
phase: 04-ui-reliability
plan: 01
subsystem: ui
tags: [react, next.js, supabase, error-handling, typescript]

# Dependency graph
requires: []
provides:
  - "Per-section inline error states with retry on client detail page"
  - "Individual fetch functions: loadBookings(), loadPurchases(), loadNotes()"
  - "sectionError state with profile/bookings/purchases/notes keys"
affects: [ui, clients]

# Tech tracking
tech-stack:
  added: []
  patterns: ["sectionError state pattern for per-section error isolation", "SectionError helper component with amber styling", "Individual fetch function per critical section"]

key-files:
  created: []
  modified:
    - "apps/trainer-web/src/app/(app)/clients/[id]/page.tsx"

key-decisions:
  - "SectionError placed as nested function inside component after the !client guard — defined inside JSX scope so it can reference component state via closure"
  - "Chained ternary for comms section — sectionError.notes ? error : communications.length > 0 ? list : empty — preserves existing empty state"
  - "Package summary ternary wraps the existing IIFE — sectionError.purchases ? error : (() => { ... })() — no restructuring needed"

patterns-established:
  - "sectionError pattern: each critical section has a boolean flag, reset to false before fetch, set to true on error"
  - "SectionError component: amber-50 bg, amber-700 text, amber-200 border — visually distinct from grey empty states"
  - "Individual fetch functions call setSectionError(prev => ({...prev, key: false/true})) — preserves other section error states"

requirements-completed: [UI-01]

# Metrics
duration: 8min
completed: 2026-02-25
---

# Phase 4 Plan 01: Client Detail Page — Per-Section Error States Summary

**Partial (awaiting human-verify checkpoint) — Per-section inline error states with amber warning + retry for bookings, packages, notes, and page-level client profile on the client detail page**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-25T12:58:14Z
- **Completed:** 2026-02-25T13:06:00Z (checkpoint pause)
- **Tasks:** 2 of 3 (Task 3 is human-verify checkpoint)
- **Files modified:** 1

## Accomplishments
- Split monolithic `loadClient()` into `loadBookings()`, `loadPurchases()`, `loadNotes()` with per-section error destructuring
- Added `sectionError` state object tracking profile/bookings/purchases/notes failure independently
- Implemented `SectionError` helper component with amber styling, warning icon, and "Try again" button
- Added inline error UI to all four critical sections; error states are visually distinct from empty states

## Task Commits

Each task was committed atomically:

1. **Task 1: Add per-section error state and split monolithic loadClient** - `9dd7020` (feat)
2. **Task 2: Add inline error UI to the four critical sections** - `c791b6a` (feat)

## Files Created/Modified
- `apps/trainer-web/src/app/(app)/clients/[id]/page.tsx` - Added sectionError state, individual fetch functions, SectionError component, and inline error UI for 4 sections

## Decisions Made
- SectionError placed as nested function inside component after the `!client` guard — defined inside JSX scope to avoid hoisting issues with the existing IIFE pattern
- Chained ternary for comms section preserves the existing empty-state rendering path unchanged
- Package summary IIFE wrapped with ternary rather than refactored — minimal change, preserves existing logic exactly

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Tasks 1 and 2 complete. TypeScript compiles clean.
- Task 3 (human-verify checkpoint) is paused — trainer needs to visually verify error states in browser.
- To test: temporarily rename table in loadBookings() to "bookings_broken", reload a client page, verify amber error state appears. Revert after testing.

---
*Phase: 04-ui-reliability*
*Completed: 2026-02-25 (partial — awaiting checkpoint)*
