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

  return {
    orgId: membership?.org_id ?? null,
    userId: user.id,
  };
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { orgId } = await getOrgAndUser(supabase);

    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const clientId = url.searchParams.get("client_id");

    let query = supabase
      .from("meal_plans")
      .select(`*, client:clients(id, full_name)`)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Meal plans fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch plans" }, { status: 500 });
    }

    return NextResponse.json({ plans: data ?? [] });
  } catch (error) {
    console.error("Meal plans fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch plans" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { orgId, userId } = await getOrgAndUser(supabase);

    if (!orgId || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { client_id, name, start_date, end_date } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Plan name is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("meal_plans")
      .insert({
        org_id: orgId,
        client_id: client_id || null,
        created_by: userId,
        name: name.trim(),
        start_date: start_date || null,
        end_date: end_date || null,
        status: "draft",
        version: 1,
      })
      .select()
      .single();

    if (error) {
      console.error("Meal plan create error:", error);
      return NextResponse.json({ error: "Failed to create plan" }, { status: 500 });
    }

    return NextResponse.json({ plan: data }, { status: 201 });
  } catch (error) {
    console.error("Meal plan create error:", error);
    return NextResponse.json({ error: "Failed to create plan" }, { status: 500 });
  }
}
