"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { clsx } from "clsx";
import type { InquiryStatus } from "@/types";

const statusConfig: Record<InquiryStatus, { label: string; bg: string; text: string }> = {
  NEW: { label: "New", bg: "bg-blue-100", text: "text-blue-700" },
  CONTACTED: { label: "Contacted", bg: "bg-purple-100", text: "text-purple-700" },
  BOOKED: { label: "Booked", bg: "bg-amber-100", text: "text-amber-700" },
  WON: { label: "Won", bg: "bg-green-100", text: "text-green-700" },
  LOST: { label: "Lost", bg: "bg-gray-100", text: "text-gray-500" },
};

const statusOrder: InquiryStatus[] = ["NEW", "CONTACTED", "BOOKED", "WON", "LOST"];

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [converting, setConverting] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadLead();
  }, [leadId]);

  async function loadLead() {
    const { data } = await supabase
      .from("inquiries")
      .select("*")
      .eq("id", leadId)
      .single();

    setLead(data);
    if (data?.follow_up_date) {
      setFollowUpDate(data.follow_up_date);
    }
    setLoading(false);
  }

  async function saveFollowUp() {
    setSavingFollowUp(true);
    await supabase
      .from("inquiries")
      .update({ follow_up_date: followUpDate || null })
      .eq("id", leadId);

    setLead({ ...lead, follow_up_date: followUpDate || null });
    setSavingFollowUp(false);
  }

  async function updateStatus(newStatus: InquiryStatus) {
    setUpdating(true);
    await supabase
      .from("inquiries")
      .update({ status: newStatus })
      .eq("id", leadId);

    setLead({ ...lead, status: newStatus });
    setUpdating(false);
  }

  async function convertToClient() {
    if (!lead) return;
    setConverting(true);

    // Get org_id
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) return;

    // Create client
    const { data: client, error } = await supabase
      .from("clients")
      .insert({
        org_id: membership.org_id,
        full_name: lead.name,
        email: lead.email,
        phone: lead.phone,
        status: "active",
      })
      .select()
      .single();

    if (error || !client) {
      setConverting(false);
      return;
    }

    // Update inquiry
    await supabase
      .from("inquiries")
      .update({ status: "WON", converted_client_id: client.id })
      .eq("id", leadId);

    router.push(`/clients/${client.id}`);
  }

  async function deleteLead() {
    if (!confirm("Delete this lead?")) return;

    await supabase.from("inquiries").delete().eq("id", leadId);
    router.push("/leads");
  }

  if (loading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  if (!lead) {
    return <div className="text-gray-500">Lead not found</div>;
  }

  const currentStatus = lead.status as InquiryStatus;
  const config = statusConfig[currentStatus];

  return (
    <div className="max-w-2xl">
      <Link href="/leads" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">
        ← Back to Leads
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{lead.name}</h1>
          <span className={clsx("inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium", config.bg, config.text)}>
            {config.label}
          </span>
        </div>
        {lead.services_interested && lead.services_interested.length > 0 && (
          <div className="text-right">
            <p className="text-sm text-gray-500">Interested In</p>
            <div className="flex flex-wrap justify-end gap-1 mt-1">
              {lead.services_interested.map((service: string, idx: number) => (
                <span key={idx} className="text-sm bg-brand-100 text-brand-700 px-2 py-0.5 rounded">
                  {service}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Follow Up Reminder */}
      {currentStatus !== "WON" && currentStatus !== "LOST" && (
        <div className="card p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Follow-up Reminder</p>
              <p className="text-xs text-gray-500">Set a date to remind you to follow up</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="input text-sm py-1.5"
              />
              {followUpDate !== (lead.follow_up_date || "") && (
                <button
                  onClick={saveFollowUp}
                  disabled={savingFollowUp}
                  className="btn-primary text-sm py-1.5"
                >
                  {savingFollowUp ? "Saving..." : "Save"}
                </button>
              )}
              {followUpDate && (
                <button
                  onClick={() => {
                    setFollowUpDate("");
                    supabase.from("inquiries").update({ follow_up_date: null }).eq("id", leadId).then(() => {
                      setLead({ ...lead, follow_up_date: null });
                    });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status Pipeline */}
      <div className="card p-4 mb-6">
        <p className="text-sm text-gray-500 mb-3">Move to:</p>
        <div className="flex flex-wrap gap-2">
          {statusOrder.map((status) => {
            const cfg = statusConfig[status];
            const isActive = status === currentStatus;
            return (
              <button
                key={status}
                onClick={() => updateStatus(status)}
                disabled={updating || isActive}
                className={clsx(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? `${cfg.bg} ${cfg.text} cursor-default`
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contact Info */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
        <dl className="space-y-3">
          {lead.email && (
            <div>
              <dt className="text-sm text-gray-500">Email</dt>
              <dd className="text-gray-900">
                <a href={`mailto:${lead.email}`} className="text-brand-600 hover:underline">
                  {lead.email}
                </a>
              </dd>
            </div>
          )}
          {lead.phone && (
            <div>
              <dt className="text-sm text-gray-500">Phone</dt>
              <dd className="text-gray-900">
                <a href={`tel:${lead.phone}`} className="text-brand-600 hover:underline">
                  {lead.phone}
                </a>
              </dd>
            </div>
          )}
          <div>
            <dt className="text-sm text-gray-500">Source</dt>
            <dd className="text-gray-900 capitalize">{lead.source}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Created</dt>
            <dd className="text-gray-900">
              {new Date(lead.created_at).toLocaleDateString("en-AU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </dd>
          </div>
        </dl>
      </div>

      {/* Notes */}
      {lead.message && (
        <div className="card p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{lead.message}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {currentStatus !== "WON" && currentStatus !== "LOST" && (
          <button
            onClick={convertToClient}
            disabled={converting}
            className="btn-primary"
          >
            {converting ? "Converting..." : "Convert to Client"}
          </button>
        )}
        {lead.converted_client_id && (
          <Link href={`/clients/${lead.converted_client_id}`} className="btn-secondary">
            View Client
          </Link>
        )}
        <button onClick={deleteLead} className="btn-danger ml-auto">
          Delete
        </button>
      </div>
    </div>
  );
}
