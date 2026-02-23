"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import React from "react";
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

interface ClientRow {
  id: string;
  full_name: string;
  phone: string | null;
}

interface LeadRow {
  id: string;
  name: string;
  phone: string | null;
  status: string;
}

const aud = (cents: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0 }).format(cents / 100);

function offerLine(offer: Offer, prefix = "•"): string {
  const price = aud(offer.price_cents);
  if (offer.offer_type === "subscription") {
    return `${prefix} ${offer.name} – ${price}/${offer.billing_period ?? "month"}`;
  }
  if (offer.offer_type === "session_pack") {
    const total = (offer.sessions_included ?? 0) + (offer.bonus_sessions ?? 0);
    const validity = offer.pack_validity_days ? `, valid ${offer.pack_validity_days} days` : "";
    return `${prefix} ${offer.name} – ${price} (${total} sessions${validity})`;
  }
  const dur = offer.session_duration_mins ? ` (${offer.session_duration_mins} min)` : "";
  return `${prefix} ${offer.name} – ${price}${dur}`;
}

function buildMessage(template: string, selectedOffers: Offer[], offerEmojis: Record<string, string>): string {
  if (!template.trim()) return "";
  const offerBlock = selectedOffers.length > 0
    ? selectedOffers.map(o => offerLine(o, offerEmojis[o.id] || "•")).join("\n")
    : "(no offers selected)";
  return template.replace(/\{offers\}/g, offerBlock);
}

type RecipientFilter = "all" | "active" | "manual";

