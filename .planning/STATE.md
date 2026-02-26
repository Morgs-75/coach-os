---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
last_updated: "2026-02-27T00:12:00Z"
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 8
  completed_plans: 6
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-26)

**Core value:** A coach can run their entire client-facing business from one place.
**Current focus:** v1.2 — Nutrition Engine

## Current Position

Phase: Phase 7 — Plan Builder + AI Generation (IN PROGRESS)
Plan: 07-02 complete (2/4)
Status: Meal CRUD and food search complete. Coach can add meals to days, search AFCD foods, edit component qty, see live macros at meal and day level. All persisted to Supabase. Ready for Plan 03 (AI Generation).
Last activity: 2026-02-27 — 07-02 complete: meal CRUD, AFCD food search, inline macro totals

Progress: [██████████████████░░░░░░░░░░░░░░░░░░░] 50% (phase 7, plan 2/4)

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
- [07-02] Component POST returns food_item join immediately — no second fetch needed to display macros on add
- [07-02] onMouseDown for food dropdown selection — fires before input blur, ensures item selection registers before dropdown closes
- [07-02] Local state mutation callbacks replace full loadPlan() reloads — handleDayUpdated/handleMealUpdated/handleComponentUpdated chain avoids flicker
- [07-02] 204 responses use new NextResponse(null, { status: 204 }) — avoids sending response body on DELETE/no-content routes

### Pending Todos

- Add `STRIPE_SECRET_KEY` to Netlify env vars (for POST /api/portal/checkout)
- Add `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` to Supabase Edge Function secrets (for stripe-webhook)
- Register Stripe webhook endpoint in Stripe dashboard pointing to Supabase Edge Function URL
- Test end-to-end: buy a package → check client_purchases + money_events created

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-27
Stopped at: Completed 07-02-PLAN.md — meal CRUD, AFCD food search, inline macro totals
Resume file: None
