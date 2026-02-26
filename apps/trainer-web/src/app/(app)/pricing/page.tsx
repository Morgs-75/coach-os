"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { clsx } from "clsx";

interface Offer {
  id: string;
  name: string;
  description: string | null;
  offer_type: "subscription" | "session_pack" | "single_session";
  price_cents: number;
  currency: string;
  billing_period: string | null;
  sessions_included: number | null;
  bonus_sessions: number | null;
  pack_validity_days: number | null;
  session_duration_mins: number | null;
  included_items: string[] | null;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
}

interface PromoCode {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  times_used: number;
  is_active: boolean;
}

const billingPeriods = [
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly (3 months)" },
  { value: "yearly", label: "Yearly" },
];

export default function PricingPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [saving, setSaving] = useState(false);

  // Promo code state
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);
  const [promoForm, setPromoForm] = useState({
    code: "",
    discount_type: "percentage" as "percentage" | "fixed",
    discount_value: "",
    valid_from: "",
    valid_until: "",
    max_uses: "",
  });

  const supabase = createClient();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    offer_type: "subscription" as "subscription" | "session_pack" | "single_session",
    price: "",
    billing_period: "monthly",
    sessions_included: "10",
    bonus_sessions: "0",
    pack_validity_days: "",
    session_duration_mins: "60",
    included_items: [] as string[],
    is_featured: false,
    is_active: true,
  });
  const [newItem, setNewItem] = useState("");

  useEffect(() => {
    loadOffers();
  }, []);

  async function loadOffers() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) return;

    const [offersRes, promosRes] = await Promise.all([
      supabase
        .from("offers")
        .select("*")
        .eq("org_id", membership.org_id)
        .order("sort_order"),
      supabase
        .from("promo_codes")
        .select("*")
        .eq("org_id", membership.org_id)
        .order("created_at", { ascending: false }),
    ]);

    if (offersRes.data) setOffers(offersRes.data);
    if (promosRes.data) setPromoCodes(promosRes.data);
    setLoading(false);
  }

  function resetPromoForm() {
    setPromoForm({
      code: "",
      discount_type: "percentage",
      discount_value: "",
      valid_from: "",
      valid_until: "",
      max_uses: "",
    });
    setEditingPromo(null);
  }

  function editPromoCode(promo: PromoCode) {
    setPromoForm({
      code: promo.code,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value.toString(),
      valid_from: promo.valid_from?.split("T")[0] || "",
      valid_until: promo.valid_until?.split("T")[0] || "",
      max_uses: promo.max_uses?.toString() || "",
    });
    setEditingPromo(promo);
    setShowPromoForm(true);
  }

  async function savePromoCode(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      setSaving(false);
      return;
    }

    const promoData = {
      org_id: membership.org_id,
      code: promoForm.code.toUpperCase().trim(),
      discount_type: promoForm.discount_type,
      discount_value: parseFloat(promoForm.discount_value),
      valid_from: promoForm.valid_from || null,
      valid_until: promoForm.valid_until || null,
      max_uses: promoForm.max_uses ? parseInt(promoForm.max_uses) : null,
      is_active: true,
    };

    if (editingPromo) {
      const { error } = await supabase
        .from("promo_codes")
        .update(promoData)
        .eq("id", editingPromo.id);

      if (error) {
        console.error("Promo update error:", error);
        alert("Error updating promo code: " + (error.message || JSON.stringify(error)));
        setSaving(false);
        return;
      }
      setPromoCodes(promoCodes.map(p => p.id === editingPromo.id ? { ...p, ...promoData } : p));
    } else {
      const { data, error } = await supabase
        .from("promo_codes")
        .insert({ ...promoData, times_used: 0 })
        .select()
        .single();

      if (error) {
        console.error("Promo create error:", error);
        alert("Error creating promo code: " + (error.message || JSON.stringify(error)));
        setSaving(false);
        return;
      }
      if (data) {
        setPromoCodes([data, ...promoCodes]);
      }
    }

    setSaving(false);
    setShowPromoForm(false);
    resetPromoForm();
  }

  async function togglePromoActive(promo: PromoCode) {
    const { error } = await supabase
      .from("promo_codes")
      .update({ is_active: !promo.is_active })
      .eq("id", promo.id);

    if (!error) {
      setPromoCodes(promoCodes.map(p => p.id === promo.id ? { ...p, is_active: !p.is_active } : p));
    }
  }

  async function deletePromoCode(promo: PromoCode) {
    if (!confirm(`Delete promo code "${promo.code}"?`)) return;

    const { error } = await supabase
      .from("promo_codes")
      .delete()
      .eq("id", promo.id);

    if (!error) {
      setPromoCodes(promoCodes.filter(p => p.id !== promo.id));
    }
  }

  function resetForm() {
    setFormData({
      name: "",
      description: "",
      offer_type: "subscription",
      price: "",
      billing_period: "monthly",
      sessions_included: "10",
      bonus_sessions: "0",
      pack_validity_days: "",
      session_duration_mins: "60",
      included_items: [],
      is_featured: false,
      is_active: true,
    });
    setNewItem("");
    setEditingOffer(null);
  }

  function editOffer(offer: Offer) {
    setFormData({
      name: offer.name,
      description: offer.description || "",
      offer_type: offer.offer_type,
      price: (offer.price_cents / 100).toString(),
      billing_period: offer.billing_period || "monthly",
      sessions_included: offer.sessions_included?.toString() || "10",
      bonus_sessions: offer.bonus_sessions?.toString() || "0",
      pack_validity_days: offer.pack_validity_days?.toString() || "",
      session_duration_mins: offer.session_duration_mins?.toString() || "60",
      included_items: offer.included_items || [],
      is_featured: offer.is_featured,
      is_active: offer.is_active,
    });
    setNewItem("");
    setEditingOffer(offer);
    setShowForm(true);
  }

  function addIncludedItem() {
    if (newItem.trim() && !formData.included_items.includes(newItem.trim())) {
      setFormData({
        ...formData,
        included_items: [...formData.included_items, newItem.trim()],
      });
      setNewItem("");
    }
  }

  function removeIncludedItem(item: string) {
    setFormData({
      ...formData,
      included_items: formData.included_items.filter((i) => i !== item),
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("Not authenticated");
      setSaving(false);
      return;
    }

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      alert("No organization found");
      setSaving(false);
      return;
    }

    const offerData = {
      org_id: membership.org_id,
      name: formData.name,
      description: formData.description || null,
      offer_type: formData.offer_type,
      price_cents: Math.round(parseFloat(formData.price) * 100),
      currency: "aud",
      billing_period: formData.offer_type === "subscription" ? formData.billing_period : null,
      sessions_included: formData.offer_type === "session_pack" ? parseInt(formData.sessions_included) : null,
      bonus_sessions: formData.offer_type === "session_pack" ? parseInt(formData.bonus_sessions) : null,
      pack_validity_days: formData.offer_type === "session_pack" && formData.pack_validity_days
        ? parseInt(formData.pack_validity_days) : null,
      session_duration_mins: formData.offer_type === "single_session"
        ? parseInt(formData.session_duration_mins) : null,
      included_items: formData.included_items.length > 0 ? formData.included_items : null,
      is_featured: formData.is_featured,
      is_active: formData.is_active,
      updated_at: new Date().toISOString(),
    };

    if (editingOffer) {
      const { error } = await supabase
        .from("offers")
        .update(offerData)
        .eq("id", editingOffer.id);

      if (error) {
        console.error("Update error:", error);
        alert("Error updating offer: " + (error.message || JSON.stringify(error)));
        setSaving(false);
        return;
      }
      setOffers(offers.map((o) => (o.id === editingOffer.id ? { ...o, ...offerData } : o)));
    } else {
      const { data, error } = await supabase
        .from("offers")
        .insert(offerData)
        .select()
        .single();

      if (error) {
        console.error("Insert error:", error);
        alert("Error creating offer: " + (error.message || JSON.stringify(error)));
        setSaving(false);
        return;
      }
      if (data) {
        setOffers([...offers, data]);
      }
    }

    setSaving(false);
    setShowForm(false);
    resetForm();
  }

  async function toggleActive(offer: Offer) {
    const { error } = await supabase
      .from("offers")
      .update({ is_active: !offer.is_active })
      .eq("id", offer.id);

    if (!error) {
      setOffers(offers.map((o) => (o.id === offer.id ? { ...o, is_active: !o.is_active } : o)));
    }
  }

  async function deleteOffer(offer: Offer) {
    if (!confirm(`Delete "${offer.name}"? This cannot be undone.`)) return;

    const { error } = await supabase
      .from("offers")
      .delete()
      .eq("id", offer.id);

    if (!error) {
      setOffers(offers.filter((o) => o.id !== offer.id));
    }
  }

  const formatPrice = (cents: number) =>
    new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100);

  const formatBillingPeriod = (period: string | null) => {
    if (!period) return "";
    return billingPeriods.find((p) => p.value === period)?.label || period;
  };

  if (loading) {
    return <div className="text-gray-500 dark:text-gray-400">Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Pricing & Offers</h1>
          <p className="text-gray-500 dark:text-gray-400">The operating system that turns personal trainers into business owners.</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="btn-primary"
        >
          + Add Offer
        </button>
      </div>

      {/* Offer Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                {editingOffer ? "Edit Offer" : "Create New Offer"}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Offer Type */}
              <div>
                <label className="label">Offer Type</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: "subscription", label: "Subscription", desc: "Recurring payments" },
                    { value: "session_pack", label: "Session Pack", desc: "Buy sessions in bulk" },
                    { value: "single_session", label: "Single Session", desc: "One-time booking" },
                  ].map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, offer_type: type.value as any })}
                      className={clsx(
                        "p-4 rounded-lg border-2 text-left transition-colors",
                        formData.offer_type === type.value
                          ? "border-brand-600 bg-brand-50"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                      )}
                    >
                      <p className="font-medium text-gray-900 dark:text-gray-100">{type.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{type.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Name & Description */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                    placeholder="e.g., Monthly Coaching"
                    required
                  />
                </div>
                <div>
                  <label className="label">Price (AUD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="input"
                    placeholder="199.00"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                  rows={2}
                  placeholder="Brief description of this offer..."
                />
              </div>

              {/* Included Items */}
              <div>
                <label className="label">What's Included</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addIncludedItem();
                      }
                    }}
                    className="input flex-1"
                    placeholder="e.g., Weekly Check-ins"
                  />
                  <button
                    type="button"
                    onClick={addIncludedItem}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 text-sm font-medium"
                  >
                    Add
                  </button>
                </div>
                {formData.included_items.length > 0 && (
                  <ul className="space-y-1">
                    {formData.included_items.map((item, index) => (
                      <li
                        key={index}
                        className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm"
                      >
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {item}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeIncludedItem(item)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Press Enter or click Add to add each item</p>
              </div>

              {/* Subscription Options */}
              {formData.offer_type === "subscription" && (
                <div>
                  <label className="label">Billing Period</label>
                  <select
                    value={formData.billing_period}
                    onChange={(e) => setFormData({ ...formData, billing_period: e.target.value })}
                    className="input"
                  >
                    {billingPeriods.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Session Pack Options */}
              {formData.offer_type === "session_pack" && (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="label">Sessions Included *</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.sessions_included}
                        onChange={(e) => setFormData({ ...formData, sessions_included: e.target.value })}
                        className="input"
                        placeholder="10"
                      />
                    </div>
                    <div>
                      <label className="label">Bonus Sessions</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.bonus_sessions}
                        onChange={(e) => setFormData({ ...formData, bonus_sessions: e.target.value })}
                        className="input"
                        placeholder="0"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">e.g., "1" for buy 10 get 1 free</p>
                    </div>
                    <div>
                      <label className="label">Valid for (days)</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.pack_validity_days}
                        onChange={(e) => setFormData({ ...formData, pack_validity_days: e.target.value })}
                        className="input"
                        placeholder="90"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Leave blank for no expiry</p>
                    </div>
                  </div>

                  {/* Preview */}
                  {formData.sessions_included && formData.price && (
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <strong>Preview:</strong>{" "}
                        {parseInt(formData.sessions_included) + parseInt(formData.bonus_sessions || "0")} sessions
                        {formData.bonus_sessions && parseInt(formData.bonus_sessions) > 0
                          ? ` (${formData.sessions_included} + ${formData.bonus_sessions} bonus)`
                          : ""}{" "}
                        for {formatPrice(parseFloat(formData.price) * 100)}
                        {" = "}
                        {formatPrice(
                          (parseFloat(formData.price) * 100) /
                          (parseInt(formData.sessions_included) + parseInt(formData.bonus_sessions || "0"))
                        )}
                        /session
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Single Session Options */}
              {formData.offer_type === "single_session" && (
                <div>
                  <label className="label">Session Duration (minutes)</label>
                  <select
                    value={formData.session_duration_mins}
                    onChange={(e) => setFormData({ ...formData, session_duration_mins: e.target.value })}
                    className="input"
                  >
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                    <option value="90">90 minutes</option>
                    <option value="120">2 hours</option>
                  </select>
                </div>
              )}

              {/* Settings */}
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_featured}
                    onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                    className="rounded text-brand-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Featured (highlight this offer)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded text-brand-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Active (visible to clients)</span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Saving..." : editingOffer ? "Update Offer" : "Create Offer"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Offers List */}
      {offers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className={clsx(
                "card p-6 relative",
                !offer.is_active && "opacity-60",
                offer.is_featured && "ring-2 ring-brand-500"
              )}
            >
              {offer.is_featured && (
                <span className="absolute -top-2 -right-2 px-2 py-1 bg-brand-600 text-white text-xs rounded-full">
                  Featured
                </span>
              )}

              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{offer.name}</h3>
                  <span className={clsx(
                    "inline-block px-2 py-0.5 rounded text-xs font-medium mt-1",
                    offer.offer_type === "subscription" ? "bg-purple-100 text-purple-700" :
                    offer.offer_type === "session_pack" ? "bg-blue-100 text-blue-700" :
                    "bg-green-100 text-green-700"
                  )}>
                    {offer.offer_type === "subscription" ? "Subscription" :
                     offer.offer_type === "session_pack" ? "Session Pack" :
                     "Single Session"}
                  </span>
                </div>
                {!offer.is_active && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 dark:text-gray-400 text-xs rounded">
                    Inactive
                  </span>
                )}
              </div>

              <div className="mb-4">
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {formatPrice(offer.price_cents)}
                </p>
                {offer.offer_type === "subscription" && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">/{formatBillingPeriod(offer.billing_period)?.toLowerCase()}</p>
                )}
                {offer.offer_type === "session_pack" && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {(offer.sessions_included || 0) + (offer.bonus_sessions || 0)} sessions
                    {offer.bonus_sessions ? ` (${offer.bonus_sessions} bonus)` : ""}
                  </p>
                )}
                {offer.offer_type === "single_session" && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{offer.session_duration_mins} min session</p>
                )}
              </div>

              {offer.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{offer.description}</p>
              )}

              {offer.included_items && offer.included_items.length > 0 && (
                <ul className="space-y-1.5 mb-4">
                  {offer.included_items.map((item, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              )}

              {offer.offer_type === "session_pack" && offer.pack_validity_days && (
                <p className="text-xs text-gray-400 mb-4">
                  Valid for {offer.pack_validity_days} days from purchase
                </p>
              )}

              <div className="flex gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => editOffer(offer)}
                  className="text-sm text-brand-600 hover:text-brand-700"
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleActive(offer)}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-700"
                >
                  {offer.is_active ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => deleteOffer(offer)}
                  className="text-sm text-red-600 hover:text-red-700 ml-auto"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No offers yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Create your first offer to start accepting payments from clients.
          </p>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="btn-primary"
          >
            Create Your First Offer
          </button>
        </div>
      )}

      {/* Promo Codes Section */}
      <div className="mt-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Promo Codes</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Create discount codes for special offers</p>
          </div>
          <button
            onClick={() => {
              resetPromoForm();
              setShowPromoForm(true);
            }}
            className="btn-secondary"
          >
            + Add Promo Code
          </button>
        </div>

        {/* Promo Code Form */}
        {showPromoForm && (
          <div className="card p-6 mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {editingPromo ? "Edit Promo Code" : "Create Promo Code"}
            </h3>
            <form onSubmit={savePromoCode} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Code *</label>
                  <input
                    type="text"
                    value={promoForm.code}
                    onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })}
                    className="input font-mono"
                    placeholder="SUMMER20"
                    required
                  />
                </div>
                <div>
                  <label className="label">Discount Type</label>
                  <select
                    value={promoForm.discount_type}
                    onChange={(e) => setPromoForm({ ...promoForm, discount_type: e.target.value as any })}
                    className="input"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount ($)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">
                    Discount Value {promoForm.discount_type === "percentage" ? "(%)" : "($)"} *
                  </label>
                  <input
                    type="number"
                    step={promoForm.discount_type === "percentage" ? "1" : "0.01"}
                    min="0"
                    max={promoForm.discount_type === "percentage" ? "100" : undefined}
                    value={promoForm.discount_value}
                    onChange={(e) => setPromoForm({ ...promoForm, discount_value: e.target.value })}
                    className="input"
                    placeholder={promoForm.discount_type === "percentage" ? "20" : "25.00"}
                    required
                  />
                </div>
                <div>
                  <label className="label">Valid From</label>
                  <input
                    type="date"
                    value={promoForm.valid_from}
                    onChange={(e) => setPromoForm({ ...promoForm, valid_from: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Valid Until</label>
                  <input
                    type="date"
                    value={promoForm.valid_until}
                    onChange={(e) => setPromoForm({ ...promoForm, valid_until: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="label">Max Uses (leave blank for unlimited)</label>
                <input
                  type="number"
                  min="1"
                  value={promoForm.max_uses}
                  onChange={(e) => setPromoForm({ ...promoForm, max_uses: e.target.value })}
                  className="input w-32"
                  placeholder="Unlimited"
                />
              </div>

              <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? "Saving..." : editingPromo ? "Update Code" : "Create Code"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPromoForm(false);
                    resetPromoForm();
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Promo Codes List */}
        {promoCodes.length > 0 ? (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Discount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Valid Period</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Usage</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {promoCodes.map((promo) => {
                  const isExpired = promo.valid_until && new Date(promo.valid_until) < new Date();
                  const isExhausted = promo.max_uses && promo.times_used >= promo.max_uses;
                  return (
                    <tr key={promo.id} className={clsx(!promo.is_active && "bg-gray-50 dark:bg-gray-800")}>
                      <td className="px-4 py-3">
                        <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{promo.code}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {promo.discount_type === "percentage"
                          ? `${promo.discount_value}% off`
                          : `$${promo.discount_value} off`}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {promo.valid_from || promo.valid_until ? (
                          <>
                            {promo.valid_from && new Date(promo.valid_from).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                            {promo.valid_from && promo.valid_until && " - "}
                            {promo.valid_until && new Date(promo.valid_until).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                          </>
                        ) : (
                          "No expiry"
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {promo.times_used}{promo.max_uses ? ` / ${promo.max_uses}` : ""}
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx(
                          "px-2 py-0.5 rounded text-xs font-medium",
                          isExpired ? "bg-red-100 text-red-700" :
                          isExhausted ? "bg-gray-100 text-gray-500 dark:text-gray-400" :
                          promo.is_active ? "bg-green-100 text-green-700" :
                          "bg-gray-100 text-gray-500 dark:text-gray-400"
                        )}>
                          {isExpired ? "Expired" : isExhausted ? "Exhausted" : promo.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => editPromoCode(promo)} className="text-sm text-brand-600 hover:text-brand-700 mr-3">
                          Edit
                        </button>
                        <button onClick={() => togglePromoActive(promo)} className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-700 mr-3">
                          {promo.is_active ? "Disable" : "Enable"}
                        </button>
                        <button onClick={() => deletePromoCode(promo)} className="text-sm text-red-600 hover:text-red-700">
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : !showPromoForm && (
          <div className="card p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">No promo codes yet</p>
            <button
              onClick={() => {
                resetPromoForm();
                setShowPromoForm(true);
              }}
              className="btn-secondary"
            >
              Create Your First Promo Code
            </button>
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="mt-8 card p-6 bg-gray-50 dark:bg-gray-800">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Offer Types Explained</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-400">
          <div>
            <p className="font-medium text-gray-700 dark:text-gray-300">Subscription</p>
            <p>Recurring payments (weekly, monthly, etc.). Best for ongoing coaching relationships.</p>
          </div>
          <div>
            <p className="font-medium text-gray-700 dark:text-gray-300">Session Pack</p>
            <p>Bulk sessions at a discount. Add bonus sessions for "buy X get Y free" deals.</p>
          </div>
          <div>
            <p className="font-medium text-gray-700 dark:text-gray-300">Single Session</p>
            <p>One-time purchases for casual clients or trial sessions.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
