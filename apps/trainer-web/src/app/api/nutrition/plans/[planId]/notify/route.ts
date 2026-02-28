import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrg } from "@/lib/get-org";
import twilio from "twilio";

/**
 * POST /api/nutrition/plans/[planId]/notify
 * Sends an SMS to the plan's client notifying them their meal plan is ready.
 * Uses the client's existing portal_token — does NOT regenerate it.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params;
    const org = await getOrg();
    if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;
    if (!sid || !authToken || !from) {
      return NextResponse.json({ error: "SMS not configured — missing Twilio credentials" }, { status: 500 });
    }

    const supabase = await createClient();

    // Fetch plan + client details
    const { data: plan } = await supabase
      .from("meal_plans")
      .select("id, name, status, client_id, client:clients!meal_plans_client_id_fkey(id, full_name, phone, portal_token)")
      .eq("id", planId)
      .eq("org_id", org.orgId)
      .single();

    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    if (plan.status !== "published") {
      return NextResponse.json({ error: "Plan must be published before notifying the client" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = plan.client as Record<string, any> | null;
    if (!client) return NextResponse.json({ error: "Plan has no assigned client" }, { status: 400 });
    if (!client.phone) return NextResponse.json({ error: "Client has no phone number on file" }, { status: 400 });
    if (!client.portal_token) {
      return NextResponse.json({ error: "Client has no portal link yet — send them their portal link first" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://coach-os.netlify.app";
    const portalUrl = `${baseUrl}/portal/${client.portal_token}`;
    const message = `Hi ${client.full_name}, your new meal plan "${plan.name}" is ready. View it here: ${portalUrl}`;

    const twilioClient = twilio(sid, authToken);
    await twilioClient.messages.create({ body: message, from, to: client.phone });

    await supabase.from("client_communications").insert({
      org_id: org.orgId,
      client_id: client.id,
      type: "sms",
      direction: "outbound",
      subject: "Meal Plan Ready",
      content: message,
    });

    return NextResponse.json({ success: true, portal_url: portalUrl });
  } catch (error) {
    console.error("Nutrition notify error:", error);
    const msg = error instanceof Error ? error.message : "Failed to send notification";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
