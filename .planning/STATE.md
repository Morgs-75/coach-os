# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-25)

**Core value:** A coach can run their entire client-facing business from one place.
**Current focus:** Phase 4 — UI Reliability

## Current Position

Phase: 4 of 5 (UI Reliability)
Plan: 04-02-PLAN.md executed (view-aware calendar confirmation poll)
Status: Phase 4 in progress — 04-02 complete
Last activity: 2026-02-25 — 04-02 complete. Poll useEffect rewritten with view-aware range (day/month/week) and immediate-fire on navigation.

Progress: [██████░░░░] ~65%

## Performance Metrics

**Velocity:**
- Total plans completed: 7 (01-01 + 01-02 + 01-03 + 01-01 + 02-01 + 02-02 + 02-03)
- Average duration: ~2 min
- Total execution time: ~19 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-session-integrity | 4 | ~10 min | ~2.5 min |
| 02-sms-correctness | 3 | ~9 min | ~3 min |

**Recent Trend:**
- Last 5 plans: 01-01 (1 min), 02-01 (5 min), 02-02 (2 min), 02-03 (2 min)
- Trend: Fast execution

*Updated after each plan completion*

| Phase 03-background-jobs P02 | 1 min | 1 task | 1 file |
| Phase 04-ui-reliability P02 | 1 min | 1 task | 1 file |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Fix in place, no architecture changes — avoid introducing new failures while fixing existing ones
- Use atomic DB operations where they exist — `use_session()` DB function already exists, use it
- Single inbound SMS handler — consolidate to one path to eliminate divergent logic
- [01-02] Select-before-update pattern for cron auto-complete: fetch purchase_ids first, update by IDs, then call use_session() per packaged booking
- [01-02] use_session() guards double-deduction internally — no additional dedup logic needed in cron layer
- [01-03] release_session() returns int not boolean — caller can refresh local state without a second SELECT roundtrip
- [01-03] Sentinel -1 when sessions_used is 0 — distinguishes no-op from success without raising an error
- [01-03] No expires_at check in release_session — reinstatement is intentional regardless of pack expiry
- [01-01] Optimistic local state increment after use_session() RPC is safe — RPC is write authority, update only runs on confirmed success
- [01-01] Reinstate local state set to DB-returned newSessionsUsed — authoritative, not stale component value
- [01-01] Calendar loop uses continue on error — one failed booking does not block subsequent bookings
- [02-01] Fetch sms_settings.timezone inside handleSaveBooking else branch — minimises scope change, avoids restructuring the function
- [02-01] Post-session follow-up loop does not format dates in SMS body — no timezone fix needed there
- [02-02] Use Intl.DateTimeFormat with org timezone to extract local hour in Deno edge (runs in UTC, not server local time)
- [02-02] Non-wraparound quiet window (start < end): && suppresses inside range; wraparound (start > end): || suppresses across midnight
- [02-02] Reschedule to org-local time by deriving UTC offset from Intl.DateTimeFormat parts and subtracting from Date.UTC construction
- [Phase 02-03]: 2-hour grace window replaces 24h lookback in sms-inbound Y-reply handler — prevents matching yesterday's session after midnight
- [Phase 02-03]: Single inbound handler /api/sms-inbound is authoritative — /api/sms/webhook and supabase/functions/sms-inbound disabled with comments, not deleted
- [Phase 03-01]: Move schedule gating into processAutomation() where supabase is available — keeps isScheduleDue() pure
- [Phase 03-01]: Query automation_runs for last ok fired_at to determine schedule due-ness — no last_fired_at column on automations row
- [Phase 03-01]: Delete dead shouldTriggerFire() rather than stub it — no other call site existed
- [Phase 03-01]: Return { executed, anyFailed } from executeActions() — avoids global state or exception rethrowing
- [Phase 03-02]: INCOME row used as sentinel for dedup: if INCOME exists for invoice.id, all three rows (INCOME/FEE/PLATFORM_FEE) exist — single SELECT suffices
- [Phase 03-02]: Subscription update kept unconditional outside the dedup if/else — status always reflects current state regardless of dedup outcome
- [Phase 04-02]: pollKey integer state chosen to force poll useEffect reset on explicit navigation — avoids stale closure on weekStart (derived useMemo value)
- [Phase 04-02]: currentDate included in poll deps directly — weekStart is derived from currentDate so both change together; no double-dep needed
- [Phase 04-02]: doPoll() called immediately before setInterval — navigation gives instant feedback, not a 15s wait
- [Phase 04-02]: No Page Visibility API — keep poll simple per CONTEXT.md discretion note
- [Phase 04-01]: SectionError placed as nested function after !client guard — avoids hoisting issues with existing IIFE pattern
- [Phase 04-01]: sectionError pattern: per-section boolean flags, reset to false before fetch, set true on error — other section errors preserved via prev spread

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-25
Stopped at: Checkpoint — 04-01 Tasks 1+2 complete, awaiting human-verify (Task 3 visual verification)
Resume file: None
