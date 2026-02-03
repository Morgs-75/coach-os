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

function calculateGstCents(amountCents: number, taxTreatment: string): number {
  if (taxTreatment === "gst") {
    return Math.round(amountCents / 11);
  }
  return 0;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId(supabase);

    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: { user } } = await supabase.auth.getUser();

    const body = await request.json();
    const { transaction_ids, account_id } = body;

    if (!transaction_ids || !Array.isArray(transaction_ids) || transaction_ids.length === 0) {
      return NextResponse.json({ error: "No transactions specified" }, { status: 400 });
    }

    if (!account_id) {
      return NextResponse.json({ error: "Account ID required" }, { status: 400 });
    }

    // Get account details
    const { data: account } = await supabase
      .from("chart_of_accounts")
      .select("*")
      .eq("id", account_id)
      .single();

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Get transactions to update
    const { data: transactions } = await supabase
      .from("bank_transactions")
      .select("*")
      .in("id", transaction_ids)
      .eq("org_id", orgId);

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ error: "No transactions found" }, { status: 404 });
    }

    // Determine status
    const status = account.code === "OTH-003" ? "excluded" : "coded";

    // Update each transaction
    let updated = 0;
    for (const tx of transactions) {
      const gstCents = calculateGstCents(tx.amount_cents, account.tax_treatment);

      const { error } = await supabase
        .from("bank_transactions")
        .update({
          account_id,
          tax_treatment: account.tax_treatment,
          gst_cents: gstCents,
          status,
          coded_by: user?.id,
          coded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", tx.id);

      if (!error) {
        updated++;
      }
    }

    return NextResponse.json({
      success: true,
      updated,
    });
  } catch (error) {
    console.error("Bulk code error:", error);
    return NextResponse.json(
      { error: "Failed to bulk code transactions" },
      { status: 500 }
    );
  }
}
