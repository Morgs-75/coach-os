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

/** Returns dates that have at least one available time slot, respecting min_notice_hours. */
export function generateAvailableDates(
  availability: Availability[],
  settings: BookingSettings,
  existingBookings: ExistingBooking[],
  durationMins: number,
  bufferMins: number
): Date[] {
  const dates: Date[] = [];
  const minDate = new Date();
  minDate.setHours(minDate.getHours() + settings.min_notice_hours);

  for (let i = 0; i < settings.max_advance_days; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    date.setHours(0, 0, 0, 0);

    if (
      availability.some(a => a.day_of_week === date.getDay()) &&
      date >= minDate
    ) {
      const slots = generateTimeSlots(
        date,
        durationMins,
        availability,
        settings,
        existingBookings,
        bufferMins
      );
      if (slots.length > 0) {
        dates.push(date);
      }
    }
  }

  return dates;
}

/** Returns available slot ISO strings for a given date. */
export function generateTimeSlots(
  selectedDate: Date,
  durationMins: number,
  availability: Availability[],
  settings: BookingSettings,
  existingBookings: ExistingBooking[],
  bufferMins: number = settings.buffer_between_mins,
  slotIntervalMins: number = 15
): string[] {
  const slots: string[] = [];
  const dayAvailability = availability.filter(
    a => a.day_of_week === selectedDate.getDay()
  );

  const minTime = new Date();
  minTime.setHours(minTime.getHours() + settings.min_notice_hours);

  for (const avail of dayAvailability) {
    const [startHour, startMin] = avail.start_time.split(":").map(Number);
    const [endHour, endMin] = avail.end_time.split(":").map(Number);

    let current = new Date(selectedDate);
    current.setHours(startHour, startMin, 0, 0);

    const windowEnd = new Date(selectedDate);
    windowEnd.setHours(endHour, endMin, 0, 0);

    while (current.getTime() + durationMins * 60_000 <= windowEnd.getTime()) {
      if (current > minTime) {
        const slotEnd = new Date(current.getTime() + durationMins * 60_000);
        const conflict = existingBookings.some(b => {
          const bs = new Date(b.start_time);
          const be = new Date(b.end_time);
          // Booking occupies [bs - bufferMins, be + bufferMins]
          const blockedStart = new Date(bs.getTime() - bufferMins * 60_000);
          const blockedEnd = new Date(be.getTime() + bufferMins * 60_000);
          // Slot conflicts if it overlaps the blocked window
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

    const recommended = existingBookings.length === 0 || score >= 2;
    return { start: slotStart, end: end.toISOString(), score, recommended };
  });
}
