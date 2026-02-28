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

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params;
  const supabase = await createClient();
  const orgId = await getOrgId(supabase);
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify plan belongs to org
  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("id", planId)
    .eq("org_id", orgId)
    .single();
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  // Reset any previous error and set status to generating
  const { error: updateError } = await supabase
    .from("meal_plans")
    .update({ generation_status: "generating", generation_error: null })
    .eq("id", planId);

  if (updateError) {
    return NextResponse.json({ error: "Failed to set generation status" }, { status: 500 });
  }

  return NextResponse.json({ status: "generating" });
}
