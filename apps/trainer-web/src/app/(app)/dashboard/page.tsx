import { createClient } from "@/lib/supabase/server";
import { getOrg } from "@/lib/get-org";
import Link from "next/link";
import { clsx } from "clsx";
import { redirect } from "next/navigation";
import Charts from "./Charts";
import type { WeeklySessionRow, MonthlyRow, PackageStat, NameValue, RevenueByDemo } from "./Charts";

// ── Timezone helpers ─────────────────────────────────────────────────────────

function getOrgDateBounds(tz: string) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "numeric", day: "numeric",
    weekday: "short", hour: "numeric", minute: "numeric", hour12: false,
  }).formatToParts(now);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const year = parseInt(get("year"));
  const month = parseInt(get("month")) - 1;
  const day = parseInt(get("day"));
  const weekday = get("weekday");
  const tzHour = parseInt(get("hour")) % 24;
  const tzMin = parseInt(get("minute"));

  const utcParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC", hour: "numeric", minute: "numeric", hour12: false,
  }).formatToParts(now);
  const utcHour = parseInt(utcParts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const utcMin = parseInt(utcParts.find((p) => p.type === "minute")?.value ?? "0");

  let offsetMin = (tzHour * 60 + tzMin) - (utcHour * 60 + utcMin);
  if (offsetMin > 720) offsetMin -= 1440;
  if (offsetMin < -720) offsetMin += 1440;

  const todayStart = new Date(Date.UTC(year, month, day) - offsetMin * 60000);
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  const wkMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dowIdx = wkMap[weekday] ?? 0;
  const daysFromMon = dowIdx === 0 ? 6 : dowIdx - 1;
  const weekStart = new Date(todayStart.getTime() - daysFromMon * 86400000);
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);

  return { now, todayStart, todayEnd, weekStart, weekEnd, offsetMin };
}

// ── Aggregation helpers ──────────────────────────────────────────────────────

function ageGroup(dob: string | null): string {
  if (!dob) return "Unknown";
  const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 86400000));
  if (age < 25) return "18–24";
  if (age < 35) return "25–34";
  if (age < 45) return "35–44";
  if (age < 55) return "45–54";
  return "55+";
}

function weekLabel(date: Date, tz: string): string {
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: tz });
}

