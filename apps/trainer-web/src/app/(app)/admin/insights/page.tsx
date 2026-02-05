"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "clsx";
import { INSIGHT_CATEGORIES } from "@/lib/insight-scanner";

interface ScannedInsight {
  id: string;
  source: string;
  source_url: string;
  raw_content: string;
  extracted_insight: string;
  deep_analysis: string;
  category: string;
  sub_category: string;
  actionable_takeaway: string;
  confidence_score: number;
  novelty_score: number;
  evidence_type: string;
  upvotes: number;
  comments: number;
  scanned_at: string;
  approved: boolean;
}

interface ScanStats {
  total: number;
  approved: number;
  pending: number;
  avgConfidence: number;
  byCategory: Record<string, number>;
}

export default function AdminInsightsPage() {
  const [insights, setInsights] = useState<ScannedInsight[]>([]);
  const [stats, setStats] = useState<ScanStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<ScannedInsight | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("pending");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [filter, categoryFilter]);

  async function loadData() {
    setLoading(true);

    // Load stats
    const statsResponse = await fetch("/api/insights/scan");
    if (statsResponse.ok) {
      const data = await statsResponse.json();
      setStats(data.stats);
    }

    // Load insights with filters
    let query = supabase
      .from("scanned_insights")
      .select("*")
      .order("scanned_at", { ascending: false });

    if (filter === "pending") {
      query = query.eq("approved", false);
    } else if (filter === "approved") {
      query = query.eq("approved", true);
    }

    if (categoryFilter !== "all") {
      query = query.eq("category", categoryFilter);
    }

    const { data } = await query.limit(50);
    setInsights(data || []);
    setLoading(false);
  }

  async function runScan() {
    setScanning(true);
    try {
      const response = await fetch("/api/insights/scan", {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Scan complete!\n\nScanned: ${data.scanned}\nExtracted: ${data.extracted}\nSkipped: ${data.skipped}`);
        loadData();
      } else {
        const error = await response.json();
        alert(`Scan failed: ${error.error}`);
      }
    } catch (error) {
      alert("Scan failed");
    }
    setScanning(false);
  }

  async function approveInsight(id: string) {
    await supabase
      .from("scanned_insights")
      .update({ approved: true })
      .eq("id", id);

    setInsights((prev) =>
      prev.map((i) => (i.id === id ? { ...i, approved: true } : i))
    );
    if (selectedInsight?.id === id) {
      setSelectedInsight({ ...selectedInsight, approved: true });
    }
  }

  async function rejectInsight(id: string) {
    await supabase.from("scanned_insights").delete().eq("id", id);
    setInsights((prev) => prev.filter((i) => i.id !== id));
    if (selectedInsight?.id === id) {
      setSelectedInsight(null);
    }
  }

  async function editInsight(id: string, updates: Partial<ScannedInsight>) {
    await supabase.from("scanned_insights").update(updates).eq("id", id);
    setInsights((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...updates } : i))
    );
    if (selectedInsight?.id === id) {
      setSelectedInsight({ ...selectedInsight, ...updates });
    }
  }

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Insight Repository</h1>
          <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Manage AI-scanned business insights for PT coaching</p>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          className="btn-primary"
        >
          {scanning ? "Scanning..." : "Run Scan Now"}
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Total Insights</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Approved</p>
            <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Pending Review</p>
            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Avg Confidence</p>
            <p className="text-2xl font-bold text-brand-600">{stats.avgConfidence}%</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Categories</p>
            <p className="text-2xl font-bold text-purple-600">{Object.keys(stats.byCategory).length}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex gap-2">
          {(["all", "pending", "approved"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                filter === f
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="input py-2"
        >
          <option value="all">All Categories</option>
          {Object.entries(INSIGHT_CATEGORIES).map(([key, cat]) => (
            <option key={key} value={key}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Insights List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 dark:text-gray-500">Loading...</div>
          ) : insights.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 dark:text-gray-500">
              No insights found. Run a scan to populate the repository.
            </div>
          ) : (
            insights.map((insight) => (
              <div
                key={insight.id}
                onClick={() => setSelectedInsight(insight)}
                className={clsx(
                  "bg-white dark:bg-gray-900 rounded-xl border p-4 cursor-pointer transition-all",
                  selectedInsight?.id === insight.id
                    ? "border-brand-500 ring-2 ring-brand-100"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <span
                    className={clsx(
                      "px-2 py-0.5 rounded text-xs font-medium",
                      insight.approved
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    )}
                  >
                    {insight.approved ? "Approved" : "Pending"}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {formatDate(insight.scanned_at)}
                  </span>
                </div>

                <p className="font-medium text-gray-900 dark:text-gray-100 mb-2 line-clamp-2">
                  {insight.extracted_insight}
                </p>

                <div className="flex flex-wrap gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-brand-100 text-brand-700 rounded text-xs">
                    {INSIGHT_CATEGORIES[insight.category as keyof typeof INSIGHT_CATEGORIES]?.label || insight.category}
                  </span>
                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 dark:text-gray-500 rounded text-xs">
                    {insight.sub_category}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  <span>Confidence: {insight.confidence_score}%</span>
                  <span>Novelty: {insight.novelty_score}%</span>
                  <span>{insight.source}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail Panel */}
        {selectedInsight && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 sticky top-4 max-h-[calc(100vh-8rem)] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span
                  className={clsx(
                    "px-2 py-0.5 rounded text-xs font-medium",
                    selectedInsight.approved
                      ? "bg-green-100 text-green-700"
                      : "bg-amber-100 text-amber-700"
                  )}
                >
                  {selectedInsight.approved ? "Approved" : "Pending Review"}
                </span>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {formatDate(selectedInsight.scanned_at)}
                </p>
              </div>
              <div className="flex gap-2">
                {!selectedInsight.approved && (
                  <button
                    onClick={() => approveInsight(selectedInsight.id)}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                  >
                    Approve
                  </button>
                )}
                <button
                  onClick={() => rejectInsight(selectedInsight.id)}
                  className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200"
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Extracted Insight
                </label>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">
                  {selectedInsight.extracted_insight}
                </p>
              </div>

              <div className="flex gap-4">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Category
                  </label>
                  <p className="text-gray-900 dark:text-gray-100 mt-1">
                    {INSIGHT_CATEGORIES[selectedInsight.category as keyof typeof INSIGHT_CATEGORIES]?.label}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Sub-Category
                  </label>
                  <p className="text-gray-900 dark:text-gray-100 mt-1">{selectedInsight.sub_category}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Evidence
                  </label>
                  <p className="text-gray-900 dark:text-gray-100 mt-1 capitalize">{selectedInsight.evidence_type.replace("_", " ")}</p>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Deep Analysis
                </label>
                <p className="text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap">
                  {selectedInsight.deep_analysis}
                </p>
              </div>

              <div className="bg-brand-50 rounded-lg p-4">
                <label className="text-xs text-brand-600 uppercase tracking-wider font-medium">
                  Actionable Takeaway
                </label>
                <p className="text-brand-900 mt-1">
                  {selectedInsight.actionable_takeaway}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Confidence Score
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full"
                        style={{ width: `${selectedInsight.confidence_score}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{selectedInsight.confidence_score}%</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Novelty Score
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${selectedInsight.novelty_score}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{selectedInsight.novelty_score}%</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Source
                </label>
                <a
                  href={selectedInsight.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 hover:underline mt-1 block"
                >
                  {selectedInsight.source} ({selectedInsight.upvotes} upvotes, {selectedInsight.comments} comments)
                </a>
              </div>

              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Raw Content
                </label>
                <div className="mt-1 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 max-h-40 overflow-y-auto">
                  <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 whitespace-pre-wrap">
                    {selectedInsight.raw_content}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
