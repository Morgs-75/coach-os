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
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params;
    const supabase = await createClient();
    const orgId = await getOrgId(supabase);
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const owned = await verifyPlanOwnership(supabase, planId, orgId);
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const { day_id, meal_type, title = null, note = null } = body;

    if (!day_id || !meal_type) {
      return NextResponse.json(
        { error: "day_id and meal_type are required" },
        { status: 400 }
      );
    }

    // Verify day belongs to this plan
    const { data: dayCheck } = await supabase
      .from("meal_plan_days")
      .select("id")
      .eq("id", day_id)
      .eq("plan_id", planId)
      .single();

    if (!dayCheck) {
      return NextResponse.json({ error: "Day not found" }, { status: 404 });
    }

    // Determine sort_order (max existing + 1)
    const { data: existing } = await supabase
      .from("meal_plan_meals")
      .select("sort_order")
      .eq("day_id", day_id)
      .order("sort_order", { ascending: false })
      .limit(1);

    const sort_order =
      existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

    const { data, error } = await supabase
      .from("meal_plan_meals")
      .insert({ day_id, meal_type, title, note, sort_order })
      .select()
      .single();

    if (error) {
      console.error("Add meal error:", error);
      return NextResponse.json({ error: "Failed to add meal" }, { status: 500 });
    }

    return NextResponse.json({ meal: data }, { status: 201 });
  } catch (error) {
    console.error("Add meal error:", error);
    return NextResponse.json({ error: "Failed to add meal" }, { status: 500 });
  }
}
