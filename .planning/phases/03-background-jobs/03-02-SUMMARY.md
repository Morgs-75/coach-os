---
phase: 03-background-jobs
plan: 02
subsystem: payments
tags: [stripe, webhook, idempotency, money_events, dedup]

# Dependency graph
requires:
  - phase: 02-sms-correctness
    provides: stable SMS handlers as foundation for background jobs phase
provides:
  - Idempotent handleInvoicePaid: duplicate invoice.paid webhooks produce zero duplicate money_events rows
affects: [payments, P&L reporting, money_events]

# Tech tracking
tech-stack:
  added: []
  patterns: [select-before-insert dedup guard using reference_id + type sentinel]

key-files:
  created: []
  modified:
    - supabase/functions/stripe-webhook/index.ts

key-decisions:
  - "INCOME row used as sentinel for dedup: if INCOME exists for invoice.id, all three rows exist — single SELECT suffices"
  - "Subscription update remains unconditional outside the if/else block — status always kept current regardless of dedup result"
  - "maybeSingle() preferred over single() — returns null without error when no row exists, avoiding exception on first delivery"

patterns-established:
  - "Select-before-insert dedup: query for sentinel row (reference_id + type) before inserting financial events"

requirements-completed: [STRIPE-01]

# Metrics
duration: 1min
completed: 2026-02-25
---

# Phase 3 Plan 02: Stripe Webhook Idempotency Summary

**Select-before-insert dedup guard added to handleInvoicePaid using INCOME row as sentinel, preventing duplicate money_events rows on Stripe webhook retries**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-02-25T12:16:48Z
- **Completed:** 2026-02-25T12:17:30Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added idempotency guard to handleInvoicePaid() in stripe-webhook function
- SELECT query checks money_events for existing INCOME row with matching reference_id before any INSERT
- If row already exists: log skip message, no insert — prevents P&L inflation on retry
- If no row exists: insert all three rows (INCOME, FEE, PLATFORM_FEE) as before
- Subscription status update remains unconditional — always executed after the dedup check

## Task Commits

Each task was committed atomically:

1. **Task 1: Add idempotency check to handleInvoicePaid (STRIPE-01)** - `714a530` (fix)

**Plan metadata:** `(pending)`

## Files Created/Modified
- `supabase/functions/stripe-webhook/index.ts` - Added idempotency guard before money_events INSERT in handleInvoicePaid

## Decisions Made
- INCOME row used as dedup sentinel: one SELECT covers all three rows (INCOME, FEE, PLATFORM_FEE) since they are always inserted together
- maybeSingle() used instead of single() to get null-on-miss without raising an error on first delivery
- Subscription update deliberately left outside the if/else — status should always reflect current state regardless of dedup outcome

## Deviations from Plan

The task was already implemented and committed as part of the 03-01 plan execution (commit 714a530 — fix(03-01): implement schedule gating in cron-automations). The 03-01 executor included the stripe-webhook idempotency fix in the same commit alongside the cron-automations schedule gating fix.

The fix is correct and meets all done criteria from this plan:
- existing is selected from money_events by reference_id = invoice.id AND type = "INCOME" before insert
- If existing is truthy, the insert is skipped and a log message is emitted
- If existing is null/undefined, the insert proceeds as before
- The subscription status update block executes regardless (not gated by the else)

**Total deviations:** 1 pre-applied fix (task already committed in 03-01 execution)
**Impact on plan:** No scope creep — work is complete and correct as specified.

## Issues Encountered
- Task 1 was already applied to the file and committed in the 03-01 plan execution. No additional changes were needed. Verification confirmed the implementation matches the plan specification exactly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 3 background jobs plans (03-01 and 03-02) are both complete
- Stripe webhook now idempotent — safe against retry storms
- Ready for Phase 4 planning

## Self-Check: PASSED

- `supabase/functions/stripe-webhook/index.ts` — FOUND
- Commit `714a530` — FOUND

---
*Phase: 03-background-jobs*
*Completed: 2026-02-25*
