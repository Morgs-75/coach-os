---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
last_updated: "2026-02-26T23:08:01.190Z"
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 8
  completed_plans: 5
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-26)

**Core value:** A coach can run their entire client-facing business from one place.
**Current focus:** v1.2 — Nutrition Engine

## Current Position

Phase: Phase 7 — Plan Builder + AI Generation (IN PROGRESS)
Plan: 07-01 complete (1/4)
Status: Plan builder shell delivered. /nutrition/[planId] route live with days sidebar, day panel, plan header. API routes for plan detail and days CRUD complete. Ready for Plan 02 (Meal + Component Editor).
Last activity: 2026-02-27 — 07-01 complete: plan builder shell, days sidebar, nested plan API

Progress: [█████████░░░░░░░░░░░░░░░░░░░░░░░░░░░] 25% (phase 7, plan 1/4)

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
- [06-03] Minimum 2-char query returns empty array (not error) — avoids full-table scan on single keystrokes, simplifies Phase 7 autocomplete
- [06-03] Auth via org_members check (not food_items RLS) — endpoint is coach-only in Phase 6 despite food_items having public SELECT RLS
- [06-04] getOrgAndUser replaces getOrgId in plans route — POST needs user.id for created_by; returning both avoids second auth.getUser() call
- [06-04] Clients loaded via Supabase client-side query for filter dropdown — avoids building a separate /api/clients endpoint for this page
- [06-04] useCallback on loadData with selectedClientId dependency — satisfies useEffect deps without infinite re-renders
- [Phase 07-plan-builder-ai-generation]: Next.js 15 async params used throughout plan builder routes
- [Phase 07-plan-builder-ai-generation]: loadPlan useEffect fires on [planId] only; useCallback has broader deps to satisfy linter without re-fetch on day selection
- [Phase 07-plan-builder-ai-generation]: Slot divs (plan-action-slot, add-meal-slot-[dayId]) placed as placeholders for Plans 02 and 04

### Pending Todos

- Add `STRIPE_SECRET_KEY` to Netlify env vars (for POST /api/portal/checkout)
- Add `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` to Supabase Edge Function secrets (for stripe-webhook)
- Register Stripe webhook endpoint in Stripe dashboard pointing to Supabase Edge Function URL
- Test end-to-end: buy a package → check client_purchases + money_events created

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-27
Stopped at: Completed 07-01-PLAN.md — plan builder shell, days sidebar, and plan detail API routes
Resume file: None
