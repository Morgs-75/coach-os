"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { clsx } from "clsx";

type InquiryStatus = "NEW" | "CONTACTED" | "BOOKED" | "WON" | "LOST";

interface Inquiry {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: InquiryStatus;
  source: string;
  services_interested: string[] | null;
  follow_up_date: string | null;
  referral_code: string | null;
  created_at: string;
}

interface ReferralLink {
  id: string;
  code: string;
  name: string;
  description: string | null;
  reward_type: string;
  reward_value: number | null;
  clicks: number;
  signups: number;
  conversions: number;
  is_active: boolean;
  created_at: string;
}

const statusConfig: Record<InquiryStatus, { label: string; bg: string; text: string }> = {
  NEW: { label: "New", bg: "bg-blue-100", text: "text-blue-700" },
  CONTACTED: { label: "Contacted", bg: "bg-purple-100", text: "text-purple-700" },
  BOOKED: { label: "Booked", bg: "bg-amber-100", text: "text-amber-700" },
  WON: { label: "Won", bg: "bg-green-100", text: "text-green-700" },
  LOST: { label: "Lost", bg: "bg-gray-100 dark:bg-gray-700", text: "text-gray-500 dark:text-gray-400 dark:text-gray-500" },
};

const pipelineOrder: InquiryStatus[] = ["NEW", "CONTACTED", "BOOKED", "WON", "LOST"];

