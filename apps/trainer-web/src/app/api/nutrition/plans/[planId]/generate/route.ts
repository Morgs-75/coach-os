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
- Daily calorie target: ${targetKcal} kcal
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

INSTRUCTIONS:
- Create exactly ${numDays} day(s) (day_number 1 through ${numDays}).
- Each day must have ${mealsPerDay} meals. Use only these meal_type values: breakfast, morning_snack, lunch, afternoon_snack, dinner, evening_snack, other.
- Each meal should have 2–4 food components.
- Use ONLY the short food IDs from the list above (e.g. F1, F12, F47) — do NOT invent IDs.
- Set qty_g to realistic serving sizes (oats: 80g, chicken breast: 150g, milk: 200g, etc.).
- Aim for each day's total calories to be within 10% of ${targetKcal} kcal.
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
  return `You are a sports nutrition expert. Generate a 1-day meal plan for a personal training client.

CLIENT GOAL: ${goal}
DAILY CALORIE TARGET: ${calorieTarget} kcal
MACRO SPLIT: Protein ${macroPct.protein_pct}% / Carbs ${macroPct.carb_pct}% / Fat ${macroPct.fat_pct}%
DIETARY RESTRICTIONS: ${restrictions}

AVAILABLE FOODS (id | name | group | kcal/100g | protein_g | carb_g | fat_g):
${foodList}

INSTRUCTIONS:
- Create exactly 1 day (day_number 1).
- Each day must have 3–5 meals using these meal_type values only: breakfast, morning_snack, lunch, afternoon_snack, dinner, evening_snack, other.
- Each meal should have 2–4 food components.
- Use ONLY the short food IDs from the list above (e.g. F1, F12, F47) — do NOT invent IDs.
- Set qty_g to a realistic serving size (e.g. oats: 80g, chicken breast: 150g, milk: 200g).
- Aim for each day's total calories to be within 10% of the calorie target.
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

    // Fetch a curated food sample biased toward common PT meal-plan ingredients.
    // Two-pass: priority keywords first, then fill with general variety.
    const PRIORITY_KEYWORDS = [
      "chicken","salmon","tuna","beef","pork","turkey","lamb","egg",
      "milk","yoghurt","yogurt","cheese","ricotta","cottage",
      "oat","rice","pasta","bread","potato","sweet potato","quinoa",
      "broccoli","spinach","capsicum","carrot","zucchini","tomato",
      "lettuce","salad","cucumber","onion","mushroom","asparagus",
      "apple","banana","berry","berries","orange","mango","grape",
      "almond","peanut","avocado","olive oil","nut","seed",
      "tofu","lentil","bean","chickpea","protein powder",
    ];
    const orFilter = PRIORITY_KEYWORDS.map((k) => `food_name.ilike.%${k}%`).join(",");

    const [{ data: priorityFoods }, { data: generalFoods }] = await Promise.all([
      supabase
        .from("food_items")
        .select("id, food_name, food_group, energy_kcal, protein_g, carb_g, fat_g")
        .not("energy_kcal", "is", null)
        .or(orFilter)
        .order("food_name", { ascending: true })
        .limit(150),
      supabase
        .from("food_items")
        .select("id, food_name, food_group, energy_kcal, protein_g, carb_g, fat_g")
        .not("energy_kcal", "is", null)
        .order("food_group", { ascending: true })
        .order("food_name", { ascending: true })
        .limit(60),
    ]);

    // Merge: priority foods first, then general foods not already included
    const priorityIds = new Set((priorityFoods ?? []).map((f) => f.id));
    const foodSample = [
      ...(priorityFoods ?? []),
      ...(generalFoods ?? []).filter((f) => !priorityIds.has(f.id)),
    ];

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

    // Always use Haiku — Sonnet exceeds Netlify's 26s function timeout
    const model = "claude-haiku-4-5-20251001";
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
