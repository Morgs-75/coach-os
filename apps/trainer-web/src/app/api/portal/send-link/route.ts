import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { getOrg } from "@/lib/get-org";
import twilio from "twilio";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * POST /api/portal/send-link
 * Body: { client_id: string }
 *
 * Generates (or regenerates) a portal_token for the client, builds the magic
 * link, sends an SMS to the client, and logs the communication.
 * Requires coach authentication via getOrg().
 */
export async function POST(request: Request) {
  try {
    // Coach must be authenticated
    const org = await getOrg();
    if (!org) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { client_id } = await request.json();
    if (!client_id) {
      return NextResponse.json({ error: "Missing client_id" }, { status: 400 });
    }

    // Use anon client (with coach session) to verify the client belongs to this org
    const supabase = await createClient();
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, full_name, phone")
      .eq("id", client_id)
      .eq("org_id", org.orgId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Generate new UUID token via service role (bypasses RLS for the update)
    const serviceSupabase = createServiceClient();
    const newToken = crypto.randomUUID();

    const { error: updateError } = await serviceSupabase
      .from("clients")
      .update({ portal_token: newToken })
      .eq("id", client_id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to generate portal token: " + updateError.message },
        { status: 500 }
      );
    }

    // Build portal URL
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get("origin") ||
      "http://localhost:3000";
    const portalUrl = `${baseUrl}/portal/${newToken}`;

    // Attempt SMS (non-blocking — link is still returned even if SMS fails)
    let smsSent = false;
    const from = process.env.TWILIO_PHONE_NUMBER;

    if (from && client.phone) {
      try {
        await twilioClient.messages.create({
          body: `Hi ${client.full_name}, your personal booking portal is ready. You can view your sessions, book and cancel appointments here: ${portalUrl}`,
          from,
          to: client.phone,
        });
        smsSent = true;

        // Log outbound SMS
        await supabase.from("client_communications").insert({
          org_id: org.orgId,
          client_id,
          type: "sms",
          direction: "outbound",
          subject: "Portal Link Sent",
          content: `Portal link sent to ${client.phone}: ${portalUrl}`,
        });
      } catch (smsError) {
        console.error("Portal SMS send failed:", smsError);
      }
    }

    return NextResponse.json({ portal_url: portalUrl, sms_sent: smsSent });
  } catch (error) {
    console.error("Send portal link error:", error);
    return NextResponse.json({ error: "Failed to send portal link" }, { status: 500 });
  }
}
