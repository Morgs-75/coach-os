import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import twilio from "twilio";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * POST /api/portal/cancel-booking
 * Body: { token: string, booking_id: string }
 *
 * Validates token + ownership + notice period, cancels the booking,
 * and sends SMS notifications to both the client and coach.
 */
export async function POST(request: Request) {
  try {
    const { token, booking_id } = await request.json();

    if (!token || !booking_id) {
      return NextResponse.json({ error: "Missing token or booking_id" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Resolve client from token
    const { data: client } = await supabase
      .from("clients")
      .select("id, full_name, phone, org_id")
      .eq("portal_token", token)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Invalid link" }, { status: 401 });
    }

    // Fetch booking — verify it belongs to this client
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, client_id, org_id, start_time, status")
      .eq("id", booking_id)
      .eq("client_id", client.id)
      .single();

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.status === "cancelled") {
      return NextResponse.json({ error: "Booking is already cancelled" }, { status: 400 });
    }

    const start = new Date(booking.start_time);
    if (start <= new Date()) {
      return NextResponse.json({ error: "Cannot cancel a session that has already started" }, { status: 400 });
    }

    // Check cancellation notice period
    const { data: settings } = await supabase
      .from("booking_settings")
      .select("cancel_notice_hours, allow_client_cancel, notify_phone")
      .eq("org_id", client.org_id)
      .single();

    if (settings && !settings.allow_client_cancel) {
      return NextResponse.json({ error: "Client cancellations are not enabled" }, { status: 403 });
    }

    const noticeHours = settings?.cancel_notice_hours ?? 24;
    const hoursUntilSession = (start.getTime() - Date.now()) / 3_600_000;

    if (hoursUntilSession < noticeHours) {
      return NextResponse.json(
        { error: `Cancellations require at least ${noticeHours} hours notice` },
        { status: 400 }
      );
    }

    // Cancel the booking
    const { error: cancelError } = await supabase
      .from("bookings")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", booking_id);

    if (cancelError) {
      return NextResponse.json({ error: "Failed to cancel booking" }, { status: 500 });
    }

    const from = process.env.TWILIO_PHONE_NUMBER;
    const sessionDate = start.toLocaleDateString("en-AU", {
      weekday: "short", day: "numeric", month: "short",
    });
    const sessionTime = start.toLocaleTimeString("en-AU", {
      hour: "numeric", minute: "2-digit", hour12: true,
    });

    // Client confirmation SMS
    if (from && client.phone) {
      try {
        await twilioClient.messages.create({
          body: `Hi ${client.full_name}, your session on ${sessionDate} at ${sessionTime} has been cancelled. Please contact your coach to rebook.`,
          from,
          to: client.phone,
        });
        await supabase.from("client_communications").insert({
          org_id: client.org_id,
          client_id: client.id,
          type: "sms",
          direction: "outbound",
          subject: "Session Cancelled (Client Portal)",
          content: `Client cancelled session on ${sessionDate} at ${sessionTime}`,
        });
      } catch (e) {
        console.error("Client cancellation SMS failed:", e);
      }
    }

    // Coach notification SMS
    const coachPhone = settings?.notify_phone;
    if (from && coachPhone) {
      try {
        await twilioClient.messages.create({
          body: `${client.full_name} has cancelled their session on ${sessionDate} at ${sessionTime} via their portal.`,
          from,
          to: coachPhone,
        });
      } catch (e) {
        console.error("Coach notification SMS failed:", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cancel booking error:", error);
    return NextResponse.json({ error: "Failed to cancel booking" }, { status: 500 });
  }
}
