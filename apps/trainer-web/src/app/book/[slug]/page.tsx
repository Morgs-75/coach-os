"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import { clsx } from "clsx";

interface Org {
  id: string;
  name: string;
}

interface Branding {
  display_name: string;
  primary_color: string;
  logo_url: string | null;
}

interface Offer {
  id: string;
  name: string;
  description: string | null;
  offer_type: string;
  price_cents: number;
  session_duration_mins: number | null;
}

interface ScoredSlot {
  start: string;
  end: string;
  score: number;
  recommended: boolean;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function PublicBookingPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<Org | null>(null);
  const [branding, setBranding] = useState<Branding | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);

  // Booking flow state
  const [step, setStep] = useState<"service" | "date" | "time" | "details" | "confirmed">("service");
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [clientForm, setClientForm] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
  });
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");

  // API-driven data
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [timeSlots, setTimeSlots] = useState<ScoredSlot[]>([]);
  const [durationMins, setDurationMins] = useState(60);
  const [loadingDates, setLoadingDates] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookingDisabled, setBookingDisabled] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadOrgData();
  }, [slug]);

  async function loadOrgData() {
    // Find org by slug
    const { data: orgsData } = await supabase
      .from("orgs")
      .select("id, name")
      .ilike("name", slug.replace(/-/g, " "));

    let org = orgsData?.find(o => o.name.toLowerCase().replace(/\s+/g, "-") === slug.toLowerCase());
    if (!org && orgsData?.length) org = orgsData[0];

    if (!org) {
      setLoading(false);
      return;
    }

    setOrg(org);

    // Load branding + offers in parallel
    const [{ data: brandingData }, { data: offersData }] = await Promise.all([
      supabase.from("branding").select("display_name, primary_color, logo_url")
        .eq("org_id", org.id).single(),
      supabase.from("offers").select("*")
        .eq("org_id", org.id).eq("is_active", true).order("sort_order"),
    ]);

    if (brandingData) setBranding(brandingData);
    if (offersData) setOffers(offersData);

    setLoading(false);
  }

  // Fetch available dates when offer is selected
  async function loadAvailableDates(offer: Offer) {
    setLoadingDates(true);
    setAvailableDates([]);
    setBookingDisabled(false);
    try {
      const params = new URLSearchParams({ slug });
      if (offer.id) params.set("offer_id", offer.id);
      const res = await fetch(`/api/public/available-dates?${params}`);
      const data = await res.json();
      if (res.status === 403) {
        setBookingDisabled(true);
        setError(data.error || "Online booking is not available.");
      } else if (data.dates) {
        setAvailableDates(data.dates);
      }
    } catch {
      setError("Failed to load available dates.");
    }
    setLoadingDates(false);
  }

  // Fetch time slots when date is selected
  async function loadTimeSlots(date: string) {
    setLoadingSlots(true);
    setTimeSlots([]);
    try {
      const params = new URLSearchParams({ slug, date });
      if (selectedOffer?.id) params.set("offer_id", selectedOffer.id);
      const res = await fetch(`/api/public/available-slots?${params}`);
      const data = await res.json();
      if (data.slots) {
        setTimeSlots(data.slots);
        if (data.durationMins) setDurationMins(data.durationMins);
      }
    } catch {
      setError("Failed to load available times.");
    }
    setLoadingSlots(false);
  }

  async function handleBooking() {
    if (!org || !selectedOffer || !selectedDate || !selectedTime) return;

    setBooking(true);
    setError("");

    const startTime = new Date(selectedTime);
    const endTime = new Date(startTime.getTime() + durationMins * 60000);

    // Create or find client
    let clientId: string;

    const { data: existingClient } = await supabase
      .from("clients")
      .select("id")
      .eq("org_id", org.id)
      .eq("email", clientForm.email)
      .single();

    if (existingClient) {
      clientId = existingClient.id;
    } else {
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({
          org_id: org.id,
          full_name: clientForm.name,
          email: clientForm.email,
          phone: clientForm.phone || null,
          status: "active",
          source: "online_booking",
        })
        .select()
        .single();

      if (clientError || !newClient) {
        setError("Failed to create client record");
        setBooking(false);
        return;
      }

      clientId = newClient.id;
    }

    // Check waiver
    const { data: signedWaivers } = await supabase
      .from("client_waivers")
      .select("id")
      .eq("client_id", clientId)
      .eq("status", "signed")
      .limit(1);

    if (!signedWaivers || signedWaivers.length === 0) {
      setError("You must have a signed waiver on file before booking. Please contact your trainer.");
      setBooking(false);
      return;
    }

    // Create booking
    const { error: bookingError } = await supabase
      .from("bookings")
      .insert({
        org_id: org.id,
        client_id: clientId,
        offer_id: selectedOffer.id,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        duration_mins: durationMins,
        session_type: "pt_session",
        location_type: "in_person",
        status: "confirmed",
        booked_by: null,
        booking_source: "client",
        client_notes: clientForm.notes || null,
      });

    if (bookingError) {
      setError("Failed to create booking. Please try again.");
      setBooking(false);
      return;
    }

    setStep("confirmed");
    setBooking(false);
  }

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString("en-AU", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDateDisplay = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return {
      day: DAYS[date.getDay()],
      date: d,
      month: date.toLocaleDateString("en-AU", { month: "short" }),
      full: date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" }),
    };
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Page not found</h1>
          <p className="text-gray-500">This booking page doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <h1 className="text-xl font-semibold text-gray-900">
            {branding?.display_name || org.name}
          </h1>
          <p className="text-sm text-gray-500">Book a session</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Progress */}
        {step !== "confirmed" && (
          <div className="flex items-center gap-2 mb-8 text-xs">
            {["service", "date", "time", "details"].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <span className={clsx(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                  step === s ? "bg-blue-600 text-white" :
                  ["service", "date", "time", "details"].indexOf(step) > i
                    ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"
                )}>
                  {i + 1}
                </span>
                <span className={clsx(
                  "capitalize",
                  step === s ? "text-gray-900 font-medium" : "text-gray-500"
                )}>
                  {s}
                </span>
                {i < 3 && <div className="w-8 h-px bg-gray-300"></div>}
              </div>
            ))}
          </div>
        )}

        {/* Step 1: Select Service */}
        {step === "service" && (
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Select a service</h2>
            <div className="space-y-3">
              {offers.length > 0 ? offers.map((offer) => (
                <button
                  key={offer.id}
                  onClick={() => {
                    setSelectedOffer(offer);
                    loadAvailableDates(offer);
                    setStep("date");
                  }}
                  className="w-full bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-blue-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{offer.name}</p>
                      {offer.description && (
                        <p className="text-sm text-gray-500 mt-1">{offer.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        {offer.session_duration_mins || 60} mins
                      </p>
                    </div>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatCurrency(offer.price_cents)}
                    </p>
                  </div>
                </button>
              )) : (
                <p className="text-gray-500 text-center py-8">No services available</p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Select Date */}
        {step === "date" && (
          <div>
            <button
              onClick={() => { setStep("service"); setSelectedOffer(null); }}
              className="text-sm text-gray-500 hover:text-gray-700 mb-4"
            >
              &larr; Back
            </button>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Select a date</h2>

            {bookingDisabled ? (
              <p className="text-gray-500 text-center py-8">{error}</p>
            ) : loadingDates ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {availableDates.length > 0 ? availableDates.map((dateStr) => {
                  const d = formatDateDisplay(dateStr);
                  return (
                    <button
                      key={dateStr}
                      onClick={() => {
                        setSelectedDate(dateStr);
                        setSelectedTime(null);
                        loadTimeSlots(dateStr);
                        setStep("time");
                      }}
                      className={clsx(
                        "p-3 rounded-lg border text-center transition-all",
                        selectedDate === dateStr
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      )}
                    >
                      <p className="text-xs text-gray-500">{d.day}</p>
                      <p className="text-lg font-medium text-gray-900">{d.date}</p>
                    </button>
                  );
                }) : (
                  <p className="col-span-full text-gray-500 text-center py-8">
                    No available dates
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Select Time */}
        {step === "time" && (
          <div>
            <button
              onClick={() => setStep("date")}
              className="text-sm text-gray-500 hover:text-gray-700 mb-4"
            >
              &larr; Back
            </button>
            <h2 className="text-lg font-medium text-gray-900 mb-1">Select a time</h2>
            {selectedDate && (
              <p className="text-sm text-gray-500 mb-4">{formatDateDisplay(selectedDate).full}</p>
            )}

            {loadingSlots ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {timeSlots.length > 0 ? timeSlots.map((slot) => (
                  <button
                    key={slot.start}
                    onClick={() => {
                      setSelectedTime(slot.start);
                      setStep("details");
                    }}
                    className={clsx(
                      "p-3 rounded-lg border text-center transition-all",
                      selectedTime === slot.start
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    )}
                  >
                    <p className="text-sm font-medium text-gray-900">{formatTime(slot.start)}</p>
                  </button>
                )) : (
                  <p className="col-span-full text-gray-500 text-center py-8">
                    No available times for this date
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Enter Details */}
        {step === "details" && (
          <div>
            <button
              onClick={() => setStep("time")}
              className="text-sm text-gray-500 hover:text-gray-700 mb-4"
            >
              &larr; Back
            </button>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Your details</h2>

            {/* Booking Summary */}
            <div className="bg-gray-100 rounded-lg p-4 mb-6">
              <p className="font-medium text-gray-900">{selectedOffer?.name}</p>
              <p className="text-sm text-gray-500">
                {selectedDate && formatDateDisplay(selectedDate).full} at {selectedTime && formatTime(selectedTime)}
              </p>
              <p className="text-sm font-medium text-gray-900 mt-2">
                {formatCurrency(selectedOffer?.price_cents || 0)}
              </p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleBooking(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={clientForm.name}
                  onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={clientForm.email}
                  onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={clientForm.phone}
                  onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={clientForm.notes}
                  onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Anything you'd like us to know..."
                />
              </div>

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <button
                type="submit"
                disabled={booking}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {booking ? "Booking..." : "Confirm Booking"}
              </button>
            </form>
          </div>
        )}

        {/* Confirmed */}
        {step === "confirmed" && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Booking Confirmed!</h2>
            <p className="text-gray-500 mb-6">
              We've sent a confirmation to {clientForm.email}
            </p>
            <div className="bg-white rounded-lg border border-gray-200 p-4 inline-block text-left">
              <p className="font-medium text-gray-900">{selectedOffer?.name}</p>
              <p className="text-sm text-gray-500">
                {selectedDate && formatDateDisplay(selectedDate).full} at {selectedTime && formatTime(selectedTime)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                with {branding?.display_name || org.name}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
