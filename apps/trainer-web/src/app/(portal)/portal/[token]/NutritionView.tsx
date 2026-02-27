"use client";

import { useState } from "react";

export interface FoodItem {
  id: string;
  food_name: string;
  energy_kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
}

export interface Component {
  id: string;
  qty_g: number;
  custom_name: string | null;
  sort_order?: number;
  food_item: FoodItem | null;
}

export interface Meal {
  id: string;
  meal_type: string;
  title: string | null;
  sort_order: number;
  components: Component[];
}

export interface Day {
  id: string;
  day_number: number;
  date: string | null;
  meals: Meal[];
}

export interface NutritionPlan {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  published_at: string;
  version?: number;
  days: Day[];
}

interface NutritionViewProps {
  plan: NutritionPlan;
  token: string;
  primaryColor: string;
  onFeedback: (meal: Meal) => void;
}

function fmtQty(qty: number): string {
  return Number.isInteger(qty) ? qty.toString() : qty.toFixed(1);
}

function scaledMacro(foodItem: FoodItem | null, qty_g: number, key: keyof Pick<FoodItem, "carb_g" | "protein_g" | "fat_g" | "energy_kcal">): number {
  if (!foodItem) return 0;
  return (foodItem[key] / 100) * qty_g;
}

interface MealTotals {
  carb_g: number;
  protein_g: number;
  fat_g: number;
  energy_kcal: number;
}

function calcMealTotals(meal: Meal): MealTotals {
  return meal.components.reduce(
    (acc, comp) => ({
      carb_g: acc.carb_g + scaledMacro(comp.food_item, comp.qty_g, "carb_g"),
      protein_g: acc.protein_g + scaledMacro(comp.food_item, comp.qty_g, "protein_g"),
      fat_g: acc.fat_g + scaledMacro(comp.food_item, comp.qty_g, "fat_g"),
      energy_kcal: acc.energy_kcal + scaledMacro(comp.food_item, comp.qty_g, "energy_kcal"),
    }),
    { carb_g: 0, protein_g: 0, fat_g: 0, energy_kcal: 0 }
  );
}

interface DayTotals {
  carb_g: number;
  protein_g: number;
  fat_g: number;
  energy_kcal: number;
}

function calcDayTotals(day: Day): DayTotals {
  return day.meals.reduce(
    (acc, meal) => {
      const t = calcMealTotals(meal);
      return {
        carb_g: acc.carb_g + t.carb_g,
        protein_g: acc.protein_g + t.protein_g,
        fat_g: acc.fat_g + t.fat_g,
        energy_kcal: acc.energy_kcal + t.energy_kcal,
      };
    },
    { carb_g: 0, protein_g: 0, fat_g: 0, energy_kcal: 0 }
  );
}

