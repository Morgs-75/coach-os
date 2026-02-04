import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Mock bank accounts for UI testing
const MOCK_BANK_ACCOUNTS = [
  {
    id: "ba-001",
    account_name: "Business Everyday",
    account_number: "****4521",
    bsb: "063-000",
    institution_name: "Commonwealth Bank",
    account_type: "transaction",
    balance_cents: 1245670,
    available_cents: 1245670,
    is_active: true,
    last_synced_at: new Date().toISOString(),
  },
  {
    id: "ba-002",
    account_name: "Business Savings",
    account_number: "****8832",
    bsb: "063-000",
    institution_name: "Commonwealth Bank",
    account_type: "savings",
    balance_cents: 5672300,
    available_cents: 5672300,
    is_active: true,
    last_synced_at: new Date().toISOString(),
  },
];

const MOCK_CONNECTION = {
  id: "conn-001",
  status: "active",
  institution_name: "Commonwealth Bank",
  institution_logo: null,
  last_synced_at: new Date().toISOString(),
  created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
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

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId(supabase);

    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get connection info
    const { data: connection, error: connError } = await supabase
      .from("basiq_connections")
      .select("*")
      .eq("org_id", orgId)
      .single();

    // Get bank accounts
    const { data: accounts, error: accountsError } = await supabase
      .from("bank_accounts")
      .select("*")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("account_name");

    // Return mock data for UI testing when DB tables don't exist
    if (connError || accountsError) {
      return NextResponse.json({
        connection: MOCK_CONNECTION,
        accounts: MOCK_BANK_ACCOUNTS,
        _mock: true,
      });
    }

    return NextResponse.json({
      connection,
      accounts: accounts || [],
    });
  } catch (error) {
    console.error("Accounts fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}
