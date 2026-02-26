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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ planId: string; mealId: string; componentId: string }> }
) {
  try {
    const { planId, componentId } = await params;
    const supabase = await createClient();
    const orgId = await getOrgId(supabase);
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const owned = await verifyPlanOwnership(supabase, planId, orgId);
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if ("qty_g" in body) updates.qty_g = Number(body.qty_g);
    if ("custom_name" in body) updates.custom_name = body.custom_name;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("meal_plan_components")
      .update(updates)
      .eq("id", componentId)
      .select(
        `*, food_item:food_items(id, food_name, food_group, energy_kcal, protein_g, fat_g, carb_g, fibre_g)`
      )
      .single();

    if (error) {
      console.error("Update component error:", error);
      return NextResponse.json({ error: "Failed to update component" }, { status: 500 });
    }

    return NextResponse.json({ component: data });
  } catch (error) {
    console.error("Update component error:", error);
    return NextResponse.json({ error: "Failed to update component" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ planId: string; mealId: string; componentId: string }> }
) {
  try {
    const { planId, componentId } = await params;
    const supabase = await createClient();
    const orgId = await getOrgId(supabase);
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const owned = await verifyPlanOwnership(supabase, planId, orgId);
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { error } = await supabase
      .from("meal_plan_components")
      .delete()
      .eq("id", componentId);

    if (error) {
      console.error("Delete component error:", error);
      return NextResponse.json({ error: "Failed to delete component" }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Delete component error:", error);
    return NextResponse.json({ error: "Failed to delete component" }, { status: 500 });
  }
}
