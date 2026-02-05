"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "clsx";

interface SessionType {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  duration_mins: number;
  price_cents: number | null;
  color: string;
  is_active: boolean;
  allow_online_booking: boolean;
  buffer_before_mins: number;
  buffer_after_mins: number;
  max_per_day: number | null;
  sort_order: number;
}

const COLORS = [
  // Blues
  { value: "#3B82F6", name: "Blue" },
  { value: "#0EA5E9", name: "Sky" },
  { value: "#6366F1", name: "Indigo" },
  { value: "#2563EB", name: "Royal Blue" },
  // Greens
  { value: "#10B981", name: "Emerald" },
  { value: "#22C55E", name: "Green" },
  { value: "#14B8A6", name: "Teal" },
  { value: "#84CC16", name: "Lime" },
  // Purples
  { value: "#8B5CF6", name: "Purple" },
  { value: "#A855F7", name: "Violet" },
  { value: "#D946EF", name: "Fuchsia" },
  // Warm
  { value: "#F59E0B", name: "Amber" },
  { value: "#F97316", name: "Orange" },
  { value: "#EF4444", name: "Red" },
  { value: "#EC4899", name: "Pink" },
  { value: "#F43F5E", name: "Rose" },
  // Neutrals
  { value: "#78716C", name: "Stone" },
  { value: "#64748B", name: "Slate" },
  { value: "#71717A", name: "Gray" },
  { value: "#000000", name: "Black" },
];

const DURATIONS = [15, 30, 45, 60, 75, 90, 120];

