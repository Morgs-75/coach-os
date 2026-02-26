"use client";

import { useState, useEffect, useCallback } from "react";
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

// --- Component ---

export default function PlanBuilderClient({ planId }: { planId: string }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [addingDay, setAddingDay] = useState(false);

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
          {/* Publish button rendered by Plan 04 */}
          <div id="plan-action-slot" />
        </div>
      </div>

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
            <DayPanel day={selectedDay} planId={planId} onReload={loadPlan} />
          )}
        </div>
      </div>
    </div>
  );
}

// --- DayPanel: renders meals for a selected day ---
// Phase 02 will add meal editing. Phase 01 renders a read-only scaffold.

function DayPanel({
  day,
  planId,
  onReload,
}: {
  day: Day;
  planId: string;
  onReload: () => void;
}) {
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
        {/* Add Meal button — wired in Plan 02 */}
        <div id={`add-meal-slot-${day.id}`} />
      </div>

      {/* Meals list — empty state when no meals */}
      {day.meals.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-8 text-center">
          <p className="text-gray-400 dark:text-gray-500 text-sm">
            No meals yet. Add a meal to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {day.meals.map((meal) => (
            <MealCard key={meal.id} meal={meal} />
          ))}
        </div>
      )}
    </div>
  );
}

// --- MealCard: read-only in Plan 01; made editable in Plan 02 ---

function MealCard({ meal }: { meal: Meal }) {
  const label = MEAL_TYPE_LABELS[meal.meal_type] ?? meal.meal_type;
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
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
      </div>
      {meal.components.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500">No components yet.</p>
      ) : (
        <table className="w-full text-xs mt-1">
          <thead>
            <tr className="text-gray-400 dark:text-gray-500">
              <th className="text-left font-normal pb-1">Food</th>
              <th className="text-right font-normal pb-1">Qty (g)</th>
              <th className="text-right font-normal pb-1">kcal</th>
              <th className="text-right font-normal pb-1">P</th>
              <th className="text-right font-normal pb-1">C</th>
              <th className="text-right font-normal pb-1">F</th>
            </tr>
          </thead>
          <tbody>
            {meal.components.map((c) => {
              const scale = c.qty_g / 100;
              const kcal =
                c.food_item?.energy_kcal != null
                  ? +(c.food_item.energy_kcal * scale).toFixed(1)
                  : null;
              const p =
                c.food_item?.protein_g != null
                  ? +(c.food_item.protein_g * scale).toFixed(1)
                  : null;
              const carb =
                c.food_item?.carb_g != null
                  ? +(c.food_item.carb_g * scale).toFixed(1)
                  : null;
              const fat =
                c.food_item?.fat_g != null
                  ? +(c.food_item.fat_g * scale).toFixed(1)
                  : null;
              const name = c.custom_name ?? c.food_item?.food_name ?? "Unknown";
              return (
                <tr key={c.id} className="text-gray-700 dark:text-gray-300">
                  <td className="py-0.5 pr-2">{name}</td>
                  <td className="text-right py-0.5">{c.qty_g}</td>
                  <td className="text-right py-0.5">{kcal ?? "—"}</td>
                  <td className="text-right py-0.5">{p ?? "—"}</td>
                  <td className="text-right py-0.5">{carb ?? "—"}</td>
                  <td className="text-right py-0.5">{fat ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
