"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

// --- Type definitions ---

interface FoodItem {
  id: string;
  food_name: string;
  food_group: string | null;
  energy_kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carb_g: number | null;
  fibre_g: number | null;
}

interface Component {
  id: string;
  meal_id: string;
  food_item_id: string | null;
  qty_g: number;
  custom_name: string | null;
  sort_order: number;
  food_item: FoodItem | null;
}

interface Meal {
  id: string;
  day_id: string;
  meal_type: string;
  title: string | null;
  note: string | null;
  sort_order: number;
  components: Component[];
}

interface Day {
  id: string;
  plan_id: string;
  day_number: number;
  date: string | null;
  meals: Meal[];
}

interface PlanClient {
  id: string;
  name: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

interface Plan {
  id: string;
  name: string;
  status: "draft" | "published";
  version: number;
  start_date: string | null;
  end_date: string | null;
  published_at: string | null;
  client: PlanClient | null;
  days: Day[];
}

// --- Version types ---

interface VersionSummary {
  id: string;
  version: number;
  status: "draft" | "published";
  published_at: string | null;
}

// --- Macro types ---

interface MacroTotals {
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
}

// --- Helpers ---

function clientDisplayName(client: PlanClient | null): string {
  if (!client) return "Unassigned";
  return (
    client.name ||
    [client.first_name, client.last_name].filter(Boolean).join(" ") ||
    "Unknown"
  );
}

function formatDate(d: string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  morning_snack: "Morning Snack",
  lunch: "Lunch",
  afternoon_snack: "Afternoon Snack",
  dinner: "Dinner",
  evening_snack: "Evening Snack",
  other: "Other",
};

function computeTotals(components: Component[]): MacroTotals {
  return components.reduce(
    (acc, c) => {
      const scale = c.qty_g / 100;
      return {
        kcal: acc.kcal + (c.food_item?.energy_kcal ?? 0) * scale,
        protein: acc.protein + (c.food_item?.protein_g ?? 0) * scale,
        carb: acc.carb + (c.food_item?.carb_g ?? 0) * scale,
        fat: acc.fat + (c.food_item?.fat_g ?? 0) * scale,
      };
    },
    { kcal: 0, protein: 0, carb: 0, fat: 0 }
  );
}

// --- Component ---

export default function PlanBuilderClient({ planId }: { planId: string }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [addingDay, setAddingDay] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [versions, setVersions] = useState<VersionSummary[]>([]);

  const loadVersions = useCallback(async () => {
    const res = await fetch(`/api/nutrition/plans/${planId}/versions`);
    if (res.ok) {
      const data = await res.json();
      setVersions(data.versions ?? []);
    }
  }, [planId]);

  const loadPlan = useCallback(async () => {
    try {
      const res = await fetch(`/api/nutrition/plans/${planId}`);
      if (!res.ok) {
        setError("Plan not found");
        return;
      }
      const data = await res.json();
      setPlan(data.plan);
      // Auto-select first day if none selected
      if (data.plan.days?.length > 0 && !selectedDayId) {
        setSelectedDayId(data.plan.days[0].id);
      }
    } catch {
      setError("Failed to load plan");
    } finally {
      setLoading(false);
    }
  }, [planId, selectedDayId]);

  useEffect(() => {
    loadPlan();
    loadVersions();
  }, [planId]); // Load once on mount; reload called explicitly after mutations

  async function handleAddDay() {
    if (!plan) return;
    setAddingDay(true);
    try {
      const res = await fetch(`/api/nutrition/plans/${planId}/days`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        const newDay: Day = { ...data.day, meals: [] };
        setPlan((p) => (p ? { ...p, days: [...p.days, newDay] } : p));
        setSelectedDayId(data.day.id);
      }
    } catch {
      // Silently fail; could add error toast in later plan
    } finally {
      setAddingDay(false);
    }
  }

  function handleDayUpdated(updatedDay: Day) {
    setPlan((p) =>
      p ? { ...p, days: p.days.map((d) => (d.id === updatedDay.id ? updatedDay : d)) } : p
    );
  }

  async function handlePublish() {
    if (!plan) return;
    if (plan.days.length === 0) {
      setPublishError("Add at least one day before publishing.");
      return;
    }
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await fetch(`/api/nutrition/plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "published",
          published_at: new Date().toISOString(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPlan((p) => p ? { ...p, status: data.plan.status, published_at: data.plan.published_at } : p);
      } else {
        const data = await res.json();
        setPublishError(data.error ?? "Failed to publish");
      }
    } catch {
      setPublishError("Failed to publish");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="p-6">
        <Link href="/nutrition" className="text-sm text-brand-600 hover:underline">
          ← Back to Nutrition Plans
        </Link>
        <p className="mt-4 text-gray-500 dark:text-gray-400">{error ?? "Plan not found."}</p>
      </div>
    );
  }

  const selectedDay = plan.days.find((d) => d.id === selectedDayId) ?? null;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Back nav */}
      <Link
        href="/nutrition"
        className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4 transition-colors"
      >
        ← Nutrition Plans
      </Link>

      {/* Version selector — shown only when multiple versions exist */}
      {versions.length > 1 && (
        <div className="flex justify-end mb-3">
          <select
            value={planId}
            onChange={(e) => { window.location.href = `/nutrition/${e.target.value}`; }}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:text-gray-100"
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.version} — {v.status === "published" ? "Published" : "Draft"}
                {v.id === planId ? " (current)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Plan header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {plan.name}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {clientDisplayName(plan.client)}
            {(plan.start_date || plan.end_date) && (
              <span className="mx-2 text-gray-300 dark:text-gray-600">·</span>
            )}
            {plan.start_date && formatDate(plan.start_date)}
            {plan.start_date && plan.end_date && " – "}
            {plan.end_date && formatDate(plan.end_date)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={
              plan.status === "published"
                ? "px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"
                : "px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
            }
          >
            {plan.status}
          </span>
          {/* Publish action */}
          {plan.status === "published" ? (
            <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
              ✓ Published
            </span>
          ) : (
            <button
              onClick={handlePublish}
              disabled={publishing || plan.days.length === 0}
              title={plan.days.length === 0 ? "Add at least one day before publishing" : undefined}
              className="bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
            >
              {publishing && (
                <span className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
              )}
              Publish
            </button>
          )}
          <button
            onClick={() => setShowGenerateModal(true)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-brand-600 text-brand-600 dark:text-brand-400 dark:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
          >
            Generate with AI
          </button>
        </div>
      </div>

      {publishError && (
        <div className="mb-4 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
          {publishError}
        </div>
      )}

      {/* Main layout: days sidebar + day panel */}
      <div className="flex gap-6 min-h-[500px]">
        {/* Days sidebar */}
        <aside className="w-48 flex-shrink-0">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Days
              </p>
            </div>
            <nav className="p-1">
              {plan.days.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 px-3 py-2">
                  No days yet
                </p>
              )}
              {plan.days.map((day) => (
                <button
                  key={day.id}
                  onClick={() => setSelectedDayId(day.id)}
                  className={
                    "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors " +
                    (selectedDayId === day.id
                      ? "bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 font-medium"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100")
                  }
                >
                  Day {day.day_number}
                  {day.date && (
                    <span className="block text-xs text-gray-400 dark:text-gray-500 font-normal">
                      {new Date(day.date).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  )}
                </button>
              ))}
            </nav>
            <div className="p-1 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={handleAddDay}
                disabled={addingDay}
                className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-full disabled:opacity-50"
              >
                {addingDay ? (
                  <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>+</span>
                )}
                Add Day
              </button>
            </div>
          </div>
        </aside>

        {/* Day content panel */}
        <div className="flex-1 min-w-0">
          {!selectedDay ? (
            <div className="bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-10 text-center">
              <p className="text-gray-400 dark:text-gray-500">
                {plan.days.length === 0
                  ? "Add a day to start building your plan."
                  : "Select a day from the sidebar."}
              </p>
            </div>
          ) : (
            <DayPanel
              day={selectedDay}
              planId={planId}
              onDayUpdated={handleDayUpdated}
            />
          )}
        </div>
      </div>

      {showGenerateModal && (
        <GenerateModal
          planId={planId}
          onClose={() => setShowGenerateModal(false)}
          onGenerated={() => {
            setShowGenerateModal(false);
            // Reload plan from API to get generated days/meals/components
            setLoading(true);
            setSelectedDayId(null);
            fetch(`/api/nutrition/plans/${planId}`)
              .then((r) => r.json())
              .then((data) => {
                setPlan(data.plan);
                if (data.plan.days?.length > 0) {
                  setSelectedDayId(data.plan.days[0].id);
                }
              })
              .finally(() => setLoading(false));
          }}
        />
      )}
    </div>
  );
}

// --- DayPanel: interactive meal editing ---

function DayPanel({
  day,
  planId,
  onDayUpdated,
}: {
  day: Day;
  planId: string;
  onDayUpdated: (updatedDay: Day) => void;
}) {
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [mealType, setMealType] = useState<string>("breakfast");
  const [mealTitle, setMealTitle] = useState("");
  const [addingMeal, setAddingMeal] = useState(false);

  // Compute day totals from all components across all meals
  const dayTotals = computeTotals(day.meals.flatMap((m) => m.components));

  async function handleAddMeal(e: React.FormEvent) {
    e.preventDefault();
    setAddingMeal(true);
    try {
      const res = await fetch(`/api/nutrition/plans/${planId}/meals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day_id: day.id,
          meal_type: mealType,
          title: mealTitle.trim() || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const newMeal: Meal = { ...data.meal, components: [] };
        onDayUpdated({ ...day, meals: [...day.meals, newMeal] });
        setShowAddMeal(false);
        setMealTitle("");
        setMealType("breakfast");
      }
    } finally {
      setAddingMeal(false);
    }
  }

