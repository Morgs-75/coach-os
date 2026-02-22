import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const params = new URLSearchParams(body);

    const fromPhone = params.get("From");
    const messageBody = params.get("Body")?.trim().toUpperCase();

    console.log("Inbound SMS:", { fromPhone, messageBody });

    if (!fromPhone || !messageBody) {
      return twiml("");
    }

    if (messageBody === "Y" || messageBody === "YES") {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Find client by phone number
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("id, full_name, org_id")
        .or(`phone.eq.${fromPhone},phone.eq.${fromPhone.replace("+61", "0")}`)
        .limit(1)
        .maybeSingle();

      console.log("Client lookup:", { client, clientError });

      if (!client) {
        return twiml("We couldn't find your booking. Please contact your trainer directly.");
      }

      // Find their most recent unconfirmed booking
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .select("id, start_time")
        .eq("client_id", client.id)
        .eq("status", "confirmed")
        .eq("client_confirmed", false)
        .not("confirmation_sent_at", "is", null)
        .gte("start_time", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order("start_time", { ascending: true })
        .limit(1)
        .maybeSingle();

      console.log("Booking lookup:", { booking, bookingError });

      if (!booking) {
        return twiml("No upcoming booking found to confirm. Please contact your trainer.");
      }

      const { error: updateError } = await supabase
        .from("bookings")
        .update({ client_confirmed: true })
        .eq("id", booking.id);

      console.log("Update result:", { updateError });

      // Look up org timezone
      const { data: settings } = await supabase
        .from("booking_settings")
        .select("timezone")
        .eq("org_id", client.org_id)
        .maybeSingle();
      const timezone = settings?.timezone || "Australia/Brisbane";

      const dateStr = new Date(booking.start_time).toLocaleDateString("en-AU", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: timezone,
      });
      const timeStr = new Date(booking.start_time).toLocaleTimeString("en-AU", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: timezone,
      });

      // Check for additional unconfirmed bookings
      const { data: nextBooking } = await supabase
        .from("bookings")
        .select("id, start_time")
        .eq("client_id", client.id)
        .eq("status", "confirmed")
        .eq("client_confirmed", false)
        .not("confirmation_sent_at", "is", null)
        .gte("start_time", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order("start_time", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextBooking) {
        const nextDateStr = new Date(nextBooking.start_time).toLocaleDateString("en-AU", {
          weekday: "short",
          day: "numeric",
          month: "short",
          timeZone: timezone,
        });
        const nextTimeStr = new Date(nextBooking.start_time).toLocaleTimeString("en-AU", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: timezone,
        });
        return twiml(`Confirmed! See you ${dateStr} at ${timeStr}. You also have a session on ${nextDateStr} at ${nextTimeStr}. Reply Y to confirm that one too.`);
      }

      return twiml(`Confirmed! See you ${dateStr} at ${timeStr}.`);
    }

    return twiml("");

  } catch (err) {
    console.error("sms-inbound error:", err);
    return twiml("");
  }
}

function twiml(message: string) {
  const xml = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
