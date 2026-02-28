import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

async function getOrgAndUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { orgId: null, userId: null };
  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  return { orgId: membership?.org_id ?? null, userId: user.id };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IntakeData = Record<string, any>;

interface GenerateBody {
  // Rich path (from IntakeWizard)
  intake_data?: IntakeData;
  plan_length_days?: number;
  // Legacy simple path
  goal?: string;
  calorie_target?: number;
  macro_split?: { protein_pct: number; carb_pct: number; fat_pct: number };
  dietary_restrictions?: string;
}

const VALID_MEAL_TYPES = new Set([
  "breakfast", "morning_snack", "lunch", "afternoon_snack",
  "dinner", "evening_snack", "other",
]);

function buildRichPrompt(intake: IntakeData, numDays: number, foodList: string, startDay = 1): string {
  const goal = intake.primary_goal?.replace(/_/g, " ") ?? "general health";
  const targetKcal = intake.target_calories ?? 2000;
  const mealsPerDay = intake.meals_per_day ?? 4;
  const kcalPerMeal = Math.round(targetKcal / mealsPerDay);
  const dietStyle = intake.diet_style ?? "omnivore";
  const allergies = intake.allergies || "none";
  const dislikes = intake.dislikes_foods || "none";
  const likes = intake.likes_foods || "varied";
  const cookTime = intake.cooking_time_min ?? 30;
  const cookSkill = intake.cooking_skill ?? "intermediate";
  const mealPrep = intake.meal_prep ? "Yes — batch cooking is OK" : "No — fresh meals preferred";
  const repeatMeals = intake.repeat_meals_ok ? "Yes — repeat meals across days is fine" : "No — vary meals each day";
  const includeSnacks = intake.include_snacks ? "Yes" : "No";
  const medConditions = intake.medical_conditions || "none";
  const supplements = intake.supplements || "none";
  const nonNeg = intake.non_negotiables || "none";
  const biggestChallenge = intake.biggest_challenge || "not specified";
  const budget = intake.budget_per_day_aud ? `$${intake.budget_per_day_aud} AUD/day` : "not specified";
  const spice = intake.spice_level ?? "mild";
  const equipment = intake.equipment || "standard kitchen";

  return `You are a sports nutrition expert creating a personalised meal plan for a personal training client.

CLIENT PROFILE:
- Goal: ${goal}
- Daily calorie target: ${targetKcal} kcal (${mealsPerDay} meals × ~${kcalPerMeal} kcal each)
- Diet style: ${dietStyle}
- Allergies/intolerances: ${allergies}
- Foods they like: ${likes}
- Foods they dislike/avoid: ${dislikes}
- Medical conditions relevant to diet: ${medConditions}
- Supplements: ${supplements}
- Non-negotiables: ${nonNeg}
- Biggest eating challenge: ${biggestChallenge}

MEAL STRUCTURE:
- Meals per day: ${mealsPerDay}
- Include snacks: ${includeSnacks}
- Spice tolerance: ${spice}
- Repeat meals across days: ${repeatMeals}

PRACTICAL CONSTRAINTS:
- Cooking skill: ${cookSkill}
- Max cook time per meal: ${cookTime} min
- Meal prep/batch cooking: ${mealPrep}
- Available equipment: ${equipment}
- Daily budget: ${budget}

AVAILABLE FOODS (id | name | group | kcal/100g | P | C | F):
${foodList}

CALORIE CALCULATION GUIDE — CRITICAL: use the kcal/100g column to size every portion:
- Formula: qty_g = round(meal_target_kcal / food_kcal_per_100g * 100)
- Example A: target 750 kcal, food is 165 kcal/100g → qty_g = round(750/165*100) = 455g
- Example B: target 750 kcal, food is 380 kcal/100g → qty_g = round(750/380*100) = 197g
- Each meal target is ~${kcalPerMeal} kcal. A 2-component meal needs both components to add up to ~${kcalPerMeal} kcal.
- DO NOT use small portions (e.g. 50g) for multiple low-density foods in one meal — that will only provide 50–150 kcal, far below the ${kcalPerMeal} kcal target.

INSTRUCTIONS:
- Create exactly ${numDays} day(s) (day_number ${startDay} through ${startDay + numDays - 1}).${startDay > 1 ? `\n- This continues a multi-day plan — use different foods from the earlier days.` : ""}
- Each day must have exactly ${mealsPerDay} meals. Use only these meal_type values: breakfast, morning_snack, lunch, afternoon_snack, dinner, evening_snack, other.
- Each meal MUST deliver approximately ${kcalPerMeal} kcal — use the kcal/100g data to calculate qty_g precisely.
- Each meal should have 2–4 food components.
- Use ONLY the short food IDs from the list above (e.g. F1, F12, F47) — do NOT invent IDs.
- The day total MUST be within 5% of ${targetKcal} kcal. This is a hard requirement.
- Strictly avoid all allergens: ${allergies}.
- Strictly avoid: ${dislikes}.
- Each food item (by ID) must appear at most once across all meals in a single day — no duplicates within a day.
- Foods sharing the same first word are the same ingredient (e.g. all "Apple, *" variants = one apple, all "Broccoli, *" = one broccoli). Use each ingredient family at most once per day.
- Limit fruit to 1 serving per day total (across all meals combined).
- Vary foods across days — do not repeat the exact same meal on multiple days.
- ${repeatMeals.startsWith("No") ? "Use different meals each day." : "Repeating similar meals is acceptable."}

Respond with ONLY valid JSON — no commentary, no markdown fences:
{
  "days": [
    {
      "day_number": 1,
      "meals": [
        {
          "meal_type": "breakfast",
          "title": "descriptive title",
          "components": [
            { "food_item_id": "F3", "qty_g": 80 }
          ]
        }
      ]
    }
  ]
}`;
}

