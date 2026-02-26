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
    const allowedFields = ["meal_type", "title", "note", "sort_order"];
    const updates: Record<string, unknown> = {};
    for (const f of allowedFields) {
      if (f in body) updates[f] = body[f];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("meal_plan_meals")
      .update(updates)
      .eq("id", mealId)
      .select()
      .single();

    // RLS on meal_plan_meals ensures meal belongs to an org the coach can access
    // via EXISTS chain: meal -> day -> plan -> org_id
    if (error) {
      console.error("Update meal error:", error);
      return NextResponse.json({ error: "Failed to update meal" }, { status: 500 });
    }

    return NextResponse.json({ meal: data });
  } catch (error) {
    console.error("Update meal error:", error);
    return NextResponse.json({ error: "Failed to update meal" }, { status: 500 });
  }
}

export async function DELETE(
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

    const { error } = await supabase
      .from("meal_plan_meals")
      .delete()
      .eq("id", mealId);

    if (error) {
      console.error("Delete meal error:", error);
      return NextResponse.json({ error: "Failed to delete meal" }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Delete meal error:", error);
    return NextResponse.json({ error: "Failed to delete meal" }, { status: 500 });
  }
}
