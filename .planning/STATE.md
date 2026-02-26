# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-26)

**Core value:** A coach can run their entire client-facing business from one place.
**Current focus:** v1.2 — Nutrition Engine

## Current Position

Phase: Phase 6 — Nutrition Foundation (in progress)
Plan: 06-02 complete (2/4), moving to 06-03
Status: Active. AFCD seed script ready; food_items awaiting manual seed run.
Last activity: 2026-02-26 — 06-02 complete: AFCD seed script written (checkpoint: user must download AFCD xlsx and run seed)

Progress: [████████████████████] 50% (phase 6, plan 2/4)

## Phase Summary

| Phase | Description | Status | Commit |
|-------|-------------|--------|--------|
| 1 | Portal token + page shell (magic link) | Done | Phase 1 |
| 2 | Client dashboard + cancellation | Done | Phase 2 |
| 3 | Self-booking flow | Done | dee44c2 |
| 4 | Stripe checkout for session packs | Done | 4bd7667 |

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
- [06-02] Seed script uses SUPABASE_SERVICE_ROLE_KEY (not anon) — food_items INSERT requires service role despite public SELECT RLS
- [06-02] Column detection is dynamic/fuzzy — AFCD Release 3 header names vary; partial case-insensitive match guards against breakage
- [06-02] kJ-to-kcal fallback (divide by 4.184) if kcal column absent from a given AFCD release
- [06-02] AFCD file NOT bundled in repo — user downloads from Food Standards Australia NZ; script accepts path as CLI arg

### Pending Todos

- Add `STRIPE_SECRET_KEY` to Netlify env vars (for POST /api/portal/checkout)
- Add `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` to Supabase Edge Function secrets (for stripe-webhook)
- Register Stripe webhook endpoint in Stripe dashboard pointing to Supabase Edge Function URL
- Test end-to-end: buy a package → check client_purchases + money_events created
- Run AFCD seed: `npx tsx scripts/seed-afcd.ts /path/to/AFCD-Release3.xlsx` from apps/trainer-web/

### Blockers/Concerns

None — code is complete. AFCD seeding is a one-time operator task (not a blocker for 06-03 food search API development).

## Session Continuity

Last session: 2026-02-26
Stopped at: Completed 06-02-PLAN.md — AFCD seed script written (a36c353). Checkpoint: user must download AFCD xlsx and run seed to verify ~1,588 rows. Ready for 06-03 (food search API).
Resume file: None
