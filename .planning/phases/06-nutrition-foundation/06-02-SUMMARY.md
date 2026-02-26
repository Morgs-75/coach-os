---
phase: 06-nutrition-foundation
plan: 02
subsystem: database
tags: [supabase, afcd, food-items, seed-script, exceljs, typescript, nutrition]

# Dependency graph
requires:
  - phase: 06-01
    provides: food_items table with AFCD schema and upsert-safe afcd_food_id UNIQUE constraint
provides:
  - AFCD Release 3 seed script at apps/trainer-web/scripts/seed-afcd.ts
  - exceljs, dotenv, tsx dependencies in apps/trainer-web/package.json
  - npm run seed-afcd shortcut for running the import
affects:
  - 06-03 (food search API needs food_items populated)
  - 07-nutrition-planner (plan builder needs food library available)
  - 08-portal-nutrition (portal macros need food_items populated)

# Tech tracking
tech-stack:
  added:
    - exceljs ^4.4.0 (Excel file parsing for AFCD Release 3)
    - dotenv ^16.4.0 (load .env.local in Node scripts outside Next.js)
    - tsx ^4.0.0 (run TypeScript scripts without build step)
  patterns:
    - Column auto-detection from Excel header row via partial case-insensitive match
    - Batch upsert pattern: 500 rows per request, onConflict: 'afcd_food_id'
    - dotenv config({ path: resolve(__dirname, '..', '.env.local') }) for script env loading

key-files:
  created:
    - apps/trainer-web/scripts/seed-afcd.ts
  modified:
    - apps/trainer-web/package.json

key-decisions:
  - "Script uses SUPABASE_SERVICE_ROLE_KEY (not anon key) — food_items INSERT requires service role since public RLS only allows SELECT"
  - "Column detection is dynamic/fuzzy — AFCD Release 3 column names may differ slightly between downloads; partial match guards against this"
  - "kJ -> kcal fallback conversion (divide by 4.184) in case the kcal column is absent from a particular AFCD release"
  - "AFCD file is NOT bundled in repo — user downloads separately from Food Standards Australia NZ; script path is a CLI arg"

patterns-established:
  - "Seed scripts go in apps/trainer-web/scripts/ and use tsx + dotenv for env loading"
  - "ExcelJS dynamic column finder: headerRow.eachCell -> partial lowercase match with optional exclusion patterns"

requirements-completed:
  - NUTR-03

# Metrics
duration: 5min
completed: 2026-02-26
---

# Phase 6 Plan 02: AFCD Seed Script Summary

**TypeScript seed script using ExcelJS to bulk-upsert AFCD Release 3 Australian food composition data into food_items via Supabase service role with dynamic column detection and idempotent batch upsert**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-26T13:55:09Z
- **Completed:** 2026-02-26T14:00:00Z (checkpoint — awaiting human verification of seed run)
- **Tasks:** 1/1 code tasks complete (checkpoint pending human action)
- **Files modified:** 2

## Accomplishments

- Created apps/trainer-web/scripts/seed-afcd.ts with full AFCD Release 3 import logic
- Added exceljs, dotenv, tsx dependencies; npm run seed-afcd script entry
- Script auto-detects all 8 AFCD columns from header row (food ID, name, group, energy kcal, protein, fat, carb, fibre)
- kJ-to-kcal fallback if kcal column not present in a given AFCD release

## Task Commits

Each task was committed atomically:

1. **Task 1: Install tsx dependency and write seed script** - `a36c353` (feat)

**Plan metadata:** (pending — will be committed with SUMMARY.md and STATE.md)

## Files Created/Modified

- `apps/trainer-web/scripts/seed-afcd.ts` - AFCD Release 3 Excel importer: dynamic column detection, batch upsert to food_items via Supabase service role, progress logging, idempotent
- `apps/trainer-web/package.json` - Added exceljs ^4.4.0, dotenv ^16.4.0, tsx ^4.0.0, seed-afcd npm script

## Decisions Made

- Used `SUPABASE_SERVICE_ROLE_KEY` instead of anon key: food_items has a public SELECT policy but INSERT requires service role — scripts run as admin operations.
- Column detection uses partial, case-insensitive matching: AFCD column names vary slightly between releases. Fuzzy matching prevents the script from breaking on minor header variations.
- kJ fallback: If only kJ energy column is available, script divides by 4.184 to produce kcal values. This handles older AFCD formats.
- AFCD file not bundled: The Excel file is ~10MB Australian government data; users download it from Food Standards Australia NZ website. Script accepts path as CLI arg.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

To seed the food_items table, the user must:

1. Download AFCD Release 3 from: https://www.foodstandards.gov.au/science-data/monitoringnutrients/ausnut/fooddetails
   (Look for "AFCD Release 3 — Food composition data" Excel file)

2. Ensure `.env.local` in `apps/trainer-web/` contains:
   ```
   SUPABASE_URL=https://ntqdmgvxirswnjlnwopq.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   ```

3. From `apps/trainer-web/`, run:
   ```
   npx tsx scripts/seed-afcd.ts /path/to/AFCD-Release3.xlsx
   ```
   Or: `npm run seed-afcd -- /path/to/AFCD-Release3.xlsx`

4. Verify in Supabase dashboard:
   ```sql
   SELECT count(*) FROM food_items;
   -- Expected: ~1,400–1,700 rows
   ```

## Next Phase Readiness

- Seed script is ready; food_items will be populated once user runs the seed
- 06-03 (food search API) can proceed in parallel — the GIN/trgm indexes are already live from 06-01
- 07-nutrition-planner and 08-portal-nutrition should wait until food_items is seeded

---
*Phase: 06-nutrition-foundation*
*Completed: 2026-02-26*

## Self-Check: PASSED

- FOUND: apps/trainer-web/scripts/seed-afcd.ts
- FOUND: commit a36c353 (feat(06-02): add AFCD seed script and exceljs/tsx/dotenv dependencies)
- CONFIRMED: exceljs in package.json dependencies
- CONFIRMED: tsx in package.json devDependencies
- CONFIRMED: dotenv in package.json dependencies
- CONFIRMED: seed-afcd in package.json scripts
- CONFIRMED: script contains upsert, afcd_food_id, BATCH_SIZE, food_items, exceljs, SUPABASE_SERVICE_ROLE_KEY
