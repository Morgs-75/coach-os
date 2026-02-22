import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.text();
    const params = new URLSearchParams(body);

    const fromPhone = params.get("From");
    const messageBody = params.get("Body")?.trim().toUpperCase();

    console.log("Inbound SMS:", { fromPhone, messageBody });

    if (!fromPhone || !messageBody) {
      return twiml("");
    }

    // Handle Y / YES — confirm the booking
    if (messageBody === "Y" || messageBody === "YES") {
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

      // Find their most recent unconfirmed booking with confirmation requested
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .select("id, start_time")
        .eq("client_id", client.id)
        .eq("status", "confirmed")
        .eq("client_confirmed", false)
        .not("confirmation_sent_at", "is", null)
        .gte("start_time", new Date().toISOString())
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

      const dateStr = new Date(booking.start_time).toLocaleDateString("en-AU", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      const timeStr = new Date(booking.start_time).toLocaleTimeString("en-AU", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      return twiml(`Confirmed! See you ${dateStr} at ${timeStr}.`);
    }

    // Ignore STOP/HELP — Twilio handles these automatically
    return twiml("");

  } catch (err) {
    console.error("sms-inbound error:", err);
    return twiml("");
  }
});

function twiml(message: string): Response {
  const xml = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
