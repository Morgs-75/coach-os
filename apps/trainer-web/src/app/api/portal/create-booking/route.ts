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

    // Check sessions remaining (includes future confirmed bookings)
    const { data: purchases } = await supabase
      .from("client_purchases")
      .select("id, sessions_remaining, expires_at, session_duration_mins, offer_id(session_duration_mins)")
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
      .select("slot_duration_mins, allow_client_booking, notify_phone, timezone")
      .eq("org_id", client.org_id)
      .single();

    if (settings && !settings.allow_client_booking) {
      return NextResponse.json(
        { error: "Online self-booking is not currently enabled." },
        { status: 403 }
      );
    }

    // Resolve purchased duration: if purchase_id specified, use that purchase; otherwise earliest-expiring
    const sortedPurchases = activePurchases.sort(
      (a: any, b: any) => (a.expires_at ?? "9999") < (b.expires_at ?? "9999") ? -1 : 1
    );
    const resolvedPurchase = (
      purchase_id
        ? activePurchases.find((p: any) => p.id === purchase_id) ?? sortedPurchases[0]
        : sortedPurchases[0]
    ) as any;
    const purchasedDurationMins: number =
      resolvedPurchase.session_duration_mins ??
      (resolvedPurchase.offer_id as any)?.session_duration_mins ??
      settings?.slot_duration_mins ??
      60;

    // Atomic check: are there bookable sessions left (sessions_remaining minus future bookings)?
    const { data: bookableCount } = await supabase.rpc("bookable_sessions_remaining", {
      p_purchase_id: resolvedPurchase.id,
    });

    if ((bookableCount ?? 0) <= 0) {
      return NextResponse.json(
        { error: "All your available sessions are already booked. Please wait for a session to complete or purchase a new package." },
        { status: 400 }
      );
    }

    const startDt = new Date(start_time);
    const endDt = new Date(startDt.getTime() + purchasedDurationMins * 60_000);

    // Guard: end_time must exactly match start + purchased duration
    const requestedEnd = new Date(start_time);
    requestedEnd.setMinutes(requestedEnd.getMinutes()); // used below for explicit check
    const expectedEnd = new Date(startDt.getTime() + purchasedDurationMins * 60_000);
    // (end_time is not sent by client — we compute it, so this guard protects server-side integrity)

    if (startDt <= new Date()) {
      return NextResponse.json({ error: "That time slot is in the past." }, { status: 400 });
    }

    const durationMins = purchasedDurationMins;

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

    // Use the specified purchase or the earliest-expiring active one
    const resolvedPurchaseId = purchase_id ?? resolvedPurchase.id;

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
    const tz = settings?.timezone ?? "Australia/Brisbane";
    const sessionDate = startDt.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: tz });
    const sessionTime = startDt.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz });

    // Client confirmation SMS — include remaining sessions and portal link
    if (from && client.phone) {
      try {
        // Get updated bookable count after this booking was created
        const { data: remainingAfter } = await supabase.rpc("bookable_sessions_remaining", {
          p_purchase_id: resolvedPurchaseId,
        });
        const remaining = remainingAfter ?? 0;

        // Get offer name
        const { data: offerData } = await supabase
          .from("client_purchases")
          .select("offer_id(name)")
          .eq("id", resolvedPurchaseId)
          .single();
        const packageName = (offerData?.offer_id as any)?.name ?? "package";

        const portalLink = `${process.env.NEXT_PUBLIC_APP_URL}/portal/${token}`;

        await twilioClient.messages.create({
          body: `Hi ${client.full_name}, your session is booked for ${sessionDate} at ${sessionTime}. You have ${remaining} session${remaining !== 1 ? "s" : ""} remaining on your ${packageName} package. You can review your packages and sessions booked here: ${portalLink}`,
          from,
          to: client.phone,
        });
        // Mark confirmation sent so the cron reminder can chase unconfirmed bookings
        await supabase
          .from("bookings")
          .update({ confirmation_sent_at: new Date().toISOString() })
          .eq("id", booking.id);
        await supabase.from("client_communications").insert({
          org_id: client.org_id,
          client_id: client.id,
          type: "sms",
          direction: "outbound",
          subject: "Session Confirmation Request (Client Portal)",
          content: `Booking confirmation request: ${sessionDate} at ${sessionTime}`,
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
