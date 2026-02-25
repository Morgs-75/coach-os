# Coach OS

## What This Is

Coach OS is an end-to-end business management platform for personal trainers. Each coach operates within an isolated tenant and uses the platform to manage clients, bookings, availability, billing, and communications. Coaches pay a monthly subscription plus a percentage of sales.

## Core Value

A coach can run their entire client-facing business from one place — bookings, payments, communications, and client management — without needing technical knowledge or external tools.

## Current State

**Shipped:** v1.0 Stabilisation (2026-02-26)

The platform is operational in production. The v1.0 milestone resolved the 10 instability candidates identified in the stability audit — session counter atomicity, SMS correctness, background job reliability, UI reliability, and production hygiene.

**Tech stack:** Next.js 14 (app router) + Supabase (Postgres + Edge Functions + Auth) + Netlify + Twilio + Stripe
**Codebase:** ~4,000 LOC TypeScript (web app) + ~1,500 LOC Deno (edge functions)

## Requirements

### Validated

- ✓ Coach onboarding — functional
- ✓ Availability management — functional
- ✓ Client booking (calendar) — functional
- ✓ Stripe billing and subscriptions — functional
- ✓ SMS reminders and notifications — functional
- ✓ Waiver completion — functional
- ✓ Client onboarding flows — functional
- ✓ Backend accounting support — functional
- ✓ AI business insights — functional
- ✓ Executive assistant functionality — functional
- ✓ Marketing features — functional
- ✓ **DATA-01/02/03**: Session deductions atomic via `use_session()` / `release_session()` DB functions — v1.0
- ✓ **SMS-01/02/03/04**: All SMS uses org timezone; quiet hours enforce in org local time with correct boolean logic — v1.0
- ✓ **SMS-05**: Single Y-reply handler with 2-hour grace window — v1.0
- ✓ **CRON-01/02**: Automations fire on schedule; failures recorded truthfully — v1.0
- ✓ **STRIPE-01**: Stripe webhook idempotency preventing duplicate money_events — v1.0
- ✓ **UI-01**: Client detail page surfaces load failures per-section — v1.0
- ✓ **UI-02**: Calendar poll is view-aware (day/week/month) — v1.0
- ✓ **INFRA-01**: PII removed from production logs — v1.0
- ✓ **INFRA-02**: Org timezone sourced from single canonical `booking_settings.timezone` — v1.0

### Active

(None — define in next milestone with `/gsd:new-milestone`)

### Out of Scope

- `clients/[id]/page.tsx` full refactor — god component risk acknowledged; full decomposition is next-milestone scope
- `use_session()` internal atomicity — SELECT-then-UPDATE inside the DB function is a pre-existing edge case, not a regression
- Performance optimisations — not a current stability issue

## Constraints

- **Tech stack**: Next.js + Supabase + Netlify — no stack changes
- **Production safety**: All changes must be safe to deploy without downtime or migration windows

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fix in place, no architecture changes | Avoid introducing new failures while fixing existing ones | ✓ Good — all 15 requirements resolved without introducing regressions |
| Use atomic DB operations where they exist | `use_session()` DB function already exists — use it | ✓ Good — all deduction paths now go through the DB function |
| Single inbound SMS handler | Consolidate to one path to eliminate divergent logic | ✓ Good — `/api/sms-inbound` is the single source of truth; two dead paths disabled |
| `booking_settings.timezone` as canonical source | Settings page writes there; make all consumers read from there | ✓ Good — all 5 consumers (calendar, dashboard, cron, sms-worker, inbound) aligned |
| 2-hour grace window for Y-reply | Prevents matching yesterday's session after midnight without risking wrong-session confirmation | ✓ Good — narrower than previous 24h window, still handles late replies |
| Split `loadClient()` per-section in client detail | Per-section error isolation without full god component refactor | ✓ Good — partial failure now visible; full refactor deferred |
| Poll useEffect reset via integer `pollKey` state | Forces useEffect teardown/restart on navigation without stale closure on derived values | ✓ Good — immediate confirmation feedback on view change |

---
*Last updated: 2026-02-26 after v1.0 Stabilisation milestone*