  function handleMealUpdated(updatedMeal: Meal) {
    onDayUpdated({
      ...day,
      meals: day.meals.map((m) => (m.id === updatedMeal.id ? updatedMeal : m)),
    });
  }

  function handleMealDeleted(mealId: string) {
    onDayUpdated({ ...day, meals: day.meals.filter((m) => m.id !== mealId) });
  }

  const MEAL_TYPE_OPTIONS = [
    { value: "breakfast", label: "Breakfast" },
    { value: "morning_snack", label: "Morning Snack" },
    { value: "lunch", label: "Lunch" },
    { value: "afternoon_snack", label: "Afternoon Snack" },
    { value: "dinner", label: "Dinner" },
    { value: "evening_snack", label: "Evening Snack" },
    { value: "other", label: "Other" },
  ];

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:text-gray-100";

  return (
    <div className="space-y-4">
      {/* Day header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Day {day.day_number}
          </h2>
          {day.date && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {new Date(day.date).toLocaleDateString("en-AU", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowAddMeal(true)}
          className="bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          + Add Meal
        </button>
      </div>

      {/* Add meal form (inline) */}
      {showAddMeal && (
        <div className="bg-white dark:bg-gray-900 border border-brand-200 dark:border-brand-800 rounded-xl p-4">
          <form onSubmit={handleAddMeal} className="space-y-3">
            <div className="flex gap-3">
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value)}
                className={inputClass + " flex-1"}
              >
                {MEAL_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Custom title (optional)"
                value={mealTitle}
                onChange={(e) => setMealTitle(e.target.value)}
                className={inputClass + " flex-1"}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddMeal(false);
                  setMealTitle("");
                }}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addingMeal}
                className="bg-brand-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
              >
                {addingMeal && (
                  <span className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                )}
                Add Meal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Meals */}
      {day.meals.length === 0 && !showAddMeal ? (
        <div className="bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-8 text-center">
          <p className="text-gray-400 dark:text-gray-500 text-sm">
            No meals yet. Add a meal to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {day.meals.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              planId={planId}
              onMealUpdated={handleMealUpdated}
              onMealDeleted={handleMealDeleted}
            />
          ))}
        </div>
      )}

      {/* Day totals */}
      {day.meals.length > 0 && (
        <MacroBar label="Day total" totals={dayTotals} highlight />
      )}
    </div>
  );
}

