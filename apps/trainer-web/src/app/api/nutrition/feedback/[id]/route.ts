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
 * GET /api/nutrition/feedback/[id]
 *
 * Returns a feedback row with joined meal and component data for the
 * coach review UI. The ai_draft_food_item data is fetched separately
 * (two queries) because Supabase cannot join a non-standard FK field
 * like ai_draft_food_item_id using the named-relation syntax.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { orgId } = await getOrgAndUser(supabase);
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Load the feedback row with meal + component joins
    const { data: feedback, error } = await supabase
      .from("meal_plan_feedback")
      .select(`
        *,
        meal:meal_plan_meals(
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
        )
      `)
      .eq("id", id)
      .single();

    if (error || !feedback) {
      return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
    }

    // Verify feedback belongs to coach's org via plan ownership
    const { data: plan } = await supabase
      .from("meal_plans")
      .select("id")
      .eq("id", (feedback as any).plan_id)
      .eq("org_id", orgId)
      .single();

    if (!plan) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch draft food item separately (non-standard FK field)
    let draftFoodItem: {
      id: string;
      food_name: string;
      food_group: string | null;
      energy_kcal: number | null;
      protein_g: number | null;
      fat_g: number | null;
      carb_g: number | null;
    } | null = null;

    const draftFoodItemId = (feedback as any).ai_draft_food_item_id;
    if (draftFoodItemId) {
      const { data: fi } = await supabase
        .from("food_items")
        .select("id, food_name, food_group, energy_kcal, protein_g, fat_g, carb_g")
        .eq("id", draftFoodItemId)
        .single();
      draftFoodItem = fi ?? null;
    }

    return NextResponse.json({
      feedback: {
        ...(feedback as any),
        draft_food_item: draftFoodItem,
      },
    });
  } catch (error) {
    console.error("Feedback fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 });
  }
}

/**
 * PATCH /api/nutrition/feedback/[id]
 *
 * Updates the status of a feedback row (e.g. mark as 'reviewed').
 * Body: { status: 'reviewed' | 'pending' }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { orgId } = await getOrgAndUser(supabase);
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { status } = body;

    if (!status || !["pending", "reviewed"].includes(status)) {
      return NextResponse.json(
        { error: "status must be 'pending' or 'reviewed'" },
        { status: 400 }
      );
    }

    // Fetch feedback to check plan ownership
    const { data: feedback } = await supabase
      .from("meal_plan_feedback")
      .select("id, plan_id")
      .eq("id", id)
      .single();

    if (!feedback) {
      return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
    }

    const { data: plan } = await supabase
      .from("meal_plans")
      .select("id")
      .eq("id", (feedback as any).plan_id)
      .eq("org_id", orgId)
      .single();

    if (!plan) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: updated, error } = await supabase
      .from("meal_plan_feedback")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Feedback update error:", error);
      return NextResponse.json({ error: "Failed to update feedback" }, { status: 500 });
    }

    return NextResponse.json({ feedback: updated });
  } catch (error) {
    console.error("Feedback patch error:", error);
    return NextResponse.json({ error: "Failed to update feedback" }, { status: 500 });
  }
}
