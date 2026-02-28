export interface Availability {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface BookingSettings {
  min_notice_hours: number;
  max_advance_days: number;
  slot_duration_mins: number;
  buffer_between_mins: number;
}

export interface ExistingBooking {
  start_time: string;
  end_time: string;
}

/** Convert a local date + time string to a UTC Date using the given timezone.
 *  Returns ISO string when called as toUTCFromLocal, Date when called as toUTCDate. */
export function toUTCFromLocal(dateStr: string, timeStr: string, tz: string): string {
  return toUTCDate(dateStr, timeStr, tz).toISOString();
}

function toUTCDate(dateStr: string, timeStr: string, tz: string): Date {
  const [h, m] = timeStr.split(":").map(Number);
  // Create a date string that Intl can parse in the target timezone
  const local = new Date(`${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
  // Get the UTC offset for this timezone at this date/time
  const utcStr = local.toLocaleString("en-US", { timeZone: "UTC" });
  const tzStr = local.toLocaleString("en-US", { timeZone: tz });
  const diff = new Date(utcStr).getTime() - new Date(tzStr).getTime();
  return new Date(local.getTime() + diff);
}

/** Get the day-of-week (0=Sun..6=Sat) for a Date interpreted in the given timezone. */
function getDayInTimezone(date: Date, tz: string): number {
  const dayStr = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(dayStr);
}

/** Get midnight-to-midnight range in the given timezone, returned as UTC ISO strings. */
export function getTimezoneDay(dateStr: string, tz: string): { start: string; end: string } {
  const dayStart = toUTCDate(dateStr, "00:00", tz);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start: dayStart.toISOString(), end: dayEnd.toISOString() };
}

/** Returns dates that have at least one available time slot, respecting min_notice_hours. */
export function generateAvailableDates(
  availability: Availability[],
  settings: BookingSettings,
  existingBookings: ExistingBooking[],
  durationMins: number,
  bufferMins: number,
  timezone: string = "Australia/Brisbane"
): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  const minTime = new Date(now.getTime() + settings.min_notice_hours * 60 * 60 * 1000);

  for (let i = 0; i < settings.max_advance_days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + i);

    // Format as YYYY-MM-DD in the coach's timezone
    const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date);
    const dayOfWeek = getDayInTimezone(date, timezone);

    if (availability.some(a => a.day_of_week === dayOfWeek)) {
      const slots = generateTimeSlots(
        dateStr,
        durationMins,
        availability,
        settings,
        existingBookings,
        bufferMins,
        15,
        timezone
      );
      if (slots.length > 0) {
        // Store the date as midnight UTC for the coach's date (for display purposes)
        dates.push(toUTCDate(dateStr, "00:00", timezone));
      }
    }
  }

  return dates;
}

/** Returns available slot ISO strings for a given date. */
export function generateTimeSlots(
  selectedDate: string | Date,
  durationMins: number,
  availability: Availability[],
  settings: BookingSettings,
  existingBookings: ExistingBooking[],
  bufferMins: number = settings.buffer_between_mins,
  slotIntervalMins: number = 15,
  timezone: string = "Australia/Brisbane"
): string[] {
  // Normalize selectedDate to a YYYY-MM-DD string
  const dateStr = typeof selectedDate === "string"
    ? selectedDate.slice(0, 10) // handle both "2026-03-02" and "2026-03-02T00:00:00"
    : new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(selectedDate);

  const dayOfWeek = getDayInTimezone(toUTCDate(dateStr, "12:00", timezone), timezone);
  const dayAvailability = availability.filter(a => a.day_of_week === dayOfWeek);

  const now = new Date();
  const minTime = new Date(now.getTime() + settings.min_notice_hours * 60 * 60 * 1000);

  const slots: string[] = [];

  for (const avail of dayAvailability) {
    // Convert availability start/end to UTC dates for this specific date
    let current = toUTCDate(dateStr, avail.start_time, timezone);
    const windowEnd = toUTCDate(dateStr, avail.end_time, timezone);

    while (current.getTime() + durationMins * 60_000 <= windowEnd.getTime()) {
      if (current > minTime) {
        const slotEnd = new Date(current.getTime() + durationMins * 60_000);
        const conflict = existingBookings.some(b => {
          const bs = new Date(b.start_time);
          const be = new Date(b.end_time);
          const blockedStart = new Date(bs.getTime() - bufferMins * 60_000);
          const blockedEnd = new Date(be.getTime() + bufferMins * 60_000);
          return current < blockedEnd && slotEnd > blockedStart;
        });
        if (!conflict) slots.push(current.toISOString());
      }
      current = new Date(current.getTime() + slotIntervalMins * 60_000);
    }
  }

  return slots;
}

export function scoreSlots(
  slots: string[],
  durationMins: number,
  existingBookings: { start_time: string; end_time: string }[],
  bufferMins: number
): { start: string; end: string; score: number; recommended: boolean }[] {
  return slots.map(slotStart => {
    const start = new Date(slotStart);
    const end = new Date(start.getTime() + durationMins * 60000);
    let score = 0;

    for (const b of existingBookings) {
      const bs = new Date(b.start_time);
      const be = new Date(b.end_time);

      // +3 back-to-back after an existing booking (slot starts right after booking + buffer)
      if (Math.abs(start.getTime() - (be.getTime() + bufferMins * 60000)) < 60000) score += 3;
      // +2 back-to-back before an existing booking (slot ends right before booking - buffer)
      if (Math.abs(end.getTime() - (bs.getTime() - bufferMins * 60000)) < 60000) score += 2;

      // Check gaps created on either side
      const gapBefore = start.getTime() - be.getTime(); // ms between existing end and this start
      const gapAfter = bs.getTime() - end.getTime();    // ms between this end and next booking start

      if (gapBefore > 0 && gapBefore < 30 * 60000) score -= 2; // awkward gap before
      if (gapAfter > 0 && gapAfter < 30 * 60000) score -= 2;   // awkward gap after
      if (gapBefore >= 30 * 60000 || gapBefore === 0) score += 1; // clean gap or back-to-back
    }

    // Only recommend when there ARE existing bookings and the slot optimally fills gaps
    const recommended = existingBookings.length > 0 && score >= 2;
    return { start: slotStart, end: end.toISOString(), score, recommended };
  });
}
