"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import Link from "next/link";

interface TrainerProfile {
  displayName: string;
  businessName: string;
  primaryColor: string;
  services: {
    id: string;
    name: string;
    description: string | null;
    price_cents: number;
    session_count: number;
    duration_minutes: number | null;
  }[];
}

interface ReferralLink {
  id: string;
  code: string;
  org_id: string;
  reward_type: string;
  reward_value: number | null;
  signups: number;
}

export default function ReferPage() {
  const params = useParams();
  const code = params.code as string;
  const [profile, setProfile] = useState<TrainerProfile | null>(null);
  const [referralLink, setReferralLink] = useState<ReferralLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showInquiryForm, setShowInquiryForm] = useState(false);
  const [inquiryForm, setInquiryForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
    services_interested: [] as string[],
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadProfile();
  }, [code]);

  async function loadProfile() {
    // Get referral link
    const { data: linkData, error: linkError } = await supabase
      .from("referral_links")
      .select("*")
      .eq("code", code)
      .eq("is_active", true)
      .single();

    if (linkError || !linkData) {
      setError("This referral link is not valid or has expired.");
      setLoading(false);
      return;
    }

    setReferralLink(linkData);

    // Track click
    await supabase
      .from("referral_links")
      .update({ clicks: linkData.clicks + 1 })
      .eq("id", linkData.id);

    // Get org and branding
    const { data: orgData } = await supabase
      .from("orgs")
      .select("name")
      .eq("id", linkData.org_id)
      .single();

    const { data: brandingData } = await supabase
      .from("branding")
      .select("display_name, primary_color")
      .eq("org_id", linkData.org_id)
      .single();

    // Get services/offers
    const { data: offersData } = await supabase
      .from("offers")
      .select("id, name, description, price_cents, session_count, duration_minutes")
      .eq("org_id", linkData.org_id)
      .eq("is_active", true)
      .order("price_cents");

    setProfile({
      displayName: brandingData?.display_name || orgData?.name || "Personal Trainer",
      businessName: orgData?.name || "",
      primaryColor: brandingData?.primary_color || "#0ea5e9",
      services: offersData || [],
    });

    setLoading(false);
  }

  function toggleService(serviceId: string) {
    setInquiryForm((prev) => ({
      ...prev,
      services_interested: prev.services_interested.includes(serviceId)
        ? prev.services_interested.filter((id) => id !== serviceId)
        : [...prev.services_interested, serviceId],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!referralLink || !profile) return;
    setSubmitting(true);

    // Get service names for the selected IDs
    const selectedServiceNames = profile.services
      .filter((s) => inquiryForm.services_interested.includes(s.id))
      .map((s) => s.name);

    // Create inquiry
    const { error } = await supabase.from("inquiries").insert({
      org_id: referralLink.org_id,
      name: inquiryForm.name,
      email: inquiryForm.email || null,
      phone: inquiryForm.phone || null,
      message: inquiryForm.message || null,
      source: "referral",
      status: "NEW",
      referral_code: code,
      services_interested: selectedServiceNames.length > 0 ? selectedServiceNames : null,
    });

    if (!error) {
      // Update signups count
      await supabase
        .from("referral_links")
        .update({ signups: (referralLink.signups || 0) + 1 })
        .eq("id", referralLink.id);

      setSubmitted(true);
    }

    setSubmitting(false);
  }

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
    }).format(cents / 100);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">{error}</p>
          <Link href="/" className="text-blue-600 hover:underline">
            Go to homepage
          </Link>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="py-16 px-4 text-center text-white"
        style={{ backgroundColor: profile.primaryColor }}
      >
        <h1 className="text-4xl font-bold mb-2">{profile.displayName}</h1>
        {profile.businessName && profile.businessName !== profile.displayName && (
          <p className="text-white/80 text-lg">{profile.businessName}</p>
        )}
        <p className="mt-4 text-white/90 max-w-xl mx-auto">
          Personal Training Services
        </p>

        {referralLink?.reward_type && referralLink.reward_type !== "none" && (
          <div className="mt-6 inline-block bg-white/20 rounded-full px-6 py-2">
            <span className="font-medium">
              {referralLink.reward_type === "discount" &&
                `Get ${referralLink.reward_value}% off your first package!`}
              {referralLink.reward_type === "free_session" && "Get a FREE first session!"}
              {referralLink.reward_type === "credit" &&
                `Get $${((referralLink.reward_value || 0) / 100).toFixed(0)} credit!`}
            </span>
          </div>
        )}
      </div>

      {/* Services */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">Services Offered</h2>

        {profile.services.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {profile.services.map((service) => (
              <div
                key={service.id}
                className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <h3 className="text-lg font-semibold text-gray-900">{service.name}</h3>
                {service.description && (
                  <p className="text-gray-600 text-sm mt-2">{service.description}</p>
                )}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-2xl font-bold" style={{ color: profile.primaryColor }}>
                    {formatCurrency(service.price_cents)}
                  </span>
                  <span className="text-sm text-gray-500">
                    {service.session_count} session{service.session_count !== 1 ? "s" : ""}
                    {service.duration_minutes && ` · ${service.duration_minutes} min`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 mb-12">
            Contact me for personalized training packages.
          </p>
        )}

        {/* CTA */}
        {!showInquiryForm && !submitted && (
          <div className="text-center">
            <button
              onClick={() => setShowInquiryForm(true)}
              className="px-8 py-4 rounded-xl text-white font-semibold text-lg shadow-lg hover:opacity-90 transition-opacity"
              style={{ backgroundColor: profile.primaryColor }}
            >
              Get Started Today
            </button>
          </div>
        )}

        {/* Inquiry Form */}
        {showInquiryForm && !submitted && (
          <div className="max-w-lg mx-auto bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Start Your Fitness Journey</h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={inquiryForm.name}
                  onChange={(e) => setInquiryForm({ ...inquiryForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={inquiryForm.email}
                  onChange={(e) => setInquiryForm({ ...inquiryForm, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={inquiryForm.phone}
                  onChange={(e) => setInquiryForm({ ...inquiryForm, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {profile.services.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Services Interested In
                  </label>
                  <div className="space-y-2">
                    {profile.services.map((service) => (
                      <label
                        key={service.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={inquiryForm.services_interested.includes(service.id)}
                          onChange={() => toggleService(service.id)}
                          className="w-4 h-4 rounded text-blue-600"
                        />
                        <span className="flex-1 text-gray-900">{service.name}</span>
                        <span className="text-sm text-gray-500">
                          {formatCurrency(service.price_cents)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message (optional)
                </label>
                <textarea
                  value={inquiryForm.message}
                  onChange={(e) => setInquiryForm({ ...inquiryForm, message: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Tell me about your fitness goals..."
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-lg text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: profile.primaryColor }}
              >
                {submitting ? "Submitting..." : "Send Inquiry"}
              </button>
            </form>
          </div>
        )}

        {/* Success Message */}
        {submitted && (
          <div className="max-w-lg mx-auto bg-green-50 border border-green-200 rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Inquiry Sent!</h3>
            <p className="text-gray-600">
              Thank you for your interest! {profile.displayName} will be in touch with you soon.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-8 text-sm text-gray-500">
        Powered by <span className="font-semibold">Coach OS</span>
      </div>
    </div>
  );
}
