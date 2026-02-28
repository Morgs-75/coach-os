import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateTimeSlots, toUTCFromLocal } from "@/lib/booking/slot-generator";

export const dynamic = "force-dynamic";

/**
 * GET /api/portal/available-dates?token=<uuid>
 * Returns { dates: string[], timezone: string }
 * Each date is YYYY-MM-DD in the coach's timezone.
 * Only dates with at least one bookable slot (after filtering blocked times) are returned.
 */
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const supabase = createServiceClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, org_id")
    .eq("portal_token", token)
    .single();
  if (!client) return NextResponse.json({ error: "Invalid token" }, { status: 404 });

  const { data: settings } = await supabase
    .from("booking_settings")
    .select("slot_duration_mins, buffer_between_mins, min_notice_hours, max_advance_days, timezone, allow_client_booking")
    .eq("org_id", client.org_id)
    .single();

  if (settings && !settings.allow_client_booking) {
    return NextResponse.json({ error: "Online self-booking is not currently enabled." }, { status: 403 });
  }

  const slotDurationMins = settings?.slot_duration_mins ?? 60;
  const bufferMins = settings?.buffer_between_mins ?? 0;
  const minNoticeHours = settings?.min_notice_hours ?? 24;
  const maxAdvanceDays = settings?.max_advance_days ?? 30;
  const timezone = settings?.timezone ?? "Australia/Brisbane";

  // Fetch purchased duration
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

  // Fetch availability, bookings, and blocked times
  const [{ data: availability }, { data: allBookings }, { data: allBlockedTimes }] = await Promise.all([
    supabase.from("availability").select("day_of_week, start_time, end_time")
      .eq("org_id", client.org_id).eq("is_available", true),
    supabase.from("bookings").select("start_time, end_time")
      .eq("org_id", client.org_id).neq("status", "cancelled")
      .gte("start_time", new Date().toISOString()),
    supabase.from("blocked_times").select("date, day_of_week, start_time, end_time")
      .eq("org_id", client.org_id),
  ]);

  const availRows = availability ?? [];
  const bookings = allBookings ?? [];
  const blocks = allBlockedTimes ?? [];

  const now = new Date();
  const dates: string[] = [];

  for (let i = 0; i < maxAdvanceDays; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);

    // Get date string and day_of_week in coach timezone
    const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(d);
    const dayStr = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(d);
    const dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(dayStr);

    // Check if any availability exists for this day
    const dayAvail = availRows.filter(a => a.day_of_week === dayOfWeek);
    if (dayAvail.length === 0) continue;

    // Get applicable blocks for this date
    const applicableBlocks = blocks.filter((bt: any) =>
      (bt.date && bt.date === dateStr) || (bt.day_of_week !== null && bt.day_of_week === dayOfWeek)
    );

    // Convert blocks to booking-shaped objects
    const blocksAsBookings = applicableBlocks.map((bt: any) => ({
      start_time: toUTCFromLocal(bt.date ?? dateStr, bt.start_time, timezone),
      end_time: toUTCFromLocal(bt.date ?? dateStr, bt.end_time, timezone),
      no_buffer: true,
    }));

    // Get bookings for this date
    const dayStart = toUTCFromLocal(dateStr, "00:00", timezone);
    const dayEndMs = new Date(dayStart).getTime() + 24 * 60 * 60 * 1000;
    const dayBookings = bookings.filter(b => {
      const t = new Date(b.start_time).getTime();
      return t >= new Date(dayStart).getTime() && t < dayEndMs;
    });

    const allConflicts = [...dayBookings, ...blocksAsBookings];

    // Generate slots
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
