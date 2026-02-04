import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Mock chart of accounts for UI testing
const MOCK_ACCOUNTS = [
  // Income
  { id: "acc-001", code: "INC-001", name: "Client Training Income", category: "income", tax_treatment: "gst", is_system: true, is_active: true, display_order: 100 },
  { id: "acc-002", code: "INC-002", name: "PT Sessions", category: "income", tax_treatment: "gst", is_system: true, is_active: true, display_order: 110 },
  { id: "acc-003", code: "INC-003", name: "Group Classes", category: "income", tax_treatment: "gst", is_system: true, is_active: true, display_order: 120 },
  { id: "acc-004", code: "INC-004", name: "Online Coaching", category: "income", tax_treatment: "gst", is_system: true, is_active: true, display_order: 130 },
  { id: "acc-005", code: "INC-005", name: "Nutrition Plans", category: "income", tax_treatment: "gst", is_system: true, is_active: true, display_order: 140 },
  { id: "acc-006", code: "INC-006", name: "Merchandise Sales", category: "income", tax_treatment: "gst", is_system: true, is_active: true, display_order: 150 },
  { id: "acc-007", code: "INC-007", name: "Supplement Sales", category: "income", tax_treatment: "gst", is_system: true, is_active: true, display_order: 160 },
  { id: "acc-008", code: "INC-008", name: "Other Income", category: "income", tax_treatment: "gst", is_system: true, is_active: true, display_order: 170 },
  // Expenses
  { id: "acc-101", code: "EXP-001", name: "Equipment & Supplies", category: "expense", tax_treatment: "gst", is_system: true, is_active: true, display_order: 200 },
  { id: "acc-102", code: "EXP-002", name: "Gym Rent / Facility Fees", category: "expense", tax_treatment: "gst", is_system: true, is_active: true, display_order: 210 },
  { id: "acc-103", code: "EXP-003", name: "Insurance", category: "expense", tax_treatment: "gst_free", is_system: true, is_active: true, display_order: 220 },
  { id: "acc-104", code: "EXP-004", name: "Marketing & Social Media Ads", category: "expense", tax_treatment: "gst", is_system: true, is_active: true, display_order: 230 },
  { id: "acc-105", code: "EXP-005", name: "Professional Development", category: "expense", tax_treatment: "gst", is_system: true, is_active: true, display_order: 240 },
  { id: "acc-106", code: "EXP-006", name: "Software Subscriptions", category: "expense", tax_treatment: "gst", is_system: true, is_active: true, display_order: 250 },
  { id: "acc-107", code: "EXP-007", name: "Bank Fees", category: "expense", tax_treatment: "gst_free", is_system: true, is_active: true, display_order: 260 },
  { id: "acc-113", code: "EXP-013", name: "Payment Processing Fees", category: "expense", tax_treatment: "gst_free", is_system: true, is_active: true, display_order: 265 },
  { id: "acc-108", code: "EXP-008", name: "Motor Vehicle Expenses", category: "expense", tax_treatment: "gst", is_system: true, is_active: true, display_order: 270 },
  { id: "acc-109", code: "EXP-009", name: "Phone & Internet", category: "expense", tax_treatment: "gst", is_system: true, is_active: true, display_order: 280 },
  { id: "acc-110", code: "EXP-010", name: "Cost of Goods Sold", category: "expense", tax_treatment: "gst", is_system: true, is_active: true, display_order: 290 },
  { id: "acc-111", code: "EXP-011", name: "Accounting & Legal", category: "expense", tax_treatment: "gst", is_system: true, is_active: true, display_order: 300 },
  { id: "acc-112", code: "EXP-012", name: "Other Expenses", category: "expense", tax_treatment: "gst", is_system: true, is_active: true, display_order: 310 },
  // Other
  { id: "acc-201", code: "OTH-001", name: "Owner Drawings", category: "other", tax_treatment: "bas_excluded", is_system: true, is_active: true, display_order: 400 },
  { id: "acc-202", code: "OTH-002", name: "Bank Transfers", category: "other", tax_treatment: "bas_excluded", is_system: true, is_active: true, display_order: 410 },
  { id: "acc-203", code: "OTH-003", name: "Personal / Exclude", category: "other", tax_treatment: "bas_excluded", is_system: true, is_active: true, display_order: 420 },
];

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
      // Return mock data for UI testing when DB tables don't exist
      return NextResponse.json({
        accounts: MOCK_ACCOUNTS,
        _mock: true,
      });
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
