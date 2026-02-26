"use client";

import { useState } from "react";
import Link from "next/link";

interface Offer {
  id: string;
  name: string;
  description: string | null;
  offer_type: string;
  price_cents: number;
  sessions_included: number | null;
  bonus_sessions: number | null;
  pack_validity_days: number | null;
  is_featured: boolean | null;
  sort_order: number | null;
}

interface Props {
  token: string;
  displayName: string;
  primaryColor: string;
  offers: Offer[];
  stripeReady: boolean;
  gstRegistered: boolean;
  passStripeFees: boolean;
}

function fmtPrice(cents: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100);
}

export default function PackagesClient({ token, displayName, primaryColor, offers, stripeReady, gstRegistered, passStripeFees }: Props) {
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleBuy(offerId: string) {
    setBuying(offerId);
    setError("");

    const res = await fetch("/api/portal/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, offer_id: offerId }),
    });
    const data = await res.json();

    if (!res.ok || !data.url) {
      setError(data.error || "Failed to start checkout. Please try again.");
      setBuying(null);
    } else {
      window.location.href = data.url;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-center gap-3">
          <Link href={`/portal/${token}`} className="text-gray-400 hover:text-gray-600 text-lg">←</Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: primaryColor }}>
              {displayName}
            </p>
            <h1 className="text-base font-semibold text-gray-900">Buy sessions</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
        )}

        {!stripeReady && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-4 py-4 text-sm">
            Online payments are not yet set up. Contact your coach to purchase sessions.
          </div>
        )}

        {stripeReady && offers.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-10 text-center text-sm text-gray-500">
            No packages are available at the moment. Check back soon.
          </div>
        )}

        {offers.map(offer => {
          const displayCents = passStripeFees
            ? Math.ceil((offer.price_cents + 30) / (1 - 0.0175))
            : offer.price_cents;
          const priceLabel = gstRegistered && passStripeFees
            ? "incl. GST + card surcharge"
            : gstRegistered
            ? "incl. GST"
            : passStripeFees
            ? "incl. card surcharge"
            : null;
          const totalSessions = (offer.sessions_included ?? 1) + (offer.bonus_sessions ?? 0);
          const pricePerSession = totalSessions > 0 ? displayCents / totalSessions : displayCents;
          const isBuying = buying === offer.id;

          return (
            <div
              key={offer.id}
              className={`bg-white rounded-xl overflow-hidden ${offer.is_featured ? "border-2" : "border border-gray-200"}`}
              style={offer.is_featured ? { borderColor: primaryColor } : undefined}
            >
              {offer.is_featured && (
                <div
                  className="px-5 py-1.5 text-xs font-semibold text-white text-center"
                  style={{ backgroundColor: primaryColor }}
                >
                  Most popular
                </div>
              )}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h2 className="font-semibold text-gray-900">{offer.name}</h2>
                    {offer.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{offer.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {offer.offer_type === "session_pack" && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {totalSessions} session{totalSessions !== 1 ? "s" : ""}
                          {(offer.bonus_sessions ?? 0) > 0 && ` (${offer.bonus_sessions} bonus)`}
                        </span>
                      )}
                      {offer.pack_validity_days && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          Valid {offer.pack_validity_days} days
                        </span>
                      )}
                      {totalSessions > 1 && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {fmtPrice(pricePerSession)} / session
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold text-gray-900">{fmtPrice(displayCents)}</p>
                    {priceLabel && (
                      <p className="text-xs text-gray-400 mt-0.5">{priceLabel}</p>
                    )}
                  </div>
                </div>

                {stripeReady && (
                  <button
                    onClick={() => handleBuy(offer.id)}
                    disabled={isBuying || buying !== null}
                    className="mt-4 w-full py-3 rounded-lg text-white font-medium disabled:opacity-50 transition-opacity"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {isBuying ? "Redirecting to payment…" : "Buy now"}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <p className="text-center text-xs text-gray-400 pt-2">
          Payments are processed securely via Stripe.
        </p>
      </div>
    </div>
  );
}
