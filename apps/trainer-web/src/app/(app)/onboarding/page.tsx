"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";

const DAYS_OF_WEEK = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];

const TIMEZONES = [
  "Australia/Brisbane",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Adelaide",
  "Australia/Perth",
  "Australia/Darwin",
  "Australia/Hobart",
];

type Step = "business" | "offer" | "availability" | "settings" | "done";
const STEPS: Step[] = ["business", "offer", "availability", "settings", "done"];
const STEP_LABELS: Record<Step, string> = {
  business: "Business",
  offer: "First Offer",
  availability: "Availability",
  settings: "Settings",
  done: "All Done",
};

export default function OnboardingWizard() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("business");
  const [saving, setSaving] = useState(false);
  const [orgId, setOrgId] = useState("");
  const [orgSlug, setOrgSlug] = useState("");

  // Step 1: Business basics
  const [businessName, setBusinessName] = useState("");
  const [timezone, setTimezone] = useState("Australia/Brisbane");

  // Step 2: First offer
  const [offerName, setOfferName] = useState("PT Session");
  const [offerDuration, setOfferDuration] = useState("60");
  const [offerPrice, setOfferPrice] = useState("80");

  // Step 3: Availability
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState("06:00");
  const [endTime, setEndTime] = useState("18:00");

  // Step 4: Booking settings
  const [minNotice, setMinNotice] = useState("24");
  const [maxAdvance, setMaxAdvance] = useState("30");
  const [buffer, setBuffer] = useState("15");

  useEffect(() => {
    loadExistingData();
  }, []);

  async function loadExistingData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id, orgs(id, name, slug)")
      .eq("user_id", user.id)
      .single();

    if (membership) {
      setOrgId(membership.org_id);
      const org = membership.orgs as any;
      if (org?.name) setBusinessName(org.name);
      if (org?.slug) setOrgSlug(org.slug);
    }
  }

  function toggleDay(day: number) {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  }

  async function handleNext() {
    setSaving(true);

    try {
      if (step === "business") {
        // Update org name and save timezone to booking_settings
        await supabase.from("orgs").update({ name: businessName }).eq("id", orgId);

        // Upsert booking_settings with timezone
        const { data: existing } = await supabase
          .from("booking_settings")
          .select("id")
          .eq("org_id", orgId)
          .single();

        if (existing) {
          await supabase.from("booking_settings").update({ timezone }).eq("org_id", orgId);
        } else {
          await supabase.from("booking_settings").insert({ org_id: orgId, timezone });
        }

        setStep("offer");
      } else if (step === "offer") {
        // Create first offer
        await supabase.from("offers").insert({
          org_id: orgId,
          name: offerName,
          offer_type: "single_session",
          session_duration_mins: parseInt(offerDuration),
          price_cents: Math.round(parseFloat(offerPrice) * 100),
          is_active: true,
          sort_order: 0,
        });

        setStep("availability");
      } else if (step === "availability") {
        // Create availability rows for selected days
        const rows = selectedDays.map(day => ({
          org_id: orgId,
          day_of_week: day,
          start_time: startTime,
          end_time: endTime,
          is_available: true,
        }));

        // Delete existing availability first
        await supabase.from("availability").delete().eq("org_id", orgId);
        if (rows.length > 0) {
          await supabase.from("availability").insert(rows);
        }

        setStep("settings");
      } else if (step === "settings") {
        // Save booking settings
        await supabase.from("booking_settings").update({
          min_notice_hours: parseInt(minNotice),
          max_advance_days: parseInt(maxAdvance),
          buffer_between_mins: parseInt(buffer),
          slot_duration_mins: parseInt(offerDuration),
          allow_client_booking: true,
        }).eq("org_id", orgId);

        // Mark onboarding complete
        await supabase.from("orgs").update({ onboarding_completed: true }).eq("id", orgId);

        setStep("done");
      }
    } catch (err) {
      console.error("Onboarding step error:", err);
    }

    setSaving(false);
  }

  function handleFinish() {
    router.push("/dashboard");
    router.refresh();
  }

  const stepIndex = STEPS.indexOf(step);

  const bookingUrl = typeof window !== "undefined"
    ? `${window.location.origin}/book/${orgSlug || businessName.toLowerCase().replace(/\s+/g, "-")}`
    : "";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        {step !== "done" && (
          <div className="flex items-center gap-1 mb-8">
            {STEPS.slice(0, 4).map((s, i) => (
              <div key={s} className="flex-1 flex items-center gap-1">
                <div className={clsx(
                  "h-1.5 rounded-full flex-1 transition-colors",
                  i <= stepIndex ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
                )} />
              </div>
            ))}
          </div>
        )}

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
          {/* Step 1: Business Basics */}
          {step === "business" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Welcome to Coach OS</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Let's set up your business in under 2 minutes.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Business Name</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. Troy Morgan Fitness"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz} value={tz}>{tz.replace("Australia/", "")}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Step 2: First Offer */}
          {step === "offer" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Create your first offer</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">You can add more offers later in Pricing.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Session Name</label>
                <input
                  type="text"
                  value={offerName}
                  onChange={(e) => setOfferName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration (mins)</label>
                  <select
                    value={offerDuration}
                    onChange={(e) => setOfferDuration(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="30">30 mins</option>
                    <option value="45">45 mins</option>
                    <option value="60">60 mins</option>
                    <option value="90">90 mins</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price (AUD)</label>
                  <input
                    type="number"
                    value={offerPrice}
                    onChange={(e) => setOfferPrice(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="80"
                    min="0"
                    step="5"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Availability */}
          {step === "availability" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Set your availability</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Select the days and hours you're available for bookings.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Available Days</label>
                <div className="flex gap-2">
                  {DAYS_OF_WEEK.map(d => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleDay(d.value)}
                      className={clsx(
                        "flex-1 py-2 rounded-lg text-sm font-medium transition-colors border",
                        selectedDays.includes(d.value)
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-blue-300"
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Time</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Booking Settings */}
          {step === "settings" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Booking settings</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure how clients can book with you.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Minimum notice (hours)</label>
                <select
                  value={minNotice}
                  onChange={(e) => setMinNotice(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="1">1 hour</option>
                  <option value="2">2 hours</option>
                  <option value="4">4 hours</option>
                  <option value="12">12 hours</option>
                  <option value="24">24 hours</option>
                  <option value="48">48 hours</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">Clients must book at least this far in advance</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max advance booking (days)</label>
                <select
                  value={maxAdvance}
                  onChange={(e) => setMaxAdvance(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="7">1 week</option>
                  <option value="14">2 weeks</option>
                  <option value="30">1 month</option>
                  <option value="60">2 months</option>
                  <option value="90">3 months</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Buffer between sessions (mins)</label>
                <select
                  value={buffer}
                  onChange={(e) => setBuffer(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="0">No buffer</option>
                  <option value="5">5 mins</option>
                  <option value="10">10 mins</option>
                  <option value="15">15 mins</option>
                  <option value="30">30 mins</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 5: Done */}
          {step === "done" && (
            <div className="space-y-6 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">You're all set!</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Your business is ready to accept bookings.</p>
              </div>

              {bookingUrl && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-left">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Your booking page</p>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400 break-all">{bookingUrl}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleFinish}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
                >
                  Go to Dashboard
                </button>
                <button
                  onClick={() => router.push("/clients/new")}
                  className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm"
                >
                  Add First Client
                </button>
              </div>
            </div>
          )}

          {/* Navigation */}
          {step !== "done" && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
              {stepIndex > 0 ? (
                <button
                  onClick={() => setStep(STEPS[stepIndex - 1])}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  &larr; Back
                </button>
              ) : (
                <div />
              )}
              <button
                onClick={handleNext}
                disabled={saving || (step === "business" && !businessName.trim())}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
              >
                {saving ? "Saving..." : step === "settings" ? "Complete Setup" : "Continue"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
