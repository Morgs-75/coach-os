"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "clsx";

type Booking = {
  id: string;
  client_id: string;
  start_time: string;
  end_time: string;
  duration_mins: number;
  session_type: string;
  session_type_id?: string;
  status: string;
  client_name?: string;
  notes?: string;
  client_confirmed?: boolean;
  confirmation_sent_at?: string;
  client_purchase_id?: string;
};

type BlockedTime = {
  id: string;
  date?: string; // For specific date blocks
  day_of_week?: number; // For recurring weekly blocks
  start_time: string;
  end_time: string;
};

type Client = {
  id: string;
  full_name: string;
};

type SessionType = {
  id: string;
  name: string;
  slug: string;
  duration_mins: number;
  color: string;
  is_active: boolean;
};

type ClientPackage = {
  id: string;
  offer_id: string;
  sessions_total: number;
  sessions_used: number;
  payment_status: string;
  expires_at: string | null;
  offers: {
    name: string;
  };
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// 05:00 to 21:00 in 15-min blocks = 65 slots
const TIME_SLOTS = Array.from({ length: 65 }, (_, i) => {
  const totalMinutes = 5 * 60 + i * 15; // Start at 05:00
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return { hour, minute, label: `${hour}:${minute.toString().padStart(2, "0")}` };
});

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sessionTypes, setSessionTypes] = useState<SessionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Block time modal
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [editingBlock, setEditingBlock] = useState<BlockedTime | null>(null);
  const [blockForm, setBlockForm] = useState({
    type: "specific" as "specific" | "recurring",
    date: "",
    day_of_week: 1,
    start_time: "05:00",
    end_time: "21:00",
    all_day: true,
  });

  // Booking modal
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; hour: number; minute: number } | null>(null);
  const [bookingForm, setBookingForm] = useState({
    client_id: "",
    duration: 60,
    session_type_id: "",
    notes: "",
    datetime: "",
    sendSmsReminder: true,
    smsType: "standard" as "standard" | "custom",
    customSmsMessage: "",
    requestConfirmation: true,
    client_purchase_id: "",
  });
  const [clientPackages, setClientPackages] = useState<ClientPackage[]>([]);
  const [saving, setSaving] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(2); // 0-4 scale: 20px, 24px, 32px, 40px, 48px

  const ZOOM_SIZES = [20, 24, 32, 40, 48];
  const rowHeight = ZOOM_SIZES[zoomLevel];

  const supabase = createClient();

  const weekStart = useMemo(() => {
    const date = new Date(currentDate);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
  }, [currentDate]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      return date;
    });
  }, [weekStart]);

  useEffect(() => {
    loadData();
  }, [currentDate]);

  // Poll every 15 seconds for confirmation updates
  useEffect(() => {
    if (!orgId) return;
    const interval = setInterval(async () => {
      const rangeStart = new Date(weekStart);
      const rangeEnd = new Date(weekStart);
      rangeEnd.setDate(rangeEnd.getDate() + 7);
      const { data } = await supabase
        .from("bookings")
        .select("id, client_confirmed, confirmation_sent_at, status")
        .eq("org_id", orgId)
        .gte("start_time", rangeStart.toISOString())
        .lt("start_time", rangeEnd.toISOString());
      if (data) {
        setBookings((prev) => prev.map((b) => {
          const updated = data.find((d: any) => d.id === b.id);
          return updated ? { ...b, ...updated } : b;
        }));
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [orgId, weekStart]);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) return;
    setOrgId(membership.org_id);

    const rangeStart = new Date(weekStart);
    const rangeEnd = new Date(weekStart);
    rangeEnd.setDate(rangeEnd.getDate() + 7);

    const [bookingsRes, blockedRes, clientsRes, sessionTypesRes] = await Promise.all([
      supabase
        .from("bookings")
        .select(`*, clients (full_name)`)
        .eq("org_id", membership.org_id)
        .gte("start_time", rangeStart.toISOString())
        .lt("start_time", rangeEnd.toISOString())
        .neq("status", "cancelled"),
      supabase
        .from("blocked_times")
        .select("*")
        .eq("org_id", membership.org_id),
      supabase
        .from("clients")
        .select("id, full_name")
        .eq("org_id", membership.org_id)
        .eq("status", "active")
        .order("full_name"),
      supabase
        .from("session_types")
        .select("id, name, slug, duration_mins, color, is_active")
        .eq("org_id", membership.org_id)
        .eq("is_active", true)
        .order("sort_order"),
    ]);

    if (bookingsRes.data) {
      setBookings(bookingsRes.data.map((b: any) => ({
        ...b,
        client_name: b.clients?.full_name,
      })));

      // Auto-complete past bookings and deduct sessions
      const now = new Date();
      const pastBookings = bookingsRes.data.filter((b: any) =>
        new Date(b.end_time) < now &&
        b.status === "confirmed" &&
        b.client_purchase_id
      );

      for (const booking of pastBookings) {
        // Mark booking as completed
        await supabase
          .from("bookings")
          .update({ status: "completed" })
          .eq("id", booking.id);

        // Deduct session from package
        const { data: purchase } = await supabase
          .from("client_purchases")
          .select("sessions_used")
          .eq("id", booking.client_purchase_id)
          .single();

        if (purchase) {
          await supabase
            .from("client_purchases")
            .update({ sessions_used: purchase.sessions_used + 1 })
            .eq("id", booking.client_purchase_id);
        }
      }
    }

    if (blockedRes.error) {
      console.error("Error loading blocked times:", blockedRes.error);
    }
    if (blockedRes.data) {
      setBlockedTimes(blockedRes.data);
    }

    if (clientsRes.data) {
      setClients(clientsRes.data);
    }

    if (sessionTypesRes.data) {
      setSessionTypes(sessionTypesRes.data);
    }

    setLoading(false);
  }

  async function saveBlockedTime() {
    if (!orgId || !userId) return;

    const data: any = {
      start_time: blockForm.start_time + ":00",
      end_time: blockForm.end_time + ":00",
      date: blockForm.type === "specific" && blockForm.date ? blockForm.date : null,
      day_of_week: blockForm.type === "recurring" ? blockForm.day_of_week : null,
    };

    let error;
    if (editingBlock) {
      const result = await supabase
        .from("blocked_times")
        .update(data)
        .eq("id", editingBlock.id);
      error = result.error;
    } else {
      const result = await supabase.from("blocked_times").insert({
        ...data,
        org_id: orgId,
        user_id: userId,
      });
      error = result.error;
    }

    if (error) {
      console.error("Error saving blocked time:", error);
      alert("Error: " + (error.message || JSON.stringify(error)));
      return;
    }
    setShowBlockModal(false);
    setEditingBlock(null);
    loadData();
  }

  function handleEditBlock(bt: BlockedTime) {
    const isAllDay = bt.start_time === "05:00:00" && bt.end_time === "21:00:00";
    setEditingBlock(bt);
    setBlockForm({
      type: bt.date ? "specific" : "recurring",
      date: bt.date || "",
      day_of_week: bt.day_of_week ?? 1,
      start_time: bt.start_time.slice(0, 5),
      end_time: bt.end_time.slice(0, 5),
      all_day: isAllDay,
    });
    setShowBlockModal(true);
  }

  async function deleteBlockedTime(id: string) {
    await supabase.from("blocked_times").delete().eq("id", id);
    loadData();
  }

  async function loadClientPackages(clientId: string) {
    if (!clientId) {
      setClientPackages([]);
      return;
    }

    const { data } = await supabase
      .from("client_purchases")
      .select("id, offer_id, sessions_total, sessions_used, payment_status, expires_at, offers(name)")
      .eq("client_id", clientId)
      .eq("payment_status", "succeeded")
      .order("purchased_at", { ascending: false });

    if (data) {
      // Filter to only show packages with sessions remaining and not expired
      const now = new Date();
      const available = data.filter((p: any) => {
        const hasSessionsLeft = p.sessions_total > p.sessions_used;
        const notExpired = !p.expires_at || new Date(p.expires_at) > now;
        return hasSessionsLeft && notExpired;
      });
      setClientPackages(available as unknown as ClientPackage[]);
    }
  }

  function handleSlotClick(date: Date, hour: number, minute: number) {
    const available = isAvailable(date, hour, minute);
    const booked = isBookedSlot(date, hour, minute);

    if (available && !booked) {
      setSelectedSlot({ date, hour, minute });
      const defaultSessionType = sessionTypes[0];
      setClientPackages([]);
      setBookingForm({
        client_id: "",
        duration: defaultSessionType?.duration_mins || 60,
        session_type_id: defaultSessionType?.id || "",
        notes: "",
        datetime: "",
        sendSmsReminder: true,
        smsType: "standard",
        customSmsMessage: "",
        requestConfirmation: true,
        client_purchase_id: "",
      });
      setShowBookingModal(true);
    }
  }

  async function handleSaveBooking() {
    if (!orgId || !bookingForm.client_id) return;

    if (!userId) {
      alert("Not authenticated. Please refresh the page and try again.");
      return;
    }

    // Determine start time from slot or datetime picker
    let startTime: Date;
    if (selectedSlot) {
      startTime = new Date(selectedSlot.date);
      startTime.setHours(selectedSlot.hour, selectedSlot.minute, 0, 0);
    } else if (bookingForm.datetime) {
      startTime = new Date(bookingForm.datetime);
    } else {
      return; // No time selected
    }

    setSaving(true);

    // Check client has a signed waiver
    const { data: signedWaivers } = await supabase
      .from("client_waivers")
      .select("id")
      .eq("client_id", bookingForm.client_id)
      .eq("status", "signed")
      .limit(1);

    if (!signedWaivers || signedWaivers.length === 0) {
      setSaving(false);
      alert("This client does not have a signed waiver on file. Please send a waiver from the client's Waivers tab before booking.");
      return;
    }

    const endTime = new Date(startTime.getTime() + bookingForm.duration * 60000);
    const selectedType = sessionTypes.find(st => st.id === bookingForm.session_type_id);

    const insertData: Record<string, any> = {
      org_id: orgId,
      client_id: bookingForm.client_id,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      duration_mins: bookingForm.duration,
      session_type: selectedType?.slug || "pt_session",
      location_type: "in_person",
      status: "confirmed",
      booked_by: userId,
      booking_source: "trainer",
      notes: bookingForm.notes || null,
    };

    // TODO: Link to purchase_id once column exists on bookings table
    // if (bookingForm.client_purchase_id) {
    //   insertData.purchase_id = bookingForm.client_purchase_id;
    // }

    console.log("Inserting booking:", JSON.stringify(insertData, null, 2));

    const { data: newBooking, error } = await supabase
      .from("bookings")
      .insert(insertData)
      .select()
      .single();

    setSaving(false);

    if (error) {
      console.error("Booking error - full object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      console.error("Booking error code:", error.code);
      console.error("Booking error message:", error.message);
      console.error("Booking error details:", error.details);
      console.error("Booking error hint:", error.hint);
      const msg = error.message || error.details || error.hint || error.code || "Unknown error - check browser console";
      alert("Error creating booking: " + msg);
      return;
    }

    // Send SMS confirmation if enabled
    if (bookingForm.sendSmsReminder && newBooking) {
      const client = clients.find(c => c.id === bookingForm.client_id);
      if (client) {
        let message: string;
        const requestConfirm = bookingForm.smsType === "standard" && bookingForm.requestConfirmation;

        if (bookingForm.smsType === "custom" && bookingForm.customSmsMessage) {
          message = bookingForm.customSmsMessage;
        } else {
          const dateStr = startTime.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
          const timeStr = startTime.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });
          message = `Hi ${client.full_name.split(" ")[0]}, your session is confirmed for ${dateStr} at ${timeStr}.${requestConfirm ? " Reply Y to confirm." : ""} See you then!`;
        }

        try {
          await fetch("/api/send-sms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              booking_id: newBooking.id,
              client_id: bookingForm.client_id,
              message,
              request_confirmation: requestConfirm,
            }),
          });

          // Mark confirmation as sent if reply was requested
          if (requestConfirm) {
            await supabase
              .from("bookings")
              .update({ confirmation_sent_at: new Date().toISOString() })
              .eq("id", newBooking.id);
          }
        } catch (err) {
          console.error("SMS confirmation error:", err);
        }
      }
    }

    setShowBookingModal(false);
    setSelectedSlot(null);
    setEditingBooking(null);
    loadData();
  }

  async function handleBookingDoubleClick(booking: Booking) {
    const startDate = new Date(booking.start_time);
    // Format as local datetime for the input (YYYY-MM-DDTHH:MM)
    const localDatetime = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}T${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`;

    // Load client's packages
    await loadClientPackages(booking.client_id);

    setEditingBooking(booking);
    setSelectedSlot(null);
    setBookingForm({
      client_id: booking.client_id,
      duration: booking.duration_mins,
      session_type_id: sessionTypes.find(st => st.slug === booking.session_type)?.id || "",
      notes: booking.notes || "",
      datetime: localDatetime,
      sendSmsReminder: false,
      smsType: "standard",
      customSmsMessage: "",
      requestConfirmation: true,
      client_purchase_id: (booking as any).client_purchase_id || "",
    });
    setShowBookingModal(true);
  }

  async function handleUpdateBooking() {
    if (!editingBooking || !bookingForm.client_id) return;
    setSaving(true);

    const startTime = new Date(bookingForm.datetime);
    const endTime = new Date(startTime.getTime() + bookingForm.duration * 60000);
    const selectedType = sessionTypes.find(st => st.id === bookingForm.session_type_id);

    const originalTime = new Date(editingBooking.start_time).toISOString();
    const newTime = startTime.toISOString();
    const isRescheduled = originalTime !== newTime;
    console.log("Reschedule check:", { originalTime, newTime, isRescheduled });

    const { error } = await supabase
      .from("bookings")
      .update({
        client_id: bookingForm.client_id,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        duration_mins: bookingForm.duration,
        session_type: selectedType?.slug || editingBooking.session_type,
        notes: bookingForm.notes || null,
        ...(isRescheduled ? { client_confirmed: false, confirmation_sent_at: new Date().toISOString() } : {}),
      })
      .eq("id", editingBooking.id);

    setSaving(false);

    if (error) {
      console.error("Update error:", error);
      alert("Error updating booking: " + (error.message || JSON.stringify(error)));
      return;
    }

    // Send SMS if rescheduled
    if (isRescheduled) {
      try {
        const dateStr = startTime.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
        const timeStr = startTime.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });
        const firstName = editingBooking.client_name?.split(" ")[0] || "there";
        const message = `Hi ${firstName}, your session has been rescheduled to ${dateStr} at ${timeStr}. Reply Y to confirm.`;

        const smsRes = await fetch("/api/send-sms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: bookingForm.client_id,
            booking_id: editingBooking.id,
            message,
            request_confirmation: true,
          }),
        });
        const smsData = await smsRes.json();
        console.log("Reschedule SMS response:", smsRes.status, smsData);
      } catch (err) {
        console.error("SMS reschedule error:", err);
      }
    }

    setShowBookingModal(false);
    setEditingBooking(null);
    loadData();
  }

  async function sendBookingConfirmation(booking: Booking) {
    const startTime = new Date(booking.start_time);
    const dateStr = startTime.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
    const timeStr = startTime.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });

    const message = `Hi ${booking.client_name?.split(" ")[0]}, your session is confirmed for ${dateStr} at ${timeStr}. See you then!`;

    if (confirm(`Send SMS confirmation?\n\n"${message}"`)) {
      try {
        const response = await fetch("/api/send-sms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            booking_id: booking.id,
            client_id: booking.client_id,
            message,
          }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          console.error("SMS send failed:", err);
        }
      } catch (err) {
        console.error("SMS confirmation error:", err);
      }
    }
  }

  async function handleCancelBooking() {
    if (!editingBooking) return;
    if (!confirm("Cancel this booking and notify the client by SMS?")) return;

    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", editingBooking.id);

    if (error) {
      alert("Error cancelling booking: " + (error.message || JSON.stringify(error)));
      return;
    }

    // Send SMS cancellation notice to client
    try {
      const startTime = new Date(editingBooking.start_time);
      const dateStr = startTime.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
      const timeStr = startTime.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });
      const firstName = editingBooking.client_name?.split(" ")[0] || "there";
      const message = `Hi ${firstName}, your session on ${dateStr} at ${timeStr} has been cancelled. Please contact us to reschedule.`;

      await fetch("/api/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: editingBooking.client_id,
          message,
        }),
      });
    } catch (err) {
      console.error("SMS cancellation error:", err);
    }

    setShowBookingModal(false);
    setEditingBooking(null);
    loadData();
  }

  function isBookedSlot(date: Date, hour: number, minute: number): boolean {
    const slotStart = new Date(date);
    slotStart.setHours(hour, minute, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + 15 * 60000);

    return bookings.some((booking) => {
      const bookingStart = new Date(booking.start_time);
      const bookingEnd = new Date(booking.end_time);
      return (
        bookingStart.toDateString() === date.toDateString() &&
        slotStart < bookingEnd &&
        slotEnd > bookingStart
      );
    });
  }

  function getBookingAtSlot(date: Date, hour: number, minute: number): Booking | null {
    const slotStart = new Date(date);
    slotStart.setHours(hour, minute, 0, 0);

    return bookings.find((booking) => {
      const bookingStart = new Date(booking.start_time);
      return (
        bookingStart.toDateString() === date.toDateString() &&
        bookingStart.getHours() === hour &&
        bookingStart.getMinutes() === minute
      );
    }) || null;
  }

  function isAvailable(date: Date, hour: number, minute: number): boolean {
    const dayOfWeek = date.getDay();
    const dateStr = date.toISOString().split("T")[0];
    const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:00`;

    // Check if this slot is blocked
    const isBlocked = blockedTimes.some((b) => {
      const timeMatches = b.start_time <= timeStr && b.end_time > timeStr;
      if (!timeMatches) return false;

      // Check if it's a specific date block or recurring weekly block
      if (b.date) {
        return b.date === dateStr;
      } else if (b.day_of_week !== undefined) {
        return b.day_of_week === dayOfWeek;
      }
      return false;
    });

    // Available by default unless blocked
    return !isBlocked;
  }

  const formatTime = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  if (loading) {
    return <div className="text-gray-500 dark:text-gray-400 text-sm">Loading...</div>;
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Calendar</h1>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {weekStart.toLocaleDateString("en-AU", { month: "short", year: "numeric" })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedSlot(null);
              setClientPackages([]);
              const defaultSessionType = sessionTypes[0];
              // Default to next hour
              const now = new Date();
              now.setHours(now.getHours() + 1, 0, 0, 0);
              const defaultDatetime = now.toISOString().slice(0, 16);
              setBookingForm({
                client_id: "",
                duration: defaultSessionType?.duration_mins || 60,
                session_type_id: defaultSessionType?.id || "",
                notes: "",
                datetime: defaultDatetime,
                sendSmsReminder: true,
                smsType: "standard",
                customSmsMessage: "",
                requestConfirmation: true,
                client_purchase_id: "",
              });
              setShowBookingModal(true);
            }}
            className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            + Add Booking
          </button>
          <button
            onClick={() => {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              setBlockForm({
                type: "specific",
                date: tomorrow.toISOString().split("T")[0],
                day_of_week: 1,
                start_time: "05:00",
                end_time: "21:00",
                all_day: true,
              });
              setShowBlockModal(true);
            }}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
          >
            Block Time
          </button>
          <button
            onClick={() => setShowNotes(!showNotes)}
            className={clsx(
              "px-3 py-1.5 text-xs font-medium rounded-lg",
              showNotes
                ? "bg-amber-100 text-amber-700"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
            )}
          >
            {showNotes ? "Hide Notes" : "Show Notes"}
          </button>
          <div className="flex items-center gap-1 border-l border-gray-200 dark:border-gray-700 pl-2 ml-1">
            <button
              onClick={() => setZoomLevel(Math.max(0, zoomLevel - 1))}
              disabled={zoomLevel === 0}
              className="w-7 h-7 flex items-center justify-center text-sm font-bold rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Zoom out"
            >
              −
            </button>
            <button
              onClick={() => setZoomLevel(Math.min(4, zoomLevel + 1))}
              disabled={zoomLevel === 4}
              className="w-7 h-7 flex items-center justify-center text-sm font-bold rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Zoom in"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Blocked Times List */}
      {blockedTimes.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {blockedTimes.map((bt) => {
            const isAllDay = bt.start_time === "05:00:00" && bt.end_time === "21:00:00";
            return (
              <div
                key={bt.id}
                className="inline-flex items-center gap-2 px-2 py-1 bg-red-50 border border-red-200 rounded text-xs cursor-pointer hover:bg-red-100"
                onClick={() => handleEditBlock(bt)}
              >
                <span className="text-red-700">
                  {bt.date
                    ? new Date(bt.date).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })
                    : DAYS[bt.day_of_week || 0].slice(0, 3) + "s"
                  }
                  {isAllDay ? " (All Day)" : ` ${bt.start_time.slice(0, 5)} - ${bt.end_time.slice(0, 5)}`}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteBlockedTime(bt.id);
                  }}
                  className="text-red-400 hover:text-red-600"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Week Navigation */}
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={() => {
            const d = new Date(currentDate);
            d.setDate(d.getDate() - 7);
            setCurrentDate(d);
          }}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={() => setCurrentDate(new Date())}
          className="px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded"
        >
          Today
        </button>
        <button
          onClick={() => {
            const d = new Date(currentDate);
            d.setDate(d.getDate() + 7);
            setCurrentDate(d);
          }}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900 overflow-y-auto mt-3">
        {/* Day headers */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
          <div className="p-1 text-xs text-gray-500 dark:text-gray-400"></div>
          {weekDays.map((date, i) => (
            <div
              key={i}
              className={clsx(
                "p-2 text-center border-l border-gray-200 dark:border-gray-700",
                isToday(date) && "bg-blue-50"
              )}
            >
              <div className="text-xs text-gray-500 dark:text-gray-400">{SHORT_DAYS[date.getDay()]}</div>
              <div className={clsx(
                "text-sm font-medium",
                isToday(date) ? "text-blue-600" : "text-gray-900 dark:text-gray-100"
              )}>
                {date.getDate()}
              </div>
            </div>
          ))}
        </div>

        {/* Time slots */}
        {TIME_SLOTS.map((slot, slotIndex) => (
          <div key={slotIndex} className="grid grid-cols-[60px_repeat(7,1fr)]">
            <div
              className={clsx(
                "relative border-r border-gray-200 dark:border-gray-700",
                slot.minute === 0 ? "border-t border-gray-300 dark:border-gray-600" : "border-t border-gray-100"
              )}
              style={{ height: `${rowHeight}px` }}
            >
              {/* Only show hour labels, positioned at the line */}
              {slot.minute === 0 && (
                <span className="absolute -top-[10px] left-0 right-1 text-right text-xs text-gray-500 dark:text-gray-400 font-medium bg-white dark:bg-gray-900 pr-1">
                  {slot.hour.toString().padStart(2, "0")}:00
                </span>
              )}
            </div>
            {weekDays.map((date, dayIndex) => {
              const available = isAvailable(date, slot.hour, slot.minute);
              const booking = getBookingAtSlot(date, slot.hour, slot.minute);
              const isBooked = isBookedSlot(date, slot.hour, slot.minute);
              const bookingType = booking ? sessionTypes.find(st => st.id === booking.session_type_id || st.slug === booking.session_type) : null;

              return (
                <div
                  key={dayIndex}
                  onClick={() => booking ? handleBookingDoubleClick(booking) : handleSlotClick(date, slot.hour, slot.minute)}
                  className={clsx(
                    "border-l border-gray-100 relative border-t",
                    slot.minute === 0 ? "border-t-gray-300" : "border-t-gray-100",
                    available && !isBooked && "bg-green-50 hover:bg-green-100 cursor-pointer",
                    isBooked && "cursor-pointer",
                    !available && !isBooked && "bg-gray-100 dark:bg-gray-700"
                  )}
                  style={{ height: `${rowHeight}px` }}
                >
                  {booking && (
                    <div
                      className="absolute left-0 right-0 mx-0.5 rounded overflow-hidden z-10 p-1.5 group cursor-pointer"
                      style={{
                        top: 1,
                        height: `${(booking.duration_mins / 15) * rowHeight - 2}px`,
                        backgroundColor: booking.client_confirmed ? "#16a34a" : (bookingType?.color || "#3B82F6"),
                      }}
                      onClick={(e) => { e.stopPropagation(); handleBookingDoubleClick(booking); }}
                    >
                      <div className="text-xs font-bold text-white truncate">
                        {booking.client_name} - {bookingType?.name || booking.session_type}
                      </div>
                      <div className="text-[10px] text-white/80">
                        {new Date(booking.start_time).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false })}
                        {" - "}
                        {new Date(booking.end_time).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false })}
                      </div>
                      {showNotes && booking.notes && (
                        <div className="text-[10px] text-white/90 mt-1 line-clamp-3">
                          {booking.notes}
                        </div>
                      )}
                      {/* Confirmation status indicator */}
                      {booking.confirmation_sent_at && (
                        <div className={`absolute bottom-1 left-1 right-1 flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                          booking.client_confirmed
                            ? "bg-green-500/90 text-white"
                            : "bg-white/20 text-white"
                        }`}>
                          {booking.client_confirmed ? (
                            <>
                              <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Confirmed
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Awaiting
                            </>
                          )}
                        </div>
                      )}
                      {/* SMS button - shows on hover */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          sendBookingConfirmation(booking);
                        }}
                        className="absolute top-1 right-1 hidden group-hover:flex items-center justify-center w-6 h-6 bg-white dark:bg-gray-900/20 hover:bg-white dark:bg-gray-900/30 rounded text-white"
                        title="Send SMS confirmation"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </button>
                    </div>
                  )}
                  {!available && !isBooked && (
                    <div className="absolute inset-0 opacity-30" style={{
                      backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 3px, #9ca3af 3px, #9ca3af 4px)"
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mt-2">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-50 border border-green-200"></div>
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-400"></div>
          <span>Booked</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-600"></div>
          <span>Confirmed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
            <div className="absolute inset-0 opacity-40" style={{
              backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 1px, #9ca3af 1px, #9ca3af 2px)"
            }} />
          </div>
          <span>Unavailable</span>
        </div>
        <span className="text-gray-400">Click an available slot to book</span>
      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editingBooking ? "Edit Booking" : selectedSlot ? "New Booking" : "Add Booking"}
              </h2>
              {selectedSlot && !editingBooking && (() => {
                const endMins = selectedSlot.hour * 60 + selectedSlot.minute + bookingForm.duration;
                const endHour = Math.floor(endMins / 60);
                const endMinute = endMins % 60;
                return (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedSlot.date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })} | {formatTime(selectedSlot.hour, selectedSlot.minute)} – {formatTime(endHour, endMinute)} ({bookingForm.duration} min)
                  </p>
                );
              })()}
              {editingBooking && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {editingBooking.client_name}
                </p>
              )}
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client *</label>
                <select
                  value={bookingForm.client_id}
                  onChange={(e) => {
                    const clientId = e.target.value;
                    setBookingForm({ ...bookingForm, client_id: clientId, client_purchase_id: "" });
                    loadClientPackages(clientId);
                  }}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Package Selection */}
              {bookingForm.client_id && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Use Package</label>
                  {clientPackages.length > 0 ? (
                    <select
                      value={bookingForm.client_purchase_id}
                      onChange={(e) => {
                        const purchaseId = e.target.value;
                        const pkg = clientPackages.find(p => p.id === purchaseId);
                        const offerName = pkg?.offers?.name || "";

                        // Match offer name to session type
                        const matchedType = sessionTypes.find(st =>
                          st.name.toLowerCase() === offerName.toLowerCase() ||
                          offerName.toLowerCase().includes(st.name.toLowerCase()) ||
                          st.name.toLowerCase().includes(offerName.toLowerCase())
                        );

                        setBookingForm({
                          ...bookingForm,
                          client_purchase_id: purchaseId,
                          ...(matchedType ? {
                            session_type_id: matchedType.id,
                            duration: matchedType.duration_mins,
                          } : {}),
                        });
                      }}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">No package (casual session)</option>
                      {clientPackages.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.offers?.name} - {pkg.sessions_total - pkg.sessions_used} sessions left
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                      No active packages with sessions remaining.
                    </p>
                  )}
                </div>
              )}

              {(!selectedSlot || editingBooking) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={bookingForm.datetime}
                    onChange={(e) => setBookingForm({ ...bookingForm, datetime: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Session Type *</label>
                {sessionTypes.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {sessionTypes.map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setBookingForm({
                          ...bookingForm,
                          session_type_id: st.id,
                          duration: st.duration_mins,
                        })}
                        className={clsx(
                          "px-3 py-1.5 text-sm rounded-lg border transition-colors flex items-center gap-2",
                          bookingForm.session_type_id === st.id
                            ? "border-gray-900 bg-gray-50 dark:bg-gray-800"
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:border-gray-600"
                        )}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: st.color }}
                        />
                        {st.name}
                        <span className="text-gray-400 text-xs">({st.duration_mins}m)</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No session types configured.{" "}
                    <a href="/settings/session-types" className="text-blue-600 hover:underline">
                      Add session types
                    </a>
                  </p>
                )}
              </div>

              {bookingForm.session_type_id && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Duration: <span className="font-medium text-gray-900 dark:text-gray-100">{bookingForm.duration} min</span> (set by session type)
                </p>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea
                  value={bookingForm.notes}
                  onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Optional notes..."
                />
              </div>

              {/* SMS Reminder */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bookingForm.sendSmsReminder}
                    onChange={(e) => setBookingForm({ ...bookingForm, sendSmsReminder: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Send SMS confirmation</span>
                  </div>
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </label>

                {bookingForm.sendSmsReminder && (
                  <div className="p-3 space-y-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setBookingForm({ ...bookingForm, smsType: "standard" })}
                        className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                          bookingForm.smsType === "standard"
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800"
                        }`}
                      >
                        Standard message
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const client = clients.find(c => c.id === bookingForm.client_id);
                          const startTime = selectedSlot
                            ? new Date(new Date(selectedSlot.date).setHours(selectedSlot.hour, selectedSlot.minute))
                            : bookingForm.datetime ? new Date(bookingForm.datetime) : new Date();
                          const dateStr = startTime.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
                          const timeStr = startTime.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });
                          const defaultMsg = `Hi ${client?.full_name?.split(" ")[0] || "[Name]"}, your session is confirmed for ${dateStr} at ${timeStr}. See you then!`;
                          setBookingForm({
                            ...bookingForm,
                            smsType: "custom",
                            customSmsMessage: defaultMsg
                          });
                        }}
                        className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                          bookingForm.smsType === "custom"
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800"
                        }`}
                      >
                        Custom message
                      </button>
                    </div>

                    {bookingForm.smsType === "standard" && (
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={bookingForm.requestConfirmation}
                            onChange={(e) => setBookingForm({ ...bookingForm, requestConfirmation: e.target.checked })}
                            className="w-4 h-4 rounded text-blue-600"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Request confirmation (Reply Y)</span>
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                          "Hi [Name], your session is confirmed for [Date] at [Time].
                          {bookingForm.requestConfirmation ? " Reply Y to confirm." : ""} See you then!"
                        </p>
                      </div>
                    )}

                    {bookingForm.smsType === "custom" && (
                      <textarea
                        value={bookingForm.customSmsMessage}
                        onChange={(e) => setBookingForm({ ...bookingForm, customSmsMessage: e.target.value })}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm"
                        rows={3}
                        placeholder="Enter your custom message..."
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
              {editingBooking ? (
                <button
                  onClick={handleCancelBooking}
                  className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                >
                  Cancel Booking
                </button>
              ) : (
                <div></div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowBookingModal(false);
                    setSelectedSlot(null);
                    setEditingBooking(null);
                  }}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={editingBooking ? handleUpdateBooking : handleSaveBooking}
                  disabled={
                    !bookingForm.client_id ||
                    (!selectedSlot && !bookingForm.datetime) ||
                    saving
                  }
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                {saving ? "Saving..." : editingBooking ? "Update Booking" : "Create Booking"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Block Time Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editingBlock ? "Edit Blocked Time" : "Block Time"}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Mark times as unavailable for bookings</p>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Block Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={blockForm.type === "specific"}
                      onChange={() => setBlockForm({ ...blockForm, type: "specific" })}
                      className="text-blue-600"
                    />
                    <span className="text-sm">Specific Date</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={blockForm.type === "recurring"}
                      onChange={() => setBlockForm({ ...blockForm, type: "recurring" })}
                      className="text-blue-600"
                    />
                    <span className="text-sm">Every Week</span>
                  </label>
                </div>
              </div>

              {blockForm.type === "specific" ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                  <input
                    type="date"
                    value={blockForm.date}
                    onChange={(e) => setBlockForm({ ...blockForm, date: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Day of Week</label>
                  <select
                    value={blockForm.day_of_week}
                    onChange={(e) => setBlockForm({ ...blockForm, day_of_week: parseInt(e.target.value) })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm"
                  >
                    {DAYS.map((day, i) => (
                      <option key={i} value={i}>{day}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={blockForm.all_day}
                    onChange={(e) => setBlockForm({
                      ...blockForm,
                      all_day: e.target.checked,
                      start_time: e.target.checked ? "05:00" : "09:00",
                      end_time: e.target.checked ? "21:00" : "17:00",
                    })}
                    className="rounded text-red-600"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">All Day</span>
                </label>
              </div>

              {!blockForm.all_day && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From</label>
                    <input
                      type="time"
                      value={blockForm.start_time}
                      onChange={(e) => setBlockForm({ ...blockForm, start_time: e.target.value })}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To</label>
                    <input
                      type="time"
                      value={blockForm.end_time}
                      onChange={(e) => setBlockForm({ ...blockForm, end_time: e.target.value })}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
              {editingBlock ? (
                <button
                  onClick={() => {
                    deleteBlockedTime(editingBlock.id);
                    setShowBlockModal(false);
                    setEditingBlock(null);
                  }}
                  className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                >
                  Delete
                </button>
              ) : (
                <div></div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowBlockModal(false);
                    setEditingBlock(null);
                  }}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={saveBlockedTime}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  {editingBlock ? "Update" : "Block Time"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
