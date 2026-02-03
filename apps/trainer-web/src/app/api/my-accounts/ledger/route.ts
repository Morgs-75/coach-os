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

    const url = new URL(request.url);
    const accountCode = url.searchParams.get("account");
    const startDate = url.searchParams.get("start_date");
    const endDate = url.searchParams.get("end_date");
    const limit = parseInt(url.searchParams.get("limit") || "500");

    let query = supabase
      .from("cashbook_ledger")
      .select("*")
      .eq("org_id", orgId)
      .order("transaction_date", { ascending: false })
      .limit(limit);

    if (accountCode) {
      query = query.eq("account_code", accountCode);
    }
    if (startDate) {
      query = query.gte("transaction_date", startDate);
    }
    if (endDate) {
      query = query.lte("transaction_date", endDate);
    }

    const { data: ledgerData, error } = await query;

    if (error) {
      console.error("Ledger fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch ledger data" }, { status: 500 });
    }

    // Calculate totals
    const totalDebits = ledgerData?.filter((e) => e.direction === "debit")
      .reduce((sum, e) => sum + e.amount_cents, 0) ?? 0;

    const totalCredits = ledgerData?.filter((e) => e.direction === "credit")
      .reduce((sum, e) => sum + e.amount_cents, 0) ?? 0;

    return NextResponse.json({
      entries: ledgerData || [],
      summary: {
        total_debits: totalDebits,
        total_credits: totalCredits,
        net_movement: totalCredits - totalDebits,
      },
    });
  } catch (error) {
    console.error("Ledger fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch ledger data" },
      { status: 500 }
    );
  }
}
