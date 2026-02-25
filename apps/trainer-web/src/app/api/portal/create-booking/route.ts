import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import twilio from "twilio";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * POST /api/portal/create-booking
 * Body: { token, start_time, purchase_id? }
 *
 * Validates token → sessions remaining → slot availability → inserts booking.
 * Sends SMS confirmations to client and coach.
 */
export async function POST(request: Request) {
  try {
    const { token, start_time, purchase_id } = await request.json();

    if (!token || !start_time) {
      return NextResponse.json({ error: "Missing token or start_time" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Resolve client
    const { data: client } = await supabase
      .from("clients")
      .select("id, full_name, phone, org_id")
      .eq("portal_token", token)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Invalid link" }, { status: 401 });
    }

    // Check sessions remaining
    const { data: purchases } = await supabase
      .from("client_purchases")
      .select("id, sessions_remaining, expires_at")
      .eq("client_id", client.id)
      .eq("payment_status", "succeeded")
      .gt("sessions_remaining", 0);

    const activePurchases = (purchases ?? []).filter(
      p => !p.expires_at || new Date(p.expires_at) >= new Date()
    );

    if (activePurchases.length === 0) {
      return NextResponse.json(
        { error: "No sessions remaining. Please purchase a package to book." },
        { status: 400 }
      );
    }

    // Booking settings
    const { data: settings } = await supabase
      .from("booking_settings")
      .select("slot_duration_mins, allow_client_booking, notify_phone")
      .eq("org_id", client.org_id)
      .single();

    if (settings && !settings.allow_client_booking) {
      return NextResponse.json(
        { error: "Online self-booking is not currently enabled." },
        { status: 403 }
      );
    }

    const durationMins = settings?.slot_duration_mins ?? 60;
    const startDt = new Date(start_time);
    const endDt = new Date(startDt.getTime() + durationMins * 60_000);

    if (startDt <= new Date()) {
      return NextResponse.json({ error: "That time slot is in the past." }, { status: 400 });
    }

    // Check slot availability via DB function
    const { data: available } = await supabase.rpc("is_slot_available", {
      p_org_id: client.org_id,
      p_start_time: startDt.toISOString(),
      p_end_time: endDt.toISOString(),
    });

    if (!available) {
      return NextResponse.json(
        { error: "That time slot is no longer available. Please choose another." },
        { status: 409 }
      );
    }

    // Use the specified purchase or the first active one
    const resolvedPurchaseId =
      purchase_id ??
      activePurchases.sort((a, b) => (a.expires_at ?? "9999") < (b.expires_at ?? "9999") ? -1 : 1)[0].id;

    // Insert booking (booked_by is NULL for portal bookings — migration 0035)
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        org_id: client.org_id,
        client_id: client.id,
        purchase_id: resolvedPurchaseId,
        start_time: startDt.toISOString(),
        end_time: endDt.toISOString(),
        duration_mins: durationMins,
        session_type: "pt_session",
        location_type: "in_person",
        status: "confirmed",
        booking_source: "client",
        booked_by: null,
      })
      .select("id")
      .single();

    if (bookingError || !booking) {
      console.error("Booking insert error:", bookingError);
      return NextResponse.json({ error: "Failed to create booking." }, { status: 500 });
    }

    const from = process.env.TWILIO_PHONE_NUMBER;
    const sessionDate = startDt.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
    const sessionTime = startDt.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true });

    // Client confirmation SMS
    if (from && client.phone) {
      try {
        await twilioClient.messages.create({
          body: `Hi ${client.full_name}, your session is confirmed for ${sessionDate} at ${sessionTime}. See you then!`,
          from,
          to: client.phone,
        });
        await supabase.from("client_communications").insert({
          org_id: client.org_id,
          client_id: client.id,
          type: "sms",
          direction: "outbound",
          subject: "Session Confirmed (Client Portal)",
          content: `Booking confirmed: ${sessionDate} at ${sessionTime}`,
        });
      } catch (e) {
        console.error("Client confirmation SMS failed:", e);
      }
    }

    // Coach notification SMS
    const coachPhone = settings?.notify_phone;
    if (from && coachPhone) {
      try {
        await twilioClient.messages.create({
          body: `${client.full_name} booked a session on ${sessionDate} at ${sessionTime} via their portal.`,
          from,
          to: coachPhone,
        });
      } catch (e) {
        console.error("Coach notification SMS failed:", e);
      }
    }

    return NextResponse.json({ success: true, booking_id: booking.id });
  } catch (error) {
    console.error("Create portal booking error:", error);
    return NextResponse.json({ error: "Failed to create booking." }, { status: 500 });
  }
}
