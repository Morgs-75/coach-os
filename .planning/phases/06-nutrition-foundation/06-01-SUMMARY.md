---
phase: 06-nutrition-foundation
plan: 01
subsystem: database
tags: [supabase, postgres, rls, nutrition, afcd, migrations, pg_trgm, full-text-search]

# Dependency graph
requires: []
provides:
  - food_items table with AFCD food library schema, public read RLS, and GIN/trgm indexes
  - meal_plans table with org-scoped draft/published workflow, client assignment, and versioning
  - meal_plan_days table (1-based day numbering, optional calendar date, unique constraint)
  - meal_plan_meals table (7-type meal_type enum, sort_order, notes)
  - meal_plan_components table (food_item FK, qty_g, custom_name for display overrides)
affects:
  - 06-02 (AFCD seed script depends on food_items table)
  - 06-03 (food search API depends on food_items + GIN index)
  - 06-04 (/nutrition page depends on meal_plans + all child tables)
  - 07-nutrition-planner (plan builder depends on all 5 tables)

# Tech tracking
tech-stack:
  added:
    - pg_trgm PostgreSQL extension (trigram similarity search)
  patterns:
    - RLS via is_org_member(org_id) helper for direct org_id tables
    - RLS via EXISTS subquery chain for child tables (days -> plans -> org)
    - public SELECT RLS policy for globally-shared reference data (food_items)
    - IF NOT EXISTS guards on all CREATE TABLE and CREATE INDEX statements

key-files:
  created:
    - supabase/migrations/0041_nutrition_foundation.sql
  modified: []

key-decisions:
  - "food_items has no org_id — AFCD data is globally shared, public SELECT RLS policy enables food search without auth context"
  - "meal_plan_days/meals/components RLS uses EXISTS subquery chains back to org_id rather than is_org_member helper (no direct org_id column)"
  - "pg_trgm extension added alongside GIN full-text index to support both exact prefix ILIKE and ranked full-text food search"
  - "meal_plan_components.food_item_id is nullable (SET NULL on delete) allowing custom-only components without AFCD reference"

patterns-established:
  - "Child table RLS pattern: EXISTS(SELECT 1 FROM child JOIN ... JOIN meal_plans mp JOIN org_members om ON om.org_id = mp.org_id WHERE ... AND om.user_id = auth.uid())"
  - "Global reference tables get public SELECT + no INSERT/UPDATE/DELETE for non-service-role"

requirements-completed:
  - NUTR-01
  - NUTR-02

# Metrics
duration: 5min
completed: 2026-02-26
---

# Phase 6 Plan 01: Nutrition Foundation Summary

**PostgreSQL nutrition schema with 5 tables (food_items + meal plan hierarchy), pg_trgm + GIN indexes for AFCD food search, org-scoped RLS via EXISTS subquery chains, applied to Supabase production**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-26T13:43:23Z
- **Completed:** 2026-02-26T13:48:14Z
- **Tasks:** 2/2
- **Files modified:** 1

## Accomplishments

- Created and applied migration 0041 with all 5 nutrition tables to Supabase production
- Established RLS hierarchy: public read for food_items, org-member access for meal_plans, EXISTS chain for child tables
- GIN full-text index + pg_trgm trigram index on food_items.food_name for fast food search

## Task Commits

Each task was committed atomically:

1. **Task 1: Write migration 0041_nutrition_foundation.sql** - `14e55e7` (feat)
2. **Task 2: Apply migration via Supabase Management API** - (no file change, API operation — confirmed 5 tables in production)

**Plan metadata:** (docs commit — pending)

## Files Created/Modified

- `supabase/migrations/0041_nutrition_foundation.sql` - Complete nutrition schema: food_items (AFCD library), meal_plans (org-scoped, draft/published), meal_plan_days (day numbering), meal_plan_meals (meal type enum), meal_plan_components (food_item FK + qty)

## Decisions Made

- food_items has no org_id: AFCD is Australian government food data shared globally across all orgs. Public SELECT RLS policy allows food search to work without auth context (required for Phase 8 client portal nutrition view).
- Child table RLS via EXISTS subquery chains: meal_plan_days has no org_id, so RLS walks plan_id -> meal_plans -> org_members. Same pattern extends to meal_plan_meals (via day_id) and meal_plan_components (via meal_id -> day_id -> plan_id).
- pg_trgm added alongside full-text GIN: short search terms (<3 chars) don't work well with tsvector; trigram index handles prefix/substring queries that would miss with full-text only.
- food_item_id nullable in meal_plan_components: allows coaches to add custom text components (e.g., "1 cup water") without needing an AFCD food entry.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Windows Credential Manager PAT retrieval: stored as UTF-16 (44 bytes for 22-char token). The `CredRead` API returns bytes that must be interpreted as ASCII (every byte is significant, not every other byte). Required hex dump to confirm the actual PAT value before the API call succeeded.

## User Setup Required

None - no external service configuration required. Migration applied directly to Supabase production via Management API.

## Next Phase Readiness

- All 5 nutrition tables exist in production with correct schema, RLS, and indexes
- Phase 06-02 (AFCD seed script) can proceed immediately
- Phase 06-03 (food search API) can proceed: food_items_name_gin and food_items_name_trgm indexes are live
- Phase 06-04 (/nutrition scaffold) can proceed: meal_plans + child tables are ready

---
*Phase: 06-nutrition-foundation*
*Completed: 2026-02-26*

## Self-Check: PASSED

- FOUND: supabase/migrations/0041_nutrition_foundation.sql
- FOUND: commit 14e55e7 (feat(06-01): create nutrition foundation migration 0041)
- CONFIRMED: 5 tables in Supabase production (food_items, meal_plan_components, meal_plan_days, meal_plan_meals, meal_plans)
- CONFIRMED: RLS enabled on all 5 tables
- CONFIRMED: GIN indexes food_items_name_gin and food_items_name_trgm created
