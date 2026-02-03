import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const success = url.searchParams.get("success");
  const error = url.searchParams.get("error");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Get org
  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!membership?.org_id) {
    return NextResponse.redirect(new URL("/my-accounts/connect?error=no_org", request.url));
  }

  if (error) {
    return NextResponse.redirect(
      new URL(`/my-accounts/connect?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (success === "true") {
    // Update connection status
    await supabase
      .from("basiq_connections")
      .update({
        consent_status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", membership.org_id);

    return NextResponse.redirect(new URL("/my-accounts/connect?success=true", request.url));
  }

  return NextResponse.redirect(new URL("/my-accounts/connect", request.url));
}
