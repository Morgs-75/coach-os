import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Mock accounts for testing
const MOCK_ACCOUNTS: Record<string, { id: string; code: string; name: string; category: string; tax_treatment: string }> = {
  "acc-001": { id: "acc-001", code: "INC-001", name: "Client Training Income", category: "income", tax_treatment: "gst" },
  "acc-002": { id: "acc-002", code: "INC-002", name: "PT Sessions", category: "income", tax_treatment: "gst" },
  "acc-003": { id: "acc-003", code: "INC-003", name: "Group Classes", category: "income", tax_treatment: "gst" },
  "acc-006": { id: "acc-006", code: "INC-006", name: "Merchandise Sales", category: "income", tax_treatment: "gst" },
  "acc-101": { id: "acc-101", code: "EXP-001", name: "Equipment & Supplies", category: "expense", tax_treatment: "gst" },
  "acc-102": { id: "acc-102", code: "EXP-002", name: "Gym Rent / Facility Fees", category: "expense", tax_treatment: "gst" },
  "acc-103": { id: "acc-103", code: "EXP-003", name: "Insurance", category: "expense", tax_treatment: "gst_free" },
  "acc-104": { id: "acc-104", code: "EXP-004", name: "Marketing & Social Media Ads", category: "expense", tax_treatment: "gst" },
  "acc-106": { id: "acc-106", code: "EXP-006", name: "Software Subscriptions", category: "expense", tax_treatment: "gst" },
  "acc-107": { id: "acc-107", code: "EXP-007", name: "Bank Fees", category: "expense", tax_treatment: "gst_free" },
  "acc-113": { id: "acc-113", code: "EXP-013", name: "Payment Processing Fees", category: "expense", tax_treatment: "gst_free" },
  "acc-108": { id: "acc-108", code: "EXP-008", name: "Motor Vehicle Expenses", category: "expense", tax_treatment: "gst" },
  "acc-109": { id: "acc-109", code: "EXP-009", name: "Phone & Internet", category: "expense", tax_treatment: "gst" },
  "acc-201": { id: "acc-201", code: "OTH-001", name: "Owner Drawings", category: "other", tax_treatment: "bas_excluded" },
  "acc-203": { id: "acc-203", code: "OTH-003", name: "Personal / Exclude", category: "other", tax_treatment: "bas_excluded" },
};

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

function calculateGstCents(amountCents: number, taxTreatment: string): number {
  if (taxTreatment === "gst") {
    return Math.round(amountCents / 11);
  }
  return 0;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const orgId = await getOrgId(supabase);

    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: { user } } = await supabase.auth.getUser();

    const body = await request.json();
    const { account_id, tax_treatment, notes } = body;

    // Verify transaction belongs to org
    const { data: existingTx, error: fetchError } = await supabase
      .from("bank_transactions")
      .select("*")
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    // Handle mock mode when DB tables don't exist
    if (fetchError) {
      console.log("Mock mode: simulating transaction update for", id);
      const mockAccount = MOCK_ACCOUNTS[account_id];
      const finalTaxTreatment = tax_treatment || mockAccount?.tax_treatment || "gst";
      const status = mockAccount?.code === "OTH-003" ? "excluded" : "coded";

      return NextResponse.json({
        transaction: {
          id,
          account_id,
          account: mockAccount,
          tax_treatment: finalTaxTreatment,
          gst_cents: finalTaxTreatment === "gst" ? Math.round(10000 / 11) : 0,
          notes,
          status,
          coded_at: new Date().toISOString(),
        },
        _mock: true,
      });
    }

    if (!existingTx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Get account's default tax treatment if not provided
    let finalTaxTreatment = tax_treatment;
    if (!finalTaxTreatment && account_id) {
      const { data: account } = await supabase
        .from("chart_of_accounts")
        .select("tax_treatment")
        .eq("id", account_id)
        .single();
      finalTaxTreatment = account?.tax_treatment || "gst";
    }

    const gstCents = calculateGstCents(existingTx.amount_cents, finalTaxTreatment);

    // Determine status based on account
    let status = "coded";
    const { data: account } = await supabase
      .from("chart_of_accounts")
      .select("code")
      .eq("id", account_id)
      .single();

    if (account?.code === "OTH-003") {
      status = "excluded";
    }

    const { data: updatedTx, error } = await supabase
      .from("bank_transactions")
      .update({
        account_id,
        tax_treatment: finalTaxTreatment,
        gst_cents: gstCents,
        notes: notes || existingTx.notes,
        status,
        coded_by: user?.id,
        coded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Update error:", error);
      return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 });
    }

    return NextResponse.json({ transaction: updatedTx });
  } catch (error) {
    console.error("Transaction update error:", error);
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}