function fmtDayDate(day: Day): string {
  if (!day.date) return `Day ${day.day_number}`;
  try {
    return new Date(day.date).toLocaleDateString("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return `Day ${day.day_number}`;
  }
}

function fmtShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface DayCardProps {
  day: Day;
  isOpen: boolean;
  onToggle: () => void;
  primaryColor: string;
  onFeedback: (meal: Meal) => void;
}

function DayCard({ day, isOpen, onToggle, primaryColor, onFeedback }: DayCardProps) {
  const dayTotals = calcDayTotals(day);
  const sortedMeals = [...day.meals].sort((a, b) => a.sort_order - b.sort_order);

  // CSS stacked bar chart percentages
  const carbKcal = dayTotals.carb_g * 4;
  const protKcal = dayTotals.protein_g * 4;
  const fatKcal = dayTotals.fat_g * 9;
  const totalKcal = carbKcal + protKcal + fatKcal;
  const carbPct = totalKcal > 0 ? (carbKcal / totalKcal) * 100 : 0;
  const proteinPct = totalKcal > 0 ? (protKcal / totalKcal) * 100 : 0;
  const fatPct = totalKcal > 0 ? (fatKcal / totalKcal) * 100 : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between text-left"
      >
        <div>
          <span className="font-semibold text-gray-900 text-sm">Day {day.day_number}</span>
          {day.date && (
            <span className="ml-2 text-xs text-gray-400">{fmtDayDate(day)}</span>
          )}
          {!day.date && (
            <span className="ml-2 text-xs text-gray-400">Day {day.day_number}</span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "" : "-rotate-180"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {isOpen && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {/* Meals */}
          {sortedMeals.map((meal) => {
            const mealTotals = calcMealTotals(meal);
            const sortedComponents = [...meal.components].sort(
              (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
            );

            const mealHeading = meal.title
              ? `${capitalize(meal.meal_type)} — ${meal.title}`
              : capitalize(meal.meal_type);

            return (
              <div key={meal.id} className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800 text-sm">{mealHeading}</h3>
                  <button
                    onClick={() => onFeedback(meal)}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg border"
                    style={{ color: primaryColor, borderColor: primaryColor }}
                  >
                    Leave feedback
                  </button>
                </div>

                {/* Component table */}
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-xs min-w-[360px]">
                    <thead>
                      <tr className="text-gray-400 uppercase tracking-wide">
                        <th className="text-left font-medium py-1 pr-2">Component</th>
                        <th className="text-right font-medium py-1 px-1">Qty</th>
                        <th className="text-left font-medium py-1 px-1">Unit</th>
                        <th className="text-right font-medium py-1 px-1">C</th>
                        <th className="text-right font-medium py-1 px-1">P</th>
                        <th className="text-right font-medium py-1 px-1">F</th>
                        <th className="text-right font-medium py-1 pl-1">kcal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {sortedComponents.map((comp) => {
                        const name = comp.food_item
                          ? comp.food_item.food_name
                          : comp.custom_name ?? "—";
                        const hasFood = !!comp.food_item;
                        return (
                          <tr key={comp.id} className="text-gray-700">
                            <td className="py-1.5 pr-2">{name}</td>
                            <td className="py-1.5 px-1 text-right">{fmtQty(comp.qty_g)}</td>
                            <td className="py-1.5 px-1 text-gray-400">g</td>
                            <td className="py-1.5 px-1 text-right">
                              {hasFood
                                ? scaledMacro(comp.food_item, comp.qty_g, "carb_g").toFixed(1)
                                : "—"}
                            </td>
                            <td className="py-1.5 px-1 text-right">
                              {hasFood
                                ? scaledMacro(comp.food_item, comp.qty_g, "protein_g").toFixed(1)
                                : "—"}
                            </td>
                            <td className="py-1.5 px-1 text-right">
                              {hasFood
                                ? scaledMacro(comp.food_item, comp.qty_g, "fat_g").toFixed(1)
                                : "—"}
                            </td>
                            <td className="py-1.5 pl-1 text-right">
                              {hasFood
                                ? scaledMacro(comp.food_item, comp.qty_g, "energy_kcal").toFixed(1)
                                : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="font-semibold text-gray-800 border-t border-gray-200">
                        <td className="pt-1.5 pr-2">Total</td>
                        <td className="pt-1.5 px-1" />
                        <td className="pt-1.5 px-1" />
                        <td className="pt-1.5 px-1 text-right">{mealTotals.carb_g.toFixed(1)}</td>
                        <td className="pt-1.5 px-1 text-right">{mealTotals.protein_g.toFixed(1)}</td>
                        <td className="pt-1.5 px-1 text-right">{mealTotals.fat_g.toFixed(1)}</td>
                        <td className="pt-1.5 pl-1 text-right">{mealTotals.energy_kcal.toFixed(1)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })}

          {/* Day totals panel */}
          <div className="px-5 py-4 bg-gray-50">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
              Daily totals
            </h4>

            {/* 4 KPI boxes */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="text-center">
                <p className="text-base font-bold text-gray-800">{Math.round(dayTotals.carb_g)}g</p>
                <p className="text-xs text-gray-400 mt-0.5">Carbs</p>
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-gray-800">{Math.round(dayTotals.protein_g)}g</p>
                <p className="text-xs text-gray-400 mt-0.5">Protein</p>
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-gray-800">{Math.round(dayTotals.fat_g)}g</p>
                <p className="text-xs text-gray-400 mt-0.5">Fat</p>
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-gray-800">{Math.round(dayTotals.energy_kcal)}</p>
                <p className="text-xs text-gray-400 mt-0.5">kcal</p>
              </div>
            </div>

            {/* CSS stacked bar chart */}
            <div className="flex h-3 rounded-full overflow-hidden w-full">
              <div
                style={{ width: `${carbPct}%`, backgroundColor: "#f59e0b" }}
                title={`Carbs ${carbPct.toFixed(0)}%`}
              />
              <div
                style={{ width: `${proteinPct}%`, backgroundColor: "#3b82f6" }}
                title={`Protein ${proteinPct.toFixed(0)}%`}
              />
              <div
                style={{ width: `${fatPct}%`, backgroundColor: "#ef4444" }}
                title={`Fat ${fatPct.toFixed(0)}%`}
              />
            </div>

            {/* Color legend */}
            <div className="flex gap-4 mt-2">
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: "#f59e0b" }} />
                Carbs
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: "#3b82f6" }} />
                Protein
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: "#ef4444" }} />
                Fat
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NutritionView({ plan, token: _token, primaryColor, onFeedback }: NutritionViewProps) {
  const sortedDays = [...plan.days].sort((a, b) => a.day_number - b.day_number);

  // Start with first day expanded
  const firstDayId = sortedDays[0]?.id ?? "";
  const [expandedDays, setExpandedDays] = useState<Set<string>>(
    new Set(firstDayId ? [firstDayId] : [])
  );

  function toggleDay(dayId: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayId)) {
        next.delete(dayId);
      } else {
        next.add(dayId);
      }
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* Plan header */}
      <div className="px-1">
        <h2 className="font-semibold text-gray-900">{plan.name}</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          {fmtShortDate(plan.start_date)} – {fmtShortDate(plan.end_date)}
        </p>
      </div>

      {/* Day cards */}
      {sortedDays.map((day) => (
        <DayCard
          key={day.id}
          day={day}
          isOpen={expandedDays.has(day.id)}
          onToggle={() => toggleDay(day.id)}
          primaryColor={primaryColor}
          onFeedback={onFeedback}
        />
      ))}
    </div>
  );
}
