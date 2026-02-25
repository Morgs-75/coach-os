# Phase 4: UI Reliability - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Two targeted fixes:
1. Client detail page — every critical data section surfaces load failures visibly with an inline error state and retry capability, instead of silently staying blank.
2. Calendar confirmation poll — the 15-second poll queries the correct date range for the active view (day/week/month), resets immediately on any navigation, and fires immediately on reset before resuming the normal cycle.

Creating new sections, new page layouts, or new calendar features are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Error state appearance
- Errors appear **inline**, inside the section itself — error replaces the section content (including any loading spinner)
- Display a **warning icon + short section-specific message** (e.g. "Couldn't load bookings")
- Error states are **visually distinct** from empty states — different color or icon so trainers can tell the difference between "no data" and "load failed"
- Loading-to-error transition: error message replaces the spinner in place

### Section granularity
- All four critical sections get individual inline error states: **upcoming bookings**, **package / sessions remaining**, **notes / history**, **client profile / contact info**
- If the entire page fails to load, show a **page-level error** rather than multiple individual section errors
- Sections that load successfully show data normally — no success indicator

### Recovery behavior
- Each error state includes a **"Try again" clickable link** inline (e.g. "Couldn't load bookings. Try again")
- Re-fetch on remount — navigating away and back triggers a fresh fetch automatically
- **Sections are independent** — a failed section does not disable or affect other sections or UI elements (e.g. a failed package section does not grey out the "Use 1 Session" button)
- Log real errors to the **console only** — show a friendly message to the trainer with no error codes or technical detail

### Error message wording
- Messages are **section-specific and calm/neutral**: "Couldn't load bookings", "Couldn't load package info", "Couldn't load notes", "Couldn't load client details"
- Retry is worded as an inline clickable link: **"Try again"**
- No extra context hints (no "Check your connection") — keep it minimal

### Calendar poll reset
- Any navigation resets the poll: **view-mode switch (day↔month↔week) AND next/prev navigation** all trigger an immediate re-query
- On reset: **fire immediately** for the new range, then resume the 15-second cycle
- **Week view** (if present): poll covers the visible week range — same logic as day/month
- **Initial page load**: poll uses the current view's visible range from the start
- **Silent poll** — no spinner or refresh indicator while polling
- **Silent failure** — if the poll fails, stop until the next navigation or interaction; no warning shown
- Tab/page visibility: Claude's discretion (use Page Visibility API if it fits cleanly, otherwise keep simple)

### Claude's Discretion
- Exact color/icon for error vs empty state (use existing design tokens/patterns)
- Implementation of retry trigger (state reset, refetch hook, etc.) — match existing data-fetching patterns
- Whether to use Page Visibility API for tab-hidden poll pausing
- Exact spacing/typography for error messages

</decisions>

<specifics>
## Specific Ideas

- Error + retry pattern should feel like: "Couldn't load bookings. Try again" — one line, inline, not alarming
- Empty state and error state must look different enough that a trainer can tell at a glance whether nothing exists or something broke

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-ui-reliability*
*Context gathered: 2026-02-25*
