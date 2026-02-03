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
    const status = url.searchParams.get("status");
    const bankAccountId = url.searchParams.get("bank_account_id");
    const startDate = url.searchParams.get("start_date");
    const endDate = url.searchParams.get("end_date");
    const limit = parseInt(url.searchParams.get("limit") || "200");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    let query = supabase
      .from("bank_transactions")
      .select(`
        *,
        bank_account:bank_accounts(id, account_name, institution_name),
        account:chart_of_accounts!bank_transactions_account_id_fkey(id, code, name, category, tax_treatment),
        ai_suggested_account:chart_of_accounts!bank_transactions_ai_suggested_account_id_fkey(id, code, name, category, tax_treatment),
        matched_money_event:money_events(id, type, amount_cents, event_date, notes)
      `)
      .eq("org_id", orgId)
      .order("transaction_date", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (bankAccountId && bankAccountId !== "all") {
      query = query.eq("bank_account_id", bankAccountId);
    }
    if (startDate) {
      query = query.gte("transaction_date", startDate);
    }
    if (endDate) {
      query = query.lte("transaction_date", endDate);
    }

    const { data: transactions, error } = await query;

    if (error) {
      console.error("Transactions fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
    }

    return NextResponse.json({
      transactions: transactions || [],
    });
  } catch (error) {
    console.error("Transactions fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}
