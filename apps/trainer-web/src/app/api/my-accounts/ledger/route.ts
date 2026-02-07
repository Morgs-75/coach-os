import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMockTransactions } from "@/lib/mock-data";

// Generate ledger entries from mock transactions
function generateMockLedgerData() {
  const transactions = getMockTransactions();

  // Only include coded and excluded transactions (not uncoded)
  return transactions
    .filter(t => t.status === "coded" || t.status === "excluded")
    .map(t => ({
      id: t.id,
      org_id: t.org_id,
      transaction_id: t.id,
      transaction_date: t.transaction_date,
      description: t.description,
      account_id: t.account_id,
      account_code: t.account?.code || "UNKNOWN",
      account_name: t.account?.name || "Unknown Account",
      category: t.account?.category || "other",
      direction: t.direction,
      amount_cents: t.amount_cents,
      tax_treatment: t.tax_treatment,
      gst_cents: t.gst_cents || 0,
    }));
}

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
      // Return mock data for UI testing when DB tables don't exist
      let mockLedger = generateMockLedgerData();

      // Apply filters to mock data
      if (accountCode) {
        mockLedger = mockLedger.filter(e => e.account_code === accountCode);
      }
      if (startDate) {
        mockLedger = mockLedger.filter(e => e.transaction_date >= startDate);
      }
      if (endDate) {
        mockLedger = mockLedger.filter(e => e.transaction_date <= endDate);
      }

      const entries = mockLedger.slice(0, limit);

      const totalDebits = entries.filter((e) => e.direction === "debit")
        .reduce((sum, e) => sum + e.amount_cents, 0);

      const totalCredits = entries.filter((e) => e.direction === "credit")
        .reduce((sum, e) => sum + e.amount_cents, 0);

      return NextResponse.json({
        entries,
        summary: {
          total_debits: totalDebits,
          total_credits: totalCredits,
          net_movement: totalCredits - totalDebits,
        },
        _mock: true,
      });
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
