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

    // ========================================
    // 1. SESSION REMINDERS (for upcoming bookings)
    // ========================================

    // Get bookings in the next 48 hours that need reminders
    const twoDaysFromNow = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const { data: upcomingBookings, error: bookingsError } = await supabase
      .from("bookings")
      .select(`
        *,
        clients(id, full_name, phone),
        orgs(id, name),
        sms_settings(
          enabled,
          send_session_reminders,
          reminder_hours_before,
          timezone
        )
      `)
      .eq("status", "confirmed")
      .gte("start_time", now)
      .lte("start_time", twoDaysFromNow)
      .is("reminder_sent", false) // Assumes you have this column on bookings table
      .order("start_time", { ascending: true });

    if (bookingsError) {
      console.error("Error fetching bookings:", bookingsError);
    } else if (upcomingBookings) {
      for (const booking of upcomingBookings) {
        try {
          // Check if SMS is enabled and reminders are turned on
          if (!booking.sms_settings?.enabled || !booking.sms_settings?.send_session_reminders) {
            continue;
          }

          if (!booking.clients?.phone) {
            console.log(`Skipping booking ${booking.id}: client has no phone`);
            continue;
          }

          // Calculate reminder time (default 24 hours before)
          const hoursBeforeBooking = booking.sms_settings.reminder_hours_before || 24;
          const reminderTime = new Date(
            new Date(booking.start_time).getTime() - hoursBeforeBooking * 60 * 60 * 1000
          );

          // Only schedule if reminder time is in the future
          if (reminderTime < new Date()) {
            console.log(`Skipping booking ${booking.id}: reminder time already passed`);
            // Still mark as sent to avoid repeated checks
            await supabase
              .from("bookings")
              .update({ reminder_sent: true })
              .eq("id", booking.id);
            continue;
          }

          // Format session datetime
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

          // Enqueue reminder SMS
          const messageId = await supabase.rpc("insert_sms_from_service", {
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
            p_idempotency_key: `reminder-${booking.id}`,
          });

          if (messageId.data) {
            // Mark reminder as sent
            await supabase
              .from("bookings")
              .update({ reminder_sent: true })
              .eq("id", booking.id);

            remindersCreated++;
            console.log(`Created reminder for booking ${booking.id} (message ${messageId.data})`);
          }
        } catch (bookingErr) {
          console.error(`Failed to create reminder for booking ${booking.id}:`, bookingErr);
        }
      }
    }

    // ========================================
    // 2. FEEDBACK REQUESTS (for completed sessions)
    // ========================================

    // Get bookings completed in the last 6 hours that need feedback requests
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

    const { data: completedBookings, error: completedError } = await supabase
      .from("bookings")
      .select(`
        *,
        clients(id, full_name, phone),
        orgs(id, name),
        sms_settings(
          enabled,
          send_feedback_requests,
          feedback_hours_after,
          timezone
        )
      `)
      .eq("status", "completed")
      .gte("end_time", sixHoursAgo)
      .lte("end_time", now)
      .is("feedback_sent", false) // Assumes you have this column on bookings table
      .order("end_time", { ascending: true });

    if (completedError) {
      console.error("Error fetching completed bookings:", completedError);
    } else if (completedBookings) {
      for (const booking of completedBookings) {
        try {
          // Check if SMS is enabled and feedback requests are turned on
          if (!booking.sms_settings?.enabled || !booking.sms_settings?.send_feedback_requests) {
            continue;
          }

          if (!booking.clients?.phone) {
            console.log(`Skipping booking ${booking.id}: client has no phone`);
            continue;
          }

          // Calculate feedback request time (default 2 hours after)
          const hoursAfterBooking = booking.sms_settings.feedback_hours_after || 2;
          const feedbackTime = new Date(
            new Date(booking.end_time).getTime() + hoursAfterBooking * 60 * 60 * 1000
          );

          // Check if it's time to send (should be past the scheduled time)
          if (feedbackTime > new Date()) {
            console.log(`Skipping booking ${booking.id}: feedback time not yet reached`);
            continue;
          }

          // Enqueue feedback request SMS
          const messageId = await supabase.rpc("insert_sms_from_service", {
            p_org_id: booking.org_id,
            p_client_id: booking.client_id,
            p_template_key: "feedback_request",
            p_variables: {
              client_name: booking.clients.full_name.split(" ")[0],
              coach_name: booking.orgs.name,
              feedback_link: `${Deno.env.get("WEBAPP_URL") || "https://yourapp.com"}/feedback/${booking.id}`,
            },
            p_scheduled_for: new Date().toISOString(), // Send immediately
            p_related_entity_type: "booking",
            p_related_entity_id: booking.id,
            p_idempotency_key: `feedback-${booking.id}`,
          });

          if (messageId.data) {
            // Mark feedback as sent
            await supabase
              .from("bookings")
              .update({ feedback_sent: true })
              .eq("id", booking.id);

            feedbackRequestsCreated++;
            console.log(`Created feedback request for booking ${booking.id} (message ${messageId.data})`);
          }
        } catch (bookingErr) {
          console.error(`Failed to create feedback request for booking ${booking.id}:`, bookingErr);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        remindersCreated,
        feedbackRequestsCreated,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Cron SMS reminders error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
