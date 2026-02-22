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

    const { to, message, client_id, booking_id, request_confirmation } = await request.json();

    if (!message) {
      return NextResponse.json({ error: "Missing required field: message" }, { status: 400 });
    }

    const from = process.env.TWILIO_PHONE_NUMBER;
    if (!from) {
      return NextResponse.json({ error: "SMS not configured" }, { status: 500 });
    }

    const supabase = await createClient();

    // Resolve phone number — use `to` if provided, otherwise look up client's phone
    let toPhone = to;
    if (!toPhone && client_id) {
      const { data: client } = await supabase
        .from("clients")
        .select("phone")
        .eq("id", client_id)
        .eq("org_id", org.orgId)
        .single();

      if (!client?.phone) {
        return NextResponse.json({ error: "Client has no phone number on file" }, { status: 400 });
      }
      toPhone = client.phone;
    }

    if (!toPhone) {
      return NextResponse.json({ error: "Missing required field: to or client_id" }, { status: 400 });
    }

    // Send SMS via Twilio
    const result = await twilioClient.messages.create({
      body: message,
      from,
      to: toPhone,
    });

    // Mark booking reminder_sent if this was a confirmation request
    if (booking_id && request_confirmation) {
      await supabase
        .from("bookings")
        .update({ reminder_sent: true })
        .eq("id", booking_id);
    }

    // Log to client_communications
    if (client_id) {
      await supabase.from("client_communications").insert({
        org_id: org.orgId,
        client_id,
        type: "sms",
        direction: "outbound",
        subject: booking_id ? "Booking Confirmation" : "SMS Sent",
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
