import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import twilio from "twilio";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function POST(request: Request) {
  try {
    const { client_id, org_id } = await request.json();
    if (!client_id || !org_id) {
      return NextResponse.json({ error: "Missing client_id or org_id" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get client name
    const { data: client } = await supabase
      .from("clients")
      .select("full_name")
      .eq("id", client_id)
      .single();

    // Get coach phone from booking_settings
    const { data: settings } = await supabase
      .from("booking_settings")
      .select("notify_phone")
      .eq("org_id", org_id)
      .single();

    const coachPhone = settings?.notify_phone;
    if (!coachPhone) {
      return NextResponse.json({ notified: false, reason: "no_coach_phone" });
    }

    const from = process.env.TWILIO_PHONE_NUMBER;
    if (!from) {
      return NextResponse.json({ notified: false, reason: "no_twilio_number" });
    }

    const clientName = client?.full_name || "A client";

    await twilioClient.messages.create({
      body: `${clientName} has completed their onboarding form and signed the waiver.`,
      from,
      to: coachPhone,
    });

    // Log the communication
    await supabase.from("client_communications").insert({
      org_id,
      client_id,
      type: "sms",
      direction: "outbound",
      subject: "Onboarding Completed Notification",
      content: `Coach notified that ${clientName} completed onboarding`,
    });

    return NextResponse.json({ notified: true });
  } catch (err) {
    console.error("Notify coach error:", err);
    return NextResponse.json({ notified: false, reason: "error" });
  }
}
