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

    // Verify transaction belongs to org
    const { data: existingTx } = await supabase
      .from("bank_transactions")
      .select("*")
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (!existingTx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const body = await request.json();
    const { account_id, tax_treatment, notes } = body;

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
