"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "clsx";

interface Offer {
  id: string;
  name: string;
  description: string | null;
  offer_type: "subscription" | "session_pack" | "single_session";
  price_cents: number;
  billing_period: string | null;
  sessions_included: number | null;
  bonus_sessions: number | null;
  pack_validity_days: number | null;
  session_duration_mins: number | null;
  is_active: boolean;
  sort_order: number;
}

const aud = (cents: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
  }).format(cents / 100);

function offerLine(offer: Offer): string {
  const price = aud(offer.price_cents);
  if (offer.offer_type === "subscription") {
    const period = offer.billing_period ?? "month";
    return `• ${offer.name} – ${price}/${period}`;
  }
  if (offer.offer_type === "session_pack") {
    const total = (offer.sessions_included ?? 0) + (offer.bonus_sessions ?? 0);
    const validity = offer.pack_validity_days ? `, valid ${offer.pack_validity_days} days` : "";
    return `• ${offer.name} – ${price} (${total} sessions${validity})`;
  }
  // single_session
  const dur = offer.session_duration_mins ? ` (${offer.session_duration_mins} min)` : "";
  return `• ${offer.name} – ${price}${dur}`;
}

function buildMessage(
  selectedOffers: Offer[],
  intro: string,
  outro: string
): string {
  if (selectedOffers.length === 0) return "";
  const introText = intro.trim() || "we have some great offers available:";
  const lines = selectedOffers.map(offerLine).join("\n");
  const outroText = outro.trim() ? `\n\n${outro.trim()}` : "";
  return `Hi {name}, ${introText}\n\n${lines}${outroText}\n\nReply STOP to opt out.`;
}

type RecipientFilter = "all" | "active";

