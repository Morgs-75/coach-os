import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { matchTransactionToMoneyEvents } from "@/lib/transaction-matcher";

const BASIQ_API_URL = "https://au-api.basiq.io";

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

async function getBasiqToken(): Promise<string> {
  const response = await fetch(`${BASIQ_API_URL}/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${Buffer.from(process.env.BASIQ_API_KEY + ":").toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "basiq-version": "3.0",
    },
    body: "scope=SERVER_ACCESS",
  });

  if (!response.ok) {
    throw new Error("Failed to get Basiq token");
  }

  const data = await response.json();
  return data.access_token;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId(supabase);

    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get Basiq connection
    const { data: connection } = await supabase
      .from("basiq_connections")
      .select("*")
      .eq("org_id", orgId)
      .single();

    if (!connection || connection.consent_status !== "active") {
      return NextResponse.json({ error: "No active bank connection" }, { status: 400 });
    }

    const token = await getBasiqToken();

    // Fetch accounts from Basiq
    const accountsResponse = await fetch(
      `${BASIQ_API_URL}/users/${connection.basiq_user_id}/accounts`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "basiq-version": "3.0",
        },
      }
    );

    if (!accountsResponse.ok) {
      console.error("Failed to fetch accounts:", await accountsResponse.text());
      return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
    }

    const accountsData = await accountsResponse.json();

    // Sync accounts
    for (const account of accountsData.data || []) {
      await supabase.from("bank_accounts").upsert(
        {
          org_id: orgId,
          basiq_account_id: account.id,
          institution_name: account.institution?.shortName || account.institution?.name || "Unknown",
          account_name: account.name || "Account",
          account_number_masked: account.accountNo ? `****${account.accountNo.slice(-4)}` : null,
          bsb: account.bsb || null,
          account_type: account.class?.type || null,
          currency: account.currency || "AUD",
          current_balance_cents: Math.round((account.balance || 0) * 100),
          available_balance_cents: Math.round((account.availableBalance || 0) * 100),
          is_active: account.status === "active",
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id,basiq_account_id" }
      );
    }

    // Get bank accounts for transaction sync
    const { data: bankAccounts } = await supabase
      .from("bank_accounts")
      .select("*")
      .eq("org_id", orgId)
      .eq("is_active", true);

    // Get money_events for matching
    const { data: moneyEvents } = await supabase
      .from("money_events")
      .select("*")
      .eq("org_id", orgId)
      .gte("event_date", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);

    // Fetch and sync transactions for each account
    let totalTransactions = 0;

    for (const bankAccount of bankAccounts || []) {
      const txResponse = await fetch(
        `${BASIQ_API_URL}/users/${connection.basiq_user_id}/transactions?filter=account.id.eq('${bankAccount.basiq_account_id}')&limit=500`,
        {
          headers: {
            "Authorization": `Bearer ${token}`,
            "basiq-version": "3.0",
          },
        }
      );

      if (!txResponse.ok) {
        console.error("Failed to fetch transactions:", await txResponse.text());
        continue;
      }

      const txData = await txResponse.json();

      for (const tx of txData.data || []) {
        const amountCents = Math.abs(Math.round((tx.amount || 0) * 100));
        const direction = tx.direction === "credit" ? "credit" : "debit";

        // Check for platform match
        const match = matchTransactionToMoneyEvents(
          {
            description: tx.description || "",
            amount_cents: amountCents,
            date: tx.transactionDate || tx.postDate,
            direction,
          },
          moneyEvents || []
        );

        await supabase.from("bank_transactions").upsert(
          {
            org_id: orgId,
            bank_account_id: bankAccount.id,
            basiq_transaction_id: tx.id,
            transaction_date: tx.transactionDate || tx.postDate,
            post_date: tx.postDate || null,
            amount_cents: amountCents,
            direction,
            description: tx.description || "",
            merchant_name: tx.merchant?.businessName || null,
            merchant_category: tx.class?.code || null,
            reference: tx.reference || null,
            status: "uncoded",
            matched_money_event_id: match?.money_event_id || null,
            match_type: match?.match_type || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "org_id,basiq_transaction_id", ignoreDuplicates: false }
        );

        totalTransactions++;
      }
    }

    // Update last sync time
    await supabase
      .from("basiq_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("org_id", orgId);

    // Apply coding rules to new uncoded transactions
    const { data: uncodedTransactions } = await supabase
      .from("bank_transactions")
      .select("id")
      .eq("org_id", orgId)
      .eq("status", "uncoded");

    for (const tx of uncodedTransactions || []) {
      await supabase.rpc("apply_coding_rules", { p_transaction_id: tx.id });
    }

    return NextResponse.json({
      success: true,
      accounts_synced: bankAccounts?.length || 0,
      transactions_synced: totalTransactions,
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync transactions" },
      { status: 500 }
    );
  }
}
