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
 * POST /api/nutrition/plans/[planId]/version
 *
 * Deep-copies a meal plan (days → meals → components), increments the version
 * number, applies one optional component swap, and publishes the new plan.
 *
 * Body:
 *   component_id     string  — meal_plan_components.id to swap
 *   new_food_item_id string  — food_items.id to use as replacement
 *   new_qty_g        number  — new quantity in grams
 *   feedback_id?     string  — if provided, marks that feedback row as 'reviewed'
 *
 * Deep-copy chain:
 *   meal_plans → meal_plan_days → meal_plan_meals → meal_plan_components
 *   (sequential INSERTs — acceptable at ~84 calls max for a 7-day plan)
 *
 * On partial failure: no rollback (Supabase JS client doesn't support transactions).
 * Partial plans are acceptable; coach can delete and retry.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params;
    const supabase = await createClient();
    const { orgId, userId } = await getOrgAndUser(supabase);
    if (!orgId || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Step 1: Verify plan belongs to org
    const { data: sourcePlan } = await supabase
      .from("meal_plans")
      .select("id, org_id, client_id, name, start_date, end_date, version")
      .eq("id", planId)
      .eq("org_id", orgId)
      .single();

    if (!sourcePlan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Step 2: Parse + validate body
    const body = await request.json().catch(() => ({}));
    const { component_id, new_food_item_id, new_qty_g, feedback_id } = body;

    if (!component_id || !new_food_item_id || new_qty_g == null) {
      return NextResponse.json(
        { error: "component_id, new_food_item_id, and new_qty_g are required" },
        { status: 400 }
      );
    }

    const newQty = Math.max(1, Math.round(Number(new_qty_g) || 1));

    // Validate new_food_item_id exists in food_items
    const { data: foodCheck } = await supabase
      .from("food_items")
      .select("id")
      .eq("id", new_food_item_id)
      .single();

    if (!foodCheck) {
      return NextResponse.json(
        { error: `Food item not found: ${new_food_item_id}` },
        { status: 400 }
      );
    }

    // Step 3: Load source plan metadata (already done above)
    const sourceVersion: number = (sourcePlan as any).version ?? 1;

    // Step 4: Create new meal_plans row
    const { data: newPlan, error: planError } = await supabase
      .from("meal_plans")
      .insert({
        org_id: orgId,
        client_id: (sourcePlan as any).client_id,
        created_by: userId,
        name: (sourcePlan as any).name,
        start_date: (sourcePlan as any).start_date,
        end_date: (sourcePlan as any).end_date,
        status: "published",
        version: sourceVersion + 1,
        parent_plan_id: planId,
        published_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (planError || !newPlan) {
      console.error("Failed to create versioned plan:", planError);
      return NextResponse.json(
        { error: "Failed to create new plan version" },
        { status: 500 }
      );
    }

    const newPlanId: string = (newPlan as any).id;

    // Step 5: Load all source days ordered by day_number
    const { data: sourceDays } = await supabase
      .from("meal_plan_days")
      .select("id, day_number, date")
      .eq("plan_id", planId)
      .order("day_number", { ascending: true });

    for (const sourceDay of sourceDays ?? []) {
      // Insert new day
      const { data: newDay, error: dayError } = await supabase
        .from("meal_plan_days")
        .insert({
          plan_id: newPlanId,
          day_number: (sourceDay as any).day_number,
          date: (sourceDay as any).date ?? null,
        })
        .select()
        .single();

      if (dayError || !newDay) {
        console.error("Failed to insert day:", dayError);
        continue;
      }

      const newDayId: string = (newDay as any).id;

      // Load meals for this source day
      const { data: sourceMeals } = await supabase
        .from("meal_plan_meals")
        .select("id, meal_type, title, note, sort_order")
        .eq("day_id", (sourceDay as any).id)
        .order("sort_order", { ascending: true });

      for (const sourceMeal of sourceMeals ?? []) {
        // Insert new meal
        const { data: newMeal, error: mealError } = await supabase
          .from("meal_plan_meals")
          .insert({
            day_id: newDayId,
            meal_type: (sourceMeal as any).meal_type,
            title: (sourceMeal as any).title ?? null,
            note: (sourceMeal as any).note ?? null,
            sort_order: (sourceMeal as any).sort_order ?? 0,
          })
          .select()
          .single();

        if (mealError || !newMeal) {
          console.error("Failed to insert meal:", mealError);
          continue;
        }

        const newMealId: string = (newMeal as any).id;

        // Load components for this source meal
        const { data: sourceComponents } = await supabase
          .from("meal_plan_components")
          .select("id, food_item_id, qty_g, custom_name, sort_order")
          .eq("meal_id", (sourceMeal as any).id)
          .order("sort_order", { ascending: true });

        for (const sourceComp of sourceComponents ?? []) {
          const isSwapped = (sourceComp as any).id === component_id;

          await supabase.from("meal_plan_components").insert({
            meal_id: newMealId,
            food_item_id: isSwapped ? new_food_item_id : (sourceComp as any).food_item_id,
            qty_g: isSwapped ? newQty : (sourceComp as any).qty_g,
            custom_name: isSwapped ? null : ((sourceComp as any).custom_name ?? null),
            sort_order: (sourceComp as any).sort_order ?? 0,
          });
        }
      }
    }

    // Step 7: Mark feedback as reviewed if feedback_id provided
    if (feedback_id) {
      const { error: fbError } = await supabase
        .from("meal_plan_feedback")
        .update({ status: "reviewed" })
        .eq("id", feedback_id);

      if (fbError) {
        // Log but do not fail — the plan was created successfully
        console.error("Failed to mark feedback as reviewed:", fbError);
      }
    }

    return NextResponse.json(
      {
        plan: {
          id: newPlanId,
          version: sourceVersion + 1,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Version creation error:", error);
    return NextResponse.json(
      { error: "Version creation failed", details: String(error) },
      { status: 500 }
    );
  }
}
