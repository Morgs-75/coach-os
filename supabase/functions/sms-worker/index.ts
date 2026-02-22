import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BATCH_SIZE = 10;
const VISIBILITY_TIMEOUT_SECONDS = 300; // 5 minutes
const MAX_RETRIES = 4;
const BASE_RETRY_DELAY_SECONDS = 60;

serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // First, transition pending → queued
    await supabase.rpc("queue_pending_sms");

    // Dequeue messages with SKIP LOCKED
    const lockUntil = new Date(Date.now() + VISIBILITY_TIMEOUT_SECONDS * 1000).toISOString();
    const now = new Date().toISOString();

    const { data: messages, error: dequeueError } = await supabase
      .from("sms_messages")
      .select("*")
      .eq("status", "queued")
      .lte("scheduled_for", now)
      .or(`locked_until.is.null,locked_until.lt.${now}`)
      .limit(BATCH_SIZE);

    if (dequeueError) throw dequeueError;
    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
    }

    // Lock messages
    const messageIds = messages.map((m: any) => m.id);
    await supabase
      .from("sms_messages")
      .update({ status: "sending", locked_until: lockUntil })
      .in("id", messageIds);

    // Batch fetch sms_settings for all orgs in this batch
    const orgIds = [...new Set(messages.map((m: any) => m.org_id))];
    const { data: settingsRows } = await supabase
      .from("sms_settings")
      .select("*")
      .in("org_id", orgIds);
    const settingsMap = new Map((settingsRows || []).map((s: any) => [s.org_id, s]));

    let processed = 0;
    for (const message of messages) {
      const settings = settingsMap.get(message.org_id);
      await processSmsMessage(supabase, { ...message, sms_settings: settings });
      processed++;
    }

    return new Response(JSON.stringify({ processed }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("SMS worker error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

async function processSmsMessage(supabase: any, message: any) {
  try {
    // Check quiet hours
    const settings = message.sms_settings;
    if (!message.metadata?.quiet_hours_override && settings) {
      const now = new Date();
      const hour = now.getHours(); // TODO: Convert to org timezone

      if (
        settings.quiet_hours_start < settings.quiet_hours_end &&
        (hour >= settings.quiet_hours_start || hour < settings.quiet_hours_end)
      ) {
        // Reschedule to quiet_hours_end
        const nextSend = new Date(now);
        nextSend.setHours(settings.quiet_hours_end, 0, 0, 0);
        if (nextSend <= now) nextSend.setDate(nextSend.getDate() + 1);

        await supabase
          .from("sms_messages")
          .update({
            status: "queued",
            scheduled_for: nextSend.toISOString(),
            locked_until: null
          })
          .eq("id", message.id);

        return;
      }
    }

    // Count previous attempts
    const { count: attemptCount } = await supabase
      .from("sms_attempts")
      .select("id", { count: "exact", head: true })
      .eq("message_id", message.id);

    const attemptNumber = (attemptCount || 0) + 1;

    if (attemptNumber > MAX_RETRIES) {
      await supabase
        .from("sms_messages")
        .update({
          status: "failed",
          failed_at: new Date().toISOString(),
          error_message: `Max retries (${MAX_RETRIES}) exceeded`,
          locked_until: null
        })
        .eq("id", message.id);
      return;
    }

    // Get Twilio credentials
    const twilioAccountSid = settings.twilio_account_sid || Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = settings.twilio_auth_token_encrypted || Deno.env.get("TWILIO_AUTH_TOKEN");

    if (!twilioAccountSid || !twilioAuthToken) {
      throw new Error("Missing Twilio credentials");
    }

    // Send via Twilio
    const requestPayload = {
      To: message.to_phone,
      From: message.from_phone,
      Body: message.body,
      StatusCallback: `${Deno.env.get("SUPABASE_URL")}/functions/v1/twilio-webhook`,
    };

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(requestPayload as any),
      }
    );

    const responsePayload = await response.json();

    // Record attempt
    const attemptStatus = response.ok ?
      "success" :
      (response.status >= 500 || response.status === 429 ? "transient_error" : "permanent_error");

    await supabase.from("sms_attempts").insert({
      message_id: message.id,
      attempt_number: attemptNumber,
      provider: "twilio",
      provider_message_id: responsePayload.sid,
      request_payload: requestPayload,
      response_payload: responsePayload,
      response_status: response.status,
      status: attemptStatus,
      error_code: responsePayload.error_code || responsePayload.code,
      error_message: responsePayload.error_message || responsePayload.message,
    });

    if (response.ok) {
      // Success
      await supabase
        .from("sms_messages")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          locked_until: null
        })
        .eq("id", message.id);
    } else if (attemptStatus === "permanent_error") {
      // Permanent failure
      await supabase
        .from("sms_messages")
        .update({
          status: "failed",
          failed_at: new Date().toISOString(),
          error_code: responsePayload.code,
          error_message: responsePayload.message,
          locked_until: null
        })
        .eq("id", message.id);

      // Add to suppression if needed
      const permanentErrorCodes = [21211, 21610, 21614];
      if (permanentErrorCodes.includes(responsePayload.code)) {
        await supabase.from("sms_suppression").insert({
          org_id: message.org_id,
          phone: message.to_phone,
          client_id: message.client_id,
          reason: responsePayload.code === 21610 ? "opt_out" : "invalid_number",
          source: "api_error",
          notes: `Twilio error: ${responsePayload.message}`,
        }).onConflict("org_id, phone").ignore();
      }
    } else {
      // Transient error - schedule retry with exponential backoff
      const delaySeconds = Math.min(
        BASE_RETRY_DELAY_SECONDS * Math.pow(2, attemptNumber - 1),
        3600
      );
      const jitter = Math.random() * 30; // 0-30s jitter
      const retryAt = new Date(Date.now() + (delaySeconds + jitter) * 1000);

      await supabase
        .from("sms_messages")
        .update({
          status: "queued",
          scheduled_for: retryAt.toISOString(),
          locked_until: null
        })
        .eq("id", message.id);
    }
  } catch (err) {
    console.error(`Failed to process message ${message.id}:`, err);

    // Reschedule with backoff
    const retryAt = new Date(Date.now() + 300 * 1000); // 5min
    await supabase
      .from("sms_messages")
      .update({
        status: "queued",
        scheduled_for: retryAt.toISOString(),
        error_message: String(err),
        locked_until: null
      })
      .eq("id", message.id);
  }
}
