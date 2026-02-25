---
phase: 01-session-integrity
plan: 01
subsystem: ui
tags: [react, nextjs, supabase, session-packs, atomic-operations, rpc]

# Dependency graph
requires:
  - phase: 01-session-integrity
    provides: use_session() DB function (migration 0010) and release_session() DB function (migration 0032)
provides:
  - "Calendar auto-complete loop uses atomic use_session() RPC — no read-then-write race"
  - "Client detail Use 1 Session button calls use_session() RPC atomically"
  - "Client detail Reinstate button calls release_session() RPC atomically, sets local state from DB-returned value"
affects:
  - session-integrity
  - calendar
  - client-detail

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "supabase.rpc() for atomic DB operations instead of .from().update() with component-state arithmetic"
    - "Optimistic local state update only after RPC returns success — never write stale component state to DB"
    - "Local state set to DB-returned authoritative value (release_session returns new sessions_used directly)"

key-files:
  created: []
  modified:
    - apps/trainer-web/src/app/(app)/calendar/page.tsx
    - apps/trainer-web/src/app/(app)/clients/[id]/page.tsx

key-decisions:
  - "Local state update after Use 1 Session uses p.sessions_used + 1 (optimistic) — safe because RPC is the write authority and confirmed success before update"
  - "Local state update after Reinstate uses DB-returned newSessionsUsed — authoritative, not stale component state"
  - "Calendar loop uses continue on booking completion error — one failed booking does not block others"

patterns-established:
  - "Atomic session deduction: supabase.rpc('use_session', { p_purchase_id }) — single DB statement, no intermediate SELECT"
  - "Atomic session reinstatement: supabase.rpc('release_session', { p_purchase_id }) returning int — local state set from DB value"

requirements-completed: [DATA-01, DATA-03]

# Metrics
duration: 1min
completed: 2026-02-25
---

# Phase 1 Plan 1: Atomic Session Deduction and Reinstatement Summary

**Browser-side session deduction and reinstatement now go through atomic DB RPC calls — eliminating the read-then-write race condition where two tabs could both read the same sessions_used and both write X+1 or X-1**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-25T11:40:18Z
- **Completed:** 2026-02-25T11:41:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Replaced calendar auto-complete loop's 3-step read-then-write (SELECT sessions_used + UPDATE sessions_used+1) with single `supabase.rpc("use_session", { p_purchase_id })` call
- Added error handling in calendar loop — booking completion error now logs and continues rather than silently failing
- Replaced client detail "Use 1 Session" button's non-atomic UPDATE with `supabase.rpc("use_session")` — local state only updated after DB confirms deduction
- Replaced client detail "Reinstate" button's non-atomic UPDATE with `supabase.rpc("release_session")` — local state set to DB-returned authoritative sessions_used, not stale component value
- TypeScript compiles cleanly with no new errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix calendar auto-complete loop to use atomic use_session() RPC** - `88f6156` (feat)
2. **Task 2: Fix client detail Use 1 Session and Reinstate buttons to use atomic RPC operations** - `86c1770` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `apps/trainer-web/src/app/(app)/calendar/page.tsx` - Auto-complete loop now calls use_session() RPC, removing intermediate SELECT and non-atomic UPDATE
- `apps/trainer-web/src/app/(app)/clients/[id]/page.tsx` - Use 1 Session calls use_session() RPC; Reinstate calls release_session() RPC and sets local state from DB value

## Decisions Made
- Optimistic local state increment (`p.sessions_used + 1`) in Use 1 Session is safe because the RPC is the write authority and must return true before the local update runs
- Reinstate local state is set to `newSessionsUsed` (the integer returned by release_session) rather than `purchase.sessions_used - 1` — eliminates the stale-value race entirely
- Calendar loop uses `continue` on completion error so one failed booking does not prevent subsequent bookings from being processed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All browser-side session arithmetic now goes through atomic DB functions
- No read-then-write pattern remains in calendar or client detail for sessions_used
- Ready for remaining session-integrity plans (cron, inbound SMS, etc.)

---
*Phase: 01-session-integrity*
*Completed: 2026-02-25*

## Self-Check: PASSED

- FOUND: apps/trainer-web/src/app/(app)/calendar/page.tsx
- FOUND: apps/trainer-web/src/app/(app)/clients/[id]/page.tsx
- FOUND: .planning/phases/01-session-integrity/01-01-SUMMARY.md
- FOUND commit: 88f6156 (feat: calendar auto-complete loop)
- FOUND commit: 86c1770 (feat: client detail buttons)
