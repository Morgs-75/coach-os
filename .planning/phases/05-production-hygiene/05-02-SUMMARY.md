---
phase: 05-production-hygiene
plan: 02
subsystem: infra
tags: [timezone, sms, supabase, nextjs, deno, booking_settings]

# Dependency graph
requires:
  - phase: 02-sms-correctness
    provides: "SMS timezone handling patterns and booking_settings table established"
provides:
  - "All four timezone consumers aligned to booking_settings.timezone as canonical source"
  - "Timezone changes in settings now reflected in calendar confirmation SMS, dashboard, and cron reminders"
affects: [sms, calendar, dashboard, cron-sms-reminders]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Split sms_settings (enabled) and booking_settings (timezone) fetches — merge into settings object for consumers"

key-files:
  created: []
  modified:
    - apps/trainer-web/src/app/(app)/calendar/page.tsx
    - apps/trainer-web/src/app/(app)/dashboard/page.tsx
    - supabase/functions/cron-sms-reminders/index.ts

key-decisions:
  - "[05-02] booking_settings is the canonical timezone source — settings page writes there, all consumers should read from there"
  - "[05-02] Split cron sms_settings (enabled) and booking_settings (timezone) queries and merge: preserves downstream settings.enabled and settings.timezone shape with zero cascade changes"
  - "[05-02] Section 2 (post-session feedback) in cron omits timezone — no date formatting in that SMS body — left unchanged"

patterns-established:
  - "When a field lives in a different table than enabled/config, fetch separately and merge into the settings object before use"

requirements-completed: [INFRA-02]

# Metrics
duration: 2min
completed: 2026-02-25
---

# Phase 5 Plan 02: Timezone Divergence Fix Summary

**All SMS and dashboard timezone reads redirected from sms_settings to booking_settings — the canonical source written by the settings page**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-25T13:53:17Z
- **Completed:** 2026-02-25T13:55:12Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Calendar confirmation SMS now reads timezone from `booking_settings` — booking confirmation shows correct local time after a timezone change in settings
- Dashboard date/time display now reads timezone from `booking_settings` — session list and date labels reflect the correct org timezone
- Cron SMS reminders (pre-session and unconfirmed 24h) now read timezone from `booking_settings` — reminder times formatted correctly after timezone change
- sms-inbound Y-reply handler already used `booking_settings` — confirmed unchanged and correct

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix calendar page — read timezone from booking_settings** - `1a0218e` (fix)
2. **Task 2: Fix dashboard and cron-sms-reminders — read timezone from booking_settings** - `7f00fc7` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/trainer-web/src/app/(app)/calendar/page.tsx` - Changed timezone fetch from `sms_settings` to `booking_settings`; variable renamed `smsSetting` -> `bookingSetting`
- `apps/trainer-web/src/app/(app)/dashboard/page.tsx` - Changed timezone fetch from `sms_settings` to `booking_settings`; variable renamed `smsSettings` -> `bookingSettings`
- `supabase/functions/cron-sms-reminders/index.ts` - Section 1 and Section 3 split into separate `sms_settings` (enabled) and `booking_settings` (timezone) fetches; merged into settings map with same shape as before

## Decisions Made

- `booking_settings` is the canonical timezone source — the settings page writes timezone there via `supabase.update({ timezone })`, so all consumers must read from there
- For the cron function, sms_settings still provides `enabled` (not duplicated in booking_settings), so two separate queries are needed and merged into one object: `{ org_id, enabled, timezone }`
- Section 2 (post-session feedback) already omitted timezone from its sms_settings select and doesn't format times in the SMS body — no change required there

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Timezone divergence resolved across all four consumers (calendar, dashboard, cron pre-session, cron unconfirmed 24h)
- A trainer changing their timezone in settings will now see that timezone correctly applied in all SMS messages and dashboard date displays
- Ready for phase 5 plan 03

## Self-Check: PASSED

- FOUND: apps/trainer-web/src/app/(app)/calendar/page.tsx
- FOUND: apps/trainer-web/src/app/(app)/dashboard/page.tsx
- FOUND: supabase/functions/cron-sms-reminders/index.ts
- FOUND: .planning/phases/05-production-hygiene/05-02-SUMMARY.md
- FOUND commit 1a0218e: fix(05-02): calendar page reads timezone from booking_settings
- FOUND commit 7f00fc7: fix(05-02): dashboard and cron-sms-reminders read timezone from booking_settings

---
*Phase: 05-production-hygiene*
*Completed: 2026-02-25*
