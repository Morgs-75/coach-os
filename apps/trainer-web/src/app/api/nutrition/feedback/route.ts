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
 * GET /api/nutrition/feedback
 *
 * Returns pending feedback items for the coach's org, with joined meal + client + plan data.
 * Two-step query: first fetch plan_ids for the org, then query feedback by plan_id.
 *
 * Query params:
 *   ?status=all  — include reviewed items (default: pending only)
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { orgId } = await getOrgAndUser(supabase);

    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const showAll = statusParam === "all";

    // Step 1: Get all plan_ids for this org (two-step approach — avoids
    // Supabase filter-on-joined-column limitations)
    const { data: plans, error: plansError } = await supabase
      .from("meal_plans")
      .select("id")
      .eq("org_id", orgId);

    if (plansError) {
      console.error("Failed to fetch plans for org:", plansError);
      return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 });
    }

    const planIds = (plans ?? []).map((p: any) => p.id);

    if (planIds.length === 0) {
      return NextResponse.json({ feedback: [] });
    }

    // Step 2: Query feedback for those plan_ids with joins
    let query = supabase
      .from("meal_plan_feedback")
      .select(`
        id,
        plan_id,
        meal_id,
        client_id,
        type,
        scope,
        comment,
        forward,
        status,
        created_at,
        ai_draft_food_item_id,
        ai_draft_qty_g,
        ai_draft_reasoning,
        plan:meal_plans!inner(
          id,
          name,
          version,
          client:clients(id, name, first_name, last_name)
        ),
        meal:meal_plan_meals(id, meal_type, title)
      `)
      .in("plan_id", planIds)
      .order("created_at", { ascending: false });

    if (!showAll) {
      query = query.eq("status", "pending");
    }

    const { data, error } = await query;

    if (error) {
      console.error("Feedback list fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 });
    }

    return NextResponse.json({ feedback: data ?? [] });
  } catch (error) {
    console.error("Feedback list error:", error);
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 });
  }
}
