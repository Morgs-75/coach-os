import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function renderBody(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replaceAll(`{{${k}}}`, v);
  }
  return result;
}

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
    let remindersCreated = 0;
    let feedbackRequestsCreated = 0;
    const now = new Date();

    // ========================================
    // 0. AUTO-COMPLETE PAST SESSIONS
    // ========================================
    await supabase
      .from("bookings")
      .update({ status: "completed" })
      .eq("status", "confirmed")
      .lt("end_time", now.toISOString());

    // ========================================
    // 1. SESSION REMINDERS (pre_session schedules)
    // ========================================

    const twoDaysFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

    const { data: upcomingBookings, error: bookingsError } = await supabase
      .from("bookings")
      .select(`
        id, org_id, client_id, start_time, location_type,
        clients(id, full_name, phone, sms_reminder_enabled),
        orgs(id, name)
      `)
      .eq("status", "confirmed")
      .gte("start_time", now.toISOString())
      .lte("start_time", twoDaysFromNow)
      .order("start_time", { ascending: true });

    if (bookingsError) {
      console.error("Error fetching upcoming bookings:", bookingsError);
    } else if (upcomingBookings && upcomingBookings.length > 0) {
      const orgIds = [...new Set(upcomingBookings.map((b: any) => b.org_id))];

      const { data: settingsRows } = await supabase
        .from("sms_settings")
        .select("org_id, enabled, timezone")
        .in("org_id", orgIds);
      const settingsMap = new Map((settingsRows || []).map((s: any) => [s.org_id, s]));

      const { data: scheduleRows } = await supabase
        .from("sms_schedules")
        .select("id, org_id, mins_offset, body")
        .in("org_id", orgIds)
        .eq("type", "pre_session")
        .eq("enabled", true);
      const preSchedulesByOrg = new Map<string, any[]>();
      for (const s of scheduleRows || []) {
        if (!preSchedulesByOrg.has(s.org_id)) preSchedulesByOrg.set(s.org_id, []);
        preSchedulesByOrg.get(s.org_id)!.push(s);
      }

      for (const booking of upcomingBookings as any[]) {
        try {
          const settings = settingsMap.get(booking.org_id);
          if (!settings?.enabled) continue;
          if (!booking.clients?.phone) continue;
          if (booking.clients?.sms_reminder_enabled === false) continue;

          const orgSchedules = preSchedulesByOrg.get(booking.org_id) || [];
          if (orgSchedules.length === 0) continue;

          const tz = settings.timezone || "Australia/Brisbane";
          const sessionDate = new Date(booking.start_time);
          const dateStr = sessionDate.toLocaleDateString("en-AU", {
            weekday: "short", month: "short", day: "numeric", timeZone: tz,
          });
          const timeStr = sessionDate.toLocaleTimeString("en-AU", {
            hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz,
          });

          for (const schedule of orgSchedules) {
            const reminderTime = new Date(sessionDate.getTime() - schedule.mins_offset * 60 * 1000);
            if (reminderTime <= now) continue; // missed window

            const body = renderBody(schedule.body, {
              client_name: booking.clients.full_name.split(" ")[0],
              session_datetime: `${dateStr} at ${timeStr}`,
              location: booking.location_type || "TBD",
              coach_name: booking.orgs.name,
            });

            const { data: messageId, error: rpcError } = await supabase.rpc("insert_sms_direct", {
              p_org_id: booking.org_id,
              p_client_id: booking.client_id,
              p_body: body,
              p_scheduled_for: reminderTime.toISOString(),
              p_related_entity_type: "booking",
              p_related_entity_id: booking.id,
              p_idempotency_key: `sched-${schedule.id}-${booking.id}`,
            });

            if (rpcError) {
              console.error(`RPC error for booking ${booking.id} schedule ${schedule.id}:`, rpcError.message);
              continue;
            }
            if (messageId) {
              remindersCreated++;
              console.log(`Queued reminder (${schedule.mins_offset}min before) for booking ${booking.id}`);
            }
          }
        } catch (err) {
          console.error(`Failed to process booking ${booking.id}:`, err);
        }
      }
    }

    // ========================================
    // 2. FEEDBACK REQUESTS (post_session schedules)
    // ========================================

    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

    const { data: completedBookings, error: completedError } = await supabase
      .from("bookings")
      .select(`
        id, org_id, client_id, end_time,
        clients(id, full_name, phone, sms_followup_enabled),
        orgs(id, name)
      `)
      .eq("status", "completed")
      .gte("end_time", twoDaysAgo)
      .lte("end_time", now.toISOString())
      .order("end_time", { ascending: true });

    if (completedError) {
      console.error("Error fetching completed bookings:", completedError);
    } else if (completedBookings && completedBookings.length > 0) {
      const orgIds = [...new Set(completedBookings.map((b: any) => b.org_id))];

      const { data: settingsRows } = await supabase
        .from("sms_settings")
        .select("org_id, enabled")
        .in("org_id", orgIds);
      const settingsMap = new Map((settingsRows || []).map((s: any) => [s.org_id, s]));

      const { data: scheduleRows } = await supabase
        .from("sms_schedules")
        .select("id, org_id, mins_offset, body")
        .in("org_id", orgIds)
        .eq("type", "post_session")
        .eq("enabled", true);
      const postSchedulesByOrg = new Map<string, any[]>();
      for (const s of scheduleRows || []) {
        if (!postSchedulesByOrg.has(s.org_id)) postSchedulesByOrg.set(s.org_id, []);
        postSchedulesByOrg.get(s.org_id)!.push(s);
      }

      const webappUrl = Deno.env.get("WEBAPP_URL") || "https://coachOS.netlify.app";

      for (const booking of completedBookings as any[]) {
        try {
          const settings = settingsMap.get(booking.org_id);
          if (!settings?.enabled) continue;
          if (!booking.clients?.phone) continue;
          if (booking.clients?.sms_followup_enabled === false) continue;

          const orgSchedules = postSchedulesByOrg.get(booking.org_id) || [];
          if (orgSchedules.length === 0) continue;

          // Fetch package info for template variables
          const { data: pkgData } = await supabase
            .from("client_purchases")
            .select("sessions_total, sessions_used")
            .eq("client_id", booking.client_id)
            .eq("payment_status", "succeeded")
            .order("purchased_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const { count: upcomingCount } = await supabase
            .from("bookings")
            .select("id", { count: "exact", head: true } as any)
            .eq("client_id", booking.client_id)
            .in("status", ["confirmed", "pending"])
            .gt("start_time", now.toISOString());

          const sessionsRemaining = pkgData
            ? String(pkgData.sessions_total - pkgData.sessions_used)
            : "N/A";
          const sessionsBooked = String(upcomingCount ?? 0);

          for (const schedule of orgSchedules) {
            const feedbackTime = new Date(
              new Date(booking.end_time).getTime() + schedule.mins_offset * 60 * 1000
            );
            if (feedbackTime > now) continue; // not yet time

            const body = renderBody(schedule.body, {
              client_name: booking.clients.full_name.split(" ")[0],
              coach_name: booking.orgs.name,
              feedback_link: `${webappUrl}/feedback/${booking.id}`,
              sessions_remaining: sessionsRemaining,
              sessions_booked: sessionsBooked,
            });

            const { data: messageId, error: rpcError } = await supabase.rpc("insert_sms_direct", {
              p_org_id: booking.org_id,
              p_client_id: booking.client_id,
              p_body: body,
              p_scheduled_for: feedbackTime.toISOString(),
              p_related_entity_type: "booking",
              p_related_entity_id: booking.id,
              p_idempotency_key: `sched-${schedule.id}-${booking.id}`,
            });

            if (rpcError) {
              console.error(`RPC error for booking ${booking.id} schedule ${schedule.id}:`, rpcError.message);
              continue;
            }
            if (messageId) {
              feedbackRequestsCreated++;
              console.log(`Queued follow-up (${schedule.mins_offset}min after) for booking ${booking.id}`);
            }
          }
        } catch (err) {
          console.error(`Failed to process completed booking ${booking.id}:`, err);
        }
      }
    }

    // ========================================
    // 3. UNCONFIRMED SESSION REMINDERS (24h warning)
    // ========================================
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const twentySixHoursFromNow = new Date(now.getTime() + 26 * 60 * 60 * 1000);

    const { data: unconfirmedBookings } = await supabase
      .from("bookings")
      .select(`
        id, org_id, client_id, start_time,
        clients(id, full_name, phone, sms_reminder_enabled),
        orgs(id, name)
      `)
      .eq("status", "confirmed")
      .eq("client_confirmed", false)
      .not("confirmation_sent_at", "is", null)
      .gte("start_time", twentyFourHoursFromNow.toISOString())
      .lte("start_time", twentySixHoursFromNow.toISOString());

    if (unconfirmedBookings && unconfirmedBookings.length > 0) {
      const unconfirmedOrgIds = [...new Set(unconfirmedBookings.map((b: any) => b.org_id))];
      const { data: unconfirmedSettings } = await supabase
        .from("sms_settings")
        .select("org_id, enabled, timezone")
        .in("org_id", unconfirmedOrgIds);
      const unconfirmedSettingsMap = new Map((unconfirmedSettings || []).map((s: any) => [s.org_id, s]));

      for (const booking of unconfirmedBookings as any[]) {
        try {
          const settings = unconfirmedSettingsMap.get(booking.org_id);
          if (!settings?.enabled) continue;
          if (!booking.clients?.phone) continue;
          if (booking.clients?.sms_reminder_enabled === false) continue;

          const tz = settings.timezone || "Australia/Brisbane";
          const sessionDate = new Date(booking.start_time);
          const dateStr = sessionDate.toLocaleDateString("en-AU", {
            weekday: "short", month: "short", day: "numeric", timeZone: tz,
          });
          const timeStr = sessionDate.toLocaleTimeString("en-AU", {
            hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz,
          });

          const body = `Hi ${booking.clients.full_name.split(" ")[0]}, you are booked for ${dateStr} at ${timeStr} but we have not received your confirmation of attendance. Please confirm ASAP as any unconfirmed sessions may be reallocated. Thank you! ${booking.orgs.name}`;

          const { data: messageId, error: rpcError } = await supabase.rpc("insert_sms_direct", {
            p_org_id: booking.org_id,
            p_client_id: booking.client_id,
            p_body: body,
            p_scheduled_for: now.toISOString(),
            p_related_entity_type: "booking",
            p_related_entity_id: booking.id,
            p_idempotency_key: `unconfirmed-24h-${booking.id}`,
          });

          if (rpcError) {
            console.error(`Unconfirmed reminder RPC error for booking ${booking.id}:`, rpcError.message);
            continue;
          }
          if (messageId) {
            console.log(`Queued unconfirmed 24h reminder for booking ${booking.id}`);
          }
        } catch (err) {
          console.error(`Failed to process unconfirmed booking ${booking.id}:`, err);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, remindersCreated, feedbackRequestsCreated }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Cron SMS reminders error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