export default function MarketingPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [intro, setIntro] = useState("");
  const [outro, setOutro] = useState("");
  const [recipientFilter, setRecipientFilter] = useState<RecipientFilter>("all");
  const [clientCount, setClientCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; errors: string[] } | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (orgId) fetchClientCount();
  }, [orgId, recipientFilter]);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) return;
    setOrgId(membership.org_id);

    const { data } = await supabase
      .from("offers")
      .select("id, name, description, offer_type, price_cents, billing_period, sessions_included, bonus_sessions, pack_validity_days, session_duration_mins, is_active, sort_order")
      .eq("org_id", membership.org_id)
      .order("sort_order");

    if (data) {
      setOffers(data);
      // Default: all active offers checked
      setSelected(new Set(data.filter((o) => o.is_active).map((o) => o.id)));
    }
    setLoading(false);
  }

  async function fetchClientCount() {
    if (!orgId) return;

    if (recipientFilter === "all") {
      const { count } = await supabase
        .from("clients")
        .select("id", { count: "exact", head: true } as any)
        .eq("org_id", orgId)
        .not("phone", "is", null)
        .neq("phone", "");
      setClientCount(count ?? 0);
    } else {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const { data: activeIds } = await supabase
        .from("bookings")
        .select("client_id")
        .eq("org_id", orgId)
        .gte("start_time", cutoff.toISOString());
      const ids = [...new Set((activeIds ?? []).map((r) => r.client_id))];
      if (ids.length === 0) {
        setClientCount(0);
        return;
      }
      const { count } = await supabase
        .from("clients")
        .select("id", { count: "exact", head: true } as any)
        .eq("org_id", orgId)
        .in("id", ids)
        .not("phone", "is", null)
        .neq("phone", "");
      setClientCount(count ?? 0);
    }
  }

  function toggleOffer(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedOffers = useMemo(
    () => offers.filter((o) => selected.has(o.id)),
    [offers, selected]
  );

  const preview = useMemo(
    () => buildMessage(selectedOffers, intro, outro),
    [selectedOffers, intro, outro]
  );

  const charCount = preview.replace("{name}", "there").length;
  const segments = Math.ceil(charCount / 153) || 1;

  async function handleSend() {
    if (!preview || clientCount === 0) return;
    const confirmed = window.confirm(
      `Send this SMS to ${clientCount} client${clientCount === 1 ? "" : "s"}? Each will receive a personalised message.`
    );
    if (!confirmed) return;

    setSending(true);
    setResult(null);

    try {
      const res = await fetch("/api/marketing/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: preview, recipient_filter: recipientFilter }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setResult({ sent: data.sent, failed: data.failed, errors: data.errors ?? [] });
    } catch (err) {
      setResult({ sent: 0, failed: clientCount ?? 0, errors: [err instanceof Error ? err.message : "Unknown error"] });
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <div className="text-gray-500 dark:text-gray-400 text-sm">Loading...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Marketing SMS</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Push your current offers to clients by SMS. Untick anything not relevant.
        </p>
      </div>

      {result && (
        <div className={clsx(
          "mb-6 rounded-lg p-4 text-sm",
          result.failed === 0
            ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200"
            : "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"
        )}>
          <p className="font-medium">
            {result.sent} sent{result.failed > 0 ? `, ${result.failed} failed` : " successfully"}
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-xs opacity-80">
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left column */}
        <div className="space-y-5">

          {/* Step 1 — Offers */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
              1. Select Offers
            </h2>

            {offers.length === 0 ? (
              <p className="text-sm text-gray-400">No offers found. Add some in <a href="/pricing" className="text-blue-600 hover:underline">Pricing</a>.</p>
            ) : (
              <div className="space-y-2">
                {offers.map((offer) => (
                  <label
                    key={offer.id}
                    className={clsx(
                      "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                      selected.has(offer.id)
                        ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(offer.id)}
                      onChange={() => toggleOffer(offer.id)}
                      className="mt-0.5 rounded text-blue-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{offer.name}</span>
                        <span className={clsx(
                          "text-xs px-1.5 py-0.5 rounded font-medium",
                          offer.offer_type === "subscription" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" :
                          offer.offer_type === "session_pack" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" :
                          "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                        )}>
                          {offer.offer_type === "subscription" ? "Subscription" :
                           offer.offer_type === "session_pack" ? "Session Pack" : "Single Session"}
                        </span>
                        {!offer.is_active && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">Inactive</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{offerLine(offer).replace("• ", "")}</p>
                      {offer.description && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{offer.description}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Step 2 — Customise message */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
              2. Customise Message
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Opening line <span className="text-gray-400">(after "Hi [name],")</span>
                </label>
                <input
                  type="text"
                  value={intro}
                  onChange={(e) => setIntro(e.target.value)}
                  placeholder="we have some great offers available:"
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Closing line <span className="text-gray-400">(optional, before opt-out)</span>
                </label>
                <input
                  type="text"
                  value={outro}
                  onChange={(e) => setOutro(e.target.value)}
                  placeholder="Reply to this message or call to book."
                  className="input text-sm"
                />
              </div>
            </div>
          </div>

          {/* Step 3 — Recipients */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
              3. Choose Recipients
            </h2>
            <div className="space-y-2">
              {(["all", "active"] as RecipientFilter[]).map((filter) => (
                <label key={filter} className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="recipient_filter"
                    value={filter}
                    checked={recipientFilter === filter}
                    onChange={() => setRecipientFilter(filter)}
                    className="mt-0.5 text-blue-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {filter === "all" ? "All clients with a phone number" : "Active clients only"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {filter === "all"
                        ? "Every client in your database who has a phone on file"
                        : "Clients with a booking in the last 90 days"}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {clientCount === null
                  ? "Counting recipients…"
                  : clientCount === 0
                  ? "No eligible recipients found."
                  : <><span className="font-semibold text-gray-900 dark:text-gray-100">{clientCount}</span> client{clientCount === 1 ? "" : "s"} will receive this message</>
                }
              </p>
            </div>

            <button
              onClick={handleSend}
              disabled={sending || selectedOffers.length === 0 || !clientCount}
              className={clsx(
                "mt-4 w-full py-2.5 rounded-lg text-sm font-semibold transition-colors",
                sending || selectedOffers.length === 0 || !clientCount
                  ? "bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              )}
            >
              {sending
                ? "Sending…"
                : selectedOffers.length === 0
                ? "Select at least one offer"
                : `Send to ${clientCount ?? "…"} client${clientCount === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>

        {/* Right column — preview */}
        <div className="lg:sticky lg:top-6 self-start">
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
              Message Preview
            </h2>

            {preview ? (
              <>
                {/* Phone mockup */}
                <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 mb-3">
                  <div className="bg-blue-500 text-white rounded-2xl rounded-br-sm px-4 py-3 max-w-xs ml-auto">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {preview.replace("{name}", "Sarah")}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 text-right mt-1">Preview (shown as "Sarah")</p>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{charCount} characters</span>
                  <span className={clsx(
                    "px-2 py-0.5 rounded-full font-medium",
                    segments === 1
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      : segments === 2
                      ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                      : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                  )}>
                    {segments} SMS segment{segments !== 1 ? "s" : ""}
                  </span>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  "{`{name}`}" will be replaced with each client's first name.
                </p>
              </>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 text-center">
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  Select at least one offer to preview the message.
                </p>
              </div>
            )}
          </div>

          {/* Tips */}
          <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">Tips</p>
            <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 list-disc list-inside">
              <li>1 SMS segment = up to 160 characters. Multi-segment messages still deliver fine.</li>
              <li>Only clients with a phone number on file will be included.</li>
              <li>Each client receives a personalised message with their first name.</li>
              <li>All sends are logged under each client's communications history.</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}
