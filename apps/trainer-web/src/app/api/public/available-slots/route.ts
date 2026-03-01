import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateTimeSlots, scoreSlots, getTimezoneDay, toUTCFromLocal } from "@/lib/booking/slot-generator";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/available-slots?slug=<org-slug>&date=YYYY-MM-DD&offer_id=<uuid>
 * Returns { slots: ScoredSlot[], durationMins: number }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const date = searchParams.get("date");
  const offerId = searchParams.get("offer_id");

  if (!slug || !date) {
    return NextResponse.json({ error: "Missing slug or date" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Resolve org by slug
  const { data: orgsData } = await supabase
    .from("orgs")
    .select("id, name")
    .ilike("name", slug.replace(/-/g, " "));

  let org = orgsData?.find(o => o.name.toLowerCase().replace(/\s+/g, "-") === slug.toLowerCase());
  if (!org && orgsData?.length) org = orgsData[0];
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  // Booking settings
  const { data: settings } = await supabase
    .from("booking_settings")
    .select("slot_duration_mins, buffer_between_mins, min_notice_hours, max_advance_days, timezone, allow_client_booking")
    .eq("org_id", org.id)
    .single();

  if (settings && !settings.allow_client_booking) {
    return NextResponse.json({ error: "Online booking is not currently enabled." }, { status: 403 });
  }

  const slotDurationMins = settings?.slot_duration_mins ?? 60;
  const bufferMins = settings?.buffer_between_mins ?? 0;
  const minNoticeHours = settings?.min_notice_hours ?? 24;
  const maxAdvanceDays = settings?.max_advance_days ?? 30;
  const timezone = settings?.timezone ?? "Australia/Brisbane";

  // Get offer duration
  let effectiveDurationMins = slotDurationMins;
  if (offerId) {
    const { data: offer } = await supabase
      .from("offers")
      .select("session_duration_mins")
      .eq("id", offerId)
      .single();
    if (offer?.session_duration_mins) {
      effectiveDurationMins = offer.session_duration_mins;
    }
  }

  // Day of week in coach timezone
  const midday = new Date(`${date}T12:00:00Z`);
  const dayStr = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(midday);
  const dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(dayStr);

  // Fetch availability, bookings, blocked times in parallel
  const { start: dateStart, end: dateEnd } = getTimezoneDay(date, timezone);

  const [{ data: availabilityRows }, { data: existingBookings }, { data: allBlockedTimes }] = await Promise.all([
    supabase.from("availability").select("day_of_week, start_time, end_time")
      .eq("org_id", org.id).eq("day_of_week", dayOfWeek).eq("is_available", true),
    supabase.from("bookings").select("start_time, end_time")
      .eq("org_id", org.id).neq("status", "cancelled")
      .gte("start_time", dateStart).lte("start_time", dateEnd),
    supabase.from("blocked_times").select("date, day_of_week, start_time, end_time")
      .eq("org_id", org.id),
  ]);

  if (!availabilityRows?.length) {
    return NextResponse.json({ slots: [], durationMins: effectiveDurationMins });
  }

  // Filter blocks for this date
  const applicableBlocks = (allBlockedTimes ?? []).filter((bt: any) =>
    (bt.date && bt.date === date) || (bt.day_of_week !== null && bt.day_of_week === dayOfWeek)
  );

  const blocksAsBookings = applicableBlocks.map((bt: any) => ({
    start_time: toUTCFromLocal(bt.date ?? date, bt.start_time, timezone),
    end_time: toUTCFromLocal(bt.date ?? date, bt.end_time, timezone),
    no_buffer: true,
  }));

  const bookings = [...(existingBookings ?? []), ...blocksAsBookings];

  const bookingSettings = {
    min_notice_hours: minNoticeHours,
    max_advance_days: maxAdvanceDays,
    slot_duration_mins: effectiveDurationMins,
    buffer_between_mins: bufferMins,
  };

  const slots = generateTimeSlots(
    date, effectiveDurationMins, availabilityRows, bookingSettings,
    bookings, bufferMins, 15, timezone
  );

  // Score using only real bookings (not blocks)
  const scoredSlots = scoreSlots(slots, effectiveDurationMins, existingBookings ?? [], bufferMins);

  return NextResponse.json({ slots: scoredSlots, durationMins: effectiveDurationMins }, {
    headers: { "Cache-Control": "no-store" },
  });
}
