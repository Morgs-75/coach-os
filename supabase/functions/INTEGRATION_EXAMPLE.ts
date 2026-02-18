/**
 * INTEGRATION EXAMPLE
 *
 * This file shows how to integrate SMS notifications into your booking flow.
 * Copy the relevant code snippets into your actual booking handler.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// Example 1: Send Booking Confirmation
// ============================================
// Place this code AFTER creating a booking in your app

async function sendBookingConfirmation(
  booking: any,
  client: any,
  org: any,
  userToken: string
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/sms-send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: booking.client_id,
        template_key: "booking_confirmation",
        variables: {
          client_name: client.full_name.split(" ")[0], // First name only
          coach_name: org.name,
          session_datetime: formatDateTime(booking.start_time),
          location: booking.location_details || "TBD",
        },
        related_entity_type: "booking",
        related_entity_id: booking.id,
        idempotency_key: `booking-confirmation-${booking.id}`, // Prevents duplicates
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Failed to send booking confirmation:", error);
      // Don't throw - SMS failure shouldn't fail the booking
    } else {
      const result = await response.json();
      console.log("Booking confirmation queued:", result.message.id);
    }
  } catch (err) {
    console.error("Error sending booking confirmation:", err);
    // Don't throw - SMS is optional, booking should still succeed
  }
}

// ============================================
// Example 2: Call from Booking Creation Handler
// ============================================

// In your booking creation Edge Function or API route:
/*
serve(async (req) => {
  const supabase = createClient(...);
  const bookingData = await req.json();

  // Create booking
  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      ...bookingData,
      status: "confirmed",
      reminder_sent: false,  // For cron job
      feedback_sent: false,  // For cron job
    })
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }

  // Get client and org
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", booking.client_id)
    .single();

  const { data: org } = await supabase
    .from("orgs")
    .select("*")
    .eq("id", booking.org_id)
    .single();

  // Send SMS confirmation (non-blocking, won't fail the booking)
  const authHeader = req.headers.get("Authorization")!;
  const token = authHeader.replace("Bearer ", "");

  await sendBookingConfirmation(booking, client, org, token);

  return new Response(JSON.stringify({ booking }), { status: 201 });
});
*/

// ============================================
// Example 3: Database Trigger Alternative
// ============================================
// If you prefer database triggers over application code:

/*
CREATE OR REPLACE FUNCTION public.send_booking_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_client record;
  v_org record;
  v_settings record;
BEGIN
  -- Only for new confirmed bookings
  IF (TG_OP = 'INSERT' AND NEW.status = 'confirmed') OR
     (TG_OP = 'UPDATE' AND OLD.status != 'confirmed' AND NEW.status = 'confirmed') THEN

    -- Get client
    SELECT * INTO v_client FROM public.clients WHERE id = NEW.client_id;

    -- Get org and settings
    SELECT orgs.*, sms_settings.*
    INTO v_org
    FROM public.orgs
    LEFT JOIN public.sms_settings ON sms_settings.org_id = orgs.id
    WHERE orgs.id = NEW.org_id;

    -- Check if SMS is enabled
    IF v_org.enabled AND v_org.send_booking_confirmations THEN
      -- Enqueue confirmation SMS
      PERFORM public.insert_sms_from_service(
        p_org_id := NEW.org_id,
        p_client_id := NEW.client_id,
        p_template_key := 'booking_confirmation',
        p_variables := jsonb_build_object(
          'client_name', split_part(v_client.full_name, ' ', 1),
          'coach_name', v_org.name,
          'session_datetime', to_char(NEW.start_time, 'Dy, Mon DD at HH12:MI AM'),
          'location', COALESCE(NEW.location_details, 'TBD')
        ),
        p_scheduled_for := now(),
        p_related_entity_type := 'booking',
        p_related_entity_id := NEW.id,
        p_idempotency_key := 'booking-confirmation-' || NEW.id::text
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER booking_confirmation_trigger
AFTER INSERT OR UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.send_booking_confirmation();
*/

// ============================================
// Example 4: Manual Reminder (outside cron)
// ============================================
// If you want to manually send a reminder from your app:

async function sendManualReminder(
  bookingId: string,
  userToken: string
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, userToken);

  // Get booking with related data
  const { data: booking } = await supabase
    .from("bookings")
    .select(`
      *,
      clients(id, full_name, phone),
      orgs(id, name)
    `)
    .eq("id", bookingId)
    .single();

  if (!booking) {
    throw new Error("Booking not found");
  }

  // Send reminder immediately
  const response = await fetch(`${supabaseUrl}/functions/v1/sms-send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${userToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: booking.client_id,
      template_key: "session_reminder",
      variables: {
        client_name: booking.clients.full_name.split(" ")[0],
        session_datetime: formatDateTime(booking.start_time),
        location: booking.location_details || "TBD",
        coach_name: booking.orgs.name,
      },
      scheduled_for: new Date().toISOString(), // Send now
      related_entity_type: "booking",
      related_entity_id: booking.id,
      idempotency_key: `manual-reminder-${bookingId}-${Date.now()}`,
    }),
  });

  return response.json();
}

// ============================================
// Helper Functions
// ============================================

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const dateStr = date.toLocaleDateString("en-AU", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${dateStr} at ${timeStr}`;
}

// ============================================
// Example 5: Check if Client Can Receive SMS
// ============================================

async function canReceiveSms(
  orgId: string,
  clientId: string,
  supabase: any
): Promise<{ canReceive: boolean; reason?: string }> {
  // Get client phone
  const { data: client } = await supabase
    .from("clients")
    .select("phone")
    .eq("id", clientId)
    .single();

  if (!client?.phone) {
    return { canReceive: false, reason: "No phone number" };
  }

  // Check if valid E.164 format
  if (!client.phone.match(/^\+\d{10,15}$/)) {
    return { canReceive: false, reason: "Invalid phone format" };
  }

  // Check if suppressed
  const { data: suppressed } = await supabase.rpc("is_phone_suppressed", {
    p_org_id: orgId,
    p_phone: client.phone,
  });

  if (suppressed) {
    return { canReceive: false, reason: "Phone opted out" };
  }

  // Check if SMS is enabled for org
  const { data: settings } = await supabase
    .from("sms_settings")
    .select("enabled")
    .eq("org_id", orgId)
    .single();

  if (!settings?.enabled) {
    return { canReceive: false, reason: "SMS not enabled for org" };
  }

  return { canReceive: true };
}

// ============================================
// Example 6: View SMS History for a Client
// ============================================

async function getClientSmsHistory(
  clientId: string,
  limit: number = 50,
  supabase: any
) {
  const { data, error } = await supabase
    .from("sms_messages")
    .select(`
      id,
      template_key,
      body,
      status,
      scheduled_for,
      sent_at,
      delivered_at,
      failed_at,
      error_message,
      created_at
    `)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return data || [];
}
