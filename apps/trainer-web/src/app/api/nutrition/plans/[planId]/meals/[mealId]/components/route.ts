import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getOrgId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  return membership?.org_id ?? null;
}

async function verifyPlanOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  planId: string,
  orgId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("id", planId)
    .eq("org_id", orgId)
    .single();
  return !!data;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ planId: string; mealId: string }> }
) {
  try {
    const { planId, mealId } = await params;
    const supabase = await createClient();
    const orgId = await getOrgId(supabase);
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const owned = await verifyPlanOwnership(supabase, planId, orgId);
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const { food_item_id = null, qty_g = 100, custom_name = null } = body;

    // Determine sort_order (max existing + 1)
    const { data: existing } = await supabase
      .from("meal_plan_components")
      .select("sort_order")
      .eq("meal_id", mealId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const sort_order =
      existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

    const { data, error } = await supabase
      .from("meal_plan_components")
      .insert({ meal_id: mealId, food_item_id, qty_g, custom_name, sort_order })
      .select(
        `*, food_item:food_items(id, food_name, food_group, energy_kcal, protein_g, fat_g, carb_g, fibre_g)`
      )
      .single();

    if (error) {
      console.error("Add component error:", error);
      return NextResponse.json({ error: "Failed to add component" }, { status: 500 });
    }

    return NextResponse.json({ component: data }, { status: 201 });
  } catch (error) {
    console.error("Add component error:", error);
    return NextResponse.json({ error: "Failed to add component" }, { status: 500 });
  }
}