export default function MarketingPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [offerEmojis, setOfferEmojis] = useState<Record<string, string>>({});
  const [template, setTemplate] = useState(
    "Hi {name}, we have some special offers available:\n\n{offers}\n\nReply to book or for more info.\n\nReply STOP to opt out."
  );
  const templateRef = useRef<HTMLTextAreaElement>(null);
  const [recipientFilter, setRecipientFilter] = useState<RecipientFilter>("all");
  const [clientCount, setClientCount] = useState<number | null>(null);

  // Manual selection
  const [allClients, setAllClients] = useState<ClientRow[]>([]);
  const [allLeads, setAllLeads] = useState<LeadRow[]>([]);
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [recipientTab, setRecipientTab] = useState<"clients" | "leads">("clients");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; errors: string[] } | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (orgId && recipientFilter !== "manual") fetchClientCount();
  }, [orgId, recipientFilter]);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from("org_members").select("org_id").eq("user_id", user.id).single();
    if (!membership) return;
    setOrgId(membership.org_id);

    const [offersRes, clientsRes, leadsRes] = await Promise.all([
      supabase.from("offers")
        .select("id, name, description, offer_type, price_cents, billing_period, sessions_included, bonus_sessions, pack_validity_days, session_duration_mins, is_active, sort_order")
        .eq("org_id", membership.org_id).order("sort_order"),
      supabase.from("clients")
        .select("id, full_name, phone")
        .eq("org_id", membership.org_id).order("full_name"),
      supabase.from("inquiries")
        .select("id, name, phone, status")
        .eq("org_id", membership.org_id).order("name"),
    ]);

    if (offersRes.data) {
      setOffers(offersRes.data);
      setSelected(new Set(offersRes.data.filter((o) => o.is_active).map((o) => o.id)));
    }
    if (clientsRes.data) setAllClients(clientsRes.data);
    if (leadsRes.data) setAllLeads(leadsRes.data);
    setLoading(false);
  }

  async function fetchClientCount() {
    if (!orgId) return;
    if (recipientFilter === "all") {
      const { count } = await supabase.from("clients")
        .select("id", { count: "exact", head: true } as any)
        .eq("org_id", orgId).not("phone", "is", null).neq("phone", "");
      setClientCount(count ?? 0);
    } else if (recipientFilter === "active") {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const { data: activeIds } = await supabase.from("bookings")
        .select("client_id").eq("org_id", orgId).gte("start_time", cutoff.toISOString());
      const ids = [...new Set((activeIds ?? []).map((r) => r.client_id))];
      if (!ids.length) { setClientCount(0); return; }
      const { count } = await supabase.from("clients")
        .select("id", { count: "exact", head: true } as any)
        .eq("org_id", orgId).in("id", ids).not("phone", "is", null).neq("phone", "");
      setClientCount(count ?? 0);
    }
  }

  // Manual mode: count selected recipients that have a phone
  const manualCount = useMemo(() => {
    const clientPhones = [...selectedClientIds].filter(id =>
      allClients.find(c => c.id === id && c.phone)
    ).length;
    const leadPhones = [...selectedLeadIds].filter(id =>
      allLeads.find(l => l.id === id && l.phone)
    ).length;
    return clientPhones + leadPhones;
  }, [selectedClientIds, selectedLeadIds, allClients, allLeads]);

  const effectiveCount = recipientFilter === "manual" ? manualCount : clientCount;

  function toggleOffer(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleClient(id: string) {
    setSelectedClientIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleLead(id: string) {
    setSelectedLeadIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAllVisible(type: "clients" | "leads") {
    const q = search.toLowerCase();
    if (type === "clients") {
      const visible = allClients.filter(c => c.full_name.toLowerCase().includes(q) && c.phone);
      setSelectedClientIds(prev => {
        const next = new Set(prev);
        visible.forEach(c => next.add(c.id));
        return next;
      });
    } else {
      const visible = allLeads.filter(l => l.name.toLowerCase().includes(q) && l.phone);
      setSelectedLeadIds(prev => {
        const next = new Set(prev);
        visible.forEach(l => next.add(l.id));
        return next;
      });
    }
  }

  function clearAll(type: "clients" | "leads") {
    if (type === "clients") setSelectedClientIds(new Set());
    else setSelectedLeadIds(new Set());
  }

  const selectedOffers = useMemo(() => offers.filter(o => selected.has(o.id)), [offers, selected]);
  const preview = useMemo(() => buildMessage(template, selectedOffers, offerEmojis), [template, selectedOffers, offerEmojis]);

  function insertAtCursor(text: string) {
    const el = templateRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newVal = template.slice(0, start) + text + template.slice(end);
    setTemplate(newVal);
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = start + text.length;
      el.focus();
    }, 0);
  }
  const charCount = preview.replace("{name}", "there").length;
  const segments = Math.ceil(charCount / 153) || 1;

  const filteredClients = allClients.filter(c => c.full_name.toLowerCase().includes(search.toLowerCase()));
  const filteredLeads = allLeads.filter(l => l.name.toLowerCase().includes(search.toLowerCase()));

  async function handleSend() {
    if (!preview || !effectiveCount) return;
    if (!template.includes("{offers}") && selectedOffers.length > 0) {
      const ok = window.confirm(
        "Your message doesn't include {offers} — recipients won't see the offer list. Send anyway?"
      );
      if (!ok) return;
    }
    const confirmed = window.confirm(
      `Send this SMS to ${effectiveCount} recipient${effectiveCount === 1 ? "" : "s"}?`
    );
    if (!confirmed) return;

    setSending(true);
    setResult(null);

    const body: Record<string, unknown> = { message: preview, recipient_filter: recipientFilter };
    if (recipientFilter === "manual") {
      body.client_ids = [...selectedClientIds];
      body.lead_ids = [...selectedLeadIds];
    }

    try {
      const res = await fetch("/api/marketing/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setResult({ sent: data.sent, failed: data.failed, errors: data.errors ?? [] });
    } catch (err) {
      setResult({ sent: 0, failed: effectiveCount ?? 0, errors: [err instanceof Error ? err.message : "Unknown error"] });
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div className="text-gray-500 dark:text-gray-400 text-sm">Loading...</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">myMarketing</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Push your current offers to clients and leads by SMS.
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

        {/* ── Left ── */}
        <div className="space-y-5">

          {/* Step 1 — Offers */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">1. Select Offers</h2>
            {offers.length === 0 ? (
              <p className="text-sm text-gray-400">No offers found. Add some in <a href="/pricing" className="text-blue-600 hover:underline">Pricing</a>.</p>
            ) : (
              <div className="space-y-2">
                {offers.map((offer) => (
                  <div key={offer.id} className={clsx(
                    "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                    selected.has(offer.id)
                      ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 dark:border-gray-700"
                  )}>
                    <input type="checkbox" checked={selected.has(offer.id)} onChange={() => toggleOffer(offer.id)} className="mt-1 rounded text-blue-600 cursor-pointer" />

                    {/* Emoji prefix input */}
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <input
                        type="text"
                        value={offerEmojis[offer.id] ?? "•"}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setOfferEmojis(prev => ({ ...prev, [offer.id]: e.target.value || "•" }))}
                        className="w-9 h-9 text-center text-lg border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:border-blue-400 cursor-text"
                        title="Click and type an emoji to replace the bullet"
                      />
                      <span className="text-[9px] text-gray-400 leading-none">prefix</span>
                    </div>

                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleOffer(offer.id)}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{offer.name}</span>
                        <span className={clsx("text-xs px-1.5 py-0.5 rounded font-medium",
                          offer.offer_type === "subscription" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" :
                          offer.offer_type === "session_pack" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" :
                          "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                        )}>
                          {offer.offer_type === "subscription" ? "Subscription" :
                           offer.offer_type === "session_pack" ? "Session Pack" : "Single Session"}
                        </span>
                        {!offer.is_active && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">Inactive</span>}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {offerLine(offer, offerEmojis[offer.id] || "•")}
                      </p>
                      {offer.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{offer.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 2 — Message */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">2. Compose Message</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Type your message freely. Use <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{`{name}`}</code> for the recipient's first name and <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{`{offers}`}</code> to insert the selected offer list. Emojis are supported.
            </p>

            {/* Quick-insert toolbar */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {["{name}", "{coach_name}", "{offers}"].map(token => (
                <button key={token} onClick={() => insertAtCursor(token)}
                  className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 font-mono">
                  {token}
                </button>
              ))}
              <span className="text-gray-300 dark:text-gray-600 text-xs self-center">|</span>
              {["🏋️", "💪", "🔥", "⚡", "🎯", "✅", "👊", "🙌", "💥", "🚀"].map(emoji => (
                <button key={emoji} onClick={() => insertAtCursor(emoji)}
                  className="w-7 h-7 text-base rounded hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center">
                  {emoji}
                </button>
              ))}
            </div>

            <textarea
              ref={templateRef}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={8}
              className="input text-sm font-mono leading-relaxed resize-y"
              placeholder="Write your message here…"
            />
          </div>

          {/* Step 3 — Recipients */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">3. Choose Recipients</h2>

            <div className="space-y-2 mb-4">
              {([
                { val: "all", label: "All clients with a phone number", sub: "Every client in your database who has a phone on file" },
                { val: "active", label: "Active clients only", sub: "Clients with a booking in the last 90 days" },
                { val: "manual", label: "Select specific clients & leads", sub: "Handpick exactly who receives this message" },
              ] as { val: RecipientFilter; label: string; sub: string }[]).map(({ val, label, sub }) => (
                <label key={val} className={clsx(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  recipientFilter === val
                    ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                )}>
                  <input type="radio" name="recipient_filter" value={val}
                    checked={recipientFilter === val} onChange={() => setRecipientFilter(val)}
                    className="mt-0.5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{sub}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Manual selection panel */}
            {recipientFilter === "manual" && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                {/* Search */}
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name…"
                    className="input text-sm py-1.5" />
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 dark:border-gray-700">
                  {(["clients", "leads"] as const).map((tab) => {
                    const count = tab === "clients" ? selectedClientIds.size : selectedLeadIds.size;
                    return (
                      <button key={tab} onClick={() => setRecipientTab(tab)}
                        className={clsx(
                          "flex-1 py-2 text-xs font-medium transition-colors",
                          recipientTab === tab
                            ? "bg-white dark:bg-gray-900 text-blue-600 border-b-2 border-blue-500"
                            : "bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700"
                        )}>
                        {tab === "clients" ? "Clients" : "Leads"}
                        {count > 0 && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs">
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* List */}
                <div className="max-h-56 overflow-y-auto">
                  {recipientTab === "clients" ? (
                    filteredClients.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-6">No clients found</p>
                    ) : (
                      <div>
                        <div className="flex gap-3 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                          <button onClick={() => selectAllVisible("clients")} className="text-xs text-blue-600 hover:underline">Select all</button>
                          <button onClick={() => clearAll("clients")} className="text-xs text-gray-400 hover:underline">Clear</button>
                        </div>
                        {filteredClients.map((c) => (
                          <label key={c.id} className={clsx(
                            "flex items-center gap-3 px-3 py-2 cursor-pointer border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800",
                            !c.phone && "opacity-40 cursor-not-allowed"
                          )}>
                            <input type="checkbox" checked={selectedClientIds.has(c.id)}
                              onChange={() => c.phone && toggleClient(c.id)}
                              disabled={!c.phone} className="rounded text-blue-600" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 dark:text-gray-100 truncate">{c.full_name}</p>
                              {!c.phone && <p className="text-xs text-gray-400">No phone</p>}
                            </div>
                            {c.phone && <span className="text-xs text-gray-400 shrink-0">{c.phone}</span>}
                          </label>
                        ))}
                      </div>
                    )
                  ) : (
                    filteredLeads.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-6">No leads found</p>
                    ) : (
                      <div>
                        <div className="flex gap-3 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                          <button onClick={() => selectAllVisible("leads")} className="text-xs text-blue-600 hover:underline">Select all</button>
                          <button onClick={() => clearAll("leads")} className="text-xs text-gray-400 hover:underline">Clear</button>
                        </div>
                        {filteredLeads.map((l) => (
                          <label key={l.id} className={clsx(
                            "flex items-center gap-3 px-3 py-2 cursor-pointer border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800",
                            !l.phone && "opacity-40 cursor-not-allowed"
                          )}>
                            <input type="checkbox" checked={selectedLeadIds.has(l.id)}
                              onChange={() => l.phone && toggleLead(l.id)}
                              disabled={!l.phone} className="rounded text-blue-600" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 dark:text-gray-100 truncate">{l.name}</p>
                              <span className={clsx("text-xs px-1 rounded",
                                l.status === "NEW" ? "text-blue-600" :
                                l.status === "CONTACTED" ? "text-purple-600" :
                                l.status === "WON" ? "text-green-600" : "text-gray-400"
                              )}>{l.status}</span>
                            </div>
                            {l.phone && <span className="text-xs text-gray-400 shrink-0">{l.phone}</span>}
                          </label>
                        ))}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Count + Send */}
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {recipientFilter === "manual" ? (
                  manualCount === 0
                    ? "No recipients selected with a phone number."
                    : <><span className="font-semibold text-gray-900 dark:text-gray-100">{manualCount}</span> recipient{manualCount === 1 ? "" : "s"} selected</>
                ) : effectiveCount === null
                  ? "Counting…"
                  : effectiveCount === 0
                  ? "No eligible recipients found."
                  : <><span className="font-semibold text-gray-900 dark:text-gray-100">{effectiveCount}</span> client{effectiveCount === 1 ? "" : "s"} will receive this</>
                }
              </p>

              <button onClick={handleSend}
                disabled={sending || !template.trim() || !effectiveCount}
                className={clsx(
                  "w-full py-2.5 rounded-lg text-sm font-semibold transition-colors",
                  sending || !template.trim() || !effectiveCount
                    ? "bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                )}>
                {sending ? "Sending…" :
                 !template.trim() ? "Write a message first" :
                 `Send to ${effectiveCount ?? "…"} recipient${effectiveCount === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: preview ── */}
        <div className="lg:sticky lg:top-6 self-start">
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Message Preview</h2>
            {preview ? (
              <>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 mb-3">
                  <div className="bg-blue-500 text-white rounded-2xl rounded-br-sm px-4 py-3 max-w-xs ml-auto">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {preview.replace("{name}", "Sarah")}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 text-right mt-1">Preview shown as "Sarah"</p>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{charCount} characters</span>
                  <span className={clsx("px-2 py-0.5 rounded-full font-medium",
                    segments === 1 ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" :
                    segments === 2 ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" :
                    "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                  )}>
                    {segments} SMS segment{segments !== 1 ? "s" : ""}
                  </span>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  "{`{name}`}" is replaced with each recipient's first name.
                </p>
              </>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 text-center">
                <p className="text-sm text-gray-400 dark:text-gray-500">Select at least one offer to preview.</p>
              </div>
            )}
          </div>

          <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">Tips</p>
            <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 list-disc list-inside">
              <li>Recipients without a phone number are automatically skipped.</li>
              <li>Each person receives a personalised message with their first name.</li>
              <li>All sends are logged in each client's communications history.</li>
              <li>1 SMS segment = up to 160 chars. Multi-segment messages still deliver fine.</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}
