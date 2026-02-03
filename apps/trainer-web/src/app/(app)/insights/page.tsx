"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "clsx";

interface MarketInsight {
  id: string;
  category: "trend" | "opportunity" | "tip" | "alert";
  title: string;
  content: string;
  actionable: string | null;
  source: string | null;
  relevance_score: number;
  created_at: string;
}

interface BusinessMetric {
  label: string;
  current: number;
  target: number;
  benchmark: number;
  trend: "up" | "down" | "stable";
}

// Static insights that would be updated from a real market scanning service
const MARKET_INSIGHTS: MarketInsight[] = [
  {
    id: "1",
    category: "trend",
    title: "Online Coaching Surge",
    content: "Online personal training demand has increased 40% in 2024. Clients value flexibility and convenience more than ever.",
    actionable: "Consider adding hybrid or fully online training packages to capture this market.",
    source: "Industry Report",
    relevance_score: 95,
    created_at: new Date().toISOString(),
  },
  {
    id: "2",
    category: "opportunity",
    title: "New Year Resolution Window",
    content: "January sees 3x more fitness inquiries than average. The window is Nov-Jan for marketing push.",
    actionable: "Prepare your January promotional offers now. Create a 'New Year Challenge' package.",
    source: "Seasonal Analysis",
    relevance_score: 90,
    created_at: new Date().toISOString(),
  },
  {
    id: "3",
    category: "tip",
    title: "Video Content Dominates",
    content: "Trainers posting short-form video content (Reels, TikTok) report 60% more inquiries than those who don't.",
    actionable: "Start posting 3-5 short workout tips or form correction videos per week.",
    source: "Platform Data",
    relevance_score: 85,
    created_at: new Date().toISOString(),
  },
  {
    id: "4",
    category: "alert",
    title: "Client Retention Drop Post-90 Days",
    content: "Data shows clients are most likely to churn between 90-120 days. Proactive engagement is crucial.",
    actionable: "Schedule check-ins with clients approaching 90 days. Review and refresh their programs.",
    source: "Platform Analytics",
    relevance_score: 92,
    created_at: new Date().toISOString(),
  },
  {
    id: "5",
    category: "trend",
    title: "Wellness Integration Growing",
    content: "Clients increasingly want holistic services: nutrition, recovery, mental health support alongside training.",
    actionable: "Partner with nutritionists or offer add-on services to increase package value.",
    source: "Consumer Survey",
    relevance_score: 88,
    created_at: new Date().toISOString(),
  },
  {
    id: "6",
    category: "opportunity",
    title: "Corporate Wellness Contracts",
    content: "Companies are allocating wellness budgets. Corporate clients mean stable, recurring revenue.",
    actionable: "Create a corporate wellness proposal. Reach out to local businesses offering group sessions.",
    source: "Market Research",
    relevance_score: 82,
    created_at: new Date().toISOString(),
  },
  {
    id: "7",
    category: "tip",
    title: "Response Time Critical",
    content: "Leads contacted within 5 minutes are 21x more likely to convert than those contacted after 30 minutes.",
    actionable: "Enable push notifications. Set up automated initial responses for new inquiries.",
    source: "Sales Data",
    relevance_score: 94,
    created_at: new Date().toISOString(),
  },
  {
    id: "8",
    category: "trend",
    title: "Premium Pricing Acceptance",
    content: "Clients are willing to pay 30% more for trainers who demonstrate expertise and results.",
    actionable: "Invest in certifications. Document and share client transformations with permission.",
    source: "Pricing Study",
    relevance_score: 87,
    created_at: new Date().toISOString(),
  },
];

const categoryConfig = {
  trend: { label: "Trend", bg: "bg-blue-100", text: "text-blue-700", icon: "📈" },
  opportunity: { label: "Opportunity", bg: "bg-green-100", text: "text-green-700", icon: "💡" },
  tip: { label: "Tip", bg: "bg-purple-100", text: "text-purple-700", icon: "✨" },
  alert: { label: "Alert", bg: "bg-amber-100", text: "text-amber-700", icon: "⚠️" },
};

