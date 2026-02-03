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
    const startDate = url.searchParams.get("start_date");
    const endDate = url.searchParams.get("end_date");

    let query = supabase
      .from("cashbook_pnl")
      .select("*")
      .eq("org_id", orgId)
      .order("period", { ascending: true });

    if (startDate) {
      query = query.gte("period", startDate);
    }
    if (endDate) {
      query = query.lte("period", endDate);
    }

    const { data: pnlData, error } = await query;

    if (error) {
      console.error("P&L fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch P&L data" }, { status: 500 });
    }

    // Calculate summary
    const income = pnlData?.filter((p) => p.category === "income")
      .reduce((sum, p) => sum + (p.net_cents || 0), 0) ?? 0;

    const expenses = pnlData?.filter((p) => p.category === "expense")
      .reduce((sum, p) => sum + Math.abs(p.net_cents || 0), 0) ?? 0;

    const gst = pnlData?.reduce((sum, p) => sum + (p.gst_cents || 0), 0) ?? 0;

    return NextResponse.json({
      data: pnlData || [],
      summary: {
        income,
        expenses,
        net_profit: income - expenses,
        gst,
      },
    });
  } catch (error) {
    console.error("P&L fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch P&L data" },
      { status: 500 }
    );
  }
}
