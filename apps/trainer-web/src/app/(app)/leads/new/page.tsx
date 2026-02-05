"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Offer {
  id: string;
  name: string;
}

export default function NewLeadPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("website");
  const [message, setMessage] = useState("");
  const [servicesInterested, setServicesInterested] = useState<string[]>([]);
  const [followUpDate, setFollowUpDate] = useState("");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

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

    const { data: offersData } = await supabase
      .from("offers")
      .select("id, name")
      .eq("org_id", membership.org_id)
      .eq("is_active", true);

    if (offersData) setOffers(offersData);
  }

  function toggleService(serviceName: string) {
    setServicesInterested((prev) =>
      prev.includes(serviceName)
        ? prev.filter((s) => s !== serviceName)
        : [...prev, serviceName]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      setError("No organization found");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("inquiries").insert({
      org_id: membership.org_id,
      name,
      email: email || null,
      phone: phone || null,
      source,
      message: message || null,
      services_interested: servicesInterested.length > 0 ? servicesInterested : null,
      follow_up_date: followUpDate || null,
      status: "NEW",
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push("/leads");
    router.refresh();
  }

  return (
    <div className="max-w-lg">
      <Link href="/leads" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300 mb-4 inline-block">
        ← Back to Leads
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-8">Add Lead</h1>

      <form onSubmit={handleSubmit} className="card p-6 space-y-6">
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="name" className="label">
            Name *
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            required
          />
        </div>

        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label htmlFor="phone" className="label">
            Phone
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label htmlFor="source" className="label">
            Source
          </label>
          <select
            id="source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="input"
          >
            <option value="website">Website</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="referral">Referral</option>
            <option value="other">Other</option>
          </select>
        </div>

        {offers.length > 0 && (
          <div>
            <label className="label">Services Enquired About</label>
            <div className="space-y-2">
              {offers.map((offer) => (
                <label
                  key={offer.id}
                  className="flex items-center gap-3 p-2 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <input
                    type="checkbox"
                    checked={servicesInterested.includes(offer.name)}
                    onChange={() => toggleService(offer.name)}
                    className="w-4 h-4 rounded text-brand-600"
                  />
                  <span className="text-gray-900 dark:text-gray-100">{offer.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <label htmlFor="followUpDate" className="label">
            Follow-up Date
          </label>
          <input
            id="followUpDate"
            type="date"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label htmlFor="message" className="label">
            Notes
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="input"
            rows={3}
          />
        </div>

        <div className="flex gap-3">
          <button type="submit" className="btn-primary flex-1" disabled={loading}>
            {loading ? "Adding..." : "Add Lead"}
          </button>
          <Link href="/leads" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
