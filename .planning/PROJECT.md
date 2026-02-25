# Coach OS

## What This Is

Coach OS is an end-to-end business management platform for personal trainers. Each coach operates within an isolated tenant and uses the platform to manage clients, bookings, availability, billing, and communications. Coaches pay a monthly subscription plus a percentage of sales.

## Core Value

A coach can run their entire client-facing business from one place — bookings, payments, communications, and client management — without needing technical knowledge or external tools.

## Current Milestone: v1.0 — Stabilisation

**Goal:** Fix critical data integrity, SMS correctness, and UI reliability issues before scaling the platform.

**Target areas:**
- Non-atomic session counter writes (data corruption risk)
- SMS notification correctness (timezone, quiet hours, duplicate handlers)
- Cron automation scheduling (fires every run instead of on schedule)
- Stripe webhook idempotency (duplicate money events)
- Client detail page reliability (silent load failures)
- Calendar poll correctness (wrong range in day/month view)
- Production log noise (PII leaking to Netlify logs)

## Requirements

### Validated

- ✓ Coach onboarding — functional
- ✓ Availability management — functional
- ✓ Client booking (calendar) — functional with known edge cases
- ✓ Stripe billing and subscriptions — functional with known issues
- ✓ SMS reminders and notifications — functional with known correctness bugs
- ✓ Waiver completion — functional
- ✓ Client onboarding flows — functional
- ✓ Backend accounting support — functional
- ✓ AI business insights — functional
- ✓ Executive assistant functionality — functional
- ✓ Marketing features — functional

### Active

<!-- Defined in REQUIREMENTS.md -->
See REQUIREMENTS.md for v1.0 scoped requirements with REQ-IDs.

### Out of Scope

- New features of any kind — stabilisation milestone only
- Architectural redesigns — fix in place, no restructuring
- Performance optimisations — unless directly causing a stability failure
- UI redesigns — fix broken behaviour only, do not restyle

## Context

Coach OS is operational in production. The stability audit (`.planning/stability-analysis.md`) identified 10 ranked instability candidates:

1. Non-atomic `sessions_used` counter — three separate read-then-write paths from browser
2. Triple inbound SMS handler — one handler can never match, one inactive
3. Quiet-hours logic broken in `sms-worker` — wrong timezone + OR/AND logic error
4. `cron-automations` fires all automations every run — schedule check always returns true
5. Stripe `invoice.paid` not idempotent — duplicate webhooks inflate money_events
6. `clients/[id]/page.tsx` god component — no error handling, silent partial-load failures
7. Booking confirmation SMS uses browser timezone instead of org timezone
8. Org timezone stored in two divergent tables
9. Calendar poll queries wrong date range in day/month view
10. PII logged on every request in production

## Constraints

- **Tech stack**: Next.js + Supabase + Netlify — no stack changes
- **No redesign**: Fix broken behaviour only — do not restructure or refactor beyond the fix
- **No new features**: Every change must be traceable to an existing stability issue
- **Production safety**: All changes must be safe to deploy without downtime or migration windows

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fix in place, no architecture changes | Avoid introducing new failures while fixing existing ones | — Pending |
| Use atomic DB operations where they exist | `use_session()` DB function already exists — use it | — Pending |
| Single inbound SMS handler | Consolidate to one path to eliminate divergent logic | — Pending |

---
*Last updated: 2026-02-25 — v1.0 Stabilisation milestone started*