export default function SessionTypesPage() {
  const [sessionTypes, setSessionTypes] = useState<SessionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SessionType | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    duration_mins: 60,
    price_cents: 0,
    color: "#3B82F6",
    is_active: true,
    allow_online_booking: true,
    buffer_before_mins: 0,
    buffer_after_mins: 0,
    max_per_day: null as number | null,
  });

  const supabase = createClient();

  useEffect(() => {
    loadSessionTypes();
  }, []);

  async function loadSessionTypes() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) return;
    setOrgId(membership.org_id);

    const { data } = await supabase
      .from("session_types")
      .select("*")
      .eq("org_id", membership.org_id)
      .order("sort_order");

    if (data) {
      setSessionTypes(data);
    }
    setLoading(false);
  }

  function openCreateModal() {
    setEditing(null);
    setForm({
      name: "",
      slug: "",
      description: "",
      duration_mins: 60,
      price_cents: 0,
      color: "#3B82F6",
      is_active: true,
      allow_online_booking: true,
      buffer_before_mins: 0,
      buffer_after_mins: 0,
      max_per_day: null,
    });
    setShowModal(true);
  }

  function openEditModal(st: SessionType) {
    setEditing(st);
    setForm({
      name: st.name,
      slug: st.slug,
      description: st.description || "",
      duration_mins: st.duration_mins,
      price_cents: st.price_cents || 0,
      color: st.color,
      is_active: st.is_active,
      allow_online_booking: st.allow_online_booking,
      buffer_before_mins: st.buffer_before_mins,
      buffer_after_mins: st.buffer_after_mins,
      max_per_day: st.max_per_day,
    });
    setShowModal(true);
  }

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  }

  async function handleSave() {
    if (!orgId || !form.name) return;
    setSaving(true);
    setError(null);

    const slug = form.slug || generateSlug(form.name);

    let result;
    if (editing) {
      result = await supabase
        .from("session_types")
        .update({
          name: form.name,
          slug,
          description: form.description || null,
          duration_mins: form.duration_mins,
          price_cents: form.price_cents || null,
          color: form.color,
          is_active: form.is_active,
          allow_online_booking: form.allow_online_booking,
          buffer_before_mins: form.buffer_before_mins,
          buffer_after_mins: form.buffer_after_mins,
          max_per_day: form.max_per_day,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editing.id);
    } else {
      result = await supabase.from("session_types").insert({
        org_id: orgId,
        name: form.name,
        slug,
        description: form.description || null,
        duration_mins: form.duration_mins,
        price_cents: form.price_cents || null,
        color: form.color,
        is_active: form.is_active,
        allow_online_booking: form.allow_online_booking,
        buffer_before_mins: form.buffer_before_mins,
        buffer_after_mins: form.buffer_after_mins,
        max_per_day: form.max_per_day,
        sort_order: sessionTypes.length,
      });
    }

    setSaving(false);

    // Check if there's a real error (not just an empty object)
    if (result.error && Object.keys(result.error).length > 0) {
      const errorMsg = result.error.message || result.error.details || result.error.hint || JSON.stringify(result.error);
      setError(errorMsg);
      console.error("Session type error:", JSON.stringify(result.error, null, 2));
      return;
    }

    // Also check status if available
    if (result.status && result.status >= 400) {
      setError(`Request failed with status ${result.status}`);
      return;
    }

    setShowModal(false);
    loadSessionTypes();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this session type?")) return;
    await supabase.from("session_types").delete().eq("id", id);
    loadSessionTypes();
  }

  async function handleToggleActive(st: SessionType) {
    await supabase
      .from("session_types")
      .update({ is_active: !st.is_active })
      .eq("id", st.id);
    loadSessionTypes();
  }

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins} min`;
    if (mins % 60 === 0) return `${mins / 60} hr`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const formatPrice = (cents: number | null) => {
    if (!cents) return "Free";
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Session Types</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Configure the types of sessions you offer</p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Add Session Type
        </button>
      </div>

      {sessionTypes.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No session types configured yet</p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create your first session type
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 dark:border-gray-700">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Session Type</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">Duration</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">Price</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">Online Booking</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">Status</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sessionTypes.map((st) => (
                <tr key={st.id} className={clsx(!st.is_active && "opacity-50")}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: st.color }}
                      ></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{st.name}</p>
                        {st.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{st.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-700 dark:text-gray-300">
                    {formatDuration(st.duration_mins)}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-700 dark:text-gray-300">
                    {formatPrice(st.price_cents)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {st.allow_online_booking ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                        No
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggleActive(st)}
                      className={clsx(
                        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                        st.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      )}
                    >
                      {st.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(st)}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(st.id)}
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editing ? "Edit Session Type" : "New Session Type"}
              </h2>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => {
                    setForm({
                      ...form,
                      name: e.target.value,
                      slug: editing ? form.slug : generateSlug(e.target.value),
                    });
                  }}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder="e.g., PT Session"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder="Optional description for clients"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration *</label>
                  <select
                    value={form.duration_mins}
                    onChange={(e) => setForm({ ...form, duration_mins: parseInt(e.target.value) })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    {DURATIONS.map((d) => (
                      <option key={d} value={d}>
                        {formatDuration(d)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price (AUD)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500 dark:text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      value={(form.price_cents || 0) / 100}
                      onChange={(e) => setForm({ ...form, price_cents: Math.round(parseFloat(e.target.value || "0") * 100) })}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg pl-7 pr-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      placeholder="0"
                      min="0"
                      step="5"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setForm({ ...form, color: c.value })}
                      className={clsx(
                        "w-8 h-8 rounded-full border-2 transition-all",
                        form.color === c.value ? "border-gray-900 dark:border-white scale-110" : "border-transparent"
                      )}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Buffer Before</label>
                  <select
                    value={form.buffer_before_mins}
                    onChange={(e) => setForm({ ...form, buffer_before_mins: parseInt(e.target.value) })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value={0}>None</option>
                    <option value={5}>5 min</option>
                    <option value={10}>10 min</option>
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Buffer After</label>
                  <select
                    value={form.buffer_after_mins}
                    onChange={(e) => setForm({ ...form, buffer_after_mins: parseInt(e.target.value) })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value={0}>None</option>
                    <option value={5}>5 min</option>
                    <option value={10}>10 min</option>
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max per Day</label>
                <input
                  type="number"
                  value={form.max_per_day ?? ""}
                  onChange={(e) => setForm({ ...form, max_per_day: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder="No limit"
                  min="1"
                />
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.allow_online_booking}
                    onChange={(e) => setForm({ ...form, allow_online_booking: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Allow Online Booking</span>
                </label>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              {error && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  {error}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setError(null);
                  }}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!form.name || saving}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : editing ? "Save Changes" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
