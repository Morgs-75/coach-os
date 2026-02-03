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

    // Get connection info
    const { data: connection } = await supabase
      .from("basiq_connections")
      .select("*")
      .eq("org_id", orgId)
      .single();

    // Get bank accounts
    const { data: accounts } = await supabase
      .from("bank_accounts")
      .select("*")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("account_name");

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
