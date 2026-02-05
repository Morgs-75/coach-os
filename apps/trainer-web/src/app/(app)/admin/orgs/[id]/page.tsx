"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { clsx } from "clsx";

interface OrgDetails {
  id: string;
  name: string;
  created_at: string;
  commission_rate: number;
}

interface OrgMember {
  id: string;
  user_id: string;
  role: string;
  email: string;
  created_at: string;
}

interface Client {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: string;
  created_at: string;
}

interface Earnings {
  gross_earnings_cents: number;
  net_earnings_cents: number;
  commission_cents: number;
  paid_out_cents: number;
  pending_payout_cents: number;
}

interface Payout {
  id: string;
  period_start: string;
  period_end: string;
  gross_amount_cents: number;
  commission_cents: number;
  net_amount_cents: number;
  status: string;
  paid_at: string | null;
}

export default function OrgDetailPage() {
  const params = useParams();
  const orgId = params.id as string;

  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<OrgDetails | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "clients" | "payouts" | "settings">("overview");

  // Payout modal
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutReference, setPayoutReference] = useState("");
  const [processingPayout, setProcessingPayout] = useState(false);

  // Settings
  const [commissionRate, setCommissionRate] = useState(5);
  const [savingSettings, setSavingSettings] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    checkAdminAndLoad();
  }, [orgId]);

  async function checkAdminAndLoad() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: adminCheck } = await supabase
      .from("platform_admins")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!adminCheck) {
      setLoading(false);
      return;
    }

    setIsAdmin(true);
    await loadOrgData();
    setLoading(false);
  }

  async function loadOrgData() {
    // Load org details
    const { data: orgData } = await supabase
      .from("orgs")
      .select("*")
      .eq("id", orgId)
      .single();

    if (orgData) {
      setOrg(orgData);
      setCommissionRate(orgData.commission_rate * 100);
    }

    // Load org members
    const { data: membersData } = await supabase
      .from("org_members")
      .select(`
        id,
        user_id,
        role,
        created_at,
        users:user_id (email)
      `)
      .eq("org_id", orgId);

    if (membersData) {
      setMembers(membersData.map((m: any) => ({
        ...m,
        email: m.users?.email || "Unknown",
      })));
    }

    // Load clients
    const { data: clientsData } = await supabase
      .from("clients")
      .select("id, full_name, email, phone, status, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (clientsData) setClients(clientsData);

    // Load earnings
    const { data: earningsData } = await supabase
      .from("org_earnings")
      .select("*")
      .eq("org_id", orgId)
      .single();

    if (earningsData) setEarnings(earningsData);

    // Load payouts
    const { data: payoutsData } = await supabase
      .from("org_payouts")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (payoutsData) setPayouts(payoutsData);
  }

  async function handleCreatePayout() {
    if (!earnings || !payoutAmount) return;
    setProcessingPayout(true);

    const amount = Math.round(parseFloat(payoutAmount) * 100);

    await supabase.from("org_payouts").insert({
      org_id: orgId,
      period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      period_end: new Date().toISOString().split("T")[0],
      gross_amount_cents: Math.round(amount / 0.95),
      commission_cents: Math.round(amount / 0.95 * 0.05),
      net_amount_cents: amount,
      status: "processing",
      payout_reference: payoutReference,
    });

    setShowPayoutModal(false);
    setPayoutAmount("");
    setPayoutReference("");
    setProcessingPayout(false);
    loadOrgData();
  }

  async function handleMarkPaid(payoutId: string) {
    await supabase
      .from("org_payouts")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("id", payoutId);
    loadOrgData();
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    await supabase
      .from("orgs")
      .update({ commission_rate: commissionRate / 100 })
      .eq("id", orgId);
    setSavingSettings(false);
    loadOrgData();
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(cents / 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAdmin || !org) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h1>
        <Link href="/admin" className="btn-primary inline-block mt-4">
          Back to Admin
        </Link>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "clients", label: `Clients (${clients.length})` },
    { id: "payouts", label: "Payouts" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin"
          className="inline-flex items-center text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-300 mb-4"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Admin
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{org.name}</h1>
            <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">
              Joined {new Date(org.created_at).toLocaleDateString("en-AU")} · {commissionRate}% commission
            </p>
          </div>
          <button
            onClick={() => setShowPayoutModal(true)}
            className="btn-primary"
            disabled={!earnings || earnings.pending_payout_cents <= 0}
          >
            Create Payout
          </button>
        </div>
      </div>

      {/* Earnings Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Gross Earnings</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(earnings?.gross_earnings_cents || 0)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Commission ({commissionRate}%)</p>
          <p className="text-2xl font-bold text-purple-600">
            {formatCurrency(earnings?.commission_cents || 0)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Net Earnings</p>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(earnings?.net_earnings_cents || 0)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Paid Out</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(earnings?.paid_out_cents || 0)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Pending Payout</p>
          <p className={clsx(
            "text-2xl font-bold",
            (earnings?.pending_payout_cents || 0) > 0 ? "text-amber-600" : "text-gray-400 dark:text-gray-500"
          )}>
            {formatCurrency(earnings?.pending_payout_cents || 0)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={clsx(
                "pb-4 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-300"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Team Members */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Team Members</h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {members.map((member) => (
                <div key={member.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{member.email}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      Joined {new Date(member.created_at).toLocaleDateString("en-AU")}
                    </p>
                  </div>
                  <span className={clsx(
                    "px-2.5 py-0.5 rounded-full text-xs font-medium",
                    member.role === "owner" ? "bg-purple-100 text-purple-800" : "bg-gray-100 dark:bg-gray-700 text-gray-800"
                  )}>
                    {member.role}
                  </span>
                </div>
              ))}
              {members.length === 0 && (
                <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  No team members yet
                </div>
              )}
            </div>
          </div>

          {/* Recent Clients */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Clients</h2>
              <button
                onClick={() => setActiveTab("clients")}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                View all
              </button>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {clients.slice(0, 5).map((client) => (
                <div key={client.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{client.full_name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">{client.email}</p>
                  </div>
                  <span className={clsx(
                    "px-2.5 py-0.5 rounded-full text-xs font-medium",
                    client.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 dark:bg-gray-700 text-gray-800"
                  )}>
                    {client.status}
                  </span>
                </div>
              ))}
              {clients.length === 0 && (
                <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  No clients yet
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "clients" && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{client.full_name}</td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400 dark:text-gray-500">{client.email}</td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400 dark:text-gray-500">{client.phone || "-"}</td>
                  <td className="px-6 py-4">
                    <span className={clsx(
                      "px-2.5 py-0.5 rounded-full text-xs font-medium",
                      client.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 dark:bg-gray-700 text-gray-800"
                    )}>
                      {client.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    {new Date(client.created_at).toLocaleDateString("en-AU")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "payouts" && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Period</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Gross</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Commission</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Net</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {payouts.map((payout) => (
                <tr key={payout.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800">
                  <td className="px-6 py-4 text-gray-900 dark:text-gray-100">
                    {new Date(payout.period_start).toLocaleDateString("en-AU")} - {new Date(payout.period_end).toLocaleDateString("en-AU")}
                  </td>
                  <td className="px-6 py-4 text-gray-900 dark:text-gray-100">{formatCurrency(payout.gross_amount_cents)}</td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400 dark:text-gray-500">{formatCurrency(payout.commission_cents)}</td>
                  <td className="px-6 py-4 font-medium text-green-600">{formatCurrency(payout.net_amount_cents)}</td>
                  <td className="px-6 py-4">
                    <span className={clsx(
                      "px-2.5 py-0.5 rounded-full text-xs font-medium",
                      payout.status === "paid" ? "bg-green-100 text-green-800" :
                      payout.status === "processing" ? "bg-amber-100 text-amber-800" :
                      "bg-gray-100 dark:bg-gray-700 text-gray-800"
                    )}>
                      {payout.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {payout.status === "processing" && (
                      <button
                        onClick={() => handleMarkPaid(payout.id)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Mark Paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {payouts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    No payouts yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "settings" && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-xl">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">Business Settings</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Commission Rate (%)
              </label>
              <input
                type="number"
                value={commissionRate}
                onChange={(e) => setCommissionRate(parseFloat(e.target.value))}
                className="input w-32"
                min={0}
                max={100}
                step={0.5}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
                Platform fee charged on all transactions
              </p>
            </div>

            <button
              onClick={handleSaveSettings}
              className="btn-primary"
              disabled={savingSettings}
            >
              {savingSettings ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* Payout Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Create Payout</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
                Pending balance: {formatCurrency(earnings?.pending_payout_cents || 0)}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Payout Amount ($)
                </label>
                <input
                  type="number"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  className="input"
                  placeholder="0.00"
                  step="0.01"
                  max={(earnings?.pending_payout_cents || 0) / 100}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reference (optional)
                </label>
                <input
                  type="text"
                  value={payoutReference}
                  onChange={(e) => setPayoutReference(e.target.value)}
                  className="input"
                  placeholder="Bank transfer ref, PayPal ID, etc."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowPayoutModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePayout}
                  className="btn-primary"
                  disabled={processingPayout || !payoutAmount}
                >
                  {processingPayout ? "Processing..." : "Create Payout"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
