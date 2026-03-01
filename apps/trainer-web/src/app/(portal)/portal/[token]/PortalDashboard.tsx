"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import NutritionView, { NutritionPlan, Meal } from "./NutritionView";
import FeedbackDrawer from "./FeedbackDrawer";

interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
}

interface ActivePurchase {
  id: string;
  sessions_total: number;
  sessions_remaining: number;
  bookable_remaining: number;
  expires_at: string | null;
  offer_id: { name: string } | null;
}

interface Props {
  token: string;
  clientName: string;
  displayName: string;
  primaryColor: string;
  sessionsRemaining: number;
  cancelNoticeHours: number;
  upcomingBookings: Booking[];
  pastBookings: Booking[];
  mealPlan: NutritionPlan | null;
  activePurchases: ActivePurchase[];
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true });
}

export default function PortalDashboard({
  token,
  clientName,
  displayName,
  primaryColor,
  sessionsRemaining,
  cancelNoticeHours,
  upcomingBookings,
  pastBookings,
  mealPlan,
  activePurchases,
}: Props) {
  const searchParams = useSearchParams();
  const justPurchased = searchParams.get("purchased") === "1";

  const [cancelled, setCancelled] = useState<Set<string>>(new Set());
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [upcomingOpen, setUpcomingOpen] = useState(true);
  const [pastOpen, setPastOpen] = useState(true);

  // Tab state
  const [activeTab, setActiveTab] = useState<"sessions" | "packages" | "nutrition">("sessions");

  // Feedback drawer state
  const [feedbackMeal, setFeedbackMeal] = useState<Meal | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  function handleOpenFeedback(meal: Meal) {
    setFeedbackMeal(meal);
    setFeedbackOpen(true);
  }

  async function handleCancel(booking: Booking) {
    const start = new Date(booking.start_time);
    const hoursUntil = (start.getTime() - Date.now()) / 3_600_000;

    if (hoursUntil < cancelNoticeHours) {
      setError(`Cancellations require at least ${cancelNoticeHours} hours notice.`);
      return;
    }

    const sessionLabel = `${fmtDate(booking.start_time)} at ${fmtTime(booking.start_time)}`;
    if (!confirm(`Cancel your session on ${sessionLabel}?`)) return;

    setCancelling(booking.id);
    setError("");

    try {
      const res = await fetch("/api/portal/cancel-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, booking_id: booking.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to cancel booking");
      } else {
        setCancelled(prev => new Set([...prev, booking.id]));
      }
    } catch {
      setError("Failed to cancel booking. Please try again.");
    } finally {
      setCancelling(null);
    }
  }

  const visibleUpcoming = upcomingBookings.filter(b => !cancelled.has(b.id));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: primaryColor }}>
              {displayName}
            </p>
            <h1 className="text-lg font-semibold text-gray-900 mt-0.5">
              Hi, {clientName.split(" ")[0]}
            </h1>
          </div>
          <span className="text-xs text-gray-400">My Portal</span>
        </div>

        {/* Tab bar */}
        <div className="max-w-2xl mx-auto px-4 flex gap-1">
          {(["sessions", "packages", "nutrition"] as const).map(tab => {
            const label = tab === "sessions" ? "Sessions" : tab === "packages" ? "Packages" : "Nutrition";
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab
                    ? "border-current font-semibold"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
                style={activeTab === tab ? { color: primaryColor, borderColor: primaryColor } : {}}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sessions tab content */}
      {activeTab === "sessions" && (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {/* Sessions remaining + book CTA */}
          <div className="rounded-xl p-5 text-white flex items-center justify-between gap-4" style={{ backgroundColor: primaryColor }}>
            <div>
              <p className="text-sm font-medium opacity-80">Sessions remaining</p>
              <p className="text-4xl font-bold mt-1">{sessionsRemaining}</p>
            </div>
              <div className="flex flex-col gap-2 shrink-0">
              {sessionsRemaining > 0 && (
                <Link
                  href={`/portal/${token}/book`}
                  className="px-4 py-2 rounded-lg bg-white text-sm font-semibold text-center"
                  style={{ color: primaryColor }}
                >
                  Book a session
                </Link>
              )}
              <Link
                href={`/portal/${token}/packages`}
                className="px-4 py-2 rounded-lg bg-white/20 text-sm font-medium text-white text-center"
              >
                Buy sessions
              </Link>
            </div>
          </div>

          {justPurchased && (
            <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm">
              Payment successful! Your sessions have been added. Book your first session below.
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Upcoming sessions */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setUpcomingOpen(o => !o)}
              className="w-full px-5 py-4 flex items-center justify-between border-b border-gray-100 text-left"
            >
              <h2 className="font-semibold text-gray-900">Upcoming sessions</h2>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${upcomingOpen ? "" : "-rotate-180"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
            </button>
            {upcomingOpen && (visibleUpcoming.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {visibleUpcoming.map((booking) => {
                  const isCancelling = cancelling === booking.id;
                  const hoursUntil = (new Date(booking.start_time).getTime() - Date.now()) / 3_600_000;
                  const canCancel = hoursUntil >= cancelNoticeHours;
                  return (
                    <li key={booking.id} className="px-5 py-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{fmtDate(booking.start_time)}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {fmtTime(booking.start_time)} – {fmtTime(booking.end_time)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Confirmed
                        </span>
                        {canCancel ? (
                          <button
                            onClick={() => handleCancel(booking)}
                            disabled={isCancelling}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
                          >
                            {isCancelling ? "Cancelling…" : "Cancel"}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400" title={`Requires ${cancelNoticeHours}h notice`}>
                            Can't cancel
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-gray-500">No upcoming sessions</p>
                {sessionsRemaining > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    You have {sessionsRemaining} session{sessionsRemaining !== 1 ? "s" : ""} ready to book
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Past sessions */}
          {pastBookings.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setPastOpen(o => !o)}
                className="w-full px-5 py-4 flex items-center justify-between border-b border-gray-100 text-left"
              >
                <h2 className="font-semibold text-gray-900">Past sessions</h2>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${pastOpen ? "" : "-rotate-180"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
              </button>
              {pastOpen && (
                <ul className="divide-y divide-gray-100">
                  {pastBookings.map((booking) => (
                    <li key={booking.id} className="px-5 py-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{fmtDate(booking.start_time)}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {fmtTime(booking.start_time)} – {fmtTime(booking.end_time)}
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        booking.status === "completed"
                          ? "bg-blue-100 text-blue-700"
                          : booking.status === "cancelled"
                          ? "bg-gray-100 text-gray-500"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {booking.status === "completed" ? "Completed" : booking.status === "cancelled" ? "Cancelled" : "Past"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <p className="text-center text-xs text-gray-400 pt-2">
            This is your personal portal link — keep it safe.
          </p>
        </div>
      )}

      {/* Packages tab content */}
      {activeTab === "packages" && (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {activePurchases.length > 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Your packages</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {activePurchases.map((p) => {
                  const used = p.sessions_total - p.sessions_remaining;
                  const booked = p.sessions_remaining - p.bookable_remaining;
                  const remaining = p.bookable_remaining;
                  const pct = p.sessions_total > 0 ? ((used / p.sessions_total) * 100) : 0;
                  return (
                    <div key={p.id} className="px-5 py-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-medium text-gray-900 text-sm">
                          {(p.offer_id as any)?.name ?? "Package"}
                        </p>
                        {p.expires_at && (
                          <span className="text-xs text-gray-400">
                            Expires {new Date(p.expires_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        )}
                      </div>
                      {/* Progress bar */}
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: primaryColor }}
                        />
                      </div>
                      {/* Stats grid */}
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div>
                          <p className="text-lg font-bold text-gray-900">{p.sessions_total}</p>
                          <p className="text-xs text-gray-500">Total</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-gray-900">{used}</p>
                          <p className="text-xs text-gray-500">Used</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-amber-600">{booked}</p>
                          <p className="text-xs text-gray-500">Booked</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold" style={{ color: primaryColor }}>{remaining}</p>
                          <p className="text-xs text-gray-500">Remaining</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-8 text-center">
              <p className="text-sm text-gray-500">No active packages</p>
              <Link
                href={`/portal/${token}/packages`}
                className="inline-block mt-3 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                Buy sessions
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Nutrition tab content */}
      {activeTab === "nutrition" && (
        <div
          style={{
            background: "#07081a",
            minHeight: "calc(100vh - 130px)",
          }}
        >
          {mealPlan ? (
            <NutritionView
              plan={mealPlan}
              token={token}
              primaryColor={primaryColor}
              onFeedback={handleOpenFeedback}
              clientName={clientName}
            />
          ) : (
            <div className="max-w-6xl mx-auto px-4 py-6">
              <div
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03))",
                  border: "1px solid rgba(255,255,255,.10)",
                  borderRadius: 18,
                  padding: "48px 32px",
                  textAlign: "center",
                  color: "#eef0ff",
                }}
              >
                <p style={{ fontWeight: 700, fontSize: 15, margin: "0 0 6px" }}>No meal plan published yet</p>
                <p style={{ fontSize: 13, color: "rgba(238,240,255,0.70)", margin: 0 }}>
                  Your coach will publish one when it&apos;s ready.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Feedback drawer — always mounted, isOpen controls visibility */}
      <FeedbackDrawer
        isOpen={feedbackOpen}
        meal={feedbackMeal}
        planId={mealPlan?.id ?? ""}
        token={token}
        primaryColor={primaryColor}
        onClose={() => setFeedbackOpen(false)}
        onSuccess={() => setFeedbackOpen(false)}
      />
    </div>
  );
}
