"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "clsx";
import FeedbackInbox from "./FeedbackInbox";

interface Client {
  id: string;
  full_name: string | null;
}

interface MealPlan {
  id: string;
  name: string;
  status: "draft" | "published";
  version: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  client: Client | null;
}

interface FormState {
  client_id: string;
  name: string;
  start_date: string;
  end_date: string;
}

function clientDisplayName(client: Client | null): string {
  if (!client) return "Unassigned";
  return client.full_name || "Unknown";
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "No dates";
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  return `Until ${fmt(end!)}`;
}

export default function NutritionClient() {
  const router = useRouter();
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    client_id: "",
    name: "",
    start_date: "",
    end_date: "",
  });
  const [activeTab, setActiveTab] = useState<"plans" | "feedback">("plans");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [pendingFeedbackCount, setPendingFeedbackCount] = useState(0);

  // Edit state
  const [editingPlan, setEditingPlan] = useState<MealPlan | null>(null);
  const [editForm, setEditForm] = useState<FormState>({ client_id: "", name: "", start_date: "", end_date: "" });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from("org_members")
        .select("org_id")
        .eq("user_id", user.id)
        .single();

      if (membership?.org_id) {
        setOrgId(membership.org_id);

        const { data: clientsData } = await supabase
          .from("clients")
          .select("id, full_name")
          .eq("org_id", membership.org_id)
          .eq("status", "active")
          .order("full_name");
        setClients(clientsData ?? []);

        // Fetch pending feedback count for this org's plans
        const { data: orgPlans } = await supabase
          .from("meal_plans")
          .select("id")
          .eq("org_id", membership.org_id);
        const planIds = (orgPlans ?? []).map((p: any) => p.id);
        if (planIds.length > 0) {
          const { count } = await supabase
            .from("meal_plan_feedback")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending")
            .in("plan_id", planIds);
          setPendingFeedbackCount(count ?? 0);
        }
      }

      const params = new URLSearchParams();
      if (selectedClientId) {
        params.set("client_id", selectedClientId);
      }
      const res = await fetch(`/api/nutrition/plans?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans ?? []);
      }
    } catch (err) {
      console.error("Failed to load nutrition data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedClientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreatePlan(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/nutrition/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/nutrition/${data.plan.id}`);
      } else {
        const err = await res.json();
        setError(err.error || "Failed to create plan");
      }
    } catch {
      setError("Failed to create plan");
    } finally {
      setCreating(false);
    }
  }

  function openEdit(plan: MealPlan) {
    setEditingPlan(plan);
    setEditForm({
      client_id: plan.client?.id ?? "",
      name: plan.name,
      start_date: plan.start_date ?? "",
      end_date: plan.end_date ?? "",
    });
    setEditError(null);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPlan) return;
    setSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/nutrition/plans/${editingPlan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          client_id: editForm.client_id || null,
          start_date: editForm.start_date || null,
          end_date: editForm.end_date || null,
        }),
      });
      if (res.ok) {
        // Reload to get fresh client join
        await loadData();
        setEditingPlan(null);
      } else {
        const err = await res.json();
        setEditError(err.error || "Failed to save");
      }
    } catch {
      setEditError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(planId: string) {
    if (!confirm("Delete this plan? This cannot be undone.")) return;
    setDeletingId(planId);
    try {
      const res = await fetch(`/api/nutrition/plans/${planId}`, { method: "DELETE" });
      if (res.ok) {
        setPlans((prev) => prev.filter((p) => p.id !== planId));
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete plan");
      }
    } catch {
      alert("Failed to delete plan");
    } finally {
      setDeletingId(null);
    }
  }

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:text-gray-100";

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Nutrition Plans
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Create and manage meal plans for your clients
        </p>
      </div>

      {/* Feedback inbox */}
      {activeTab === "feedback" && orgId && (
        <div className="mb-6">
          <button
            onClick={() => setActiveTab("plans")}
            className="mb-4 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1"
          >
            ← Back to plans
          </button>
          <FeedbackInbox orgId={orgId} />
        </div>
      )}

      {/* Plans view */}
      {activeTab === "plans" && (
        <>
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4 gap-4">
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:text-gray-100 max-w-xs"
            >
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {clientDisplayName(c)}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveTab("feedback")}
                className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex items-center gap-1.5"
              >
                Client feedback
                {pendingFeedbackCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-medium bg-red-500 text-white">
                    {pendingFeedbackCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                New Plan
              </button>
            </div>
          </div>

          {/* Plan list */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
              <p className="text-3xl mb-3">🥗</p>
              <p className="text-gray-500 dark:text-gray-400 font-medium">No plans yet.</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Create your first meal plan.</p>
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Plan Name</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Client</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date Range</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Version</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {plans.map((plan) => (
                    <tr key={plan.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <a
                          href={`/nutrition/${plan.id}`}
                          className="font-medium text-gray-900 dark:text-gray-100 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                        >
                          {plan.name}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {clientDisplayName(plan.client)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {formatDateRange(plan.start_date, plan.end_date)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">
                        v{plan.version}
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          plan.status === "published"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                        )}>
                          {plan.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {new Date(plan.created_at).toLocaleDateString("en-AU")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(plan)}
                            className="text-xs text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                            title="Edit"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(plan.id)}
                            disabled={deletingId === plan.id}
                            className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                            title="Delete"
                          >
                            {deletingId === plan.id ? "…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Create plan modal */}
          {showModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md shadow-xl">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">New Meal Plan</h2>
                  <button
                    onClick={() => { setShowModal(false); setError(null); }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreatePlan} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client</label>
                    <select
                      value={form.client_id}
                      onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
                      className={inputClass}
                    >
                      <option value="">No client</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>{clientDisplayName(c)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Plan Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 7-Day Weight Loss Plan"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={form.start_date}
                      onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                    <input
                      type="date"
                      value={form.end_date}
                      onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => { setShowModal(false); setError(null); }}
                      className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creating}
                      className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                    >
                      {creating && <span className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />}
                      Create Plan
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit plan modal */}
          {editingPlan && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md shadow-xl">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Plan</h2>
                  <button
                    onClick={() => setEditingPlan(null)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveEdit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client</label>
                    <select
                      value={editForm.client_id}
                      onChange={(e) => setEditForm((f) => ({ ...f, client_id: e.target.value }))}
                      className={inputClass}
                    >
                      <option value="">No client</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>{clientDisplayName(c)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Plan Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={editForm.start_date}
                      onChange={(e) => setEditForm((f) => ({ ...f, start_date: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                    <input
                      type="date"
                      value={editForm.end_date}
                      onChange={(e) => setEditForm((f) => ({ ...f, end_date: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  {editError && <p className="text-sm text-red-600 dark:text-red-400">{editError}</p>}
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingPlan(null)}
                      className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                    >
                      {saving && <span className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />}
                      Save
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