// --- MealCard: interactive version with food search and component editing ---

function MealCard({
  meal,
  planId,
  onMealUpdated,
  onMealDeleted,
}: {
  meal: Meal;
  planId: string;
  onMealUpdated: (m: Meal) => void;
  onMealDeleted: (id: string) => void;
}) {
  const label = MEAL_TYPE_LABELS[meal.meal_type] ?? meal.meal_type;
  const mealTotals = computeTotals(meal.components);

  async function handleDeleteMeal() {
    if (!confirm("Delete this meal?")) return;
    await fetch(`/api/nutrition/plans/${planId}/meals/${meal.id}`, {
      method: "DELETE",
    });
    onMealDeleted(meal.id);
  }

  function handleComponentUpdated(updated: Component) {
    onMealUpdated({
      ...meal,
      components: meal.components.map((c) => (c.id === updated.id ? updated : c)),
    });
  }

  function handleComponentAdded(added: Component) {
    onMealUpdated({ ...meal, components: [...meal.components, added] });
  }

  function handleComponentDeleted(id: string) {
    onMealUpdated({
      ...meal,
      components: meal.components.filter((c) => c.id !== id),
    });
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* Meal header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
            {label}
          </span>
          {meal.title && (
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {meal.title}
            </p>
          )}
        </div>
        <button
          onClick={handleDeleteMeal}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          Remove
        </button>
      </div>

      {/* Components table */}
      <div className="px-4 pt-2 pb-1">
        {meal.components.length > 0 && (
          <table className="w-full text-xs mb-2">
            <thead>
              <tr className="text-gray-400 dark:text-gray-500">
                <th className="text-left font-normal pb-1 pr-2">Food</th>
                <th className="text-right font-normal pb-1 px-1 w-20">Qty (g)</th>
                <th className="text-right font-normal pb-1 px-1 w-14">kcal</th>
                <th className="text-right font-normal pb-1 px-1 w-12">P (g)</th>
                <th className="text-right font-normal pb-1 px-1 w-12">C (g)</th>
                <th className="text-right font-normal pb-1 px-1 w-12">F (g)</th>
                <th className="w-6" />
              </tr>
            </thead>
            <tbody>
              {meal.components.map((c) => (
                <ComponentRow
                  key={c.id}
                  component={c}
                  planId={planId}
                  mealId={meal.id}
                  onUpdated={handleComponentUpdated}
                  onDeleted={handleComponentDeleted}
                />
              ))}
            </tbody>
          </table>
        )}
        {/* Inline food search */}
        <FoodSearchInput
          planId={planId}
          mealId={meal.id}
          onAdded={handleComponentAdded}
        />
      </div>

      {/* Meal totals */}
      {meal.components.length > 0 && (
        <div className="px-4 pb-3">
          <MacroBar label="Meal total" totals={mealTotals} />
        </div>
      )}
    </div>
  );
}

