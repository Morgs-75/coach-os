/**
 * Netlify Scheduled Function — runs every 10 minutes.
 * 1. Calls cron-sms-reminders: scans upcoming/completed bookings and queues SMS messages.
 * 2. Calls sms-worker: drains the queue and sends via Twilio.
 */

export default async function () {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("[cron-sms] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return;
  }

  const headers = {
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  // Step 1: Queue reminders for upcoming sessions
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/cron-sms-reminders`, {
      method: "POST",
      headers,
    });
    const body = await res.text();
    console.log(`[cron-sms] cron-sms-reminders → ${res.status}: ${body}`);
  } catch (err) {
    console.error("[cron-sms] cron-sms-reminders failed:", err);
  }

  // Step 2: Send queued messages (run twice to catch any that just became due)
  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/sms-worker`, {
        method: "POST",
        headers,
      });
      const body = await res.text();
      console.log(`[cron-sms] sms-worker[${i}] → ${res.status}: ${body}`);
    } catch (err) {
      console.error(`[cron-sms] sms-worker[${i}] failed:`, err);
    }
  }
}

export const config = {
  schedule: "*/10 * * * *",
};
