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

/**
 * POST /api/nutrition/feedback/[id]/draft
 *
 * Calls Claude to generate a food swap suggestion for a specific feedback row.
 * Writes ai_draft_food_item_id, ai_draft_qty_g, ai_draft_reasoning back to the
 * meal_plan_feedback row.
 *
 * Steps:
 * 1. Load feedback row + verify org ownership via meal_plans
 * 2. Require meal_id (can only swap for meal-level feedback)
 * 3. Load meal components with food_item join
 * 4. Build a targeted Claude prompt describing the component to swap
 * 5. Call Claude (claude-sonnet-4-6, max_tokens: 512)
 * 6. Parse JSON response: { food_name, qty_g, reasoning }
 * 7. Look up food_items by ILIKE match on the suggested food_name
 * 8. UPDATE meal_plan_feedback with ai_draft_* values
 * 9. Return { draft: { food_item_id, food_item_name, qty_g, reasoning, component_id } }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { orgId } = await getOrgAndUser(supabase);
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return NextResponse.json(
        { error: "AI not configured — ANTHROPIC_API_KEY is missing" },
        { status: 500 }
      );
    }

    // Step 1: Load feedback row
    const { data: feedback, error: fbError } = await supabase
      .from("meal_plan_feedback")
      .select("id, plan_id, meal_id, type, scope, comment")
      .eq("id", id)
      .single();

    if (fbError || !feedback) {
      return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
    }

    // Verify feedback belongs to coach's org
    const { data: plan } = await supabase
      .from("meal_plans")
      .select("id")
      .eq("id", (feedback as any).plan_id)
      .eq("org_id", orgId)
      .single();

    if (!plan) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Step 2: Require meal_id
    const mealId = (feedback as any).meal_id;
    if (!mealId) {
      return NextResponse.json(
        { error: "Can only generate a draft swap for meal-level feedback (meal_id is required)" },
        { status: 400 }
      );
    }

    // Step 3: Load meal with its components and food items
    const { data: meal, error: mealError } = await supabase
      .from("meal_plan_meals")
      .select(`
        id,
        meal_type,
        title,
        components:meal_plan_components(
          id,
          qty_g,
          custom_name,
          sort_order,
          food_item:food_items(id, food_name, food_group, energy_kcal, protein_g, fat_g, carb_g)
        )
      `)
      .eq("id", mealId)
      .single();

    if (mealError || !meal) {
      return NextResponse.json({ error: "Meal not found" }, { status: 404 });
    }

    const components: any[] = (meal as any).components ?? [];
    if (components.length === 0) {
      return NextResponse.json(
        { error: "Meal has no components to swap" },
        { status: 400 }
      );
    }

    // Step 4: Select the component to swap (sort_order 0 or the only component)
    const sortedComponents = [...components].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
    const targetComponent = sortedComponents[0];
    const componentId: string = targetComponent.id;
    const foodItem: any = targetComponent.food_item ?? null;

    if (!foodItem) {
      return NextResponse.json(
        { error: "Component has no food item to swap" },
        { status: 400 }
      );
    }

    const mealTitle = (meal as any).title
      ? `${(meal as any).meal_type} — ${(meal as any).title}`
      : (meal as any).meal_type;

    const kcal = foodItem.energy_kcal ?? "?";
    const protein = foodItem.protein_g ?? "?";
    const fat = foodItem.fat_g ?? "?";
    const carb = foodItem.carb_g ?? "?";

    // Step 5: Build Claude prompt
    const prompt = `You are a sports dietitian. A personal training client left this feedback on their meal plan:
Feedback type: ${(feedback as any).type}
Comment: "${(feedback as any).comment ?? "No comment provided"}"
Scope: ${(feedback as any).scope}

Current meal: ${mealTitle}
Component to substitute: ${foodItem.food_name}, ${targetComponent.qty_g}g (provides per serving: ${kcal}kcal, ${protein}g protein, ${fat}g fat, ${carb}g carbs)

Suggest ONE replacement food from Australian foods that:
- Addresses the client feedback
- Provides similar macros (within 15% of protein, fat, carbs per adjusted qty)
- Is a realistic, commonly available food
- Adjust the qty_g so the macros closely match the original

Respond with ONLY valid JSON, no commentary:
{
  "food_name": "...",
  "qty_g": 120,
  "reasoning": "one sentence explanation"
}`;

    // Step 6: Call Claude
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 512,
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

    // Step 7: Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON in Claude response:", responseText.slice(0, 200));
      return NextResponse.json({ error: "AI returned invalid response" }, { status: 500 });
    }

    let draft: { food_name: string; qty_g: number; reasoning: string };
    try {
      draft = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("Failed to parse Claude JSON:", jsonMatch[0].slice(0, 200));
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    if (!draft.food_name || !draft.qty_g || !draft.reasoning) {
      return NextResponse.json(
        { error: "AI response missing required fields (food_name, qty_g, reasoning)" },
        { status: 500 }
      );
    }

    // Step 8: Look up food_items by ILIKE match on suggested food_name
    let matchedFoodItem: { id: string; food_name: string } | null = null;

    const { data: exactMatches } = await supabase
      .from("food_items")
      .select("id, food_name")
      .ilike("food_name", `%${draft.food_name}%`)
      .limit(1);

    if (exactMatches && exactMatches.length > 0) {
      matchedFoodItem = exactMatches[0];
    } else {
      // Broader search: try first word of food_name
      const firstWord = draft.food_name.split(/[\s,]+/)[0];
      if (firstWord && firstWord.length >= 3) {
        const { data: broadMatches } = await supabase
          .from("food_items")
          .select("id, food_name")
          .ilike("food_name", `%${firstWord}%`)
          .limit(1);
        if (broadMatches && broadMatches.length > 0) {
          matchedFoodItem = broadMatches[0];
        }
      }
    }

    if (!matchedFoodItem) {
      return NextResponse.json(
        {
          error: `Could not find a matching food item for "${draft.food_name}" in the database. Claude's suggestion may not be in the AFCD dataset.`,
        },
        { status: 422 }
      );
    }

    const draftQty = Math.max(1, Math.round(Number(draft.qty_g) || 100));

    // Step 9: UPDATE meal_plan_feedback with ai_draft_* values
    const { error: updateError } = await supabase
      .from("meal_plan_feedback")
      .update({
        ai_draft_food_item_id: matchedFoodItem.id,
        ai_draft_qty_g: draftQty,
        ai_draft_reasoning: draft.reasoning,
      })
      .eq("id", id);

    if (updateError) {
      console.error("Feedback ai_draft update error:", updateError);
      return NextResponse.json(
        { error: "Failed to save AI draft to feedback" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        draft: {
          food_item_id: matchedFoodItem.id,
          food_item_name: matchedFoodItem.food_name,
          qty_g: draftQty,
          reasoning: draft.reasoning,
          component_id: componentId,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Draft generation error:", error);
    return NextResponse.json(
      { error: "Draft generation failed", details: String(error) },
      { status: 500 }
    );
  }
}
