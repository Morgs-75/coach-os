---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Nutrition Engine
status: in_progress
last_updated: "2026-02-27T07:29:06.000Z"
progress:
  total_phases: 9
  completed_phases: 8
  total_plans: 4
  completed_plans: 2
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-26)

**Core value:** A coach can run their entire client-facing business from one place.
**Current focus:** v1.2 — Nutrition Engine

## Current Position

Phase: Phase 9 — AI Feedback Loop + Versioning
Plan: 09-02 COMPLETE
Status: 09-02 complete — three API routes live: GET/PATCH /api/nutrition/feedback/[id], POST /api/nutrition/feedback/[id]/draft (Claude AI swap), POST /api/nutrition/plans/[planId]/version (deep-copy). Ready for Plan 03 (coach review UI).
Last activity: 2026-02-27 — 09-02 complete: AI draft endpoint + versioning endpoint created, TypeScript clean

Progress: [██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 50% (2/4 plans complete in phase 9)

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
- [08-01] meal_plan_feedback.meal_id is nullable (ON DELETE SET NULL) — feedback can reference a specific meal or just the plan
- [08-01] forward column allows NULL — covers plan-level feedback without carry-forward preference
- [08-01] No client INSERT RLS policy — portal API uses service role key which bypasses RLS entirely
- [08-01] Migration path is supabase/migrations/ (project root) not apps/trainer-web/supabase/migrations/ — plan had wrong path, corrected at execution time
- [08-02] GET /api/portal/nutrition returns { plan: null } with 200 (not 404) when no published plan exists — portal UI handles no-plan state gracefully
- [08-02] Two-step plan fetch: find latest plan.id first, then load full nested structure — avoids ORDER BY on nested selects
- [08-02] feedback INSERT returns { success: true, id: uuid } — id enables optimistic UI in Plan 03
- [08-02] Plan ownership verified against client_id + status=published before feedback INSERT — prevents cross-client injection
- [Phase 08-03]: NutritionPlan + Meal types exported from NutritionView.tsx — shared via import avoids duplicate type declarations
- [Phase 08-03]: Tab bar nested inside header div — keeps border-b visual grouping correct with -mb-px border overlap pattern
- [Phase 08-03]: FeedbackDrawer resets all form fields on close — prevents stale state if reopened on a different meal
- [Phase 08-03]: page.tsx casts planRes.data as any for nested sort — Supabase inferred types for deeply nested selects are complex; runtime sort is simpler than fighting the type system
- [Phase 08-03]: Human-verify checkpoint APPROVED 2026-02-27 — full phase 8 nutrition view confirmed working end-to-end
- [09-01] parent_plan_id uses ON DELETE SET NULL — if parent deleted, children keep data but lose version link (safe, no orphan cascade)
- [09-01] ai_draft_* columns are all nullable — draft populated only after coach triggers AI endpoint, not on feedback creation
- [09-01] Supabase Management API requires requests library with browser User-Agent — urllib.request gets Cloudflare 403 (error 1010); requests bypasses this
- [09-01] PAT decodes as UTF-8 (raw blob bytes), not UTF-16-LE — 44-char sbp_... token confirmed
- [09-02] Two-query approach for draft_food_item: fetch feedback first, then food_items by ai_draft_food_item_id — avoids fighting Supabase join naming for non-standard FK field
- [09-02] max_tokens: 512 for draft endpoint — focused single-food suggestion needs far less context than full plan generation (8192)
- [09-02] ILIKE + first-word fallback for food matching — Claude may suggest "Chicken breast, skinless" but AFCD has "Chicken, breast"
- [09-02] No rollback on deep-copy failure — Supabase JS client lacks transaction support; partial plans acceptable for coach-triggered action
- [09-02] Return 422 when Claude suggests a food name not found in AFCD — expected data mismatch, not infrastructure error

### Pending Todos

- Add `STRIPE_SECRET_KEY` to Netlify env vars (for POST /api/portal/checkout)
- Add `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` to Supabase Edge Function secrets (for stripe-webhook)
- Register Stripe webhook endpoint in Stripe dashboard pointing to Supabase Edge Function URL
- Test end-to-end: buy a package → check client_purchases + money_events created

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-27
Stopped at: 09-02 complete — AI draft endpoint + versioning endpoint created. Phase 9 Plan 03 is next (coach review UI).
Resume file: None
