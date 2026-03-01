import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/portal/validate?token=<uuid>
 * Returns { client_id, client_name, org_id, org_name } or 404.
 * Used by the portal server component to resolve a magic-link token.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: client, error } = await supabase
    .from("clients")
    .select("id, full_name, org_id, orgs!clients_org_id_fkey(name)")
    .eq("portal_token", token)
    .single();

  if (error || !client) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  // Fetch active purchases (server-side to bypass RLS)
  const { data: purchases } = await supabase
    .from("client_purchases")
    .select("id, sessions_total, sessions_remaining, expires_at, session_duration_mins, offer_id(name, session_duration_mins)")
    .eq("client_id", client.id)
    .eq("payment_status", "succeeded")
    .gt("sessions_remaining", 0);

  const activePurchases = (purchases ?? []).filter(
    (p: any) => !p.expires_at || new Date(p.expires_at) >= new Date()
  );

  // Enrich each purchase with bookable_remaining (sessions_remaining minus future bookings)
  const enrichedPurchases = await Promise.all(
    activePurchases.map(async (p: any) => {
      const { data: bookable } = await supabase.rpc("bookable_sessions_remaining", {
        p_purchase_id: p.id,
      });
      return { ...p, bookable_remaining: bookable ?? 0 };
    })
  );

  return NextResponse.json({
    client_id: client.id,
    client_name: client.full_name,
    org_id: client.org_id,
    org_name: (client.orgs as any)?.name ?? "",
    active_purchases: enrichedPurchases,
  });
}
