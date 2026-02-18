import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.208.0/crypto/crypto.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Verify Twilio signature
    const signature = req.headers.get("X-Twilio-Signature");
    const url = req.url;
    const body = await req.text();
    const params = new URLSearchParams(body);

    if (!verifyTwilioSignature(signature, url, params, twilioAuthToken)) {
      return new Response("Invalid signature", { status: 403 });
    }

    const messageSid = params.get("MessageSid");
    const messageStatus = params.get("MessageStatus"); // queued, sent, delivered, undelivered, failed
    const errorCode = params.get("ErrorCode");

    if (!messageSid) {
      return new Response("Missing MessageSid", { status: 400 });
    }

    // Create dedupe key
    const dedupeKey = await sha256(`${messageSid}-${messageStatus}-${new Date().toISOString().slice(0, 16)}`);

    // Check if event already processed
    const { data: existingEvent } = await supabase
      .from("sms_events")
      .select("id")
      .eq("dedupe_key", dedupeKey)
      .single();

    if (existingEvent) {
      return new Response("OK", { status: 200 }); // Already processed
    }

    // Find message by provider_message_id
    const { data: attempt } = await supabase
      .from("sms_attempts")
      .select("message_id")
      .eq("provider_message_id", messageSid)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    let messageId: string | null = null;
    let orgId: string | null = null;

    if (attempt) {
      messageId = attempt.message_id;

      // Get org_id for RLS
      const { data: message } = await supabase
        .from("sms_messages")
        .select("org_id")
        .eq("id", messageId)
        .single();

      orgId = message?.org_id || null;
    }

    // Store event
    const eventPayload = Object.fromEntries(params.entries());
    await supabase.from("sms_events").insert({
      message_id: messageId,
      org_id: orgId,
      provider: "twilio",
      provider_message_id: messageSid,
      event_type: messageStatus,
      event_status: messageStatus,
      error_code: errorCode,
      event_payload: eventPayload,
      dedupe_key: dedupeKey,
      processed_at: new Date().toISOString(),
    });

    // Update message status
    if (messageId) {
      const updates: any = { updated_at: new Date().toISOString() };

      if (messageStatus === "delivered") {
        updates.status = "delivered";
        updates.delivered_at = new Date().toISOString();
      } else if (messageStatus === "failed" || messageStatus === "undelivered") {
        updates.status = "failed";
        updates.failed_at = new Date().toISOString();
        updates.error_code = errorCode;
        updates.error_message = params.get("ErrorMessage");

        // Add to suppression if permanent error
        const permanentErrorCodes = ["21211", "21610", "21614"]; // invalid number, unsubscribed, blacklisted
        if (errorCode && permanentErrorCodes.includes(errorCode)) {
          const { data: message } = await supabase
            .from("sms_messages")
            .select("org_id, to_phone, client_id")
            .eq("id", messageId)
            .single();

          if (message) {
            await supabase.from("sms_suppression").insert({
              org_id: message.org_id,
              phone: message.to_phone,
              client_id: message.client_id,
              reason: errorCode === "21610" ? "opt_out" : "invalid_number",
              source: "webhook",
              notes: `Twilio error code: ${errorCode}`,
            }).onConflict("org_id, phone").ignore();
          }
        }
      } else if (messageStatus === "sent") {
        // Only update if current status is 'sending'
        const { data: currentMessage } = await supabase
          .from("sms_messages")
          .select("status")
          .eq("id", messageId)
          .single();

        if (currentMessage?.status === "sending") {
          updates.status = "sent";
          updates.sent_at = new Date().toISOString();
        }
      }

      await supabase.from("sms_messages").update(updates).eq("id", messageId);
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Twilio webhook error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

function verifyTwilioSignature(
  signature: string | null,
  url: string,
  params: URLSearchParams,
  authToken: string
): boolean {
  if (!signature) return false;

  // Construct data string: URL + sorted params
  let data = url;
  const sortedKeys = Array.from(params.keys()).sort();
  for (const key of sortedKeys) {
    data += key + params.get(key);
  }

  // Compute HMAC-SHA256
  const hmac = createHmac("sha256", authToken);
  hmac.update(data);
  const computedSignature = btoa(String.fromCharCode(...hmac.digest()));

  return computedSignature === signature;
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
