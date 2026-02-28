import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateTimeSlots, scoreSlots, getTimezoneDay, toUTCFromLocal } from "@/lib/booking/slot-generator";

export const dynamic = "force-dynamic";

/**
 * GET /api/portal/available-slots?token=<uuid>&date=YYYY-MM-DD
 * Returns { slots: ScoredSlot[], durationMins: number }
 * Slots have shape { start, end, score, recommended }.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const date = searchParams.get("date"); // YYYY-MM-DD
  const durationParam = searchParams.get("duration");

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

  // 2. Fetch booking settings (including timezone)
  const { data: settings } = await supabase
    .from("booking_settings")
    .select("slot_duration_mins, buffer_between_mins, min_notice_hours, max_advance_days, timezone")
    .eq("org_id", client.org_id)
    .single();

  const slotDurationMins = settings?.slot_duration_mins ?? 60;
  const bufferMins = settings?.buffer_between_mins ?? 0;
  const minNoticeHours = settings?.min_notice_hours ?? 24;
  const maxAdvanceDays = settings?.max_advance_days ?? 30;
  const timezone = settings?.timezone ?? "Australia/Brisbane";

  // 3. Fetch active purchases to determine session duration
  const { data: purchases } = await supabase
    .from("client_purchases")
    .select("session_duration_mins, expires_at, offer_id(session_duration_mins)")
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

  const effectiveDurationMins = durationParam ? parseInt(durationParam, 10) : (purchasedDuration ?? slotDurationMins);

  // 4. Get day_of_week in the coach's timezone (not UTC)
  const midday = new Date(`${date}T12:00:00Z`);
  const dayStr = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(midday);
  const dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(dayStr);

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

  // 6. Fetch existing bookings for this date (coach-timezone midnight-to-midnight)
  const { start: dateStart, end: dateEnd } = getTimezoneDay(date, timezone);

  const { data: existingBookings } = await supabase
    .from("bookings")
    .select("start_time, end_time")
    .eq("org_id", client.org_id)
    .neq("status", "cancelled")
    .gte("start_time", dateStart)
    .lte("start_time", dateEnd);

  // 6b. Fetch ALL blocked times for this org, filter in JS for reliability
  const { data: allBlockedTimes } = await supabase
    .from("blocked_times")
    .select("date, day_of_week, start_time, end_time")
    .eq("org_id", client.org_id);

  // Filter to blocks that apply to this date (specific date match OR recurring day match)
  const applicableBlocks = (allBlockedTimes ?? []).filter((bt: any) =>
    (bt.date && bt.date === date) || (bt.day_of_week !== null && bt.day_of_week === dayOfWeek)
  );

  // Convert blocked times to booking-shaped objects for the slot generator
  const blocksAsBookings = applicableBlocks.map((bt: any) => {
    const blockDate = bt.date ?? date;
    return {
      start_time: toUTCFromLocal(blockDate, bt.start_time, timezone),
      end_time: toUTCFromLocal(blockDate, bt.end_time, timezone),
      no_buffer: true,
    };
  });

  const bookings = [...(existingBookings ?? []), ...blocksAsBookings];

  // Build BookingSettings shape for generateTimeSlots
  const bookingSettings = {
    min_notice_hours: minNoticeHours,
    max_advance_days: maxAdvanceDays,
    slot_duration_mins: effectiveDurationMins,
    buffer_between_mins: bufferMins,
  };

  // 7. Generate slots using timezone-aware slot-generator
  const slots = generateTimeSlots(
    date,
    effectiveDurationMins,
    availabilityRows,
    bookingSettings,
    bookings,
    bufferMins,
    15,
    timezone
  );

  // 8. Score slots (use only real bookings for scoring, not blocks)
  const scoredSlots = scoreSlots(slots, effectiveDurationMins, existingBookings ?? [], bufferMins);

  return NextResponse.json({ slots: scoredSlots, durationMins: effectiveDurationMins }, {
    headers: { "Cache-Control": "no-store" },
  });
}
