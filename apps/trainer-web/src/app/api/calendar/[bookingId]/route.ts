import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(
  request: Request,
  { params }: { params: { bookingId: string } }
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL env vars");
    return new NextResponse("Server configuration error", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: booking, error } = await supabase
    .from("bookings")
    .select(`
      id, start_time, end_time, duration_mins, session_type,
      clients (full_name),
      orgs (name)
    `)
    .eq("id", params.bookingId)
    .single();

  if (error) {
    console.error("Calendar route DB error:", error.message);
  }

  if (!booking) {
    return new NextResponse("Booking not found", { status: 404 });
  }

  const start = new Date(booking.start_time);
  const end = new Date(booking.end_time);
  const trainerName = (booking.orgs as any)?.name || "Your Trainer";
  const clientName = (booking.clients as any)?.full_name || "Client";

  const formatIcsDate = (date: Date) =>
    date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Coach OS//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:booking-${booking.id}@coach-os`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:Session with ${trainerName}`,
    `DESCRIPTION:Hi ${clientName}\\, your session with ${trainerName} is confirmed.`,
    "STATUS:CONFIRMED",
    `DTSTAMP:${formatIcsDate(new Date())}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="session-${booking.id}.ics"`,
    },
  });
}
