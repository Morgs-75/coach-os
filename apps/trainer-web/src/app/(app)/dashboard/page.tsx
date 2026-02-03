"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { clsx } from "clsx";

interface DashboardData {
  activeClients: number;
  totalClients: number;
  activeSubscriptions: number;
  pastDueCount: number;
  mrr: number;
  revenueAtRisk: number;
  sessionsToday: number;
  sessionsThisWeek: number;
  riskClients: any[];
  upcomingBookings: any[];
  recentPayments: any[];
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({
    activeClients: 0,
    totalClients: 0,
    activeSubscriptions: 0,
    pastDueCount: 0,
    mrr: 0,
    revenueAtRisk: 0,
    sessionsToday: 0,
    sessionsThisWeek: 0,
    riskClients: [],
    upcomingBookings: [],
    recentPayments: [],
  });
  const [orgName, setOrgName] = useState("");
  const supabase = createClient();

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) return;
    const orgId = membership.org_id;

    const { data: org } = await supabase
      .from("orgs")
      .select("name")
      .eq("id", orgId)
      .single();
    if (org) setOrgName(org.name);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const [
      clientsResult,
      activeClientsResult,
      subscriptionsResult,
      bookingsResult,
      riskResult,
    ] = await Promise.all([
      supabase.from("clients").select("id", { count: "exact" }).eq("org_id", orgId),
      supabase.from("clients").select("id", { count: "exact" }).eq("org_id", orgId).eq("status", "active"),
      supabase.from("subscriptions").select("status, price_cents").eq("org_id", orgId),
      supabase.from("bookings")
        .select(`*, clients(full_name)`)
        .eq("org_id", orgId)
        .gte("start_time", today.toISOString())
        .lte("start_time", weekEnd.toISOString())
        .neq("status", "cancelled")
        .order("start_time", { ascending: true })
        .limit(8),
      supabase.from("client_risk")
        .select("client_id, tier, score, reasons, clients(full_name)")
        .eq("org_id", orgId)
        .in("tier", ["amber", "red"])
        .order("score", { ascending: false })
        .limit(5),
    ]);

    const activeSubscriptions = subscriptionsResult.data?.filter(s => s.status === "active") || [];
    const pastDueSubscriptions = subscriptionsResult.data?.filter(s => s.status === "past_due") || [];
    const mrr = activeSubscriptions.reduce((sum, s) => sum + (s.price_cents || 0), 0);
    const avgRevenue = activeSubscriptions.length > 0 ? mrr / activeSubscriptions.length : 0;

    const todayEnd = new Date(today);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const sessionsToday = bookingsResult.data?.filter(b => {
      const bookingDate = new Date(b.start_time);
      return bookingDate >= today && bookingDate < todayEnd;
    }).length || 0;

    setData({
      totalClients: clientsResult.count || 0,
      activeClients: activeClientsResult.count || 0,
      activeSubscriptions: activeSubscriptions.length,
      pastDueCount: pastDueSubscriptions.length,
      mrr,
      revenueAtRisk: pastDueSubscriptions.length * avgRevenue,
      sessionsToday,
      sessionsThisWeek: bookingsResult.data?.length || 0,
      riskClients: riskResult.data || [],
      upcomingBookings: bookingsResult.data || [],
      recentPayments: [],
    });

    setLoading(false);
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("en-AU", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">{orgName || "Dashboard"}</h1>
        <div className="flex gap-2">
          <Link
            href="/calendar"
            className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium"
          >
            + Booking
          </Link>
          <Link
            href="/clients"
            className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-xs font-medium"
          >
            + Client
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <p className="text-xs text-gray-500">MRR</p>
          <p className="text-lg font-semibold text-gray-900">{formatCurrency(data.mrr)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <p className="text-xs text-gray-500">Active Clients</p>
          <p className="text-lg font-semibold text-gray-900">{data.activeClients}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <p className="text-xs text-gray-500">Subscriptions</p>
          <p className="text-lg font-semibold text-gray-900">{data.activeSubscriptions}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <p className="text-xs text-gray-500">Today</p>
          <p className="text-lg font-semibold text-blue-600">{data.sessionsToday} sessions</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <p className="text-xs text-gray-500">This Week</p>
          <p className="text-lg font-semibold text-gray-900">{data.sessionsThisWeek} sessions</p>
        </div>
        <div className={clsx(
          "rounded-lg border p-3 text-center",
          data.pastDueCount > 0 ? "bg-red-50 border-red-200" : "bg-white border-gray-200"
        )}>
          <p className="text-xs text-gray-500">Past Due</p>
          <p className={clsx("text-lg font-semibold", data.pastDueCount > 0 ? "text-red-600" : "text-gray-900")}>
            {data.pastDueCount}
          </p>
        </div>
        <div className={clsx(
          "rounded-lg border p-3 text-center",
          data.riskClients.length > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-gray-200"
        )}>
          <p className="text-xs text-gray-500">At Risk</p>
          <p className={clsx("text-lg font-semibold", data.riskClients.length > 0 ? "text-amber-600" : "text-gray-900")}>
            {data.riskClients.length}
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Upcoming Sessions */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-900">Upcoming Sessions</h2>
            <Link href="/calendar" className="text-xs text-blue-600 hover:text-blue-700">
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {data.upcomingBookings.length > 0 ? (
              data.upcomingBookings.map((booking: any) => (
                <div key={booking.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-600">
                      {booking.clients?.full_name?.charAt(0) || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {booking.clients?.full_name || "Client"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {booking.session_type.replace("_", " ")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{formatTime(booking.start_time)}</p>
                    <p className="text-xs text-gray-500">{formatDate(booking.start_time)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                No upcoming sessions
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-5">
          {/* At Risk */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-medium text-gray-900">Needs Attention</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {data.riskClients.length > 0 ? (
                data.riskClients.map((risk: any) => (
                  <Link
                    key={risk.client_id}
                    href={`/clients/${risk.client_id}`}
                    className="block px-4 py-2.5 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {risk.clients?.full_name || "Unknown"}
                      </p>
                      <span className={clsx(
                        "px-1.5 py-0.5 rounded text-xs font-medium",
                        risk.tier === "red" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                      )}>
                        {risk.tier}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {risk.reasons?.[0] || "At risk"}
                    </p>
                  </Link>
                ))
              ) : (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-green-600 font-medium">All clients healthy</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-gray-900 rounded-lg p-4 text-white">
            <h3 className="text-xs font-medium text-gray-400 mb-3">Revenue Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">Monthly Revenue</span>
                <span className="text-sm font-medium">{formatCurrency(data.mrr)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">At Risk</span>
                <span className={clsx(
                  "text-sm font-medium",
                  data.revenueAtRisk > 0 ? "text-red-400" : ""
                )}>
                  {formatCurrency(data.revenueAtRisk)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-700">
                <span className="text-xs text-gray-400">Projected</span>
                <span className="text-sm font-medium text-green-400">
                  {formatCurrency(data.mrr - data.revenueAtRisk)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
