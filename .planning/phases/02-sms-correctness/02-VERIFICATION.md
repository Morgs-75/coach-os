---
phase: 02-sms-correctness
verified: 2026-02-25T13:00:00Z
status: passed
score: 9/9 must-haves verified
re_verification: null
gaps: []
human_verification:
  - test: "Send a booking confirmation SMS from the calendar and verify the time shown is in the org's configured timezone"
    expected: "SMS arrives with session time in sms_settings.timezone (e.g. AEST for Australia/Brisbane), not the trainer's browser time"
    why_human: "Cannot trigger Twilio SMS delivery programmatically in verification; timezone rendering requires live message receipt"
  - test: "Reply Y to a confirmation SMS and verify client_confirmed=true is set on the correct upcoming booking"
    expected: "Booking with nearest start_time >= now-2h is confirmed; a booking from the previous day is not matched"
    why_human: "Requires an active Twilio webhook round-trip and a real booking in the database"
  - test: "Trigger sms-worker during the configured quiet hours window (org local time) and verify the message is rescheduled, not sent"
    expected: "Message scheduled_for advances to quiet_hours_end in org local time; Twilio receives no API call"
    why_human: "Requires deployed Supabase edge function and a real sms_messages row; UTC-offset arithmetic correctness cannot be confirmed without runtime output"
---

# Phase 2: SMS Correctness Verification Report

