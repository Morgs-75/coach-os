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

    // Fetch client details
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
        { error: "Client has no phone number. Add a phone number to send the onboarding form by SMS." },
        { status: 400 }
      );
    }

    // Generate onboarding token and update client
    const token = crypto.randomUUID();
    const { error: updateError } = await supabase
      .from("clients")
      .update({ onboarding_token: token, onboarding_sent_at: new Date().toISOString() })
      .eq("id", client_id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to generate onboarding link: " + updateError.message },
        { status: 500 }
      );
    }

    // Build the onboarding URL
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get("origin") ||
      "http://localhost:3000";
    const onboardingUrl = `${baseUrl}/onboard/${token}`;

    // Send SMS with onboarding link
    const from = process.env.TWILIO_PHONE_NUMBER;
    let smsSent = false;

    if (from) {
      try {
        await twilioClient.messages.create({
          body: `Hi ${client.full_name}, I look forward to working with you on your fitness journey. To get started can you please complete my client onboarding form and complete the client waiver. Thank you: ${onboardingUrl}`,
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
          subject: "Onboarding Form Sent",
          content: `Onboarding form link sent to ${client.phone}`,
        });
      } catch (smsError: unknown) {
        console.error("SMS send failed:", smsError);
      }
    }

    return NextResponse.json({
      onboarding_url: onboardingUrl,
      sms_sent: smsSent,
    });
  } catch (error) {
    console.error("Send onboarding error:", error);
    return NextResponse.json(
      { error: "Failed to send onboarding form" },
      { status: 500 }
    );
  }
}
