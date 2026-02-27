# Roadmap: Coach OS

## Milestones

- ✅ **v1.0 Stabilisation** — Phases 1–5 (shipped 2026-02-26) — [Archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Client Portal** — Phases 1–4 (shipped 2026-02-26) — magic link portal, self-booking, Stripe checkout
- 🚧 **v1.2 Nutrition Engine** — Phases 6–9 — full meal planning: food library, plan builder, AI generation, client portal view, feedback loop

## Phases

<details>
<summary>✅ v1.0 Stabilisation (Phases 1–5) — SHIPPED 2026-02-26</summary>

- [x] Phase 1: Session Integrity (3/3 plans) — completed 2026-02-25
- [x] Phase 2: SMS Correctness (3/3 plans) — completed 2026-02-25
- [x] Phase 3: Background Jobs (2/2 plans) — completed 2026-02-25
- [x] Phase 4: UI Reliability (2/2 plans) — completed 2026-02-25
- [x] Phase 5: Production Hygiene (2/2 plans) — completed 2026-02-26

</details>

**v1.2 Nutrition Engine:**

- [x] **Phase 6: Nutrition Foundation** — AFCD food library import, DB schema (meal_plans, days, meals, components), /nutrition section scaffold, plan CRUD with date range + client assignment
- [x] **Phase 7: Plan Builder + AI Generation** — Coach plan builder UI (add days/meals/components, food search), AI generation from client goal/calories/macros/restrictions, macro auto-calculation, publish to portal (completed 2026-02-26)
- [x] **Phase 8: Client Portal Nutrition View** — Nutrition tab in portal/[token], collapsible day view, per-meal macro tables, day totals + stacked bar chart, feedback drawer (submit + coach notified) (completed 2026-02-27)
- [ ] **Phase 9: AI Feedback Loop + Versioning** — Coach feedback inbox, AI drafts component swap from AFCD, coach approves/edits draft, new plan version published, version history for coach + client

### Phase 6: Nutrition Foundation

**Goal:** Seed the AFCD food library into Supabase, define the meal plan data model, and scaffold the `/nutrition` section so coaches can create and list plans.

**Plans:** 4/4 plans complete (06-04 checkpoint approved 2026-02-27)

Plans:
- [x] 06-01-PLAN.md — DB migration 0041 (all 5 nutrition tables + RLS + indexes) ✅ 2026-02-26
- [x] 06-02-PLAN.md — AFCD seed script + human-verify seeding (~1,588 rows) ✅ 2026-02-26
- [x] 06-03-PLAN.md — Food search API GET /api/nutrition/foods?q=... ✅ 2026-02-27
- [x] 06-04-PLAN.md — /nutrition page scaffold (list + create modal + sidebar nav) ✅ 2026-02-27

**Deliverables:**
- `food_items` table seeded from AFCD Release 3 Excel (1,588 AU foods, 58 nutrients — focus: energy_kcal, protein_g, fat_g, carb_g, food_name, food_group)
- One-time seed script (`scripts/seed-afcd.ts`) to import AFCD Excel → Supabase
- DB schema: `meal_plans` (id, org_id, client_id, name, start_date, end_date, status, version, published_at), `meal_plan_days` (id, plan_id, day_number, date), `meal_plan_meals` (id, day_id, meal_type, title, note), `meal_plan_components` (id, meal_id, food_item_id, qty_g, custom_name)
- `/nutrition` page: list of client plans, create plan modal (client select, date range, name), plan status badges (draft/published)
- Food item search API: `GET /api/nutrition/foods?q=chicken` — returns top 20 AFCD matches

**Verification:**
- AFCD data seeded: `SELECT count(*) FROM food_items` returns ~1,588
- Coach can create a plan assigned to a client with a date range
- Plan appears in `/nutrition` list with correct status

### Phase 7: Plan Builder + AI Generation

**Goal:** Coach can build a meal plan day-by-day, adding meals and AFCD components with auto-calculated macros, or generate the full plan via AI.

**Plans:** 4/4 plans complete

Plans:
- [x] 07-01-PLAN.md — Plan builder shell: /nutrition/[planId] page, days sidebar, GET plan API with nested days/meals/components, POST days ✅ 2026-02-27
- [x] 07-02-PLAN.md — Meal editing + food search + macro calculation: Add Meal modal, ComponentRow, FoodSearchInput, meal/day MacroBar totals ✅ 2026-02-27
- [x] 07-03-PLAN.md — AI generation: POST /api/nutrition/plans/[planId]/generate calls claude-sonnet-4-6, GenerateModal UI ✅ 2026-02-27
- [x] 07-04-PLAN.md — Publish action + human-verify checkpoint ✅ 2026-02-27

**Deliverables:**
- Plan builder UI at `/nutrition/[planId]`: days sidebar, meal cards per day, component rows with qty input
- Food search within component row (inline AFCD search)
- Macro auto-calculation: components summed → meal totals → day totals (energy, protein, fat, carbs)
- AI generation endpoint: `POST /api/nutrition/plans/[planId]/generate` — inputs: client goal, calorie target, macro split %, dietary restrictions → Claude generates 7-day plan using AFCD food_ids
- "Generate with AI" button → fills plan, coach can edit any component after
- Publish action: sets `meal_plans.status = 'published'`, `published_at = now()`

**Verification:**
- Coach can manually add a meal with 3 components, macros calculate correctly
- AI generation fills all 7 days with AFCD-matched foods
- Publish makes the plan visible in client portal

### Phase 8: Client Portal Nutrition View

**Goal:** Client sees their active meal plan in the portal with the UI shown in the reference design, and can submit feedback on individual meals.

**Plans:** 3/3 plans complete

Plans:
- [x] 08-01-PLAN.md — DB migration 0042 (meal_plan_feedback table + RLS) ✅ 2026-02-27
- [x] 08-02-PLAN.md — Portal nutrition API (GET published plan + POST feedback + coach SMS) ✅ 2026-02-27
- [x] 08-03-PLAN.md — Portal nutrition UI (Nutrition tab, NutritionView, FeedbackDrawer) + human-verify checkpoint ✅ 2026-02-27

**Deliverables:**
- Nutrition tab in `/portal/[token]` page
- 7-day collapsible view: day header + date, meals, component table (Component / Qty / Unit / C / P / F / kcal), meal totals row
- Day totals panel: KPI boxes (total carbs, protein, fat, calories) + stacked bar macro chart (CSS segments, no chart library)
- Feedback drawer: type (substitution/dislike/allergy/portion/schedule/other), meal scope select, comment textarea, going-forward select
- `meal_plan_feedback` table: id, plan_id, meal_id, client_id, type, scope, comment, forward, status (pending/reviewed), created_at
- Submit feedback → stored + coach receives SMS notification via existing Twilio pattern

**Verification:**
- Client portal shows Nutrition tab when active published plan exists
- All 7 days render with correct macro values
- Client submits feedback → row in `meal_plan_feedback`, coach receives SMS

### Phase 9: AI Feedback Loop + Versioning

**Goal:** Coach reviews client feedback, AI drafts a substitution, coach approves/edits, new plan version is published. Full version history accessible.

**Plans:** 4 plans

Plans:
- [ ] 09-01-PLAN.md — DB migration 0043 (parent_plan_id FK on meal_plans + ai_draft columns on meal_plan_feedback)
- [ ] 09-02-PLAN.md — AI draft endpoint + feedback detail API + version creation endpoint
- [ ] 09-03-PLAN.md — Feedback inbox coach UI + DraftReviewModal (Feedback tab in /nutrition)
- [ ] 09-04-PLAN.md — Version selector in coach plan builder + version badge in portal + human-verify checkpoint

**Deliverables:**
- Nutrition feedback inbox in `/nutrition` section: list of pending feedback items with meal + comment
- AI draft endpoint: `POST /api/nutrition/feedback/[id]/draft` — reads feedback + current component → suggests replacement food from AFCD with adjusted qty to match original macros
- Coach review UI: shows original component vs AI-suggested swap, coach can accept/edit/reject
- On approve: creates `meal_plans` row with incremented version, copies all data, applies the swap → publishes new version
- Version selector in coach plan view and client portal (shows v1, v2 etc.)
- `meal_plans.version` integer, `meal_plans.parent_plan_id` FK for version chain

**Verification:**
- Coach sees feedback item, triggers AI draft, draft shows original vs suggested
- Approve → new version published, client portal shows updated plan with version badge
- Old version still accessible via version selector

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Session Integrity | v1.0 | 3/3 | Complete | 2026-02-25 |
| 2. SMS Correctness | v1.0 | 3/3 | Complete | 2026-02-25 |
| 3. Background Jobs | v1.0 | 2/2 | Complete | 2026-02-25 |
| 4. UI Reliability | v1.0 | 2/2 | Complete | 2026-02-25 |
| 5. Production Hygiene | v1.0 | 2/2 | Complete | 2026-02-26 |
| 6. Nutrition Foundation | v1.2 | 4/4 | Complete | 2026-02-27 |
| 7. Plan Builder + AI Generation | v1.2 | 4/4 | Complete | 2026-02-27 |
| 8. Client Portal Nutrition View | v1.2 | 3/3 | Complete | 2026-02-27 |
| 9. AI Feedback Loop + Versioning | v1.2 | 0/4 | Planned | — |
