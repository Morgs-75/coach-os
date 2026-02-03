import { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { supabase } from "../../src/lib/supabase";
import { colors } from "../../src/lib/theme";

interface Offer {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  session_duration_mins: number | null;
}

interface Availability {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  offer_name?: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function BookScreen() {
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [existingBookings, setExistingBookings] = useState<Booking[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);

  // Booking flow
  const [step, setStep] = useState<"list" | "service" | "date" | "time" | "confirm">("list");
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get client record
    const { data: client } = await supabase
      .from("clients")
      .select("id, org_id")
      .eq("auth_user_id", user.id)
      .single();

    if (!client) {
      setLoading(false);
      return;
    }

    setClientId(client.id);
    setOrgId(client.org_id);

    // Load offers
    const { data: offersData } = await supabase
      .from("offers")
      .select("id, name, description, price_cents, session_duration_mins")
      .eq("org_id", client.org_id)
      .eq("is_active", true)
      .order("sort_order");

    if (offersData) setOffers(offersData);

    // Load availability
    const { data: availData } = await supabase
      .from("availability")
      .select("day_of_week, start_time, end_time")
      .eq("org_id", client.org_id)
      .eq("is_available", true);

    if (availData) setAvailability(availData);

    // Load existing bookings (to check conflicts)
    const now = new Date();
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);

    const { data: bookingsData } = await supabase
      .from("bookings")
      .select("id, start_time, end_time, status")
      .eq("org_id", client.org_id)
      .gte("start_time", now.toISOString())
      .neq("status", "cancelled");

    if (bookingsData) setExistingBookings(bookingsData);

    // Load my upcoming bookings
    const { data: myBookingsData } = await supabase
      .from("bookings")
      .select("id, start_time, end_time, status, offers(name)")
      .eq("client_id", client.id)
      .gte("start_time", now.toISOString())
      .neq("status", "cancelled")
      .order("start_time", { ascending: true })
      .limit(5);

    if (myBookingsData) {
      setMyBookings(myBookingsData.map((b: any) => ({
        ...b,
        offer_name: b.offers?.name,
      })));
    }

    setLoading(false);
  }

  // Generate available dates
  const availableDates = useMemo(() => {
    const dates: Date[] = [];
    const now = new Date();
    now.setHours(now.getHours() + 24); // 24 hour minimum notice

    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      date.setHours(0, 0, 0, 0);

      const dayOfWeek = date.getDay();
      const hasAvailability = availability.some(a => a.day_of_week === dayOfWeek);

      if (hasAvailability && date >= now) {
        dates.push(date);
      }
    }

    return dates;
  }, [availability]);

  // Generate time slots
  const timeSlots = useMemo(() => {
    if (!selectedDate || !selectedOffer) return [];

    const slots: string[] = [];
    const dayOfWeek = selectedDate.getDay();
    const dayAvailability = availability.filter(a => a.day_of_week === dayOfWeek);
    const duration = selectedOffer.session_duration_mins || 60;

    const now = new Date();
    now.setHours(now.getHours() + 24);

    for (const avail of dayAvailability) {
      const [startHour, startMin] = avail.start_time.split(":").map(Number);
      const [endHour, endMin] = avail.end_time.split(":").map(Number);

      let currentTime = new Date(selectedDate);
      currentTime.setHours(startHour, startMin, 0, 0);

      const endTime = new Date(selectedDate);
      endTime.setHours(endHour, endMin, 0, 0);

      while (currentTime.getTime() + duration * 60000 <= endTime.getTime()) {
        if (currentTime > now) {
          const slotEnd = new Date(currentTime.getTime() + duration * 60000);
          const hasConflict = existingBookings.some(booking => {
            const bookingStart = new Date(booking.start_time);
            const bookingEnd = new Date(booking.end_time);
            return (
              (currentTime >= bookingStart && currentTime < bookingEnd) ||
              (slotEnd > bookingStart && slotEnd <= bookingEnd)
            );
          });

          if (!hasConflict) {
            slots.push(currentTime.toISOString());
          }
        }
        currentTime.setMinutes(currentTime.getMinutes() + duration + 15);
      }
    }

    return slots;
  }, [selectedDate, selectedOffer, availability, existingBookings]);

  async function handleBook() {
    if (!clientId || !orgId || !selectedOffer || !selectedTime) return;

    setBooking(true);

    const startTime = new Date(selectedTime);
    const duration = selectedOffer.session_duration_mins || 60;
    const endTime = new Date(startTime.getTime() + duration * 60000);

    const { error } = await supabase.from("bookings").insert({
      org_id: orgId,
      client_id: clientId,
      offer_id: selectedOffer.id,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      duration_mins: duration,
      session_type: "pt_session",
      location_type: "in_person",
      status: "confirmed",
      booked_by: clientId,
      booking_source: "client",
      client_notes: notes || null,
    });

    setBooking(false);

    if (error) {
      Alert.alert("Error", "Failed to book session. Please try again.");
    } else {
      Alert.alert("Booked!", "Your session has been confirmed.");
      setStep("list");
      setSelectedOffer(null);
      setSelectedDate(null);
      setSelectedTime(null);
      setNotes("");
      loadData();
    }
  }

  async function handleCancel(bookingId: string) {
    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this booking?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            await supabase
              .from("bookings")
              .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
              .eq("id", bookingId);
            loadData();
          },
        },
      ]
    );
  }

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString("en-AU", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // My bookings list
  if (step === "list") {
    return (
      <ScrollView style={styles.container}>
        <TouchableOpacity
          style={styles.bookButton}
          onPress={() => setStep("service")}
        >
          <Text style={styles.bookButtonText}>+ Book a Session</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Upcoming Sessions</Text>
        {myBookings.length > 0 ? (
          myBookings.map((booking) => (
            <View key={booking.id} style={styles.bookingCard}>
              <View style={styles.bookingInfo}>
                <Text style={styles.bookingTitle}>{booking.offer_name || "Session"}</Text>
                <Text style={styles.bookingTime}>
                  {formatDate(new Date(booking.start_time))} at {formatTime(booking.start_time)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleCancel(booking.id)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No upcoming sessions</Text>
        )}
      </ScrollView>
    );
  }

  // Select service
  if (step === "service") {
    return (
      <ScrollView style={styles.container}>
        <TouchableOpacity onPress={() => setStep("list")} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.stepTitle}>Select a service</Text>
        {offers.map((offer) => (
          <TouchableOpacity
            key={offer.id}
            style={styles.offerCard}
            onPress={() => {
              setSelectedOffer(offer);
              setStep("date");
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.offerName}>{offer.name}</Text>
              {offer.description && (
                <Text style={styles.offerDesc}>{offer.description}</Text>
              )}
              <Text style={styles.offerDuration}>
                {offer.session_duration_mins || 60} mins
              </Text>
            </View>
            <Text style={styles.offerPrice}>{formatCurrency(offer.price_cents)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }

  // Select date
  if (step === "date") {
    return (
      <ScrollView style={styles.container}>
        <TouchableOpacity onPress={() => setStep("service")} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.stepTitle}>Select a date</Text>
        <View style={styles.dateGrid}>
          {availableDates.map((date) => (
            <TouchableOpacity
              key={date.toISOString()}
              style={[
                styles.dateCard,
                selectedDate?.toDateString() === date.toDateString() && styles.dateCardSelected,
              ]}
              onPress={() => {
                setSelectedDate(date);
                setSelectedTime(null);
                setStep("time");
              }}
            >
              <Text style={styles.dateDay}>{DAYS[date.getDay()]}</Text>
              <Text style={styles.dateNum}>{date.getDate()}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    );
  }

  // Select time
  if (step === "time") {
    return (
      <ScrollView style={styles.container}>
        <TouchableOpacity onPress={() => setStep("date")} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.stepTitle}>Select a time</Text>
        <Text style={styles.stepSubtitle}>{formatDate(selectedDate!)}</Text>
        <View style={styles.timeGrid}>
          {timeSlots.length > 0 ? (
            timeSlots.map((slot) => (
              <TouchableOpacity
                key={slot}
                style={[
                  styles.timeCard,
                  selectedTime === slot && styles.timeCardSelected,
                ]}
                onPress={() => {
                  setSelectedTime(slot);
                  setStep("confirm");
                }}
              >
                <Text style={styles.timeText}>{formatTime(slot)}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyText}>No available times</Text>
          )}
        </View>
      </ScrollView>
    );
  }

  // Confirm
  if (step === "confirm") {
    return (
      <ScrollView style={styles.container}>
        <TouchableOpacity onPress={() => setStep("time")} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.stepTitle}>Confirm booking</Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{selectedOffer?.name}</Text>
          <Text style={styles.summaryText}>
            {formatDate(selectedDate!)} at {formatTime(selectedTime!)}
          </Text>
          <Text style={styles.summaryPrice}>
            {formatCurrency(selectedOffer?.price_cents || 0)}
          </Text>
        </View>

        <Text style={styles.inputLabel}>Notes (optional)</Text>
        <TextInput
          style={styles.textInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Anything you'd like us to know..."
          multiline
          numberOfLines={3}
        />

        <TouchableOpacity
          style={[styles.confirmButton, booking && styles.confirmButtonDisabled]}
          onPress={handleBook}
          disabled={booking}
        >
          <Text style={styles.confirmButtonText}>
            {booking ? "Booking..." : "Confirm Booking"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  bookButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  bookButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 12,
  },
  bookingCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  bookingInfo: {
    flex: 1,
  },
  bookingTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  bookingTime: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelButtonText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "500",
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: 24,
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 16,
  },
  stepSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 16,
    marginTop: -8,
  },
  offerCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  offerName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  offerDesc: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  offerDuration: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 8,
  },
  offerPrice: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  dateGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dateCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    width: 70,
    alignItems: "center",
  },
  dateCardSelected: {
    backgroundColor: colors.primary,
  },
  dateDay: {
    fontSize: 12,
    color: colors.textMuted,
  },
  dateNum: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.text,
  },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  timeCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  timeCardSelected: {
    backgroundColor: colors.primary,
  },
  timeText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  summaryText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  summaryPrice: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginTop: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: colors.text,
    marginBottom: 24,
    minHeight: 80,
    textAlignVertical: "top",
  },
  confirmButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