const aud = (cents: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0 })
    .format(cents / 100);

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const org = await getOrg();
  if (!org) redirect("/login");

  const supabase = await createClient();
  const { orgId, orgName } = org;

  // Timezone
  const { data: smsSettings } = await supabase
    .from("sms_settings").select("timezone").eq("org_id", orgId).maybeSingle();
  const tz = smsSettings?.timezone || "Australia/Brisbane";

  const { now, todayStart, todayEnd, weekStart, weekEnd } = getOrgDateBounds(tz);

  const eightWeeksAgo = new Date(weekStart.getTime() - 7 * 7 * 86400000);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = thisMonthStart;

  // ── All queries in parallel ──────────────────────────────────────────────
  const [
    activeClientsRes,
    subscriptionsRes,
    sessionsTodayRes,
    sessionsWeekRes,
    riskRes,
    recentBookingsRes,
    purchasesRes,
    allPurchasesRes,
    clientsRes,
    sessionTypesRes,
  ] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true })
      .eq("org_id", orgId).eq("status", "active"),
    supabase.from("subscriptions").select("status, price_cents").eq("org_id", orgId),
    supabase.from("bookings").select("id", { count: "exact", head: true })
      .eq("org_id", orgId).gte("start_time", todayStart.toISOString())
      .lt("start_time", todayEnd.toISOString()).neq("status", "cancelled"),
    supabase.from("bookings").select("id", { count: "exact", head: true })
      .eq("org_id", orgId).gte("start_time", weekStart.toISOString())
      .lt("start_time", weekEnd.toISOString()).neq("status", "cancelled"),
    supabase.from("client_risk")
      .select("client_id, tier, score, reasons, clients(full_name)")
      .eq("org_id", orgId).in("tier", ["amber", "red"])
      .order("score", { ascending: false }).limit(5),
    // Recent bookings for trend charts + status breakdown
    supabase.from("bookings")
      .select("id, start_time, status, session_type, purchase_id")
      .eq("org_id", orgId)
      .gte("start_time", eightWeeksAgo.toISOString())
      .order("start_time"),
    // Last 6 months purchases for revenue + package charts
    supabase.from("client_purchases")
      .select("id, offer_id, client_id, amount_paid_cents, sessions_total, purchased_at, offers(name, offer_type)")
      .eq("org_id", orgId).eq("payment_status", "succeeded")
      .gte("purchased_at", sixMonthsAgo.toISOString()),
    // All-time purchases for demographic revenue split + outstanding sessions
    supabase.from("client_purchases")
      .select("id, client_id, amount_paid_cents, sessions_total, sessions_used, payment_status, expires_at")
      .eq("org_id", orgId).eq("payment_status", "succeeded"),
    // Clients for demographics
    supabase.from("clients")
      .select("id, gender, date_of_birth, experience_level, status")
      .eq("org_id", orgId),
    supabase.from("session_types")
      .select("id, slug, name, color").eq("org_id", orgId),
  ]);

  const recentBookings: any[] = recentBookingsRes.data || [];
  const purchases: any[] = purchasesRes.data || [];
  const allPurchases: any[] = allPurchasesRes.data || [];
  const clients: any[] = clientsRes.data || [];

  // ── Build a map: purchase_id → per-session value (cents) ─────────────────
  const purchaseValueMap = new Map<string, number>();
  for (const p of allPurchases) {
    if (p.sessions_total > 0) {
      purchaseValueMap.set(p.id, Math.round(p.amount_paid_cents / p.sessions_total));
    }
  }

  // ── Weekly sessions chart data (8 weeks including current) ───────────────
  const weeklySessionData: WeeklySessionRow[] = [];
  for (let i = 7; i >= 0; i--) {
    const wStart = new Date(weekStart.getTime() - i * 7 * 86400000);
    const wEnd = new Date(wStart.getTime() + 7 * 86400000);
    const inWeek = recentBookings.filter(
      (b) => new Date(b.start_time) >= wStart && new Date(b.start_time) < wEnd
    );
    const completed = inWeek.filter((b) => b.status === "completed");
    weeklySessionData.push({
      week: weekLabel(wStart, tz),
      completed: completed.length,
      confirmed: inWeek.filter((b) => b.status === "confirmed").length,
      cancelled: inWeek.filter((b) => b.status === "cancelled").length,
      no_show: inWeek.filter((b) => b.status === "no_show").length,
      value_delivered: completed.reduce((sum, b) => {
        const sessionValueCents = b.purchase_id ? (purchaseValueMap.get(b.purchase_id) ?? 0) : 0;
        return sum + sessionValueCents / 100;
      }, 0),
    });
  }

  // ── Monthly revenue + sessions sold ──────────────────────────────────────
  const monthlyData: MonthlyRow[] = [];
  for (let i = 5; i >= 0; i--) {
    const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const inMonth = purchases.filter((p) => {
      const d = new Date(p.purchased_at);
      return d >= mStart && d < mEnd;
    });
    monthlyData.push({
      month: mStart.toLocaleDateString("en-AU", { month: "short", year: "2-digit" }),
      revenue: inMonth.reduce((s, p) => s + (p.amount_paid_cents || 0), 0) / 100,
      sessions_sold: inMonth.reduce((s, p) => s + (p.sessions_total || 0), 0),
    });
  }

  // ── Package popularity ────────────────────────────────────────────────────
  const pkgMap = new Map<string, PackageStat>();
  for (const p of purchases) {
    const name = (p.offers as any)?.name ?? "Unknown";
    const entry = pkgMap.get(name) ?? { name, count: 0, revenue: 0 };
    entry.count++;
    entry.revenue += (p.amount_paid_cents || 0) / 100;
    pkgMap.set(name, entry);
  }
  const packageStats: PackageStat[] = [...pkgMap.values()].sort((a, b) => b.count - a.count);

  // ── Session status breakdown (last 8 weeks) ───────────────────────────────
  const statusCounts = { completed: 0, confirmed: 0, cancelled: 0, no_show: 0 };
  for (const b of recentBookings) {
    if (b.status in statusCounts) statusCounts[b.status as keyof typeof statusCounts]++;
  }
  const sessionStatusBreakdown: NameValue[] = Object.entries(statusCounts)
    .map(([name, value]) => ({ name, value }))
    .filter((s) => s.value > 0);

  // ── Client demographics ───────────────────────────────────────────────────
  const genderCounts: Record<string, number> = {};
  const ageCounts: Record<string, number> = {};
  const expCounts: Record<string, number> = {};
  const AGE_ORDER = ["18–24", "25–34", "35–44", "45–54", "55+", "Unknown"];
  const EXP_ORDER = ["beginner", "intermediate", "advanced"];

  for (const c of clients) {
    const g = c.gender ?? "unknown";
    genderCounts[g] = (genderCounts[g] || 0) + 1;

    const ag = ageGroup(c.date_of_birth);
    ageCounts[ag] = (ageCounts[ag] || 0) + 1;

    if (c.experience_level) {
      expCounts[c.experience_level] = (expCounts[c.experience_level] || 0) + 1;
    }
  }

  const genderData: NameValue[] = Object.entries(genderCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const ageData: NameValue[] = AGE_ORDER
    .map((name) => ({ name, value: ageCounts[name] || 0 }))
    .filter((a) => a.value > 0);

  const experienceData: NameValue[] = EXP_ORDER
    .map((name) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value: expCounts[name] || 0 }))
    .filter((e) => e.value > 0);

  // ── Revenue by demographics (using all-time purchases) ───────────────────
  const clientMap = new Map(clients.map((c: any) => [c.id, c]));

  const revByGender: Record<string, { revenue: number; clients: Set<string> }> = {};
  const revByAge: Record<string, { revenue: number; clients: Set<string> }> = {};

  for (const p of allPurchases) {
    const client = clientMap.get(p.client_id) as any;
    const gKey = client?.gender ?? "unknown";
    const aKey = ageGroup(client?.date_of_birth ?? null);
    const rev = (p.amount_paid_cents || 0) / 100;

    if (!revByGender[gKey]) revByGender[gKey] = { revenue: 0, clients: new Set() };
    revByGender[gKey].revenue += rev;
    revByGender[gKey].clients.add(p.client_id);

    if (!revByAge[aKey]) revByAge[aKey] = { revenue: 0, clients: new Set() };
    revByAge[aKey].revenue += rev;
    revByAge[aKey].clients.add(p.client_id);
  }

  const revenueByGender: RevenueByDemo[] = Object.entries(revByGender)
    .map(([name, d]) => ({ name, revenue: Math.round(d.revenue), clients: d.clients.size }))
    .sort((a, b) => b.revenue - a.revenue);

  const revenueByAge: RevenueByDemo[] = AGE_ORDER
    .map((name) => ({
      name,
      revenue: Math.round(revByAge[name]?.revenue || 0),
      clients: revByAge[name]?.clients.size || 0,
    }))
    .filter((r) => r.revenue > 0);

  // ── KPI calculations ──────────────────────────────────────────────────────
  const activeSubscriptions = subscriptionsRes.data?.filter((s) => s.status === "active") || [];
  const pastDueSubscriptions = subscriptionsRes.data?.filter((s) => s.status === "past_due") || [];
  const mrr = activeSubscriptions.reduce((s, sub) => s + (sub.price_cents || 0), 0);
  const avgRevenue = activeSubscriptions.length > 0 ? mrr / activeSubscriptions.length : 0;

  const revenueThisMonth = purchases
    .filter((p) => new Date(p.purchased_at) >= thisMonthStart)
    .reduce((s, p) => s + (p.amount_paid_cents || 0), 0);

  const revenueLastMonth = purchases
    .filter((p) => {
      const d = new Date(p.purchased_at);
      return d >= lastMonthStart && d < lastMonthEnd;
    })
    .reduce((s, p) => s + (p.amount_paid_cents || 0), 0);

  const momChange = revenueLastMonth > 0
    ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100)
    : null;

  const last30Bookings = recentBookings.filter(
    (b) => new Date(b.start_time) >= thirtyDaysAgo
  );
  const completedLast30 = last30Bookings.filter((b) => b.status === "completed").length;
  const cancelledLast30 = last30Bookings.filter((b) => b.status === "cancelled").length;
  const totalLast30 = completedLast30 + cancelledLast30 + last30Bookings.filter((b) => b.status === "no_show").length;
  const cancellationRate = totalLast30 > 0 ? Math.round((cancelledLast30 / totalLast30) * 100) : 0;
  const completionRate = totalLast30 > 0 ? Math.round((completedLast30 / totalLast30) * 100) : 0;

  const sessionsThisMonth = recentBookings.filter(
    (b) => new Date(b.start_time) >= thisMonthStart && b.status !== "cancelled"
  ).length;

  // Outstanding sessions (sold but not delivered, not expired)
  const outstandingSessions = allPurchases.reduce((sum, p) => {
    const notExpired = !p.expires_at || new Date(p.expires_at) > now;
    if (!notExpired) return sum;
    return sum + Math.max(0, (p.sessions_total || 0) - (p.sessions_used || 0));
  }, 0);

  const avgRevenuePerClient =
    (activeClientsRes.count || 0) > 0
      ? Math.round(
          allPurchases.reduce((s, p) => s + (p.amount_paid_cents || 0), 0) /
          (activeClientsRes.count || 1) / 100
        )
      : 0;

  // Upcoming display list
  const { data: upcomingBookings } = await supabase
    .from("bookings")
    .select("*, clients(full_name)")
    .eq("org_id", orgId)
    .gte("start_time", now.toISOString())
    .neq("status", "cancelled")
    .order("start_time")
    .limit(8);

  const formatTime = (s: string) =>
    new Date(s).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz });

  const formatDate = (s: string) => {
    const d = new Date(s);
    const today = todayStart.toLocaleDateString("en-CA", { timeZone: tz });
    const tomorrow = todayEnd.toLocaleDateString("en-CA", { timeZone: tz });
    const booking = d.toLocaleDateString("en-CA", { timeZone: tz });
    if (booking === today) return "Today";
    if (booking === tomorrow) return "Tomorrow";
    return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", timeZone: tz });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{orgName || "Dashboard"}</h1>
        <div className="flex gap-2">
          <Link href="/calendar" className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium">
            + Booking
          </Link>
          <Link href="/clients/new" className="inline-flex items-center px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 text-xs font-medium">
            + Client
          </Link>
        </div>
      </div>

      {/* ── Top KPI Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Revenue this month */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Revenue This Month</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{aud(revenueThisMonth)}</p>
          {momChange !== null && (
            <p className={clsx("text-xs mt-1 font-medium", momChange >= 0 ? "text-green-600" : "text-red-500")}>
              {momChange >= 0 ? "▲" : "▼"} {Math.abs(momChange)}% vs last month
            </p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">Last month: {aud(revenueLastMonth)}</p>
        </div>

        {/* Sessions this month */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Sessions This Month</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{sessionsThisMonth}</p>
          <p className="text-xs text-gray-400 mt-1">{sessionsWeekRes.count || 0} this week · {sessionsTodayRes.count || 0} today</p>
        </div>

        {/* Completion rate */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Completion Rate (30d)</p>
          <p className={clsx("text-2xl font-bold mt-1", completionRate >= 80 ? "text-green-600" : completionRate >= 60 ? "text-amber-500" : "text-red-500")}>
            {completionRate}%
          </p>
          <p className="text-xs text-gray-400 mt-1">{completedLast30} completed of {totalLast30} booked</p>
        </div>

        {/* Cancellation rate */}
        <div className={clsx("rounded-lg border p-4", cancelledLast30 > 0 ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800" : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700")}>
          <p className="text-xs text-gray-500 dark:text-gray-400">Cancellation Rate (30d)</p>
          <p className={clsx("text-2xl font-bold mt-1", cancelledLast30 > 0 ? "text-red-600" : "text-green-600")}>
            {cancellationRate}%
          </p>
          <p className="text-xs text-gray-400 mt-1">{cancelledLast30} cancellations</p>
        </div>
      </div>

      {/* ── Secondary KPI Strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">Active Clients</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{activeClientsRes.count || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">Avg LTV / Client</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">${avgRevenuePerClient}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">Outstanding Sessions</p>
          <p className="text-lg font-semibold text-blue-600">{outstandingSessions}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">MRR</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{aud(mrr)}</p>
        </div>
        <div className={clsx("rounded-lg border p-3 text-center",
          pastDueSubscriptions.length > 0 ? "bg-red-50 dark:bg-red-950 border-red-200" : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
        )}>
          <p className="text-xs text-gray-500 dark:text-gray-400">Past Due</p>
          <p className={clsx("text-lg font-semibold", pastDueSubscriptions.length > 0 ? "text-red-600" : "text-gray-900 dark:text-gray-100")}>
            {pastDueSubscriptions.length}
          </p>
        </div>
        <div className={clsx("rounded-lg border p-3 text-center",
          (riskRes.data?.length || 0) > 0 ? "bg-amber-50 dark:bg-amber-950 border-amber-200" : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
        )}>
          <p className="text-xs text-gray-500 dark:text-gray-400">At Risk</p>
          <p className={clsx("text-lg font-semibold", (riskRes.data?.length || 0) > 0 ? "text-amber-600" : "text-gray-900 dark:text-gray-100")}>
            {riskRes.data?.length || 0}
          </p>
        </div>
      </div>

      {/* ── Charts ── */}
      <Charts
        weeklySessionData={weeklySessionData}
        monthlyData={monthlyData}
        packageStats={packageStats}
        sessionStatusBreakdown={sessionStatusBreakdown}
        genderData={genderData}
        ageData={ageData}
        experienceData={experienceData}
        revenueByGender={revenueByGender}
        revenueByAge={revenueByAge}
      />

      {/* ── Bottom: Upcoming sessions + At-Risk + Revenue summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Upcoming sessions */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Upcoming Sessions</h2>
            <Link href="/calendar" className="text-xs text-blue-600 hover:text-blue-700">View calendar →</Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {(upcomingBookings || []).length > 0 ? (
              upcomingBookings!.map((b: any) => (
                <div key={b.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-medium text-blue-600 dark:text-blue-400">
                      {b.clients?.full_name?.charAt(0) || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{b.clients?.full_name || "Client"}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{b.session_type?.replace("_", " ") || "Session"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatTime(b.start_time)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(b.start_time)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">No upcoming sessions</div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Needs attention */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Needs Attention</h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {(riskRes.data || []).length > 0 ? (
                riskRes.data!.map((r: any) => (
                  <Link key={r.client_id} href={`/clients/${r.client_id}`}
                    className="block px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{r.clients?.full_name || "Unknown"}</p>
                      <span className={clsx("px-1.5 py-0.5 rounded text-xs font-medium",
                        r.tier === "red" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                      )}>{r.tier}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{r.reasons?.[0] || "At risk"}</p>
                  </Link>
                ))
              ) : (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-green-600 font-medium">All clients healthy</p>
                </div>
              )}
            </div>
          </div>

          {/* Revenue summary */}
          <div className="bg-gray-900 rounded-lg p-4 text-white">
            <h3 className="text-xs font-medium text-gray-400 mb-3">Revenue Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">This Month</span>
                <span className="text-sm font-medium">{aud(revenueThisMonth)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">MRR (Subscriptions)</span>
                <span className="text-sm font-medium">{aud(mrr)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">Avg LTV / Client</span>
                <span className="text-sm font-medium">${avgRevenuePerClient}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">Outstanding Sessions</span>
                <span className="text-sm font-medium text-blue-400">{outstandingSessions} sessions owed</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-700">
                <span className="text-xs text-gray-400">Revenue at Risk</span>
                <span className={clsx("text-sm font-medium", pastDueSubscriptions.length * avgRevenue > 0 ? "text-red-400" : "text-green-400")}>
                  {aud(pastDueSubscriptions.length * avgRevenue)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
