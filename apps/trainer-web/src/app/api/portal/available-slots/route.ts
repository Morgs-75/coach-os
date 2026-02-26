import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateTimeSlots, scoreSlots } from "@/lib/booking/slot-generator";

/**
 * GET /api/portal/available-slots?token=<uuid>&date=YYYY-MM-DD
 * Returns { slots: ScoredSlot[], durationMins: number }
 * Slots have shape { start, end, score, recommended }.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const date = searchParams.get("date"); // YYYY-MM-DD

  if (!token || !date) {
    return NextResponse.json({ error: "Missing token or date" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 1. Validate token
  const { data: client } = await supabase
    .from("clients")
    .select("id, org_id")
    .eq("portal_token", token)
    .single();

  if (!client) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }

  // 2. Fetch booking settings
  const { data: settings } = await supabase
    .from("booking_settings")
    .select("slot_duration_mins, buffer_between_mins, min_notice_hours, max_advance_days")
    .eq("org_id", client.org_id)
    .single();

  const slotDurationMins = settings?.slot_duration_mins ?? 60;
  const bufferMins = settings?.buffer_between_mins ?? 15;
  const minNoticeHours = settings?.min_notice_hours ?? 24;
  const maxAdvanceDays = settings?.max_advance_days ?? 30;

  // 3. Fetch active purchases to determine session duration
  const { data: purchases } = await supabase
    .from("client_purchases")
    .select("session_duration_mins, offer_id(session_duration_mins)")
    .eq("client_id", client.id)
    .eq("payment_status", "succeeded")
    .gt("sessions_remaining", 0);

  const activePurchases = (purchases ?? []).filter(
    (p: any) => !p.expires_at || new Date(p.expires_at) >= new Date()
  );

  const purchasedDuration: number | null =
    (activePurchases[0] as any)?.session_duration_mins ??
    ((activePurchases[0] as any)?.offer_id as any)?.session_duration_mins ??
    null;

  const effectiveDurationMins = purchasedDuration ?? slotDurationMins;

  // 4. Parse date and get day_of_week
  const dateObj = new Date(date + "T00:00:00");
  const dayOfWeek = dateObj.getDay();

  // 5. Fetch availability for this day
  const { data: availabilityRows } = await supabase
    .from("availability")
    .select("day_of_week, start_time, end_time")
    .eq("org_id", client.org_id)
    .eq("day_of_week", dayOfWeek)
    .eq("is_available", true);

  if (!availabilityRows?.length) {
    return NextResponse.json({ slots: [], durationMins: effectiveDurationMins });
  }

  // 6. Fetch existing bookings for this date
  const dateStart = new Date(`${date}T00:00:00`).toISOString();
  const dateEnd = new Date(`${date}T23:59:59`).toISOString();

  const { data: existingBookings } = await supabase
    .from("bookings")
    .select("start_time, end_time")
    .eq("org_id", client.org_id)
    .neq("status", "cancelled")
    .gte("start_time", dateStart)
    .lte("start_time", dateEnd);

  const bookings = existingBookings ?? [];

  // Build BookingSettings shape for generateTimeSlots
  const bookingSettings = {
    min_notice_hours: minNoticeHours,
    max_advance_days: maxAdvanceDays,
    slot_duration_mins: effectiveDurationMins,
    buffer_between_mins: bufferMins,
  };

  // 7. Generate slots using existing slot-generator
  const slots = generateTimeSlots(
    dateObj,
    effectiveDurationMins,
    availabilityRows,
    bookingSettings,
    bookings,
    bufferMins,
    15
  );

  // 8. Score slots
  const scoredSlots = scoreSlots(slots, effectiveDurationMins, bookings, bufferMins);

  return NextResponse.json({ slots: scoredSlots, durationMins: effectiveDurationMins });
}
