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

function buildRichPrompt(intake: IntakeData, numDays: number, foodList: string): string {
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

CALORIE CALCULATION GUIDE — use the kcal/100g values to size portions correctly:
- Example: food with 165 kcal/100g and target 500 kcal → qty_g = round(500/165*100) = 303g
- Chicken breast (lean, grilled) ≈ 165 kcal/100g → 150g serving ≈ 248 kcal
- Oats (rolled, uncooked) ≈ 380 kcal/100g → 80g serving ≈ 304 kcal
- White rice (cooked) ≈ 130 kcal/100g → 200g serving ≈ 260 kcal
- Scale portions up or down to hit each meal's calorie target

INSTRUCTIONS:
- Create exactly ${numDays} day(s) (day_number 1 through ${numDays}).
- Each day must have exactly ${mealsPerDay} meals. Use only these meal_type values: breakfast, morning_snack, lunch, afternoon_snack, dinner, evening_snack, other.
- Each meal MUST deliver approximately ${kcalPerMeal} kcal — use the kcal/100g data to calculate qty_g precisely.
- Each meal should have 2–4 food components.
- Use ONLY the short food IDs from the list above (e.g. F1, F12, F47) — do NOT invent IDs.
- The day total MUST be within 5% of ${targetKcal} kcal. This is a hard requirement.
- Strictly avoid all allergens: ${allergies}.
- Strictly avoid: ${dislikes}.
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
  try {
    const { planId } = await params;
    const supabase = await createClient();
    const { orgId } = await getOrgAndUser(supabase);
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verify plan belongs to org
    const { data: plan } = await supabase
      .from("meal_plans")
      .select("id, name, client_id")
      .eq("id", planId)
      .eq("org_id", orgId)
      .single();
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
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

    const foodSample = groupResults.flatMap((r, i) => {
      const rows = r.data ?? [];
      const label = TARGET_GROUPS[i].label;
      // Stamp group label so the AI prompt shows a meaningful group column
      return rows.map((f) => ({ ...f, food_group: f.food_group ?? label }));
    });

    // Use short IDs (F1, F2…) in the prompt so the AI never has to copy a UUID.
    // Build a map to translate back after parsing.
    const shortIdToRealId = new Map<string, string>();
    const foodList = (foodSample ?? [])
      .map((f, i) => {
        const shortId = `F${i + 1}`;
        shortIdToRealId.set(shortId, f.id);
        return `${shortId} | ${f.food_name} | ${f.food_group ?? "General"} | kcal/100g: ${f.energy_kcal ?? "?"} | P: ${f.protein_g ?? "?"} | C: ${f.carb_g ?? "?"} | F: ${f.fat_g ?? "?"}`;
      })
      .join("\n");

    // Build prompt
    let prompt: string;
    if (useIntake && body.intake_data) {
      prompt = buildRichPrompt(body.intake_data, numDays, foodList);
    } else {
      const goal = body.goal?.trim() || "general health and balanced nutrition";
      const calorieTarget = body.calorie_target ?? 2000;
      const macroPct = body.macro_split ?? { protein_pct: 30, carb_pct: 45, fat_pct: 25 };
      const restrictions = body.dietary_restrictions?.trim() || "none";
      prompt = buildSimplePrompt(goal, calorieTarget, macroPct, restrictions, foodList);
    }

    const model = "claude-sonnet-4-6";
    // More tokens for longer plans
    const maxTokens = numDays <= 1 ? 2048 : numDays <= 5 ? 4096 : 8192;

    // Call Claude
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Anthropic API error:", errText);
      return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
    }

    const aiData = await aiResponse.json();
    const responseText: string = aiData.content?.[0]?.text ?? "";

    // Extract JSON from response (strip any accidental markdown fences)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON in Claude response:", responseText.slice(0, 500));
      return NextResponse.json({ error: "AI returned invalid response" }, { status: 500 });
    }

    let generated: { days: Array<{ day_number: number; meals: Array<{ meal_type: string; title?: string; components: Array<{ food_item_id: string; qty_g: number }> }> }> };
    try {
      generated = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response as JSON" }, { status: 500 });
    }

    if (!generated.days || !Array.isArray(generated.days)) {
      return NextResponse.json({ error: "AI response missing days array" }, { status: 500 });
    }

    // Translate short IDs (F1, F2…) back to real UUIDs in-place
    for (const day of generated.days) {
      for (const meal of day.meals ?? []) {
        for (const comp of meal.components ?? []) {
          if (comp.food_item_id) {
            const realId = shortIdToRealId.get(comp.food_item_id);
            if (realId) comp.food_item_id = realId;
          }
        }
      }
    }

    // Collect all resolved food_item_ids — all are already validated via the map
    const validFoodIds = new Set<string>(shortIdToRealId.values());

    // Clear existing days (CASCADE removes meals + components)
    await supabase.from("meal_plan_days").delete().eq("plan_id", planId);

    // Insert days → meals → components
    let daysCreated = 0;
    for (const day of generated.days) {
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

    // Persist intake_data + update updated_at
    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (useIntake && body.intake_data) updatePayload.intake_data = body.intake_data;
    await supabase.from("meal_plans").update(updatePayload).eq("id", planId);

    return NextResponse.json({ success: true, days_created: daysCreated });
  } catch (error) {
    console.error("Generation error:", error);
    return NextResponse.json({ error: "Generation failed", details: String(error) }, { status: 500 });
  }
}
