# Milestones

## v1.0 Stabilisation (Shipped: 2026-02-26)

**Phases completed:** 5 phases, 12 plans
**Timeline:** 2026-02-03 → 2026-02-26 (23 days)
**Code:** 176 files changed, +21,645 / -2,421 lines

**Delivered:** Fixed critical data integrity, SMS correctness, background job reliability, UI reliability, and production hygiene issues across the Coach OS platform.

**Key accomplishments:**
1. Session deductions are now atomic — all write paths (calendar, cron, client detail) route through `use_session()` and `release_session()` DB functions, eliminating double-count race conditions
2. SMS timezone correctness — booking confirmation, reminders, follow-ups, and quiet hours enforcement all use the org's canonical `booking_settings.timezone` consistently
3. Quiet hours logic fixed — `sms-worker` now extracts org-local hour via `Intl.DateTimeFormat` and applies correct non-wraparound AND / wraparound OR logic
4. Client Y-reply consolidated to a single `/api/sms-inbound` handler with a 2-hour grace window, replacing three divergent paths (one of which could never match)
5. Cron automations fire on schedule — `shouldTriggerFire()` checks `automation_runs` for last fired timestamp; failed actions now record as `"failed"` in `automation_runs`
6. Stripe `invoice.paid` made idempotent — select-before-insert guard prevents duplicate `money_events` rows on webhook retry
7. Client detail page: per-section inline error states for 4 critical sections — no more silently blank sections on DB load failure
8. Calendar confirmation poll is view-aware — day/month/week ranges polled correctly; fires immediately on navigation
9. PII removed from production logs — `console.log` calls logging user/session data removed from `get-org.ts` and auth middleware

**Known Tech Debt:**
- `use_session()` DB function uses SELECT-then-UPDATE internally — not fully atomic under READ COMMITTED
- `clients/[id]/page.tsx` remains a 3,500-line god component — partial split done in Phase 4, full refactor deferred
- Human verification pending: timezone in live SMS bodies, Y-reply round-trip with real Twilio, quiet hours at correct local time

---