// --- ComponentRow: editable qty, delete button, live macro display ---

function ComponentRow({
  component,
  planId,
  mealId,
  onUpdated,
  onDeleted,
}: {
  component: Component;
  planId: string;
  mealId: string;
  onUpdated: (c: Component) => void;
  onDeleted: (id: string) => void;
}) {
  const [qty, setQty] = useState(String(component.qty_g));

  const scale = Number(qty) / 100;
  const kcal =
    component.food_item?.energy_kcal != null
      ? +(component.food_item.energy_kcal * scale).toFixed(1)
      : null;
  const p =
    component.food_item?.protein_g != null
      ? +(component.food_item.protein_g * scale).toFixed(1)
      : null;
  const carb =
    component.food_item?.carb_g != null
      ? +(component.food_item.carb_g * scale).toFixed(1)
      : null;
  const fat =
    component.food_item?.fat_g != null
      ? +(component.food_item.fat_g * scale).toFixed(1)
      : null;
  const name = component.custom_name ?? component.food_item?.food_name ?? "Unknown";

  async function handleQtyBlur() {
    const newQty = Math.max(1, Number(qty) || 100);
    setQty(String(newQty));
    if (newQty === component.qty_g) return; // no change
    const res = await fetch(
      `/api/nutrition/plans/${planId}/meals/${mealId}/components/${component.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qty_g: newQty }),
      }
    );
    if (res.ok) {
      const data = await res.json();
      onUpdated(data.component);
    }
  }

  async function handleDelete() {
    await fetch(
      `/api/nutrition/plans/${planId}/meals/${mealId}/components/${component.id}`,
      { method: "DELETE" }
    );
    onDeleted(component.id);
  }

  return (
    <tr className="text-gray-700 dark:text-gray-300 group">
      <td className="py-1 pr-2 text-xs">{name}</td>
      <td className="text-right py-1 px-1">
        <input
          type="number"
          min="1"
          step="1"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onBlur={handleQtyBlur}
          className="w-16 text-right text-xs px-1 py-0.5 border border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-brand-400 rounded focus:outline-none bg-transparent focus:bg-white dark:focus:bg-gray-800"
        />
      </td>
      <td className="text-right py-1 px-1 text-xs">{kcal ?? "—"}</td>
      <td className="text-right py-1 px-1 text-xs">{p ?? "—"}</td>
      <td className="text-right py-1 px-1 text-xs">{carb ?? "—"}</td>
      <td className="text-right py-1 px-1 text-xs">{fat ?? "—"}</td>
      <td className="py-1 pl-1">
        <button
          onClick={handleDelete}
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity text-xs"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

// --- FoodSearchInput: debounced AFCD food search + add component ---

function FoodSearchInput({
  planId,
  mealId,
  onAdded,
}: {
  planId: string;
  mealId: string;
  onAdded: (c: Component) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/nutrition/foods?q=${encodeURIComponent(val)}`
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.foods ?? []);
        }
      } finally {
        setSearching(false);
      }
    }, 200);
  }

  async function handleSelect(food: FoodItem) {
    setAdding(true);
    setResults([]);
    setQuery("");
    try {
      const res = await fetch(
        `/api/nutrition/plans/${planId}/meals/${mealId}/components`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ food_item_id: food.id, qty_g: 100 }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        onAdded(data.component);
      }
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="relative mb-2">
      <input
        type="text"
        placeholder="+ Search food to add…"
        value={query}
        onChange={handleQueryChange}
        disabled={adding}
        className="w-full text-xs px-2 py-1.5 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400 bg-transparent dark:text-gray-300 placeholder-gray-400 disabled:opacity-50"
      />
      {(results.length > 0 || searching) && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
          {searching && (
            <div className="px-3 py-2 text-xs text-gray-400">Searching…</div>
          )}
          {results.map((food) => (
            <button
              key={food.id}
              onMouseDown={() => handleSelect(food)} // mouseDown fires before blur
              className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
                {food.food_name}
              </p>
              {food.food_group && (
                <p className="text-xs text-gray-400">{food.food_group}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- MacroBar: display macro totals for meal or day ---

function MacroBar({
  label,
  totals,
  highlight = false,
}: {
  label: string;
  totals: MacroTotals;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "flex items-center gap-4 text-xs rounded-lg px-3 py-2 " +
        (highlight
          ? "bg-brand-50 dark:bg-brand-900/20 font-medium"
          : "bg-gray-50 dark:bg-gray-800/50")
      }
    >
      <span className="text-gray-500 dark:text-gray-400 w-20">{label}</span>
      <span className="text-gray-800 dark:text-gray-200">
        {totals.kcal.toFixed(0)} kcal
      </span>
      <span className="text-gray-600 dark:text-gray-400">
        P: {totals.protein.toFixed(1)}g
      </span>
      <span className="text-gray-600 dark:text-gray-400">
        C: {totals.carb.toFixed(1)}g
      </span>
      <span className="text-gray-600 dark:text-gray-400">
        F: {totals.fat.toFixed(1)}g
      </span>
    </div>
  );
}

// --- GenerateModal: AI plan generation form ---

function GenerateModal({
  planId,
  onClose,
  onGenerated,
}: {
  planId: string;
  onClose: () => void;
  onGenerated: () => void;
}) {
  const [goal, setGoal] = useState("weight loss");
  const [calorieTarget, setCalorieTarget] = useState(2000);
  const [proteinPct, setProteinPct] = useState(30);
  const [carbPct, setCarbPct] = useState(45);
  const [fatPct, setFatPct] = useState(25);
  const [restrictions, setRestrictions] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-balance macros so they sum to 100
  const macroSum = proteinPct + carbPct + fatPct;

  const inputClass = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:text-gray-100";

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (macroSum !== 100) {
      setError(`Macros must sum to 100% (currently ${macroSum}%)`);
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/nutrition/plans/${planId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal,
          calorie_target: calorieTarget,
          macro_split: { protein_pct: proteinPct, carb_pct: carbPct, fat_pct: fatPct },
          dietary_restrictions: restrictions || null,
        }),
      });
      if (res.ok) {
        onGenerated();
      } else {
        const data = await res.json();
        setError(data.error ?? "Generation failed");
      }
    } catch {
      setError("Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Generate with AI
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Claude will create a 7-day meal plan using AFCD foods.
              Any existing days will be replaced.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleGenerate} className="space-y-4">
          {/* Goal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Client Goal
            </label>
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. weight loss, muscle gain, general health"
              className={inputClass}
            />
          </div>

          {/* Calorie target */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Daily Calorie Target (kcal)
            </label>
            <input
              type="number"
              min="500"
              max="6000"
              step="50"
              value={calorieTarget}
              onChange={(e) => setCalorieTarget(Number(e.target.value))}
              className={inputClass}
            />
          </div>

          {/* Macro split */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Macro Split (must total 100%)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Protein %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={proteinPct}
                  onChange={(e) => setProteinPct(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Carbs %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={carbPct}
                  onChange={(e) => setCarbPct(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Fat %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={fatPct}
                  onChange={(e) => setFatPct(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
            </div>
            <p className={`text-xs mt-1 ${macroSum === 100 ? "text-green-600" : "text-amber-600"}`}>
              Total: {macroSum}%{macroSum !== 100 ? " (must equal 100)" : " ✓"}
            </p>
          </div>

          {/* Dietary restrictions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Dietary Restrictions
            </label>
            <input
              type="text"
              value={restrictions}
              onChange={(e) => setRestrictions(e.target.value)}
              placeholder="e.g. gluten-free, vegetarian, no dairy (optional)"
              className={inputClass}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {generating && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              Generating 7-day plan… this may take 20–40 seconds.
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={generating}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={generating || macroSum !== 100}
              className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              Generate Plan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
