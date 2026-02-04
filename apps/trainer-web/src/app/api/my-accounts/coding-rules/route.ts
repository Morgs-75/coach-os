import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Mock coding rules for UI testing
const MOCK_CODING_RULES = [
  {
    id: "rule-001",
    name: "Stripe Payments",
    match_description: "STRIPE",
    match_merchant: "Stripe",
    match_direction: "credit",
    account_id: "acc-002",
    account: { id: "acc-002", code: "INC-002", name: "PT Sessions", category: "income" },
    tax_treatment: "gst",
    auto_apply: true,
    is_active: true,
    priority: 100,
    times_applied: 45,
  },
  {
    id: "rule-002",
    name: "Meta/Facebook Ads",
    match_description: "META ADS",
    match_merchant: "Meta",
    match_direction: "debit",
    account_id: "acc-104",
    account: { id: "acc-104", code: "EXP-004", name: "Marketing & Social Media Ads", category: "expense" },
    tax_treatment: "gst",
    auto_apply: true,
    is_active: true,
    priority: 90,
    times_applied: 12,
  },
  {
    id: "rule-003",
    name: "Google Ads",
    match_description: "GOOGLE ADS",
    match_merchant: "Google",
    match_direction: "debit",
    account_id: "acc-104",
    account: { id: "acc-104", code: "EXP-004", name: "Marketing & Social Media Ads", category: "expense" },
    tax_treatment: "gst",
    auto_apply: true,
    is_active: true,
    priority: 90,
    times_applied: 8,
  },
  {
    id: "rule-004",
    name: "Bank Fees",
    match_description: "ACCOUNT FEE",
    match_merchant: null,
    match_direction: "debit",
    account_id: "acc-107",
    account: { id: "acc-107", code: "EXP-007", name: "Bank Fees", category: "expense" },
    tax_treatment: "gst_free",
    auto_apply: true,
    is_active: true,
    priority: 80,
    times_applied: 6,
  },
  {
    id: "rule-005",
    name: "Gym Rent",
    match_description: "ANYTIME FITNESS",
    match_merchant: "Anytime Fitness",
    match_direction: "debit",
    account_id: "acc-102",
    account: { id: "acc-102", code: "EXP-002", name: "Gym Rent / Facility Fees", category: "expense" },
    tax_treatment: "gst",
    auto_apply: true,
    is_active: true,
    priority: 85,
    times_applied: 3,
  },
  {
    id: "rule-006",
    name: "ATM Withdrawals",
    match_description: "ATM WITHDRAWAL",
    match_merchant: null,
    match_direction: "debit",
    account_id: "acc-201",
    account: { id: "acc-201", code: "OTH-001", name: "Owner Drawings", category: "other" },
    tax_treatment: "bas_excluded",
    auto_apply: false,
    is_active: true,
    priority: 70,
    times_applied: 5,
  },
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

    const { data: rules, error } = await supabase
      .from("coding_rules")
      .select(`
        *,
        account:chart_of_accounts(id, code, name, category)
      `)
      .eq("org_id", orgId)
      .order("priority", { ascending: false });

    if (error) {
      console.error("Coding rules fetch error:", error);
      // Return mock data for UI testing when DB tables don't exist
      return NextResponse.json({
        rules: MOCK_CODING_RULES,
        _mock: true,
      });
    }

    return NextResponse.json({
      rules: rules || [],
    });
  } catch (error) {
    console.error("Coding rules fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch rules" },
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
    const {
      id,
      name,
      match_description,
      match_merchant,
      match_direction,
      account_id,
      tax_treatment,
      auto_apply,
      is_active,
      priority,
    } = body;

    if (!name || !account_id) {
      return NextResponse.json({ error: "Name and account required" }, { status: 400 });
    }

    // Update existing or create new
    if (id) {
      const { data: updatedRule, error } = await supabase
        .from("coding_rules")
        .update({
          name,
          match_description: match_description || null,
          match_merchant: match_merchant || null,
          match_direction: match_direction || null,
          account_id,
          tax_treatment: tax_treatment || null,
          auto_apply: auto_apply ?? false,
          is_active: is_active ?? true,
          priority: priority ?? 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("org_id", orgId)
        .select()
        .single();

      if (error) {
        console.error("Rule update error:", error);
        return NextResponse.json({ error: "Failed to update rule" }, { status: 500 });
      }

      return NextResponse.json({ rule: updatedRule });
    } else {
      const { data: newRule, error } = await supabase
        .from("coding_rules")
        .insert({
          org_id: orgId,
          name,
          match_description: match_description || null,
          match_merchant: match_merchant || null,
          match_direction: match_direction || null,
          account_id,
          tax_treatment: tax_treatment || null,
          auto_apply: auto_apply ?? false,
          is_active: is_active ?? true,
          priority: priority ?? 0,
        })
        .select()
        .single();

      if (error) {
        console.error("Rule creation error:", error);
        return NextResponse.json({ error: "Failed to create rule" }, { status: 500 });
      }

      return NextResponse.json({ rule: newRule });
    }
  } catch (error) {
    console.error("Rule save error:", error);
    return NextResponse.json(
      { error: "Failed to save rule" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId(supabase);

    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Rule ID required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("coding_rules")
      .delete()
      .eq("id", id)
      .eq("org_id", orgId);

    if (error) {
      console.error("Rule deletion error:", error);
      return NextResponse.json({ error: "Failed to delete rule" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Rule deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete rule" },
      { status: 500 }
    );
  }
}
