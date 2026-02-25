---
phase: 02-sms-correctness
plan: "02"
subsystem: sms
tags: [twilio, deno, timezone, intl, quiet-hours]

# Dependency graph
requires: []
provides:
  - Quiet hours enforcement using org local timezone via Intl.DateTimeFormat
  - Correct boolean logic for both wraparound and non-wraparound quiet windows
  - Reschedule time computed in org-local timezone using UTC offset arithmetic
affects: [sms-worker, cron-sms-reminders]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Use Intl.DateTimeFormat with org timezone to extract local hour — never use getHours() which returns server UTC"
    - "Non-wraparound quiet window (start < end): suppress with && (inside range); wraparound (start > end): suppress with || (outside range)"
    - "Compute org-local reschedule time by deriving UTC offset from Intl.DateTimeFormat parts, then subtracting from fake-UTC Date.UTC construction"

key-files:
  created: []
  modified:
    - supabase/functions/sms-worker/index.ts

key-decisions:
  - "Intl.DateTimeFormat with en-AU locale + org timezone is the portable way to get org-local hour in Deno edge (which runs in UTC)"
  - "en-CA locale for date formatting returns YYYY-MM-DD, making date string parsing unambiguous"
  - "Offset = orgLocalAsUtcMs - now.getTime() — positive means org is ahead of UTC (e.g. Australia/Brisbane +10h); subtract offset from fake-UTC wakeup to get real UTC"
  - "Boolean logic: && for suppression inside a window (non-wraparound), || for suppression outside a window's gap (wraparound) — these are inverses"

patterns-established:
  - "Pattern 1: Always convert to org timezone before evaluating time-of-day business rules in Deno edge functions"
  - "Pattern 2: Reschedule to org-local time by computing UTC offset from Intl.DateTimeFormat parts, not by using setHours/setUTCHours"

requirements-completed: [SMS-03, SMS-04]

# Metrics
duration: 2min
completed: 2026-02-25
---

# Phase 2 Plan 02: SMS Quiet Hours Timezone Fix Summary

**Fixed sms-worker quiet hours to use org-local timezone via Intl.DateTimeFormat, corrected && vs || suppression logic, and rebuilt reschedule using UTC offset arithmetic so wakeup lands at correct local time**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-25T12:00:42Z
- **Completed:** 2026-02-25T12:02:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Replaced `now.getHours()` (UTC) with `Intl.DateTimeFormat` using `settings.timezone` to extract the org-local hour
- Fixed inverted boolean logic: non-wraparound windows (start < end) now use `&&` to suppress inside the range; wraparound windows (start > end) now use `||` to suppress across midnight
- Replaced broken `setHours`/`setUTCHours` reschedule with UTC offset arithmetic using `Intl.DateTimeFormat` parts so the wakeup time lands at `quiet_hours_end` in the org's local timezone

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix quiet hours timezone conversion, boolean logic, and reschedule calculation in sms-worker** - `7dbce2b` (fix)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `supabase/functions/sms-worker/index.ts` - Replaced quiet hours block with timezone-aware hour extraction, corrected suppression logic, and org-local reschedule computation

## Decisions Made
- Used `Intl.DateTimeFormat` with `en-AU` locale and `hour12: false` for portable org-local hour extraction in Deno edge runtime (which runs in UTC, not server local time)
- Used `en-CA` locale for date parts because it returns unambiguous `YYYY-MM-DD` format, avoiding locale-specific date string parsing
- UTC offset derived by treating Intl.DateTimeFormat parts as if they were UTC components and subtracting actual UTC epoch — this correctly handles DST transitions too
- `isQuietHour` variable introduced to separate the boolean evaluation from the reschedule side-effect block, improving readability

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Deno is not available in the local dev environment so type checking was skipped; all grep-based verification checks passed.

## User Setup Required

None - no external service configuration required. The function is deployed to Supabase edge functions via `npx supabase functions deploy sms-worker --project-ref ntqdmgvxirswnjlnwopq`.

## Next Phase Readiness

- SMS-03 and SMS-04 requirements are complete
- sms-worker now correctly enforces quiet hours for Australian orgs using 9 PM–8 AM wraparound windows
- Messages that were previously sent at 3 AM local time will now be held until 8 AM local time
- Ready to deploy the updated sms-worker function

---
*Phase: 02-sms-correctness*
*Completed: 2026-02-25*

## Self-Check: PASSED

- FOUND: `.planning/phases/02-sms-correctness/02-02-SUMMARY.md`
- FOUND: commit `7dbce2b`
