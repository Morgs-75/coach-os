---
phase: 04-ui-reliability
verified: 2026-02-25T14:30:00Z
status: passed
score: 7/7 must-haves verified
re_verification: false
human_verification:
  - test: "Trigger a bookings load failure and confirm error state renders"
    expected: "Sessions section shows amber 'Couldn't load bookings. Try again' while other sections load normally"
    why_human: "Cannot programmatically simulate a Supabase query failure in production; visual appearance of amber vs grey states requires human confirmation"
  - test: "Switch from week view to day view and observe confirmation poll"
    expected: "Poll fires immediately with day-scoped query (00:00-23:59 of current day) — no 15-second wait; confirmed bookings update within seconds"
    why_human: "Cannot observe network queries or confirm timing behavior programmatically; requires browser devtools or confirmed booking state change"
  - test: "Switch from week view to month view and observe confirmation poll"
    expected: "Poll fires immediately with month-scoped query (month start to month+1 start) — bookings across the full month receive confirmation updates"
    why_human: "Same as above — timing and scope of actual network calls requires runtime observation"
---

# Phase 4: UI Reliability Verification Report

**Phase Goal:** The client detail page surfaces load failures visibly, and the calendar's booking confirmation poll queries the correct date range for the active view
**Verified:** 2026-02-25T14:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | If bookings fail to load, the sessions section shows "Couldn't load bookings. Try again" in place of the spinner/blank | VERIFIED | `sectionError.bookings` ternary at line 1470; `SectionError message="Couldn't load bookings." onRetry={loadBookings}` at line 1473 |
| 2 | If purchases/package data fail to load, the sessions-remaining section shows "Couldn't load package info. Try again" | VERIFIED | `sectionError.purchases` ternary at line 1560; `SectionError message="Couldn't load package info." onRetry={loadPurchases}` at line 1563 |
| 3 | If the client profile query fails, the page shows a page-level error rather than a blank page | VERIFIED | `if (!client)` guard at line 1216 checks `sectionError.profile` first; renders amber page-level error with "Try again" calling `loadClient` at line 1225 |
| 4 | If notes/comms fail to load, those sections show "Couldn't load notes. Try again" | VERIFIED | `sectionError.notes` ternary at line 3162; `SectionError message="Couldn't load notes." onRetry={loadNotes}` at line 3163 |
| 5 | Error states are visually distinct from empty states — amber styling vs grey | VERIFIED | `SectionError` component at line 1233 uses `bg-amber-50 border-amber-200 text-amber-700`; empty states in the same sections use `text-gray-500` / `text-gray-400` |
| 6 | In day view, the 15-second poll queries only the current day's range (00:00-23:59:59 of currentDate) | VERIFIED | `getRangeForPoll()` at lines 168-185: `viewMode === "day"` branch sets `rangeStart.setHours(0,0,0,0)` and `rangeEnd.setHours(23,59,59,999)` |
| 7 | In month view, the poll queries the full visible month range (month start to month+1 start) | VERIFIED | `getRangeForPoll()` at lines 176-178: `viewMode === "month"` branch sets `rangeStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)` and `rangeEnd = new Date(..., getMonth() + 1, 1)` |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/trainer-web/src/app/(app)/clients/[id]/page.tsx` | Per-section error states with retry for 4 critical sections; contains `sectionError` | VERIFIED | File exists; `sectionError` state declared at line 76 with `profile/bookings/purchases/notes` keys; `loadBookings()` at 166, `loadPurchases()` at 195, `loadNotes()` at 210; `SectionError` component at 1233; error UI in JSX at lines 1470, 1560, 3162, 1216 |
| `apps/trainer-web/src/app/(app)/calendar/page.tsx` | View-aware confirmation poll with immediate-fire on reset; contains `pollKey` | VERIFIED | File exists; `pollKey` state at line 111; `getRangeForPoll()` at line 168; `doPoll()` at line 187; immediate `doPoll()` call at line 204; `setInterval(doPoll, 15000)` at line 205; deps `[orgId, viewMode, currentDate, pollKey]` at line 207 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `loadClient()` monolithic fetch | Individual per-section fetch functions | `loadClient` calls `loadBookings()`, `loadPurchases()`, `loadNotes()` at lines 305, 354, 357 | WIRED | `sectionError.(bookings\|purchases\|profile\|notes)` pattern confirmed at lines 167, 176, 189, 196, 204, 211, 219, 239 |
| Error state JSX | Retry handler | `onClick` calls individual fetch function | WIRED | Bookings: `onRetry={loadBookings}` (line 1473); Purchases: `onRetry={loadPurchases}` (line 1563); Notes: `onRetry={loadNotes}` (line 3163); Profile: `onClick={loadClient}` (line 1225) |
| `viewMode + currentDate` state | Poll useEffect dependency array | `pollKey` in deps and incremented in all nav buttons | WIRED | useEffect deps at line 207: `[orgId, viewMode, currentDate, pollKey]`; view toggle at line 833: `setPollKey(k => k + 1)`; prev at 964, Today at 973, next at 985 all call `setPollKey(k => k + 1)` |
| Poll range logic | `loadData()` range logic | Same `rangeStart`/`rangeEnd` derivation (day/month/week) | WIRED | `getRangeForPoll()` lines 168-185 mirrors `loadData()` range logic exactly: identical `setHours` and month math |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| UI-01 | 04-01-PLAN.md | Client detail page handles database load failures gracefully — partial-load states are visible, not silently empty | SATISFIED | `sectionError` state, `SectionError` component, and inline error UI present and wired for all 4 critical sections; commits 9dd7020 and c791b6a confirmed in git log |
| UI-02 | 04-02-PLAN.md | Calendar booking confirmation poll queries the correct date range for the active view mode (day/month/week) | SATISFIED | `getRangeForPoll()` with day/month/week branching present in poll useEffect; `pollKey` reset on all navigation points; commit 90ab496 confirmed in git log |

No orphaned requirements — both UI-01 and UI-02 are claimed in plan frontmatter and implemented. REQUIREMENTS.md maps both to Phase 4 with status Complete.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `clients/[id]/page.tsx` | 906, 923, 927, 2243 | `TODO: Create Stripe Payment Link` / `alert("Payment link feature coming soon")` | Info | Pre-existing code unrelated to Phase 4; payment link is a separate unbuilt feature; does not affect error states or phase goal |
| `clients/[id]/page.tsx` | 2082, 2452, 2462, 3124, 3135 | HTML `placeholder` attributes on form inputs | Info | Standard HTML form attributes, not stub implementations; unrelated to phase goal |
| `calendar/page.tsx` | 1401, 1486 | HTML `placeholder` attributes on form inputs | Info | Standard HTML form attributes, unrelated to poll fix |

No blockers or warnings found. All anti-patterns are pre-existing, unrelated to Phase 4 deliverables.

### Human Verification Required

#### 1. Client Detail Page — Visible Error State Appearance

**Test:** In a development environment, temporarily change the table name in `loadBookings()` from `"bookings"` to `"bookings_broken"`, reload any client detail page, observe the sessions section.
**Expected:** Sessions section displays amber background warning icon with "Couldn't load bookings. Try again" text. Other sections (package summary, notes) load normally. The amber error is visually distinct from the grey "No bookings yet" empty state.
**Why human:** Visual appearance of amber-vs-grey distinction requires human judgment; programmatic verification cannot confirm the card renders correctly in the browser layout.

#### 2. Retry Button Behaviour

**Test:** While the sessions section is in error state (broken query from test 1), click "Try again".
**Expected:** The section re-fetches. If still broken, error persists. If query is restored, data appears. No full page refresh occurs.
**Why human:** Cannot verify React re-render behavior and partial-section reload without running the app.

#### 3. Calendar Day View Confirmation Poll Range

**Test:** Switch the calendar to day view. Open browser devtools Network tab. Observe the periodic Supabase bookings requests (every 15 seconds plus immediately on switch).
**Expected:** Query `start_time` range is `00:00:00` to `23:59:59` of the current day — not a 7-day span.
**Why human:** Cannot observe actual outgoing Supabase query parameters without running the app and inspecting network traffic.

#### 4. Calendar Month View Confirmation Poll Range

**Test:** Switch the calendar to month view. Observe Supabase bookings requests in devtools.
**Expected:** Query `start_time` range spans from the first of the current month to the first of the next month.
**Why human:** Same as above.

### Gaps Summary

No gaps. All automated checks passed:

- TypeScript compiles clean with zero errors (confirmed via `npx tsc --noEmit`)
- `sectionError` state object present with all 4 keys (profile, bookings, purchases, notes)
- All 3 individual fetch functions (`loadBookings`, `loadPurchases`, `loadNotes`) exist with proper error destructuring and `setSectionError` calls
- `SectionError` component present with amber styling
- Error UI wired in JSX for all 4 sections (bookings at 1470, purchases at 1560, notes at 3162, profile at 1216)
- "Try again" in each section calls the correct individual reload function
- `pollKey` state present in calendar; poll useEffect deps include `[orgId, viewMode, currentDate, pollKey]`
- `getRangeForPoll()` present with day/month/week branching matching `loadData()` logic exactly
- `doPoll()` called immediately before `setInterval` — no 15-second delay on navigation
- All 4 navigation points (view toggle, prev, Today, next) call `setPollKey(k => k + 1)`
- Commits 9dd7020, c791b6a, 90ab496 all verified in git log touching the correct files
- Both UI-01 and UI-02 accounted for across plan frontmatter — no orphaned requirements
- Pre-existing anti-patterns (payment link TODO, form placeholders) are unrelated to phase deliverables

Human verification is recommended but not blocking — the code structure fully supports the intended behavior. Three human tests are listed above to confirm visual correctness and runtime behavior.

---

_Verified: 2026-02-25T14:30:00Z_
_Verifier: Claude (gsd-verifier)_
