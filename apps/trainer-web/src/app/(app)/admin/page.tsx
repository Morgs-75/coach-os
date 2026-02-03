"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { clsx } from "clsx";

interface Org {
  id: string;
  name: string;
  created_at: string;
  commission_rate: number;
  client_count: number;
  active_subs: number;
  gross_earnings_cents: number;
  net_earnings_cents: number;
  pending_payout_cents: number;
}

interface PlatformStats {
  total_revenue: number;
  total_commission: number;
  pending_payouts: number;
}

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [platformStats, setPlatformStats] = useState<PlatformStats>({
    total_revenue: 0,
    total_commission: 0,
    pending_payouts: 0,
  });

  // New business modal
  const [showNewOrgModal, setShowNewOrgModal] = useState(false);
  const [newOrgForm, setNewOrgForm] = useState({
    name: "",
    owner_email: "",
    owner_name: "",
    commission_rate: 5,
  });
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState("");

  const supabase = createClient();

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

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
    await loadData();
    setLoading(false);
  }

  async function loadData() {
    // Load all orgs with earnings
    const { data: orgsData } = await supabase
      .from("orgs")
      .select(`
        id,
        name,
        created_at,
        commission_rate,
        clients(count),
        subscriptions(count)
      `)
      .order("created_at", { ascending: false });

    // Load earnings for each org
    const { data: earningsData } = await supabase
      .from("org_earnings")
      .select("*");

    const earningsMap = new Map(earningsData?.map((e: any) => [e.org_id, e]) || []);

    if (orgsData) {
      const orgsWithStats = orgsData.map((org: any) => {
        const earnings = earningsMap.get(org.id) || {};
        return {
          id: org.id,
          name: org.name,
          created_at: org.created_at,
          commission_rate: org.commission_rate,
          client_count: org.clients?.[0]?.count || 0,
          active_subs: org.subscriptions?.[0]?.count || 0,
          gross_earnings_cents: earnings.gross_earnings_cents || 0,
          net_earnings_cents: earnings.net_earnings_cents || 0,
          pending_payout_cents: earnings.pending_payout_cents || 0,
        };
      });
      setOrgs(orgsWithStats);

      // Calculate platform totals
      const totalRevenue = orgsWithStats.reduce((sum, org) => sum + org.gross_earnings_cents, 0);
      const totalCommission = orgsWithStats.reduce((sum, org) => sum + (org.gross_earnings_cents * org.commission_rate), 0);
      const pendingPayouts = orgsWithStats.reduce((sum, org) => sum + org.pending_payout_cents, 0);

      setPlatformStats({
        total_revenue: totalRevenue,
        total_commission: totalCommission,
        pending_payouts: pendingPayouts,
      });
    }
  }

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateMessage("");

    try {
      // Create the org
      const { data: org, error: orgError } = await supabase
        .from("orgs")
        .insert({
          name: newOrgForm.name,
          commission_rate: newOrgForm.commission_rate / 100,
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Create branding entry
      await supabase.from("branding").insert({
        org_id: org.id,
        display_name: newOrgForm.name,
        primary_color: "#0ea5e9",
      });

      // Create booking settings
      await supabase.from("booking_settings").insert({
        org_id: org.id,
      });

      // Create payout settings
      await supabase.from("org_payout_settings").insert({
        org_id: org.id,
      });

      setCreateMessage(`Business "${newOrgForm.name}" created successfully! Send invite link to ${newOrgForm.owner_email}.`);
      setNewOrgForm({ name: "", owner_email: "", owner_name: "", commission_rate: 5 });
      loadData();
    } catch (err: any) {
      setCreateMessage(`Error: ${err.message}`);
    }

    setCreating(false);
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

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-500 mb-4">You don't have platform admin access.</p>
        <Link href="/dashboard" className="btn-primary inline-block">
          Go to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Admin</h1>
          <p className="text-gray-500">Manage all Coach OS businesses</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/insights"
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
          >
            Insights
          </Link>
          <Link
            href="/admin/newsletters"
            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            Newsletters
          </Link>
          <button
            onClick={() => setShowNewOrgModal(true)}
            className="btn-primary"
          >
            + Add New Business
          </button>
        </div>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-white/20 rounded-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold">{orgs.length}</p>
          <p className="text-blue-100">Total Businesses</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-white/20 rounded-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(platformStats.total_revenue)}</p>
          <p className="text-green-100">Total Revenue</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-white/20 rounded-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(platformStats.total_commission)}</p>
          <p className="text-purple-100">Platform Commission (5%)</p>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-white/20 rounded-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(platformStats.pending_payouts)}</p>
          <p className="text-amber-100">Pending Payouts</p>
        </div>
      </div>

      {/* Businesses Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">All Businesses</h2>
          <span className="text-sm text-gray-500">{orgs.length} businesses</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clients</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subscriptions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pending Payout</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Commission</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orgs.map((org) => (
                <tr key={org.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{org.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{org.id.slice(0, 8)}...</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {org.client_count}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {org.active_subs}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {formatCurrency(org.gross_earnings_cents)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={clsx(
                      "font-medium",
                      org.pending_payout_cents > 0 ? "text-amber-600" : "text-gray-400"
                    )}>
                      {formatCurrency(org.pending_payout_cents)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {(org.commission_rate * 100).toFixed(0)}%
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-sm">
                    {new Date(org.created_at).toLocaleDateString("en-AU")}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/admin/orgs/${org.id}`}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      Manage
                      <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </td>
                </tr>
              ))}
              {orgs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <p className="text-gray-500 mb-2">No businesses yet</p>
                    <button
                      onClick={() => setShowNewOrgModal(true)}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Add your first business
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Business Modal */}
      {showNewOrgModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Add New Business</h2>
              <p className="text-sm text-gray-500 mt-1">Create a new PT business on the platform</p>
            </div>

            <form onSubmit={handleCreateOrg} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
                <input
                  type="text"
                  value={newOrgForm.name}
                  onChange={(e) => setNewOrgForm({ ...newOrgForm, name: e.target.value })}
                  className="input"
                  placeholder="e.g., John's PT Studio"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name *</label>
                <input
                  type="text"
                  value={newOrgForm.owner_name}
                  onChange={(e) => setNewOrgForm({ ...newOrgForm, owner_name: e.target.value })}
                  className="input"
                  placeholder="John Smith"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner Email *</label>
                <input
                  type="email"
                  value={newOrgForm.owner_email}
                  onChange={(e) => setNewOrgForm({ ...newOrgForm, owner_email: e.target.value })}
                  className="input"
                  placeholder="john@example.com"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  They'll receive an invite to claim their account
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Commission Rate (%)</label>
                <input
                  type="number"
                  value={newOrgForm.commission_rate}
                  onChange={(e) => setNewOrgForm({ ...newOrgForm, commission_rate: parseFloat(e.target.value) })}
                  className="input"
                  min={0}
                  max={100}
                  step={0.5}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Default is 5%. You can offer custom rates for special deals.
                </p>
              </div>

              {createMessage && (
                <div className={clsx(
                  "p-3 rounded-lg text-sm",
                  createMessage.includes("Error")
                    ? "bg-red-50 text-red-700"
                    : "bg-green-50 text-green-700"
                )}>
                  {createMessage}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewOrgModal(false);
                    setCreateMessage("");
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={creating}>
                  {creating ? "Creating..." : "Create Business"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
