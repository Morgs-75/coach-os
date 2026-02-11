import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrg } from "@/lib/get-org";
import twilio from "twilio";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function POST(request: Request) {
  try {
    const org = await getOrg();
    if (!org) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { client_id } = await request.json();
    if (!client_id) {
      return NextResponse.json({ error: "Missing client_id" }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch client details (need phone for SMS)
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, full_name, phone")
      .eq("id", client_id)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    if (!client.phone) {
      return NextResponse.json(
        { error: "Client has no phone number. Add a phone number to send the waiver by SMS." },
        { status: 400 }
      );
    }

    // Create waiver record with token
    const { data: waiver, error: insertError } = await supabase
      .from("client_waivers")
      .insert({
        org_id: org.orgId,
        client_id,
        name: "Waiver",
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .select("id, token")
      .single();

    if (insertError || !waiver) {
      return NextResponse.json(
        { error: "Failed to create waiver: " + insertError?.message },
        { status: 500 }
      );
    }

    // Build the signing URL
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get("origin") ||
      "http://localhost:3000";
    const signingUrl = `${baseUrl}/sign-waiver/${waiver.token}`;

    // Send SMS with signing link
    const from = process.env.TWILIO_PHONE_NUMBER;
    let smsSent = false;

    if (from) {
      try {
        await twilioClient.messages.create({
          body: `Hi ${client.full_name}, can you please complete the attached waiver to ensure your next training session can proceed as scheduled. Thank you! ${signingUrl}`,
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
          subject: "Waiver Sent",
          content: `Waiver signing link sent to ${client.phone}`,
        });
      } catch (smsError: unknown) {
        console.error("SMS send failed:", smsError);
        // Don't fail the whole request - waiver was still created
      }
    }

    return NextResponse.json({
      waiver_id: waiver.id,
      signing_url: signingUrl,
      sms_sent: smsSent,
    });
  } catch (error) {
    console.error("Send waiver error:", error);
    return NextResponse.json(
      { error: "Failed to send waiver" },
      { status: 500 }
    );
  }
}
