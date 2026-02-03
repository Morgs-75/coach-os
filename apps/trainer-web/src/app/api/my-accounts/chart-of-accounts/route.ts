import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getOrgId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
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

    // Get system accounts and org-specific accounts
    const { data: accounts, error } = await supabase
      .from("chart_of_accounts")
      .select("*")
      .or(`org_id.eq.${orgId},org_id.is.null`)
      .eq("is_active", true)
      .order("display_order");

    if (error) {
      console.error("Chart of accounts fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
    }

    return NextResponse.json({
      accounts: accounts || [],
    });
  } catch (error) {
    console.error("Chart of accounts fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId(supabase);

    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { code, name, category, tax_treatment } = body;

    if (!code || !name || !category) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if code already exists
    const { data: existing } = await supabase
      .from("chart_of_accounts")
      .select("id")
      .eq("org_id", orgId)
      .eq("code", code)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Account code already exists" }, { status: 400 });
    }

    // Get max display_order for the category
    const { data: maxOrder } = await supabase
      .from("chart_of_accounts")
      .select("display_order")
      .or(`org_id.eq.${orgId},org_id.is.null`)
      .eq("category", category)
      .order("display_order", { ascending: false })
      .limit(1)
      .single();

    const displayOrder = (maxOrder?.display_order || 0) + 10;

    const { data: newAccount, error } = await supabase
      .from("chart_of_accounts")
      .insert({
        org_id: orgId,
        code,
        name,
        category,
        tax_treatment: tax_treatment || "gst",
        is_system: false,
        is_active: true,
        display_order: displayOrder,
      })
      .select()
      .single();

    if (error) {
      console.error("Account creation error:", error);
      return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
    }

    return NextResponse.json({ account: newAccount });
  } catch (error) {
    console.error("Account creation error:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
