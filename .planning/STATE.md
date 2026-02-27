---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
last_updated: "2026-02-27T00:58:07.517Z"
progress:
  total_phases: 2
  completed_phases: 2
  total_plans: 8
  completed_plans: 8
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-26)

**Core value:** A coach can run their entire client-facing business from one place.
**Current focus:** v1.2 — Nutrition Engine

## Current Position

Phase: Phase 8 — Client Portal Nutrition View (next)
Plan: 08-01 (0/?)
Status: Phase 7 fully complete and human-verified. User approved end-to-end flow: days, meals, food search, macro calculation, AI generation (7 days), publish. Ready for Phase 8.
Last activity: 2026-02-27 — Phase 7 complete: human-verified, all flows confirmed

Progress: [████████████████████████████████████░] 75% (phase 7 complete, phase 8 next)

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
- [Phase 07-plan-builder-ai-generation]: Validate all Claude food_item_ids against DB before insert — prevents FK errors from hallucinated UUIDs, skips invalid silently
- [Phase 07-plan-builder-ai-generation]: DELETE existing days before AI-generated insert — CASCADE removes meals+components, simpler than diffing, acceptable since generate replaces entire plan
- [07-04] Optimistic update via setPlan callback after PATCH status=published — avoids full loadPlan() reload for a two-field change
- [07-04] Publish button disabled (not hidden) when no days — visible affordance with tooltip explaining the gate condition
- [Phase 07]: [07-04] Human-verified Phase 7 end-to-end: days, meals, food search, macro calc, AI generation, publish all confirmed working

### Pending Todos

- Add `STRIPE_SECRET_KEY` to Netlify env vars (for POST /api/portal/checkout)
- Add `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` to Supabase Edge Function secrets (for stripe-webhook)
- Register Stripe webhook endpoint in Stripe dashboard pointing to Supabase Edge Function URL
- Test end-to-end: buy a package → check client_purchases + money_events created

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-27
Stopped at: 07-04 complete — Phase 7 fully human-verified. Next: Phase 8 Client Portal Nutrition View.
Resume file: None