**Phase Goal:** All SMS messages show times in the org's configured timezone, quiet hours suppress messages in org local time, and a client's Y reply reliably confirms their booking
**Verified:** 2026-02-25T13:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Booking confirmation SMS uses org timezone from sms_settings, not browser locale | VERIFIED | `calendar/page.tsx` L510-516: fetches `sms_settings.timezone`, assigns to `orgTimezone`, passes as `timeZone:` to both `toLocaleDateString` and `toLocaleTimeString` |
| 2 | Pre-session reminder SMS uses org timezone consistently | VERIFIED | `cron-sms-reminders/index.ts` L120-127: `tz = settings.timezone \|\| "Australia/Brisbane"` passed to both date/time format calls |
| 3 | Unconfirmed-24h reminder SMS uses org timezone consistently | VERIFIED | `cron-sms-reminders/index.ts` L341-348: same `tz` pattern applied in section 3 |
| 4 | Both confirmation and reminder SMS use sms_settings.timezone as the single source | VERIFIED | Calendar page queries `sms_settings`; cron function queries `sms_settings` via `settingsMap`; both fall back to `"Australia/Brisbane"` |
| 5 | Quiet hours enforcement uses org local hour, not UTC `getHours()` | VERIFIED | `sms-worker/index.ts` L84-91: `Intl.DateTimeFormat` with `orgTimezone` extracts local hour; old `now.getHours()` TODO comment is absent |
| 6 | Non-wraparound quiet window uses `&&`; wraparound uses `\|\|` | VERIFIED | `sms-worker/index.ts` L96-99: `isQuietHour` ternary — `start < end` → `&&`; else → `\|\|` |
| 7 | Quiet hours reschedule lands at `quiet_hours_end` in org local time | VERIFIED | `sms-worker/index.ts` L108-152: `Intl.DateTimeFormat` derives UTC offset; `wakeupOrgLocalMs - offsetMs` produces correct UTC timestamp |
| 8 | Only one handler (`/api/sms-inbound`) can set `client_confirmed=true` | VERIFIED | Active handler L58-61 has the only `.update({ client_confirmed: true })`; `/api/sms/webhook` disabled block has no such update; `supabase/functions/sms-inbound` returns `twiml("")` and never updates bookings |
| 9 | Active handler uses 2h grace window, not 24h lookback | VERIFIED | `sms-inbound/route.ts` L39+47+94: `twoHoursAgo = Date.now() - 2h`; both booking queries use `.gte("start_time", twoHoursAgo)` |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/trainer-web/src/app/(app)/calendar/page.tsx` | Confirmation SMS with org-timezone-formatted date/time | VERIFIED | L510-516: fetches `sms_settings`, uses `orgTimezone` in both format calls |
| `supabase/functions/cron-sms-reminders/index.ts` | Pre-session reminder with org-timezone-formatted date/time | VERIFIED | L120-127 (pre_session), L341-348 (unconfirmed-24h): `tz` from `settings.timezone` |
| `supabase/functions/sms-worker/index.ts` | Quiet hours using org local timezone + correct boolean logic + org-local reschedule | VERIFIED | L84-152: `Intl.DateTimeFormat` for hour, `isQuietHour` with `&&`/`||`, UTC offset arithmetic |
| `apps/trainer-web/src/app/api/sms-inbound/route.ts` | Active Y-reply handler with 2h grace window | VERIFIED | L39-50: `twoHoursAgo`, both queries use `.gte("start_time", twoHoursAgo)`, `.update({ client_confirmed: true })` present |
| `apps/trainer-web/src/app/api/sms/webhook/route.ts` | Dead handler disabled with DISABLED comment | VERIFIED | L49-53: DISABLED comment block with explanation; no `client_confirmed` update |
| `supabase/functions/sms-inbound/index.ts` | Inactive edge function disabled with DISABLED comment | VERIFIED | L26-33: DISABLED comment; Y/YES returns `twiml("")` with no booking lookup or update |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `calendar/page.tsx` | `sms_settings` table | `.from("sms_settings").select("timezone").eq("org_id", orgId)` inside `handleSaveBooking` | WIRED | L508-514 confirmed; result used at L515-516 |
| `cron-sms-reminders/index.ts` | `sms_settings.timezone` | `settingsMap` lookup in pre_session booking loop | WIRED | L96, L112, L120: `settings = settingsMap.get(booking.org_id)`, `tz = settings.timezone` |
| `cron-sms-reminders/index.ts` | `sms_settings.timezone` | `unconfirmedSettingsMap` lookup in unconfirmed-24h loop | WIRED | L330-332, L336, L341 |
| `sms-worker/index.ts` | `sms_settings.timezone` | `settingsMap` lookup per `message.org_id` | WIRED | L51-55, L59-60, L85: `orgTimezone = settings.timezone \|\| "Australia/Brisbane"` |
| `sms-worker/index.ts` | `quiet_hours_start` / `quiet_hours_end` comparison | org-local hour via `Intl.DateTimeFormat` | WIRED | L86-99: hour extracted with timezone, compared to `settings.quiet_hours_start` / `settings.quiet_hours_end` |
| `sms-inbound/route.ts` | `bookings` table | `.gte("start_time", twoHoursAgo)` filter | WIRED | L40-50: query includes `twoHoursAgo` filter, ascending order, limit 1 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| SMS-01 | 02-01-PLAN.md | Booking confirmation SMS uses org configured timezone, not trainer browser timezone | SATISFIED | `calendar/page.tsx` L510-516 |
| SMS-02 | 02-01-PLAN.md | Session reminder and follow-up SMS formats times in org configured timezone | SATISFIED | `cron-sms-reminders/index.ts` L120-127, L341-348 |
| SMS-03 | 02-02-PLAN.md | Quiet hours enforcement suppresses based on org local time, not UTC | SATISFIED | `sms-worker/index.ts` L84-91: `Intl.DateTimeFormat` with `orgTimezone` |
| SMS-04 | 02-02-PLAN.md | Quiet hours logic correctly handles non-wraparound time ranges | SATISFIED | `sms-worker/index.ts` L96-99: `&&` for non-wraparound, `||` for wraparound |
| SMS-05 | 02-03-PLAN.md | Client Y reply confirmation works reliably — one active handler with correct booking query | SATISFIED | Single `.update({ client_confirmed: true })` in `/api/sms-inbound`; two other paths disabled |

All 5 requirements (SMS-01 through SMS-05) are satisfied. No orphaned requirements found — all IDs declared in plan frontmatter match the requirements in REQUIREMENTS.md, and REQUIREMENTS.md traceability table assigns all five to Phase 2.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODO comments, placeholder returns, empty handlers, or stub implementations were found in any of the six files examined.

One noteworthy observation (not a blocker): The `nextBooking` query in `/api/sms-inbound/route.ts` (L87-97) runs after `client_confirmed: true` has already been set on `booking.id`. It correctly uses the same `twoHoursAgo` filter and ascending order, so it will find the next-nearest unconfirmed session — this is the intended "chain confirmation" UX.

---

### Human Verification Required

#### 1. Timezone in confirmation SMS body

**Test:** Create a booking for a client, save it from the calendar, and check the SMS received by the client.
**Expected:** The date and time in the SMS body match the session time in the org's configured timezone (e.g. `sms_settings.timezone = "Australia/Brisbane"` should show AEST times, not UTC).
**Why human:** Cannot invoke the Twilio API or read received SMS messages programmatically in this environment.

#### 2. Y-reply sets client_confirmed on the correct booking

**Test:** With two unconfirmed bookings in the database (one from yesterday, one upcoming), reply Y to the confirmation SMS.
**Expected:** Only the upcoming booking (within the 2h grace window) has `client_confirmed` set to `true`. The prior-day booking is not touched.
**Why human:** Requires a live Twilio webhook delivery and real database rows.

#### 3. Quiet hours suppress and reschedule at correct local time

**Test:** Send a test SMS during the org's configured quiet hours (e.g. 9 PM local for a Brisbane org) and verify via the `sms_messages` table that `scheduled_for` is updated to the correct `quiet_hours_end` time in local time (e.g. 8 AM next morning AEST = 22:00 UTC the same night).
**Expected:** `scheduled_for` in the database equals `quiet_hours_end` hour in org local time, not UTC.
**Why human:** Requires deployed sms-worker and a real `sms_messages` row; UTC offset arithmetic cannot be validated without runtime output.

---

### Summary

All nine observable truths are verified against actual code. The three bugs targeted by this phase were all fixed:

1. **SMS-01/02 (Timezone in SMS body):** `calendar/page.tsx` now fetches `sms_settings.timezone` and passes it as `timeZone:` to both date and time format calls. The cron function already used the correct pattern and required no change.

2. **SMS-03/04 (Quiet hours):** `sms-worker/index.ts` replaced the broken `now.getHours()` (UTC) with `Intl.DateTimeFormat` using the org timezone. The boolean logic is corrected (`&&` for non-wraparound, `||` for wraparound). The reschedule time is computed via UTC offset arithmetic, not `setUTCHours`.

3. **SMS-05 (Y-reply consolidation):** Exactly one handler (`/api/sms-inbound`) can update `client_confirmed=true`. The dead `/api/sms/webhook` route and the inactive `supabase/functions/sms-inbound` edge function both have clear DISABLED comments and no booking update logic. The active handler uses a 2-hour grace window instead of the prior 24-hour lookback.

Three items require human testing with live Twilio delivery; no automated gaps were found.

---

_Verified: 2026-02-25T13:00:00Z_
_Verifier: Claude (gsd-verifier)_
