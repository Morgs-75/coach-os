import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

interface GenerateBody {
  goal?: string;
  calorie_target?: number;
  macro_split?: { protein_pct: number; carb_pct: number; fat_pct: number };
  dietary_restrictions?: string;
}

const VALID_MEAL_TYPES = new Set([
  "breakfast", "morning_snack", "lunch", "afternoon_snack",
  "dinner", "evening_snack", "other",
]);

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
    const goal = body.goal?.trim() || "general health and balanced nutrition";
    const calorieTarget = body.calorie_target ?? 2000;
    const macroPct = body.macro_split ?? { protein_pct: 30, carb_pct: 45, fat_pct: 25 };
    const restrictions = body.dietary_restrictions?.trim() || "none";

    // Fetch a diverse sample of food_items for the prompt
    // Get up to 250 foods ordered by food_group then food_name for variety
    const { data: foodSample } = await supabase
      .from("food_items")
      .select("id, food_name, food_group, energy_kcal, protein_g, carb_g, fat_g")
      .order("food_group", { ascending: true })
      .order("food_name", { ascending: true })
      .limit(250);

    const foodList = (foodSample ?? [])
      .map((f) => `${f.id} | ${f.food_name} | ${f.food_group ?? "General"} | kcal/100g: ${f.energy_kcal ?? "?"} | P: ${f.protein_g ?? "?"} | C: ${f.carb_g ?? "?"} | F: ${f.fat_g ?? "?"}`)
      .join("\n");

    const prompt = `You are a sports nutrition expert. Generate a 7-day meal plan for a personal training client.

CLIENT GOAL: ${goal}
DAILY CALORIE TARGET: ${calorieTarget} kcal
MACRO SPLIT: Protein ${macroPct.protein_pct}% / Carbs ${macroPct.carb_pct}% / Fat ${macroPct.fat_pct}%
DIETARY RESTRICTIONS: ${restrictions}

AVAILABLE FOODS (id | name | group | kcal/100g | protein_g | carb_g | fat_g):
${foodList}

INSTRUCTIONS:
- Create exactly 7 days (day_number 1 through 7).
- Each day must have 3–5 meals using these meal_type values only: breakfast, morning_snack, lunch, afternoon_snack, dinner, evening_snack, other.
- Each meal should have 2–5 food components.
- Use ONLY food_item_ids from the list above — do NOT invent UUIDs.
- Set qty_g to a realistic serving size (e.g. oats: 80g, chicken breast: 150g, milk: 200g).
- Aim for each day's total calories to be within 10% of the calorie target.
- Vary foods across days — do not repeat the same meal every day.
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
            { "food_item_id": "<uuid from list>", "qty_g": 80 }
          ]
        }
      ]
    }
  ]
}`;

    // Call Claude
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
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

    // Collect all food_item_ids Claude used and validate them
    const allFoodIds = new Set<string>();
    for (const day of generated.days) {
      for (const meal of day.meals ?? []) {
        for (const comp of meal.components ?? []) {
          if (comp.food_item_id) allFoodIds.add(comp.food_item_id);
        }
      }
    }

    const validFoodIds = new Set<string>();
    if (allFoodIds.size > 0) {
      const { data: validFoods } = await supabase
        .from("food_items")
        .select("id")
        .in("id", Array.from(allFoodIds));
      (validFoods ?? []).forEach((f) => validFoodIds.add(f.id));
    }

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
          // Skip components with invalid food IDs
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

    // Update plan updated_at
    await supabase
      .from("meal_plans")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", planId);

    return NextResponse.json({ success: true, days_created: daysCreated });
  } catch (error) {
    console.error("Generation error:", error);
    return NextResponse.json({ error: "Generation failed", details: String(error) }, { status: 500 });
  }
}