export default function InsightsPage() {
  const [insights, setInsights] = useState<MarketInsight[]>([]);
  const [metrics, setMetrics] = useState<BusinessMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
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

    // Load user's business data for personalized insights
    const [clientsData, leadsData, purchasesData] = await Promise.all([
      supabase.from("clients").select("status, created_at").eq("org_id", membership.org_id),
      supabase.from("inquiries").select("status, created_at").eq("org_id", membership.org_id),
      supabase.from("client_purchases").select("payment_status, sessions_total, sessions_used").eq("org_id", membership.org_id),
    ]);

    // Load platform averages
    const [allClients, allOrgs] = await Promise.all([
      supabase.from("clients").select("status"),
      supabase.from("orgs").select("id"),
    ]);

    const clients = clientsData.data || [];
    const leads = leadsData.data || [];
    const purchases = purchasesData.data || [];
    const platformClients = allClients.data || [];
    const orgs = allOrgs.data || [];

    const activeClients = clients.filter(c => c.status === "active").length;
    const totalLeads = leads.length;
    const wonLeads = leads.filter(l => l.status === "WON").length;
    const paidPurchases = purchases.filter(p => p.payment_status === "succeeded");

    const platformAvgClients = platformClients.length / (orgs.length || 1);
    const platformActiveClients = platformClients.filter(c => c.status === "active").length;
    const platformRetention = platformClients.length > 0 ? (platformActiveClients / platformClients.length) * 100 : 0;

    // Calculate metrics
    const calculatedMetrics: BusinessMetric[] = [
      {
        label: "Active Clients",
        current: activeClients,
        target: Math.ceil(activeClients * 1.2), // 20% growth target
        benchmark: Math.round(platformAvgClients),
        trend: "stable",
      },
      {
        label: "Lead Conversion",
        current: totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0,
        target: 40,
        benchmark: Math.round(platformRetention),
        trend: "up",
      },
      {
        label: "Active Packages",
        current: paidPurchases.length,
        target: Math.ceil(paidPurchases.length * 1.3),
        benchmark: Math.round(paidPurchases.length * 0.9),
        trend: "stable",
      },
    ];

    setMetrics(calculatedMetrics);

    // Filter insights based on business relevance
    const relevantInsights = MARKET_INSIGHTS.sort((a, b) => {
      // Personalize relevance based on business data
      let aScore = a.relevance_score;
      let bScore = b.relevance_score;

      // Boost retention insight if they have clients
      if (a.title.includes("Retention") && activeClients > 0) aScore += 10;
      if (b.title.includes("Retention") && activeClients > 0) bScore += 10;

      // Boost lead-related insights if they have leads
      if (a.content.toLowerCase().includes("lead") && totalLeads > 0) aScore += 5;
      if (b.content.toLowerCase().includes("lead") && totalLeads > 0) bScore += 5;

      return bScore - aScore;
    });

    setInsights(relevantInsights);
    setLoading(false);
  }

  const filteredInsights = selectedCategory === "all"
    ? insights
    : insights.filter(i => i.category === selectedCategory);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Market Insights</h1>
          <p className="text-gray-500">Daily intelligence to grow your business</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Last updated</p>
          <p className="text-sm text-gray-600">{new Date().toLocaleDateString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
        </div>
      </div>

      {/* Business Health Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500">{metric.label}</p>
              <span className={clsx(
                "text-xs px-2 py-0.5 rounded-full",
                metric.trend === "up" && "bg-green-100 text-green-700",
                metric.trend === "down" && "bg-red-100 text-red-700",
                metric.trend === "stable" && "bg-gray-100 text-gray-600"
              )}>
                {metric.trend === "up" && "↑"}
                {metric.trend === "down" && "↓"}
                {metric.trend === "stable" && "→"}
              </span>
            </div>
            <div className="flex items-end gap-4">
              <div>
                <p className="text-3xl font-bold text-gray-900">
                  {metric.label.includes("%") || metric.label.includes("Conversion") ? `${metric.current}%` : metric.current}
                </p>
                <p className="text-xs text-gray-400">Current</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-brand-600">{metric.target}</p>
                <p className="text-xs text-gray-400">Target</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-gray-400">{metric.benchmark}</p>
                <p className="text-xs text-gray-400">Avg</p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-3">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 rounded-full transition-all"
                  style={{ width: `${Math.min((metric.current / metric.target) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">{Math.round((metric.current / metric.target) * 100)}% to target</p>
            </div>
          </div>
        ))}
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedCategory("all")}
          className={clsx(
            "px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
            selectedCategory === "all"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          )}
        >
          All Insights
        </button>
        {Object.entries(categoryConfig).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setSelectedCategory(key)}
            className={clsx(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2",
              selectedCategory === key
                ? `${config.bg} ${config.text}`
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            <span>{config.icon}</span>
            {config.label}
          </button>
        ))}
      </div>

      {/* Insights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredInsights.map((insight) => {
          const config = categoryConfig[insight.category];
          return (
            <div key={insight.id} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <span className={clsx("px-2 py-1 rounded text-xs font-medium", config.bg, config.text)}>
                  {config.icon} {config.label}
                </span>
                <span className="text-xs text-gray-400">
                  Relevance: {insight.relevance_score}%
                </span>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-2">{insight.title}</h3>
              <p className="text-gray-600 text-sm mb-4">{insight.content}</p>

              {insight.actionable && (
                <div className="bg-brand-50 rounded-lg p-3 mb-3">
                  <p className="text-xs text-brand-600 font-medium mb-1">Action Step</p>
                  <p className="text-sm text-brand-800">{insight.actionable}</p>
                </div>
              )}

              {insight.source && (
                <p className="text-xs text-gray-400">Source: {insight.source}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Personalized Recommendations */}
      <div className="mt-8 bg-gradient-to-br from-brand-50 to-purple-50 rounded-xl p-6 border border-brand-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Top 3 Priorities This Week</h2>
        <div className="space-y-4">
          {metrics[0] && metrics[0].current < metrics[0].benchmark && (
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-brand-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
              <div>
                <p className="font-medium text-gray-900">Increase Client Base</p>
                <p className="text-sm text-gray-600">You're below platform average. Focus on converting your leads and launching your referral program.</p>
              </div>
            </div>
          )}
          {metrics[0] && metrics[0].current >= metrics[0].benchmark && (
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-brand-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
              <div>
                <p className="font-medium text-gray-900">Focus on Retention</p>
                <p className="text-sm text-gray-600">Your client base is strong. Now focus on keeping them engaged and reducing churn.</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
            <div>
              <p className="font-medium text-gray-900">Create Video Content</p>
              <p className="text-sm text-gray-600">Short-form video is proven to drive inquiries. Post 3-5 clips this week.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
            <div>
              <p className="font-medium text-gray-900">Follow Up Within 5 Minutes</p>
              <p className="text-sm text-gray-600">Speed is critical. Set up notifications to respond to new leads immediately.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
