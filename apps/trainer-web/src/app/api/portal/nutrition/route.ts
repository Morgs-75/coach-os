import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/portal/nutrition?token=<uuid>
 *
 * Returns the client's most recent published meal plan with nested
 * days / meals / components / food_item, or { plan: null } when none exists.
 *
 * Uses service-role client to bypass RLS — same pattern as all portal routes.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Resolve client from portal token
    const { data: client } = await supabase
      .from("clients")
      .select("id, full_name, org_id")
      .eq("portal_token", token)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Invalid link" }, { status: 401 });
    }

    // Find the most recent published plan for this client
    const { data: latestPlan } = await supabase
      .from("meal_plans")
      .select("id")
      .eq("client_id", client.id)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(1)
      .single();

    if (!latestPlan) {
      // No published plan — return null gracefully (not an error)
      return NextResponse.json({
        plan: null,
        clientName: client.full_name,
      });
    }

    // Load full plan with nested structure
    const { data: plan, error } = await supabase
      .from("meal_plans")
      .select(`
        id, name, start_date, end_date, published_at, version,
        days:meal_plan_days(
          id, day_number, date,
          meals:meal_plan_meals(
            id, meal_type, title, note, sort_order,
            components:meal_plan_components(
              id, qty_g, custom_name, sort_order,
              food_item:food_items(id, food_name, energy_kcal, protein_g, fat_g, carb_g, fibre_g)
            )
          )
        )
      `)
      .eq("id", latestPlan.id)
      .single();

    if (error || !plan) {
      console.error("Portal nutrition plan fetch error:", error);
      return NextResponse.json({ error: "Failed to load plan" }, { status: 500 });
    }

    // Sort days by day_number, meals by sort_order, components by sort_order
    if (plan.days) {
      (plan.days as any[]).sort((a, b) => a.day_number - b.day_number);
      for (const day of plan.days as any[]) {
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

    return NextResponse.json({
      plan,
      clientName: client.full_name,
    });
  } catch (error) {
    console.error("Portal nutrition error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
