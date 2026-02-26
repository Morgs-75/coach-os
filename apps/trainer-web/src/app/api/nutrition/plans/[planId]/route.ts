import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getOrgAndUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { orgId: null, userId: null };
  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  return { orgId: membership?.org_id ?? null, userId: user.id };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params;
    const supabase = await createClient();
    const { orgId } = await getOrgAndUser(supabase);
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Load plan with nested days > meals > components > food_item
    const { data: plan, error } = await supabase
      .from("meal_plans")
      .select(`
        *,
        client:clients(id, name, first_name, last_name),
        days:meal_plan_days(
          *,
          meals:meal_plan_meals(
            *,
            components:meal_plan_components(
              *,
              food_item:food_items(id, food_name, food_group, energy_kcal, protein_g, fat_g, carb_g, fibre_g)
            )
          )
        )
      `)
      .eq("id", planId)
      .eq("org_id", orgId)
      .single();

    if (error || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Sort days by day_number, meals by sort_order, components by sort_order
    if (plan.days) {
      plan.days.sort((a: any, b: any) => a.day_number - b.day_number);
      for (const day of plan.days) {
        if (day.meals) {
          day.meals.sort((a: any, b: any) => a.sort_order - b.sort_order);
          for (const meal of day.meals) {
            if (meal.components) {
              meal.components.sort((a: any, b: any) => a.sort_order - b.sort_order);
            }
          }
        }
      }
    }

    return NextResponse.json({ plan });
  } catch (error) {
    console.error("Plan fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch plan" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params;
    const supabase = await createClient();
    const { orgId } = await getOrgAndUser(supabase);
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const allowedFields = ["name", "start_date", "end_date", "client_id", "status", "published_at"];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const field of allowedFields) {
      if (field in body) updates[field] = body[field];
    }

    const { data, error } = await supabase
      .from("meal_plans")
      .update(updates)
      .eq("id", planId)
      .eq("org_id", orgId)
      .select()
      .single();

    if (error) {
      console.error("Plan update error:", error);
      return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
    }

    return NextResponse.json({ plan: data });
  } catch (error) {
    console.error("Plan update error:", error);
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
  }
}