export default function LeadsPage() {
  const [activeTab, setActiveTab] = useState<"leads" | "referrals">("leads");
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [referralLinks, setReferralLinks] = useState<ReferralLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Referral modal
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralForm, setReferralForm] = useState({
    name: "",
    description: "",
    reward_type: "discount",
    reward_value: 10,
  });
  const [creating, setCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) return;
    setOrgId(membership.org_id);

    // Load inquiries
    const { data: inquiriesData } = await supabase
      .from("inquiries")
      .select("*")
      .eq("org_id", membership.org_id)
      .order("created_at", { ascending: false });

    if (inquiriesData) setInquiries(inquiriesData);

    // Load referral links
    const { data: linksData } = await supabase
      .from("referral_links")
      .select("*")
      .eq("org_id", membership.org_id)
      .order("created_at", { ascending: false });

    if (linksData) setReferralLinks(linksData);

    setLoading(false);
  }

  async function handleCreateReferralLink(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setCreating(true);

    // Generate a unique code
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();

    const { error } = await supabase.from("referral_links").insert({
      org_id: orgId,
      code,
      name: referralForm.name,
      description: referralForm.description || null,
      reward_type: referralForm.reward_type,
      reward_value: referralForm.reward_value,
      is_active: true,
    });

    if (!error) {
      setShowReferralModal(false);
      setReferralForm({
        name: "",
        description: "",
        reward_type: "discount",
        reward_value: 10,
      });
      loadData();
    }

    setCreating(false);
  }

  async function toggleReferralActive(id: string, isActive: boolean) {
    await supabase
      .from("referral_links")
      .update({ is_active: !isActive })
      .eq("id", id);
    loadData();
  }

  function copyReferralLink(code: string) {
    const url = `${window.location.origin}/refer/${code}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
    });
  };

  // Check if a follow-up date is overdue or due today
  const getFollowUpStatus = (followUpDate: string | null) => {
    if (!followUpDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const followUp = new Date(followUpDate);
    followUp.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((followUp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "overdue";
    if (diffDays === 0) return "today";
    if (diffDays <= 3) return "soon";
    return "scheduled";
  };

  // Group inquiries by status
  const grouped = pipelineOrder.reduce((acc, status) => {
    acc[status] = inquiries.filter((i) => i.status === status);
    return acc;
  }, {} as Record<InquiryStatus, Inquiry[]>);

  // Count leads needing follow-up
  const overdueFollowUps = inquiries.filter(i =>
    !["WON", "LOST"].includes(i.status) &&
    getFollowUpStatus(i.follow_up_date) === "overdue"
  ).length;

  const todayFollowUps = inquiries.filter(i =>
    !["WON", "LOST"].includes(i.status) &&
    getFollowUpStatus(i.follow_up_date) === "today"
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Leads & Referrals</h1>
          <div className="flex items-center gap-4 mt-1">
            {overdueFollowUps > 0 && (
              <span className="text-sm text-red-600 font-medium">
                {overdueFollowUps} overdue follow-up{overdueFollowUps !== 1 ? "s" : ""}
              </span>
            )}
            {todayFollowUps > 0 && (
              <span className="text-sm text-amber-600 font-medium">
                {todayFollowUps} follow-up{todayFollowUps !== 1 ? "s" : ""} due today
              </span>
            )}
            {overdueFollowUps === 0 && todayFollowUps === 0 && (
              <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm">{inquiries.length} leads in pipeline</span>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              const activeLink = referralLinks.find(l => l.is_active);
              if (activeLink) {
                copyReferralLink(activeLink.code);
              } else {
                setShowReferralModal(true);
              }
            }}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
          >
            {copiedCode ? "Link Copied!" : "Refer Me"}
          </button>
          {activeTab === "referrals" && (
            <button
              onClick={() => setShowReferralModal(true)}
              className="btn-primary"
            >
              + Create Referral Link
            </button>
          )}
          {activeTab === "leads" && (
            <Link href="/leads/new" className="btn-primary">
              + Add Lead
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab("leads")}
            className={clsx(
              "pb-4 text-sm font-medium border-b-2 transition-colors",
              activeTab === "leads"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-300"
            )}
          >
            Leads ({inquiries.length})
          </button>
          <button
            onClick={() => setActiveTab("referrals")}
            className={clsx(
              "pb-4 text-sm font-medium border-b-2 transition-colors",
              activeTab === "referrals"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-300"
            )}
          >
            Referral Links ({referralLinks.length})
          </button>
        </div>
      </div>

      {activeTab === "leads" && (
        <>
          {/* Kanban Board */}
          <div className="flex gap-4 overflow-x-auto pb-4 mb-8">
            {pipelineOrder.slice(0, -1).map((status) => {
              const config = statusConfig[status];
              const items = grouped[status];

              return (
                <div key={status} className="flex-shrink-0 w-72">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={clsx("px-2 py-0.5 rounded text-xs font-medium", config.bg, config.text)}>
                      {config.label}
                    </span>
                    <span className="text-sm text-gray-400 dark:text-gray-500">{items.length}</span>
                  </div>

                  <div className="space-y-3">
                    {items.map((inquiry) => {
                      const followUpStatus = getFollowUpStatus(inquiry.follow_up_date);
                      return (
                        <Link
                          key={inquiry.id}
                          href={`/leads/${inquiry.id}`}
                          className={clsx(
                            "bg-white dark:bg-gray-900 rounded-xl border p-4 block hover:shadow-md transition-shadow",
                            followUpStatus === "overdue" ? "border-red-300 bg-red-50" :
                            followUpStatus === "today" ? "border-amber-300 bg-amber-50" :
                            "border-gray-200 dark:border-gray-700"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-gray-900 dark:text-gray-100">{inquiry.name}</p>
                            {followUpStatus && (
                              <span className={clsx(
                                "text-xs px-1.5 py-0.5 rounded flex-shrink-0",
                                followUpStatus === "overdue" ? "bg-red-100 text-red-700" :
                                followUpStatus === "today" ? "bg-amber-100 text-amber-700" :
                                followUpStatus === "soon" ? "bg-blue-100 text-blue-700" :
                                "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                              )}>
                                {followUpStatus === "overdue" ? "Overdue" :
                                 followUpStatus === "today" ? "Today" :
                                 `F/U ${formatDate(inquiry.follow_up_date!)}`}
                              </span>
                            )}
                          </div>
                          {inquiry.email && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 truncate">{inquiry.email}</p>
                          )}
                          {inquiry.services_interested && inquiry.services_interested.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {inquiry.services_interested.slice(0, 2).map((service, idx) => (
                                <span key={idx} className="text-xs bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded">
                                  {service}
                                </span>
                              ))}
                              {inquiry.services_interested.length > 2 && (
                                <span className="text-xs text-gray-400 dark:text-gray-500">+{inquiry.services_interested.length - 2}</span>
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-gray-400 dark:text-gray-500">{inquiry.source}</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500">{formatDate(inquiry.created_at)}</span>
                            {inquiry.referral_code && (
                              <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                                Referral
                              </span>
                            )}
                          </div>
                        </Link>
                      );
                    })}

                    {items.length === 0 && (
                      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center text-gray-400 dark:text-gray-500 text-sm">
                        No leads
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Won/Lost Summary */}
            <div className="flex-shrink-0 w-72">
              <div className="mb-3">
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                  Closed
                </span>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-green-600 font-medium">Won</span>
                  <span className="text-sm text-gray-900 dark:text-gray-100">{grouped.WON.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium">Lost</span>
                  <span className="text-sm text-gray-900 dark:text-gray-100">{grouped.LOST.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* All Leads Table */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">All Leads</h2>
            </div>
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Services Enquired</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Follow Up</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {inquiries.map((inquiry) => {
                  const config = statusConfig[inquiry.status];
                  const followUpStatus = getFollowUpStatus(inquiry.follow_up_date);
                  return (
                    <tr key={inquiry.id} className={clsx(
                      "hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800",
                      followUpStatus === "overdue" && "bg-red-50",
                      followUpStatus === "today" && "bg-amber-50"
                    )}>
                      <td className="px-6 py-4">
                        <Link href={`/leads/${inquiry.id}`} className="hover:text-blue-600">
                          <p className="font-medium text-gray-900 dark:text-gray-100">{inquiry.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">{inquiry.email}</p>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <span className={clsx("px-2 py-0.5 rounded text-xs font-medium", config.bg, config.text)}>
                          {config.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
                        {inquiry.source}
                        {inquiry.referral_code && (
                          <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                            Referral
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {inquiry.services_interested && inquiry.services_interested.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {inquiry.services_interested.map((service, idx) => (
                              <span key={idx} className="text-xs bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded">
                                {service}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {inquiry.follow_up_date ? (
                          <span className={clsx(
                            "text-xs px-2 py-0.5 rounded font-medium",
                            followUpStatus === "overdue" ? "bg-red-100 text-red-700" :
                            followUpStatus === "today" ? "bg-amber-100 text-amber-700" :
                            followUpStatus === "soon" ? "bg-blue-100 text-blue-700" :
                            "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                          )}>
                            {followUpStatus === "overdue" ? "Overdue" :
                             followUpStatus === "today" ? "Today" :
                             formatDate(inquiry.follow_up_date)}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">{formatDate(inquiry.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === "referrals" && (
        <div className="space-y-6">
          {/* Referral Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Total Links</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{referralLinks.length}</p>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Total Clicks</p>
              <p className="text-2xl font-bold text-blue-600">
                {referralLinks.reduce((sum, l) => sum + l.clicks, 0)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Signups</p>
              <p className="text-2xl font-bold text-purple-600">
                {referralLinks.reduce((sum, l) => sum + l.signups, 0)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Conversions</p>
              <p className="text-2xl font-bold text-green-600">
                {referralLinks.reduce((sum, l) => sum + l.conversions, 0)}
              </p>
            </div>
          </div>

          {/* Referral Links */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Your Referral Links</h2>
            </div>
            {referralLinks.length > 0 ? (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {referralLinks.map((link) => (
                  <div key={link.id} className="px-6 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium text-gray-900 dark:text-gray-100">{link.name}</h3>
                        <span className={clsx(
                          "px-2 py-0.5 rounded text-xs font-medium",
                          link.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 dark:text-gray-500"
                        )}>
                          {link.is_active ? "Active" : "Paused"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyReferralLink(link.code)}
                          className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          {copiedCode === link.code ? "Copied!" : "Copy Link"}
                        </button>
                        <button
                          onClick={() => toggleReferralActive(link.id, link.is_active)}
                          className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:bg-gray-700 rounded-lg transition-colors"
                        >
                          {link.is_active ? "Pause" : "Activate"}
                        </button>
                      </div>
                    </div>

                    {link.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-3">{link.description}</p>
                    )}

                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                        <code className="text-blue-600 font-mono">{link.code}</code>
                      </div>
                      <div className="text-gray-500 dark:text-gray-400 dark:text-gray-500">
                        {link.clicks} clicks
                      </div>
                      <div className="text-gray-500 dark:text-gray-400 dark:text-gray-500">
                        {link.signups} signups
                      </div>
                      <div className="text-gray-500 dark:text-gray-400 dark:text-gray-500">
                        {link.conversions} conversions
                      </div>
                      {link.reward_type !== "none" && (
                        <div className="text-purple-600">
                          {link.reward_type === "discount" && `${link.reward_value}% off`}
                          {link.reward_type === "free_session" && "Free session"}
                          {link.reward_type === "credit" && `$${(link.reward_value || 0) / 100} credit`}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 mb-4">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <p className="text-gray-900 dark:text-gray-100 font-medium mb-1">No referral links yet</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-4">Create your first referral link to start tracking</p>
                <button
                  onClick={() => setShowReferralModal(true)}
                  className="btn-primary"
                >
                  Create Referral Link
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Referral Modal */}
      {showReferralModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Create Referral Link</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">Track where your referrals come from</p>
            </div>

            <form onSubmit={handleCreateReferralLink} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Link Name *</label>
                <input
                  type="text"
                  value={referralForm.name}
                  onChange={(e) => setReferralForm({ ...referralForm, name: e.target.value })}
                  className="input"
                  placeholder="e.g., Instagram Bio, Facebook Group"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <input
                  type="text"
                  value={referralForm.description}
                  onChange={(e) => setReferralForm({ ...referralForm, description: e.target.value })}
                  className="input"
                  placeholder="Optional notes about this link"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Referral Reward</label>
                <select
                  value={referralForm.reward_type}
                  onChange={(e) => setReferralForm({ ...referralForm, reward_type: e.target.value })}
                  className="input"
                >
                  <option value="discount">Discount (%)</option>
                  <option value="free_session">Free Session</option>
                  <option value="credit">Credit ($)</option>
                  <option value="none">No Reward</option>
                </select>
              </div>

              {referralForm.reward_type !== "none" && referralForm.reward_type !== "free_session" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {referralForm.reward_type === "discount" ? "Discount %" : "Credit Amount ($)"}
                  </label>
                  <input
                    type="number"
                    value={referralForm.reward_value}
                    onChange={(e) => setReferralForm({ ...referralForm, reward_value: parseInt(e.target.value) })}
                    className="input w-32"
                    min={1}
                    max={referralForm.reward_type === "discount" ? 100 : 1000}
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowReferralModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={creating}>
                  {creating ? "Creating..." : "Create Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
