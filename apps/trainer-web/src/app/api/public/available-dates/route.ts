import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateTimeSlots, toUTCFromLocal } from "@/lib/booking/slot-generator";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/available-dates?slug=<org-slug>&offer_id=<uuid>
 * Returns { dates: string[], timezone: string }
 * Each date is YYYY-MM-DD in the coach's timezone.
 * Only dates with at least one bookable slot are returned.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const offerId = searchParams.get("offer_id");
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const supabase = createServiceClient();

  // Resolve org by slug (name-based matching)
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

  // Get offer duration if offer_id provided
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

  // Fetch availability, bookings, and blocked times in parallel
  const [{ data: availability }, { data: allBookings }, { data: allBlockedTimes }] = await Promise.all([
    supabase.from("availability").select("day_of_week, start_time, end_time")
      .eq("org_id", org.id).eq("is_available", true),
    supabase.from("bookings").select("start_time, end_time")
      .eq("org_id", org.id).neq("status", "cancelled")
      .gte("start_time", new Date().toISOString()),
    supabase.from("blocked_times").select("date, day_of_week, start_time, end_time")
      .eq("org_id", org.id),
  ]);

  const availRows = availability ?? [];
  const bookings = allBookings ?? [];
  const blocks = allBlockedTimes ?? [];

  const now = new Date();
  const dates: string[] = [];

  for (let i = 0; i < maxAdvanceDays; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);

    const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(d);
    const dayStr = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(d);
    const dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(dayStr);

    const dayAvail = availRows.filter(a => a.day_of_week === dayOfWeek);
    if (dayAvail.length === 0) continue;

    // Applicable blocks for this date
    const applicableBlocks = blocks.filter((bt: any) =>
      (bt.date && bt.date === dateStr) || (bt.day_of_week !== null && bt.day_of_week === dayOfWeek)
    );

    const blocksAsBookings = applicableBlocks.map((bt: any) => ({
      start_time: toUTCFromLocal(bt.date ?? dateStr, bt.start_time, timezone),
      end_time: toUTCFromLocal(bt.date ?? dateStr, bt.end_time, timezone),
      no_buffer: true,
    }));

    // Bookings for this date
    const dayStart = toUTCFromLocal(dateStr, "00:00", timezone);
    const dayEndMs = new Date(dayStart).getTime() + 24 * 60 * 60 * 1000;
    const dayBookings = bookings.filter(b => {
      const t = new Date(b.start_time).getTime();
      return t >= new Date(dayStart).getTime() && t < dayEndMs;
    });

    const allConflicts = [...dayBookings, ...blocksAsBookings];

    const bookingSettings = {
      min_notice_hours: minNoticeHours,
      max_advance_days: maxAdvanceDays,
      slot_duration_mins: effectiveDurationMins,
      buffer_between_mins: bufferMins,
    };

    const slots = generateTimeSlots(
      dateStr, effectiveDurationMins, dayAvail, bookingSettings,
      allConflicts, bufferMins, 15, timezone
    );

    if (slots.length > 0) dates.push(dateStr);
  }

  return NextResponse.json({ dates, timezone }, {
    headers: { "Cache-Control": "no-store" },
  });
}
