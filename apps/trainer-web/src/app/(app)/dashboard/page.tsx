import { createClient } from "@/lib/supabase/server";
import { getOrg } from "@/lib/get-org";
import Link from "next/link";
import { clsx } from "clsx";
import { redirect } from "next/navigation";

// Convert midnight of "today" in a given IANA timezone to UTC Date objects
function getOrgDateBounds(tz: string) {
  const now = new Date();

  // Get date/time parts in the org's timezone
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "numeric", day: "numeric",
    weekday: "short", hour: "numeric", minute: "numeric",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const year = parseInt(get("year"));
  const month = parseInt(get("month")) - 1; // 0-indexed
  const day = parseInt(get("day"));
  const weekday = get("weekday"); // "Sun", "Mon", etc.
  const tzHour = parseInt(get("hour")) % 24;
  const tzMin = parseInt(get("minute"));

  // Compute UTC offset (minutes) for this timezone right now
  const utcParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC", hour: "numeric", minute: "numeric", hour12: false,
  }).formatToParts(now);
  const utcHour = parseInt(utcParts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const utcMin = parseInt(utcParts.find((p) => p.type === "minute")?.value ?? "0");

  let offsetMin = (tzHour * 60 + tzMin) - (utcHour * 60 + utcMin);
  if (offsetMin > 720) offsetMin -= 1440;
  if (offsetMin < -720) offsetMin += 1440;

  // Midnight today in the org's timezone, expressed as UTC
  // e.g. AEST (UTC+10): midnight Brisbane = UTC - 10h = previous day 14:00 UTC
  const todayStart = new Date(Date.UTC(year, month, day) - offsetMin * 60000);
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  // Monday of the current week (Mon-Sun calendar, matching the calendar page)
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dowIdx = weekdays.indexOf(weekday);
  const daysFromMon = dowIdx === 0 ? 6 : dowIdx - 1;
  const weekStart = new Date(todayStart.getTime() - daysFromMon * 86400000);
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);

  return { todayStart, todayEnd, weekStart, weekEnd };
}

export default async function DashboardPage() {
  const org = await getOrg();

  if (!org) {
    redirect("/login");
  }

  const supabase = await createClient();
  const orgId = org.orgId;
  const orgName = org.orgName;

  // Fetch org timezone first (tiny query)
  const { data: smsSettings } = await supabase
    .from("sms_settings")
    .select("timezone")
    .eq("org_id", orgId)
    .maybeSingle();

  const tz = smsSettings?.timezone || "Australia/Brisbane";
  const { todayStart, todayEnd, weekStart, weekEnd } = getOrgDateBounds(tz);

  // All queries in parallel
  const [
    clientsResult,
    activeClientsResult,
    subscriptionsResult,
    sessionsTodayResult,
    sessionsWeekResult,
    upcomingResult,
    riskResult,
  ] = await Promise.all([
    // Client counts (head: true = count only, no data fetched)
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "active"),
    // Subscriptions (small, need data for MRR calc)
    supabase.from("subscriptions").select("status, price_cents").eq("org_id", orgId),
    // Sessions today — exact count, no limit
    supabase.from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .gte("start_time", todayStart.toISOString())
      .lt("start_time", todayEnd.toISOString())
      .neq("status", "cancelled"),
    // Sessions this week (Mon–Sun) — exact count, no limit
    supabase.from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .gte("start_time", weekStart.toISOString())
      .lt("start_time", weekEnd.toISOString())
      .neq("status", "cancelled"),
    // Upcoming sessions for display list (from now, limited to 8)
    supabase.from("bookings")
      .select("*, clients(full_name)")
      .eq("org_id", orgId)
      .gte("start_time", new Date().toISOString())
      .neq("status", "cancelled")
      .order("start_time", { ascending: true })
      .limit(8),
    // At-risk clients
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

  const data = {
    totalClients: clientsResult.count || 0,
    activeClients: activeClientsResult.count || 0,
    activeSubscriptions: activeSubscriptions.length,
    pastDueCount: pastDueSubscriptions.length,
    mrr,
    revenueAtRisk: pastDueSubscriptions.length * avgRevenue,
    sessionsToday: sessionsTodayResult.count || 0,
    sessionsThisWeek: sessionsWeekResult.count || 0,
    riskClients: riskResult.data || [],
    upcomingBookings: upcomingResult.data || [],
  };

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
      timeZone: tz,
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const todayDateStr = todayStart.toLocaleDateString("en-CA", { timeZone: tz });
    const tomorrowStart = new Date(todayEnd);
    const tomorrowDateStr = tomorrowStart.toLocaleDateString("en-CA", { timeZone: tz });
    const bookingDateStr = date.toLocaleDateString("en-CA", { timeZone: tz });

    if (bookingDateStr === todayDateStr) return "Today";
    if (bookingDateStr === tomorrowDateStr) return "Tomorrow";
    return date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", timeZone: tz });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{orgName || "Dashboard"}</h1>
        <div className="flex gap-2">
          <Link
            href="/calendar"
            className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium"
          >
            + Booking
          </Link>
          <Link
            href="/clients/new"
            className="inline-flex items-center px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-xs font-medium"
          >
            + Client
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">MRR</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(data.mrr)}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">Active Clients</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{data.activeClients}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">Subscriptions</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{data.activeSubscriptions}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">Today</p>
          <p className="text-lg font-semibold text-blue-600">{data.sessionsToday} sessions</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">This Week</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{data.sessionsThisWeek} sessions</p>
        </div>
        <div className={clsx(
          "rounded-lg border p-3 text-center",
          data.pastDueCount > 0 ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800" : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
        )}>
          <p className="text-xs text-gray-500 dark:text-gray-400">Past Due</p>
          <p className={clsx("text-lg font-semibold", data.pastDueCount > 0 ? "text-red-600" : "text-gray-900 dark:text-gray-100")}>
            {data.pastDueCount}
          </p>
        </div>
        <div className={clsx(
          "rounded-lg border p-3 text-center",
          data.riskClients.length > 0 ? "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800" : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
        )}>
          <p className="text-xs text-gray-500 dark:text-gray-400">At Risk</p>
          <p className={clsx("text-lg font-semibold", data.riskClients.length > 0 ? "text-amber-600" : "text-gray-900 dark:text-gray-100")}>
            {data.riskClients.length}
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Upcoming Sessions */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Upcoming Sessions</h2>
            <Link href="/calendar" className="text-xs text-blue-600 hover:text-blue-700">
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.upcomingBookings.length > 0 ? (
              data.upcomingBookings.map((booking: any) => (
                <div key={booking.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-medium text-blue-600 dark:text-blue-400">
                      {booking.clients?.full_name?.charAt(0) || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {booking.clients?.full_name || "Client"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {booking.session_type?.replace("_", " ") || "Session"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatTime(booking.start_time)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(booking.start_time)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                No upcoming sessions
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-5">
          {/* At Risk */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Needs Attention</h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {data.riskClients.length > 0 ? (
                data.riskClients.map((risk: any) => (
                  <Link
                    key={risk.client_id}
                    href={`/clients/${risk.client_id}`}
                    className="block px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {risk.clients?.full_name || "Unknown"}
                      </p>
                      <span className={clsx(
                        "px-1.5 py-0.5 rounded text-xs font-medium",
                        risk.tier === "red" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                      )}>
                        {risk.tier}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
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
