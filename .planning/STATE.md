# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-26)

**Core value:** A coach can run their entire client-facing business from one place.
**Current focus:** v1.2 — Nutrition Engine

## Current Position

Phase: Phase 6 — Nutrition Foundation (in progress)
Plan: 06-01 complete (1/4), moving to 06-02
Status: Active. Migration 0041 applied to production.
Last activity: 2026-02-26 — 06-01 complete: nutrition DB schema (5 tables, RLS, GIN indexes) applied to Supabase

Progress: [██████████] 25% (phase 6, plan 1/4)

## Phase Summary

| Phase | Description | Status | Commit |
|-------|-------------|--------|--------|
| 1 | Portal token + page shell (magic link) | ✅ Done | Phase 1 |
| 2 | Client dashboard + cancellation | ✅ Done | Phase 2 |
| 3 | Self-booking flow | ✅ Done | dee44c2 |
| 4 | Stripe checkout for session packs | ✅ Done | 4bd7667 |

## Accumulated Context

### Decisions

- Magic-link portal: `portal_token` UUID on `clients`, no auth required
- Stripe Connect: each org's `stripe_accounts.stripe_account_id` used for checkout
- Webhook discriminant: `session.metadata.offer_id` present → portal purchase, else subscription
- No DB migration needed for Phase 4 (client_purchases schema was already complete in 0010)
- [06-01] food_items has no org_id — AFCD data is globally shared, public SELECT RLS enables food search without auth
- [06-01] Child table RLS uses EXISTS subquery chains back to org_id (days -> plans -> org; meals -> days; components -> meals)
- [06-01] pg_trgm extension added for trigram search alongside full-text GIN (handles short search terms <3 chars)
- [06-01] food_item_id nullable in meal_plan_components — allows custom-only components without AFCD reference

### Pending Todos

- Add `STRIPE_SECRET_KEY` to Netlify env vars (for POST /api/portal/checkout)
- Add `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` to Supabase Edge Function secrets (for stripe-webhook)
- Register Stripe webhook endpoint in Stripe dashboard pointing to Supabase Edge Function URL
- Test end-to-end: buy a package → check client_purchases + money_events created

### Blockers/Concerns

None — code is complete, Stripe key setup is operator config.

## Session Continuity

Last session: 2026-02-26
Stopped at: Completed 06-01-PLAN.md — nutrition DB schema applied to production. Ready for 06-02 (AFCD seed script).
Resume file: None