/** Extract the first complete JSON object from a string using brace-depth tracking.
 *  Prevents greedy regex from absorbing trailing content (e.g. Sonnet commentary). */
function extractRootJson(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function buildSimplePrompt(goal: string, calorieTarget: number, macroPct: { protein_pct: number; carb_pct: number; fat_pct: number }, restrictions: string, foodList: string): string {
  const mealsPerDay = 4;
  const kcalPerMeal = Math.round(calorieTarget / mealsPerDay);
  return `You are a sports nutrition expert. Generate a 1-day meal plan for a personal training client.

CLIENT GOAL: ${goal}
DAILY CALORIE TARGET: ${calorieTarget} kcal (${mealsPerDay} meals × ~${kcalPerMeal} kcal each)
MACRO SPLIT: Protein ${macroPct.protein_pct}% / Carbs ${macroPct.carb_pct}% / Fat ${macroPct.fat_pct}%
DIETARY RESTRICTIONS: ${restrictions}

AVAILABLE FOODS (id | name | group | kcal/100g | protein_g | carb_g | fat_g):
${foodList}

CALORIE CALCULATION: use kcal/100g to size portions — qty_g = round(meal_target_kcal / food_kcal_per_100g * 100).

INSTRUCTIONS:
- Create exactly 1 day (day_number 1).
- Each day must have exactly ${mealsPerDay} meals using: breakfast, morning_snack, lunch, afternoon_snack, dinner, evening_snack, other.
- Each meal MUST deliver approximately ${kcalPerMeal} kcal — calculate qty_g from the kcal/100g values.
- Each meal should have 2–4 food components.
- Use ONLY the short food IDs from the list above (e.g. F1, F12, F47) — do NOT invent IDs.
- The day total MUST be within 5% of ${calorieTarget} kcal. This is a hard requirement.
- Respect dietary restrictions strictly.

Respond with ONLY valid JSON in this exact structure — no commentary, no markdown:
{
  "days": [
    {
      "day_number": 1,
      "meals": [
        {
          "meal_type": "breakfast",
          "title": "optional descriptive title",
          "components": [
            { "food_item_id": "F3", "qty_g": 80 }
          ]
        }
      ]
    }
  ]
}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  // Resolve planId before the try block so it's accessible in catch
  const { planId } = await params;
  try {
    const supabase = await createClient();
    const { orgId } = await getOrgAndUser(supabase);
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Idempotency guard: only run AI work if status is 'generating' (set by /start)
    const { data: planRow } = await supabase
      .from("meal_plans")
      .select("generation_status, id, name, client_id")
      .eq("id", planId)
      .eq("org_id", orgId)
      .single();
    if (!planRow) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    // Return immediately if already complete, error, or idle (not triggered by /start)
    if (planRow.generation_status !== "generating") {
      return NextResponse.json({ status: planRow.generation_status });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      await supabase
        .from("meal_plans")
        .update({ generation_status: "error", generation_error: "AI not configured — ANTHROPIC_API_KEY is missing" })
        .eq("id", planId);
      return NextResponse.json({ error: "AI not configured — ANTHROPIC_API_KEY is missing" }, { status: 500 });
    }

    // Parse request body
    const body: GenerateBody = await request.json().catch(() => ({}));
    const useIntake = !!body.intake_data;
    const numDays = Math.min(14, Math.max(1, body.plan_length_days ?? 1));

    // Fetch a curated food sample using group-based queries.
    // AUSNUT naming: "Ingredient, preparation, detail" — starts-with "Ingredient, "
    // targets simple/raw foods; compound dishes (e.g. "Chicken burger") start with
    // multi-word prefixes and are excluded.
    const TARGET_GROUPS: { label: string; limit: number; prefixes: string[] }[] = [
      { label: "Poultry",      limit: 18, prefixes: ["Chicken, ", "Turkey, ", "Duck, "] },
      { label: "Meat",         limit: 18, prefixes: ["Beef, ", "Lamb, ", "Pork, "] },
      { label: "Seafood",      limit: 15, prefixes: ["Salmon, ", "Tuna, ", "Prawn, ", "Barramundi, "] },
      { label: "Dairy",        limit: 12, prefixes: ["Milk, ", "Yoghurt, ", "Cheese, "] },
      { label: "Eggs",         limit:  8, prefixes: ["Egg, "] },
      { label: "Cereals",      limit: 18, prefixes: ["Oats, ", "Rice, ", "Pasta, ", "Porridge, ", "Quinoa, "] },
      {
        label: "Vegetables", limit: 25,
        prefixes: [
          "Potato, ", "Sweet potato, ", "Broccoli, ", "Spinach, ", "Carrot, ",
          "Cabbage, ", "Tomato, ", "Mushroom, ", "Onion, ", "Capsicum, ",
          "Asparagus, ", "Cauliflower, ", "Zucchini, ", "Cucumber, ", "Beetroot, ",
          "Snow pea, ", "Lettuce, ", "Corn, ", "Pumpkin, ", "Celery, ",
          "Brussels sprout, ", "Kale, ", "Leek, ",
        ],
      },
      {
        label: "Fruit", limit: 15,
        prefixes: [
          "Apple, ", "Banana, ", "Blueberry, ", "Strawberry, ", "Mango, ",
          "Pear, ", "Melon, ", "Peach, ", "Apricot, ", "Orange, ",
          "Grape, ", "Cherry, ", "Pineapple, ",
        ],
      },
      { label: "Nuts & Seeds", limit: 12, prefixes: ["Nut, ", "Mixed nuts, "] },
      { label: "Legumes",      limit: 10, prefixes: ["Bean, ", "Lentil, ", "Chickpea, "] },
      { label: "Fats & Oils",  limit:  8, prefixes: ["Avocado, ", "Oil, ", "Butter, "] },
    ];

    // One parallel query per group. Values containing commas are double-quoted
    // so PostgREST doesn't misparse them as OR separators.
    const groupResults = await Promise.all(
      TARGET_GROUPS.map(({ label: _label, limit, prefixes }) => {
        const orFilter = prefixes.map((p) => `food_name.ilike."${p}%"`).join(",");
        return supabase
          .from("food_items")
          .select("id, food_name, food_group, energy_kcal, protein_g, carb_g, fat_g")
          .not("energy_kcal", "is", null)
          .or(orFilter)
          .order("food_name", { ascending: true })
          .limit(limit);
      })
    );

    // Per-group family cap: high-variety groups (Fruit, Vegetables) keep only 1
    // entry per ingredient family (e.g. 1 apple, 1 broccoli) so the model can't
    // stack multiple apple cultivars in one meal. Proteins allow more variants
    // since "Beef, mince" and "Beef, diced" are nutritionally distinct.
    const FAMILY_CAPS: Record<string, number> = {
      Fruit: 1,
      Vegetables: 1,
      Cereals: 2,
    };
    const DEFAULT_FAMILY_CAP = 4;

    const foodSample = groupResults.flatMap((r, i) => {
      const rows = r.data ?? [];
      const label = TARGET_GROUPS[i].label;
      const cap = FAMILY_CAPS[label] ?? DEFAULT_FAMILY_CAP;
      const familyCounts = new Map<string, number>();
      return rows
        .map(f => ({ ...f, food_group: f.food_group ?? label }))
        .filter(f => {
          const family = f.food_name.split(",")[0].trim().toLowerCase();
          const count = familyCounts.get(family) ?? 0;
          if (count >= cap) return false;
          familyCounts.set(family, count + 1);
          return true;
        });
    });

    const dedupedFoodSample = foodSample; // alias — caps applied above

    // Use short IDs (F1, F2…) in the prompt so the AI never has to copy a UUID.
    // Build maps to translate back after parsing.
    const shortIdToRealId = new Map<string, string>();
    const shortIdToFoodName = new Map<string, string>();
    const foodList = dedupedFoodSample
      .map((f, i) => {
        const shortId = `F${i + 1}`;
        shortIdToRealId.set(shortId, f.id);
        shortIdToFoodName.set(shortId, f.food_name);
        return `${shortId} | ${f.food_name} | ${f.food_group ?? "General"} | kcal/100g: ${f.energy_kcal ?? "?"} | P: ${f.protein_g ?? "?"} | C: ${f.carb_g ?? "?"} | F: ${f.fat_g ?? "?"}`;
      })
      .join("\n");

    type GeneratedDay = {
      day_number: number;
      meals: Array<{
        meal_type: string;
        title?: string;
        components: Array<{ food_item_id: string; qty_g: number }>;
      }>;
    };

    // ── Claude call helper ────────────────────────────────────────────────────
    async function callClaude(prompt: string, requestedDays: number): Promise<GeneratedDay[]> {
      // Sonnet for short plans (≤3 days, ~13s), Haiku for longer (≤26s Netlify limit)
      const model = requestedDays <= 3 ? "claude-sonnet-4-6" : "claude-haiku-4-5-20251001";
      const maxTokens = requestedDays <= 1 ? 2048 : requestedDays <= 4 ? 4096 : 8192;

      const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey!, // non-null: checked above
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!aiResp.ok) {
        const errText = await aiResp.text();
        console.error("Anthropic API error:", errText);
        throw new Error("AI generation failed");
      }

      const aiData = await aiResp.json();
      const responseText: string = aiData.content?.[0]?.text ?? "";
      const jsonStr = extractRootJson(responseText);
      if (!jsonStr) {
        console.error("No JSON in Claude response:", responseText.slice(0, 500));
        throw new Error("AI returned invalid response");
      }

      let parsed: { days: GeneratedDay[] };
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        throw new Error("Failed to parse AI response as JSON");
      }

      if (!parsed.days || !Array.isArray(parsed.days)) {
        throw new Error("AI response missing days array");
      }

      // ── Enforce uniqueness per day (code-side, model-agnostic) ──────────────
      // Rule 1: same food ID at most once per day.
      // Rule 2: same ingredient family (first word of food name) at most once per day.
      // This catches Haiku violations without relying on prompt compliance.
      // Meals that are left empty after deduplication are dropped entirely;
      // the calorie scaler compensates across the remaining meals.
      for (const day of parsed.days) {
        const usedIds = new Set<string>();
        const usedFamilies = new Set<string>();
        for (const meal of day.meals ?? []) {
          meal.components = (meal.components ?? []).filter(comp => {
            const id = comp.food_item_id;
            const foodName = shortIdToFoodName.get(id) ?? id;
            const family = foodName.split(",")[0].trim().toLowerCase();
            if (usedIds.has(id) || usedFamilies.has(family)) return false;
            usedIds.add(id);
            usedFamilies.add(family);
            return true;
          });
        }
        // Drop meals emptied by deduplication
        day.meals = (day.meals ?? []).filter(meal => (meal.components ?? []).length > 0);
      }

      // Translate short IDs back to real UUIDs
      for (const day of parsed.days) {
        for (const meal of day.meals ?? []) {
          for (const comp of meal.components ?? []) {
            if (comp.food_item_id) {
              const realId = shortIdToRealId.get(comp.food_item_id);
              if (realId) comp.food_item_id = realId;
            }
          }
        }
      }

      return parsed.days;
    }

    // ── Build prompts ─────────────────────────────────────────────────────────
    function buildPrompt(startDay: number, count: number): string {
      if (useIntake && body.intake_data) {
        return buildRichPrompt(body.intake_data, count, foodList, startDay);
      }
      // Simple path always generates from day 1 (no continuation needed)
      const goal = body.goal?.trim() || "general health and balanced nutrition";
      const calorieTarget = body.calorie_target ?? 2000;
      const macroPct = body.macro_split ?? { protein_pct: 30, carb_pct: 45, fat_pct: 25 };
      const restrictions = body.dietary_restrictions?.trim() || "none";
      return buildSimplePrompt(goal, calorieTarget, macroPct, restrictions, foodList);
    }

    // ── First pass ────────────────────────────────────────────────────────────
    // For plans > 5 days, ask for the first 5 only to stay within Haiku's
    // 8192-token output ceiling. A second pass fills remaining days.
    const FIRST_PASS_MAX = 5;
    const firstPassCount = Math.min(numDays, FIRST_PASS_MAX);
    let allDays: GeneratedDay[];
    try {
      allDays = await callClaude(buildPrompt(1, firstPassCount), firstPassCount);
    } catch (err) {
      await supabase
        .from("meal_plans")
        .update({ generation_status: "error", generation_error: String(err) })
        .eq("id", planId);
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }

    // ── Second pass (if needed) ───────────────────────────────────────────────
    if (numDays > FIRST_PASS_MAX) {
      const startDay2 = firstPassCount + 1;
      const count2 = numDays - firstPassCount;
      try {
        const moreDays = await callClaude(buildPrompt(startDay2, count2), count2);
        allDays = [...allDays, ...moreDays];
      } catch (err) {
        // Log but don't fail — we'll persist whatever days we got in pass 1
        console.error("Second-pass generation failed:", err);
      }
    }

    // ── Per-day calorie scaling ───────────────────────────────────────────────
    // The AI often over/under-shoots portions. Scale every component's qty_g
    // proportionally so each day lands within 3% of the calorie target.
    const targetKcal = useIntake && body.intake_data
      ? (body.intake_data.target_calories ?? 2000)
      : (body.calorie_target ?? 2000);

    // Build UUID → kcal/100g lookup using energy_kcal — same value the UI and
    // verify script use, so scaling targets exactly match what is displayed.
    const realIdToEnergy = new Map<string, number>();
    for (const f of dedupedFoodSample) {
      if (f.energy_kcal != null) realIdToEnergy.set(f.id, f.energy_kcal);
    }

    for (const day of allDays) {
      let actualKcal = 0;
      for (const meal of day.meals ?? []) {
        for (const comp of meal.components ?? []) {
          const kcalPer100 = realIdToEnergy.get(comp.food_item_id);
          if (kcalPer100) actualKcal += (kcalPer100 / 100) * comp.qty_g;
        }
      }
      if (actualKcal <= 0) continue;
      const scale = targetKcal / actualKcal;
      if (Math.abs(scale - 1) <= 0.03) continue; // already within 3%
      for (const meal of day.meals ?? []) {
        for (const comp of meal.components ?? []) {
          comp.qty_g = Math.max(10, Math.min(800, Math.round(comp.qty_g * scale)));
        }
      }
    }

    // ── Collect valid food IDs ────────────────────────────────────────────────
    const validFoodIds = new Set<string>(shortIdToRealId.values());

    // ── Clear + insert ────────────────────────────────────────────────────────
    await supabase.from("meal_plan_days").delete().eq("plan_id", planId);

    let daysCreated = 0;
    for (const day of allDays) {
      if (!day.day_number || !Array.isArray(day.meals)) continue;

      const { data: insertedDay, error: dayError } = await supabase
        .from("meal_plan_days")
        .insert({ plan_id: planId, day_number: day.day_number })
        .select()
        .single();

      if (dayError || !insertedDay) {
        console.error("Failed to insert day:", dayError);
        continue;
      }
      daysCreated++;

      let mealSortOrder = 0;
      for (const meal of day.meals) {
        const mealType = VALID_MEAL_TYPES.has(meal.meal_type) ? meal.meal_type : "other";

        const { data: insertedMeal, error: mealError } = await supabase
          .from("meal_plan_meals")
          .insert({
            day_id: insertedDay.id,
            meal_type: mealType,
            title: meal.title ?? null,
            sort_order: mealSortOrder++,
          })
          .select()
          .single();

        if (mealError || !insertedMeal) {
          console.error("Failed to insert meal:", mealError);
          continue;
        }

        let compSortOrder = 0;
        for (const comp of meal.components ?? []) {
          if (!validFoodIds.has(comp.food_item_id)) continue;
          const qty = Math.max(1, Number(comp.qty_g) || 100);
          await supabase.from("meal_plan_components").insert({
            meal_id: insertedMeal.id,
            food_item_id: comp.food_item_id,
            qty_g: qty,
            sort_order: compSortOrder++,
          });
        }
      }
    }

    // Persist intake_data + update updated_at + mark generation complete
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      generation_status: "complete",
    };
    if (useIntake && body.intake_data) updatePayload.intake_data = body.intake_data;
    await supabase.from("meal_plans").update(updatePayload).eq("id", planId);

    return NextResponse.json({ success: true, days_created: daysCreated });
  } catch (error) {
    console.error("Generation error:", error);
    const supabase = await createClient();
    await supabase
      .from("meal_plans")
      .update({ generation_status: "error", generation_error: String(error) })
      .eq("id", planId);
    return NextResponse.json({ error: "Generation failed", details: String(error) }, { status: 500 });
  }
}
