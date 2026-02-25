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

/** Returns dates that have at least one availability window, respecting min_notice_hours. */
export function generateAvailableDates(
  availability: Availability[],
  settings: BookingSettings
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
      dates.push(date);
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
  existingBookings: ExistingBooking[]
): string[] {
  const slots: string[] = [];
  const dayAvailability = availability.filter(
    a => a.day_of_week === selectedDate.getDay()
  );
  const buffer = settings.buffer_between_mins;

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
          return (
            (current >= bs && current < be) ||
            (slotEnd > bs && slotEnd <= be) ||
            (current <= bs && slotEnd >= be)
          );
        });
        if (!conflict) slots.push(current.toISOString());
      }
      current.setMinutes(current.getMinutes() + durationMins + buffer);
    }
  }

  return slots;
}
