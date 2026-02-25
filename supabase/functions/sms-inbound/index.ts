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

    // DISABLED: This edge function is not registered as the Twilio inbound webhook.
    // The active inbound handler is the Netlify route at /api/sms-inbound.
    // Keeping this file to preserve the function deployment, but confirmation logic
    // is disabled to prevent divergent confirmation if this URL is ever mistakenly used.
    if (messageBody === "Y" || messageBody === "YES") {
      console.log("sms-inbound edge function: Y reply received but handler is disabled — Twilio should point to /api/sms-inbound");
      return twiml("");
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
