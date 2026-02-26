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

export async function GET(
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

    const { data, error } = await supabase
      .from("meal_plan_days")
      .select("*")
      .eq("plan_id", planId)
      .order("day_number", { ascending: true });

    if (error) return NextResponse.json({ error: "Failed to fetch days" }, { status: 500 });
    return NextResponse.json({ days: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch days" }, { status: 500 });
  }
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

    // Determine next day_number
    const { data: existingDays } = await supabase
      .from("meal_plan_days")
      .select("day_number")
      .eq("plan_id", planId)
      .order("day_number", { ascending: false })
      .limit(1);

    const nextDayNumber =
      existingDays && existingDays.length > 0
        ? existingDays[0].day_number + 1
        : 1;

    const body = await request.json().catch(() => ({}));
    const date = body.date ?? null;

    const { data, error } = await supabase
      .from("meal_plan_days")
      .insert({ plan_id: planId, day_number: nextDayNumber, date })
      .select()
      .single();

    if (error) {
      console.error("Add day error:", error);
      return NextResponse.json({ error: "Failed to add day" }, { status: 500 });
    }

    return NextResponse.json({ day: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to add day" }, { status: 500 });
  }
}
