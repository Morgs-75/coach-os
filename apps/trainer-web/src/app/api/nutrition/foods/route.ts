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

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId(supabase);

    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() ?? "";

    if (!q || q.length < 2) {
      return NextResponse.json({ foods: [] });
    }

    const { data, error } = await supabase
      .from("food_items")
      .select(
        "id, food_name, food_group, energy_kcal, protein_g, fat_g, carb_g, fibre_g"
      )
      .ilike("food_name", `%${q}%`)
      .order("food_name", { ascending: true })
      .limit(20);

    if (error) {
      console.error("Food search error:", error);
      return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }

    return NextResponse.json({ foods: data ?? [] });
  } catch (error) {
    console.error("Food search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
