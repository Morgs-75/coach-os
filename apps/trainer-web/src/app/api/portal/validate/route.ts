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

  return NextResponse.json({
    client_id: client.id,
    client_name: client.full_name,
    org_id: client.org_id,
    org_name: (client.orgs as any)?.name ?? "",
  });
}
