import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // 1. SESSION REMINDERS (24h before)
    // ========================================

    const twoDaysFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

    const { data: upcomingBookings, error: bookingsError } = await supabase
      .from("bookings")
      .select(`
        id, org_id, client_id, start_time, location_details,
        clients(id, full_name, phone),
        orgs(id, name)
      `)
      .eq("status", "confirmed")
      .gte("start_time", now.toISOString())
      .lte("start_time", twoDaysFromNow)
      .eq("reminder_24h_sent", false)
      .order("start_time", { ascending: true });

    if (bookingsError) {
      console.error("Error fetching upcoming bookings:", bookingsError);
    } else if (upcomingBookings && upcomingBookings.length > 0) {
      // Batch fetch sms_settings for all orgs in one query (avoids N+1)
      const orgIds = [...new Set(upcomingBookings.map((b: any) => b.org_id))];
      const { data: settingsRows } = await supabase
        .from("sms_settings")
        .select("*")
        .in("org_id", orgIds);

      const settingsMap = new Map((settingsRows || []).map((s: any) => [s.org_id, s]));

      for (const booking of upcomingBookings as any[]) {
        try {
          const settings = settingsMap.get(booking.org_id);

          if (!settings?.enabled || !settings?.send_session_reminders) {
            continue;
          }

          if (!booking.clients?.phone) {
            console.log(`Skipping booking ${booking.id}: client has no phone`);
            continue;
          }

          const hoursBeforeBooking = settings.reminder_hours_before || 24;
          const reminderTime = new Date(
            new Date(booking.start_time).getTime() - hoursBeforeBooking * 60 * 60 * 1000
          );

          // If reminder time has already passed, mark and skip
          if (reminderTime < now) {
            await supabase
              .from("bookings")
              .update({ reminder_24h_sent: true })
              .eq("id", booking.id);
            continue;
          }

          const sessionDate = new Date(booking.start_time);
          const dateStr = sessionDate.toLocaleDateString("en-AU", {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
          const timeStr = sessionDate.toLocaleTimeString("en-AU", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          });

          const { data: messageId, error: rpcError } = await supabase.rpc("insert_sms_from_service", {
            p_org_id: booking.org_id,
            p_client_id: booking.client_id,
            p_template_key: "session_reminder",
            p_variables: {
              client_name: booking.clients.full_name.split(" ")[0],
              session_datetime: `${dateStr} at ${timeStr}`,
              location: booking.location_details || "TBD",
              coach_name: booking.orgs.name,
            },
            p_scheduled_for: reminderTime.toISOString(),
            p_related_entity_type: "booking",
            p_related_entity_id: booking.id,
            p_idempotency_key: `reminder-24h-${booking.id}`,
          });

          if (rpcError) {
            console.error(`RPC error for booking ${booking.id}:`, rpcError.message);
            continue;
          }

          if (messageId) {
            await supabase
              .from("bookings")
              .update({ reminder_24h_sent: true })
              .eq("id", booking.id);

            remindersCreated++;
            console.log(`Created 24h reminder for booking ${booking.id}`);
          }
        } catch (err) {
          console.error(`Failed to create reminder for booking ${booking.id}:`, err);
        }
      }
    }

    // ========================================
    // 2. FEEDBACK REQUESTS (after completed sessions)
    // ========================================

    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();

    const { data: completedBookings, error: completedError } = await supabase
      .from("bookings")
      .select(`
        id, org_id, client_id, end_time,
        clients(id, full_name, phone),
        orgs(id, name)
      `)
      .eq("status", "completed")
      .gte("end_time", sixHoursAgo)
      .lte("end_time", now.toISOString())
      .eq("feedback_sent", false)
      .order("end_time", { ascending: true });

    if (completedError) {
      console.error("Error fetching completed bookings:", completedError);
    } else if (completedBookings && completedBookings.length > 0) {
      const orgIds = [...new Set(completedBookings.map((b: any) => b.org_id))];
      const { data: settingsRows } = await supabase
        .from("sms_settings")
        .select("*")
        .in("org_id", orgIds);

      const settingsMap = new Map((settingsRows || []).map((s: any) => [s.org_id, s]));

      for (const booking of completedBookings as any[]) {
        try {
          const settings = settingsMap.get(booking.org_id);

          if (!settings?.enabled || !settings?.send_feedback_requests) {
            continue;
          }

          if (!booking.clients?.phone) {
            continue;
          }

          const hoursAfterBooking = settings.feedback_hours_after || 2;
          const feedbackTime = new Date(
            new Date(booking.end_time).getTime() + hoursAfterBooking * 60 * 60 * 1000
          );

          // Not yet time to send
          if (feedbackTime > now) {
            continue;
          }

          const webappUrl = Deno.env.get("WEBAPP_URL") || "https://coachOS.netlify.app";

          const { data: messageId, error: rpcError } = await supabase.rpc("insert_sms_from_service", {
            p_org_id: booking.org_id,
            p_client_id: booking.client_id,
            p_template_key: "feedback_request",
            p_variables: {
              client_name: booking.clients.full_name.split(" ")[0],
              coach_name: booking.orgs.name,
              feedback_link: `${webappUrl}/feedback/${booking.id}`,
            },
            p_scheduled_for: now.toISOString(),
            p_related_entity_type: "booking",
            p_related_entity_id: booking.id,
            p_idempotency_key: `feedback-${booking.id}`,
          });

          if (rpcError) {
            console.error(`RPC error for booking ${booking.id}:`, rpcError.message);
            continue;
          }

          if (messageId) {
            await supabase
              .from("bookings")
              .update({ feedback_sent: true })
              .eq("id", booking.id);

            feedbackRequestsCreated++;
            console.log(`Created feedback request for booking ${booking.id}`);
          }
        } catch (err) {
          console.error(`Failed to create feedback request for booking ${booking.id}:`, err);
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
