# Phase 6: Nutrition Foundation - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning
**Source:** /gsd:discuss-phase session

<domain>
## Phase Boundary

Seed the AFCD food library into Supabase, create the meal plan data model, and scaffold the `/nutrition` section so coaches can create and list plans. This phase is pure infrastructure + scaffold — no plan builder UI, no AI generation, no client portal view. Those are Phase 7 and 8.

</domain>

<decisions>
## Implementation Decisions

### Nutrition feature scope
- Full feature end-to-end across 4 phases (6–9)
- Phase 6 specifically: data foundation + /nutrition scaffold only

### Food data source
- **AFCD (Australian Food Composition Database) Release 3** — foodstandards.gov.au
- 1,588 Australian foods, 58 core nutrients
- Available as Excel download (no API, no ongoing cost)
- Import via one-time seed script (`scripts/seed-afcd.ts`)
- Fields to capture: food_id (AFCD), food_name, food_group, energy_kcal, protein_g, fat_g, carb_g (+ fibre_g if available)
- No third-party food API dependency

### Meal plan data model
- `meal_plans` (id, org_id, client_id, name, start_date, end_date, status, version, published_at, created_by)
- `meal_plan_days` (id, plan_id, day_number, date)
- `meal_plan_meals` (id, day_id, meal_type, title, note)
- `meal_plan_components` (id, meal_id, food_item_id, qty_g, custom_name)
- Plans are **per-client** (no template/multi-client assignment in v1)
- Plans have a **date range** (start_date + end_date), not just a week
- `status`: 'draft' | 'published'
- `version`: integer (starts at 1, increments on each publish in Phase 9)

### /nutrition section (coach side)
- New top-level nav section at `/nutrition` (alongside /my-accounts, /insights etc.)
- Lists all meal plans across the org — filterable by client
- Create plan modal: client select, plan name, start_date, end_date
- Plan status badges (draft / published)

### Food search API
- `GET /api/nutrition/foods?q=chicken` — returns top 20 AFCD matches
- Used by Phase 7 plan builder (search while adding components)
- Full-text search on food_name

### Claude's Discretion
- AFCD Excel parsing approach (column mapping to handle AFCD's column naming)
- Supabase migration file naming / numbering (follow existing migration sequence)
- /nutrition page layout/styling (follow existing Coach OS design patterns)
- Food search ranking/sorting logic

</decisions>

<specifics>
## Specific Ideas

- AFCD data is from Australia's official food regulator (FSANZ) — authoritative source for AU market, aligns with Coach OS's Australia-first positioning
- The HTML mockup reference shows the final client-facing view — Phase 6 builds none of that, just the data layer
- Food search API is needed by Phase 7, but building it in Phase 6 avoids a dependency

</specifics>

<deferred>
## Deferred Ideas

- Dietary restrictions / food allergies as persistent client profile fields — could be Phase 6 extension or standalone
- Food favourites / custom foods added by coach — future phase
- Grocery list generation — future phase
- Nutritional analysis beyond C/P/F/kcal (fibre, micronutrients) — future phase
- Multi-client plan templates — deferred to after v1.2 proves value

</deferred>

---

*Phase: 06-nutrition-foundation*
*Context gathered: 2026-02-26*
