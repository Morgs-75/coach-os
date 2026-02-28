"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

type ScoredSlot = { start: string; end: string; score: number; recommended: boolean };

type ActivePurchase = {
  id: string;
  sessions_remaining: number;
  expires_at: string | null;
  session_duration_mins: number | null;
  offer_id: { name: string; session_duration_mins: number | null } | null;
};

// Note: this page intentionally uses client-side data fetching via the
// /api/portal/validate endpoint so the token never touches the server render.

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmt(iso: string, opts: Intl.DateTimeFormatOptions, timeZone?: string) {
  return new Date(iso).toLocaleString("en-AU", { ...opts, ...(timeZone ? { timeZone } : {}) });
}

function getDuration(p: ActivePurchase): number {
  return p.session_duration_mins ?? p.offer_id?.session_duration_mins ?? 60;
}

function getOfferName(p: ActivePurchase): string {
  return p.offer_id?.name ?? "Session Package";
}

export default function PortalBookPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clientName, setClientName] = useState("");
  const [orgId, setOrgId] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0ea5e9");
  const [displayName, setDisplayName] = useState("");
  const [activePurchases, setActivePurchases] = useState<ActivePurchase[]>([]);
  const [selectedPurchase, setSelectedPurchase] = useState<ActivePurchase | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [timezone, setTimezone] = useState("Australia/Brisbane");
  const [slotDurationMins, setSlotDurationMins] = useState(60);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [step, setStep] = useState<"package" | "date" | "time" | "confirm" | "done">("package");
  const [booking, setBooking] = useState(false);
  const [timeSlots, setTimeSlots] = useState<ScoredSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [datesLoading, setDatesLoading] = useState(false);
  // Track if package was auto-selected (single purchase) to control back navigation
  const [autoSelected, setAutoSelected] = useState(false);

  useEffect(() => {
    loadData();
  }, [token]);

  async function loadData() {
    setLoading(true);
    setError("");

    // Validate token
    const vRes = await fetch(`/api/portal/validate?token=${token}`);
    if (!vRes.ok) { setError("This portal link is invalid."); setLoading(false); return; }
    const v = await vRes.json();
    setClientName(v.client_name);
    setOrgId(v.org_id);

    // Load branding from Supabase (public-readable)
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const brandingRes = await fetch(`${supaUrl}/rest/v1/branding?select=display_name,primary_color&org_id=eq.${v.org_id}`, {
      headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` },
    });

    const brandingData = await brandingRes.json();
    if (brandingData?.[0]) {
      setPrimaryColor(brandingData[0].primary_color ?? "#0ea5e9");
      setDisplayName(brandingData[0].display_name ?? "");
    }

    // Fetch purchases with offer name and duration
    const sessRes = await fetch(
      `${supaUrl}/rest/v1/client_purchases?select=id,sessions_remaining,expires_at,session_duration_mins,offer_id(name,session_duration_mins)&client_id=eq.${v.client_id}&payment_status=eq.succeeded&sessions_remaining=gt.0`,
      { headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` } }
    );

    let purchases: ActivePurchase[] = [];
    if (sessRes.ok) {
      const purchasesData = await sessRes.json();
      purchases = (purchasesData ?? []).filter((p: any) =>
        !p.expires_at || new Date(p.expires_at) >= new Date()
      );
      setActivePurchases(purchases);
    }

    // Auto-select if only one purchase and skip to date step
    if (purchases.length === 1) {
      setSelectedPurchase(purchases[0]);
      setAutoSelected(true);
      setStep("date");
      // Fetch dates for this purchase's duration
      await fetchDates(token, getDuration(purchases[0]));
    } else if (purchases.length === 0) {
      // No sessions — still show date step (server will gate at booking time)
      setStep("date");
      setAutoSelected(true);
      await fetchDates(token);
    }

    setLoading(false);
  }

  async function fetchDates(tkn: string, duration?: number) {
    setDatesLoading(true);
    const durationQuery = duration ? `&duration=${duration}` : "";
    const datesRes = await fetch(`/api/portal/available-dates?token=${tkn}${durationQuery}`);
    if (datesRes.ok) {
      const datesData = await datesRes.json();
      if (datesData.error) {
        setError(datesData.error);
      } else {
        setAvailableDates(datesData.dates ?? []);
        setTimezone(datesData.timezone ?? "Australia/Brisbane");
      }
    }
    setDatesLoading(false);
  }

  function selectPackage(purchase: ActivePurchase) {
    setSelectedPurchase(purchase);
    setAutoSelected(false);
    setSelectedDate(null);
    setSelectedTime(null);
    setAvailableDates([]);
    setStep("date");
    fetchDates(token, getDuration(purchase));
  }

  const effectiveDurationMins = selectedPurchase ? getDuration(selectedPurchase) : slotDurationMins;

  const sessionsRemaining = activePurchases.reduce((sum, p) => sum + (p.sessions_remaining ?? 0), 0);

  // When a date is selected, fetch scored slots from the server
  useEffect(() => {
    if (!selectedDate || !token) return;
    const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(selectedDate);
    const durationQuery = selectedPurchase ? `&duration=${getDuration(selectedPurchase)}` : "";
    setSlotsLoading(true);
    fetch(`/api/portal/available-slots?token=${token}&date=${dateStr}${durationQuery}`)
      .then(r => r.json())
      .then(data => {
        setTimeSlots(data.slots ?? []);
      })
      .catch(() => setTimeSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [selectedDate, token, timezone, selectedPurchase]);

  async function handleConfirm() {
    if (!selectedTime) return;
    setBooking(true);
    setError("");

    const body: any = { token, start_time: selectedTime };
    if (selectedPurchase) body.purchase_id = selectedPurchase.id;

    const res = await fetch("/api/portal/create-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to create booking.");
      setBooking(false);
    } else {
      setStep("done");
      setBooking(false);
    }
  }

  function handleBack() {
    switch (step) {
      case "package":
        router.back();
        break;
      case "date":
        if (autoSelected) {
          router.back();
        } else {
          setStep("package");
          setSelectedPurchase(null);
          setAvailableDates([]);
        }
        break;
      case "time":
        setStep("date");
        setSelectedDate(null);
        break;
      case "confirm":
        setStep("time");
        setSelectedTime(null);
        break;
      default:
        router.back();
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error && step !== "date" && step !== "package") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <p className="text-red-600 font-medium">{error}</p>
          <button onClick={() => router.back()} className="mt-4 text-sm text-gray-500 underline">Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-center gap-3">
          <button onClick={handleBack} className="text-gray-400 hover:text-gray-600 text-lg">&larr;</button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: primaryColor }}>
              {displayName}
            </p>
            <h1 className="text-base font-semibold text-gray-900">Book a session</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
        )}

        {step === "done" && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-gray-900">Session booked!</p>
            <p className="text-sm text-gray-500">
              {selectedTime && fmt(selectedTime, { weekday: "long", day: "numeric", month: "long" }, timezone)}
              {" at "}
              {selectedTime && fmt(selectedTime, { hour: "numeric", minute: "2-digit", hour12: true }, timezone)}
            </p>
            <p className="text-xs text-gray-400">A confirmation SMS has been sent to you.</p>
            <button
              onClick={() => router.push(`/portal/${token}`)}
              className="mt-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: primaryColor }}
            >
              Back to my portal
            </button>
          </div>
        )}

        {step === "package" && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Select a package</h2>
              <p className="text-sm text-gray-500 mt-1">Choose which package to use for this session</p>
            </div>
            <div className="p-4 space-y-3">
              {activePurchases.map(p => (
                <button
                  key={p.id}
                  onClick={() => selectPackage(p)}
                  className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-gray-400 transition-all"
                >
                  <p className="font-medium text-gray-900">{getOfferName(p)}</p>
                  <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
                    <span>{getDuration(p)} min session</span>
                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                    <span>{p.sessions_remaining} session{p.sessions_remaining !== 1 ? "s" : ""} left</span>
                    {p.expires_at && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                        <span>Expires {new Date(p.expires_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</span>
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "date" && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Select a date</h2>
              {selectedPurchase && (
                <p className="text-sm text-gray-500 mt-1">
                  {getOfferName(selectedPurchase)} &middot; {getDuration(selectedPurchase)} min
                </p>
              )}
            </div>
            {datesLoading ? (
              <div className="px-5 py-8 flex justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : availableDates.length > 0 ? (
              <div className="p-4 grid grid-cols-4 sm:grid-cols-5 gap-2">
                {availableDates.map(dateStr => {
                  // dateStr is YYYY-MM-DD in coach timezone — parse at midday UTC to avoid day-shift
                  const d = new Date(`${dateStr}T12:00:00Z`);
                  const dayOfWeek = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(d);
                  const dayNum = new Intl.DateTimeFormat("en-AU", { timeZone: timezone, day: "numeric" }).format(d);
                  return (
                    <button
                      key={dateStr}
                      onClick={() => { setSelectedDate(d); setSelectedTime(null); setStep("time"); }}
                      className="p-3 rounded-lg border border-gray-200 text-center hover:border-gray-400 transition-all"
                    >
                      <p className="text-xs text-gray-500">{dayOfWeek}</p>
                      <p className="text-lg font-medium text-gray-900">{dayNum}</p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-5 py-8 text-center text-sm text-gray-500">No available dates</div>
            )}
          </div>
        )}

        {step === "time" && selectedDate && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">
                Select a time &mdash; {selectedDate.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: timezone })}
              </h2>
            </div>
            {slotsLoading ? (
              <div className="px-5 py-8 flex justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : timeSlots.length > 0 ? (
              <div className="p-4 grid grid-cols-3 sm:grid-cols-4 gap-2">
                {timeSlots.map(slot => (
                  <button
                    key={slot.start}
                    onClick={() => { setSelectedTime(slot.start); setStep("confirm"); }}
                    className="p-3 rounded-lg border border-gray-200 text-center hover:border-gray-400 transition-all"
                  >
                    <p className="text-sm font-medium text-gray-900">
                      {fmt(slot.start, { hour: "numeric", minute: "2-digit", hour12: true }, timezone)}
                    </p>
                    {slot.recommended && (
                      <span className="text-xs bg-brand-500/20 text-brand-400 border border-brand-500/30 rounded-full px-2 py-0.5 ml-2">
                        Best
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-5 py-8 text-center text-sm text-gray-500">No available times</div>
            )}
          </div>
        )}

        {step === "confirm" && selectedDate && selectedTime && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <h2 className="font-semibold text-gray-900">Confirm booking</h2>
            <div className="bg-gray-50 rounded-lg p-4 space-y-1">
              {selectedPurchase && (
                <p className="text-sm font-medium" style={{ color: primaryColor }}>
                  {getOfferName(selectedPurchase)}
                </p>
              )}
              <p className="font-medium text-gray-900">
                {fmt(selectedTime, { weekday: "long", day: "numeric", month: "long" }, timezone)}
              </p>
              <p className="text-sm text-gray-500">
                {fmt(selectedTime, { hour: "numeric", minute: "2-digit", hour12: true }, timezone)}
                {" – "}
                {fmt(
                  new Date(new Date(selectedTime).getTime() + effectiveDurationMins * 60_000).toISOString(),
                  { hour: "numeric", minute: "2-digit", hour12: true },
                  timezone
                )}
              </p>
              <p className="text-sm text-gray-500">{effectiveDurationMins} mins &middot; in person</p>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              onClick={handleConfirm}
              disabled={booking}
              className="w-full py-3 rounded-lg text-white font-medium disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
            >
              {booking ? "Booking\u2026" : "Confirm booking"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
