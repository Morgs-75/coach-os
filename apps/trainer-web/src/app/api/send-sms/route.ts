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

    const { to, message, client_id } = await request.json();

    if (!to || !message) {
      return NextResponse.json(
        { error: "Missing required fields: to, message" },
        { status: 400 }
      );
    }

    const from = process.env.TWILIO_PHONE_NUMBER;
    if (!from) {
      return NextResponse.json(
        { error: "SMS not configured" },
        { status: 500 }
      );
    }

    // Send SMS via Twilio
    const result = await twilioClient.messages.create({
      body: message,
      from,
      to,
    });

    // Log the outbound SMS if client_id provided
    if (client_id) {
      const supabase = await createClient();
      await supabase.from("client_communications").insert({
        org_id: org.orgId,
        client_id,
        type: "sms",
        direction: "outbound",
        subject: "SMS Sent",
        content: message,
      });
    }

    return NextResponse.json({
      success: true,
      message_sid: result.sid,
      status: result.status,
    });
  } catch (error: unknown) {
    console.error("Send SMS error:", error);
    const msg = error instanceof Error ? error.message : "Failed to send SMS";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
