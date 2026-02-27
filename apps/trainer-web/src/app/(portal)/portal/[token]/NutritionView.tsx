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
  notes?: string | null;
  days: Day[];
}

interface NutritionViewProps {
  plan: NutritionPlan;
  token: string;
  primaryColor: string;
  onFeedback: (meal: Meal) => void;
  clientName?: string;
  goal?: string;
}

// --- Calculation helpers (spec: 4/4/9 multipliers, snapshot per 100g) ---

function fmtQty(qty: number): string {
  return Number.isInteger(qty) ? qty.toString() : qty.toFixed(1);
}

function scaledMacro(
  foodItem: FoodItem | null,
  qty_g: number,
  key: keyof Pick<FoodItem, "carb_g" | "protein_g" | "fat_g" | "energy_kcal">
): number {
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

function fmtDayLabel(day: Day): string {
  if (!day.date) return `Day ${day.day_number}`;
  try {
    return new Date(day.date).toLocaleDateString("en-AU", {
      weekday: "long",
    });
  } catch {
    return `Day ${day.day_number}`;
  }
}

function fmtDayDate(day: Day): string {
  if (!day.date) return "";
  try {
    return new Date(day.date).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function fmtPeriod(start: string, end: string): string {
  try {
    const s = new Date(start).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
    const e = new Date(end).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
    return `${s} – ${e}`;
  } catch {
    return `${start} – ${end}`;
  }
}

function fmtPublished(iso: string): string {
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

// --- Shared style tokens (inline, matching the HTML spec) ---

const TEXT = "#eef0ff";
const MUTED = "rgba(238,240,255,0.70)";
const MUTED2 = "rgba(238,240,255,0.55)";
const BORDER = "rgba(255,255,255,0.10)";
const CARD_BG = "linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03))";
const MEAL_BG = "rgba(16,20,58,0.55)";
const AMBER = "#ffb34a";

// Macro bar colors per spec
const CARB_COLOR = "#4ade80";  // green
const PROT_COLOR = "#3b82f6";  // blue
const FAT_COLOR = "#ffb34a";   // amber

// --- MealTable ---

interface MealTableProps {
  meal: Meal;
  onFeedback: () => void;
}

function MealTable({ meal, onFeedback }: MealTableProps) {
  const mealTotals = calcMealTotals(meal);
  const sortedComponents = [...meal.components].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  const mealHeading = meal.title
    ? `${capitalize(meal.meal_type)} — ${meal.title}`
    : capitalize(meal.meal_type);

  return (
    <div
      style={{
        background: MEAL_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      {/* Meal header */}
      <div
        style={{
          padding: "12px 12px 10px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 14, color: TEXT, fontWeight: 700 }}>
            {mealHeading}
          </h3>
        </div>
        <div>
          <button
            onClick={onFeedback}
            style={{
              fontSize: 12,
              padding: "7px 10px",
              borderRadius: 999,
              border: `1px solid ${BORDER}`,
              background: "rgba(255,255,255,0.03)",
              color: MUTED,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Comment
          </button>
        </div>
      </div>

      {/* Component table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {["Component", "Qty", "Unit", "C (g)", "P (g)", "F (g)", "kcal"].map(
                (col, i) => (
                  <th
                    key={col}
                    style={{
                      textAlign: i === 0 ? "left" : "right",
                      color: MUTED,
                      fontWeight: 700,
                      padding: "10px 12px",
                      borderTop: `1px solid ${BORDER}`,
                      borderBottom: `1px solid ${BORDER}`,
                      background: "rgba(255,255,255,0.02)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {col}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {sortedComponents.map((comp) => {
              const name = comp.food_item
                ? comp.food_item.food_name
                : comp.custom_name ?? "—";
              const hasFood = !!comp.food_item;
              return (
                <tr key={comp.id}>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", color: TEXT, verticalAlign: "top" }}>
                    {name}
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", textAlign: "right", fontVariantNumeric: "tabular-nums", color: TEXT }}>
                    {fmtQty(comp.qty_g)}
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", color: MUTED }}>
                    g
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", textAlign: "right", fontVariantNumeric: "tabular-nums", color: TEXT }}>
                    {hasFood ? scaledMacro(comp.food_item, comp.qty_g, "carb_g").toFixed(1) : "—"}
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", textAlign: "right", fontVariantNumeric: "tabular-nums", color: TEXT }}>
                    {hasFood ? scaledMacro(comp.food_item, comp.qty_g, "protein_g").toFixed(1) : "—"}
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", textAlign: "right", fontVariantNumeric: "tabular-nums", color: TEXT }}>
                    {hasFood ? scaledMacro(comp.food_item, comp.qty_g, "fat_g").toFixed(1) : "—"}
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", textAlign: "right", fontVariantNumeric: "tabular-nums", color: TEXT }}>
                    {hasFood ? scaledMacro(comp.food_item, comp.qty_g, "energy_kcal").toFixed(0) : "—"}
                  </td>
                </tr>
              );
            })}
            {/* Meal total row */}
            <tr>
              <td
                colSpan={1}
                style={{
                  padding: "10px 12px",
                  borderTop: `1px solid ${BORDER}`,
                  background: "rgba(255,255,255,0.02)",
                  fontWeight: 800,
                  color: TEXT,
                }}
              >
                Meal total
              </td>
              <td style={{ padding: "10px 12px", borderTop: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.02)" }} />
              <td style={{ padding: "10px 12px", borderTop: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.02)" }} />
              <td style={{ padding: "10px 12px", borderTop: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.02)", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 800, color: TEXT }}>
                {mealTotals.carb_g.toFixed(1)}
              </td>
              <td style={{ padding: "10px 12px", borderTop: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.02)", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 800, color: TEXT }}>
                {mealTotals.protein_g.toFixed(1)}
              </td>
              <td style={{ padding: "10px 12px", borderTop: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.02)", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 800, color: TEXT }}>
                {mealTotals.fat_g.toFixed(1)}
              </td>
              <td style={{ padding: "10px 12px", borderTop: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.02)", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 800, color: TEXT }}>
                {mealTotals.energy_kcal.toFixed(0)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- DayCard ---

interface DayCardProps {
  day: Day;
  isOpen: boolean;
  onToggle: () => void;
  onFeedback: (meal: Meal) => void;
}

function DayCard({ day, isOpen, onToggle, onFeedback }: DayCardProps) {
  const dayTotals = calcDayTotals(day);
  const sortedMeals = [...day.meals].sort((a, b) => a.sort_order - b.sort_order);

  // Spec: macro kcal = g * multiplier (4/4/9)
  const carbKcal = dayTotals.carb_g * 4;
  const protKcal = dayTotals.protein_g * 4;
  const fatKcal = dayTotals.fat_g * 9;
  const totalMacroKcal = carbKcal + protKcal + fatKcal;
  const carbPct = totalMacroKcal > 0 ? (carbKcal / totalMacroKcal) * 100 : 0;
  const protPct = totalMacroKcal > 0 ? (protKcal / totalMacroKcal) * 100 : 0;
  const fatPct = totalMacroKcal > 0 ? (fatKcal / totalMacroKcal) * 100 : 0;

  const dayLabel = fmtDayLabel(day);
  const dayDate = fmtDayDate(day);

  return (
    <div style={{ borderTop: `1px solid ${BORDER}`, padding: "14px 16px" }}>
      {/* Day header — clickable toggle */}
      <div
        onClick={onToggle}
        role="button"
        aria-label={`Toggle Day ${day.day_number}`}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: TEXT }}>
            Day {day.day_number}{dayLabel !== `Day ${day.day_number}` ? ` — ${dayLabel}` : ""}
          </span>
          {dayDate && (
            <span style={{ color: MUTED, fontSize: 13 }}>{dayDate}</span>
          )}
        </div>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 10,
            display: "grid",
            placeItems: "center",
            border: `1px solid ${BORDER}`,
            background: "rgba(255,255,255,0.03)",
            color: TEXT,
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          {isOpen ? "▾" : "▸"}
        </div>
      </div>

      {/* Day body — only when open */}
      {isOpen && (
        <div style={{ marginTop: 14 }}>
          {/* Meals */}
          <div style={{ display: "grid", gap: 12 }}>
            {sortedMeals.map((meal) => (
              <MealTable
                key={meal.id}
                meal={meal}
                onFeedback={() => onFeedback(meal)}
              />
            ))}
          </div>

          {/* Day totals section */}
          <div
            style={{
              marginTop: 14,
              background: MEAL_BG,
              border: `1px solid ${BORDER}`,
              borderRadius: 14,
              padding: 12,
            }}
          >
            {/* Two-column: KPI + bar LEFT, callout RIGHT */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
              className="day-totals-grid"
            >
              {/* Left: KPI boxes + macro bar */}
              <div>
                {/* 4 KPI boxes */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {[
                    { label: "Total carbs", value: `${dayTotals.carb_g.toFixed(1)}g` },
                    { label: "Total protein", value: `${dayTotals.protein_g.toFixed(1)}g` },
                    { label: "Total fat", value: `${dayTotals.fat_g.toFixed(1)}g` },
                    { label: "Total calories", value: Math.round(dayTotals.energy_kcal).toLocaleString() },
                  ].map((kpi) => (
                    <div
                      key={kpi.label}
                      style={{
                        flex: 1,
                        minWidth: 100,
                        border: `1px solid ${BORDER}`,
                        background: "rgba(255,255,255,0.03)",
                        borderRadius: 14,
                        padding: "10px 10px",
                      }}
                    >
                      <div style={{ color: MUTED, fontSize: 12 }}>{kpi.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4, color: TEXT }}>{kpi.value}</div>
                    </div>
                  ))}
                </div>

                {/* Macro split stacked bar */}
                <div
                  style={{
                    marginTop: 12,
                    border: `1px solid ${BORDER}`,
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 14,
                    padding: 12,
                  }}
                >
                  <h4 style={{ margin: "0 0 10px", fontSize: 13, color: MUTED, fontWeight: 600 }}>
                    Macro split (calories) — stacked bar
                  </h4>

                  {/* Stacked bar — spec: NO pie/donut */}
                  <div
                    style={{
                      height: 14,
                      borderRadius: 999,
                      overflow: "hidden",
                      display: "flex",
                      border: `1px solid rgba(255,255,255,0.10)`,
                      background: "rgba(0,0,0,0.25)",
                    }}
                    aria-label="Macro split stacked bar"
                  >
                    <div
                      style={{
                        width: `${carbPct}%`,
                        height: "100%",
                        background: `linear-gradient(90deg, rgba(74,222,128,.95), rgba(74,222,128,.55))`,
                      }}
                    />
                    <div
                      style={{
                        width: `${protPct}%`,
                        height: "100%",
                        background: `linear-gradient(90deg, rgba(59,130,246,.95), rgba(59,130,246,.55))`,
                      }}
                    />
                    <div
                      style={{
                        width: `${fatPct}%`,
                        height: "100%",
                        background: `linear-gradient(90deg, rgba(255,179,74,.95), rgba(255,179,74,.55))`,
                      }}
                    />
                  </div>

                  {/* Legend — 3-column grid, each: dot + name + grams/kcal + % */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: 10,
                      marginTop: 10,
                    }}
                  >
                    {[
                      {
                        key: "carb",
                        color: CARB_COLOR,
                        label: "Carbs",
                        g: dayTotals.carb_g,
                        kcal: carbKcal,
                        pct: carbPct,
                      },
                      {
                        key: "prot",
                        color: PROT_COLOR,
                        label: "Protein",
                        g: dayTotals.protein_g,
                        kcal: protKcal,
                        pct: protPct,
                      },
                      {
                        key: "fat",
                        color: FAT_COLOR,
                        label: "Fat",
                        g: dayTotals.fat_g,
                        kcal: fatKcal,
                        pct: fatPct,
                      },
                    ].map((m) => (
                      <div
                        key={m.key}
                        style={{
                          border: `1px solid rgba(255,255,255,0.10)`,
                          background: "rgba(0,0,0,0.18)",
                          borderRadius: 14,
                          padding: 10,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              background: m.color,
                              flexShrink: 0,
                              opacity: 0.9,
                            }}
                          />
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 13, color: TEXT }}>{m.label}</div>
                            <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>
                              {m.g.toFixed(1)}g • {Math.round(m.kcal)} kcal
                            </div>
                          </div>
                        </div>
                        <div style={{ fontVariantNumeric: "tabular-nums", textAlign: "right", fontWeight: 800, fontSize: 13, color: TEXT }}>
                          {m.pct.toFixed(0)}%
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 10, color: MUTED2, fontSize: 12, lineHeight: 1.45 }}>
                    Minor differences can occur due to rounding and source energy values.
                  </div>
                </div>
              </div>

              {/* Right: fat loss note callout */}
              <div>
                <div
                  style={{
                    border: "1px solid rgba(255,179,74,0.25)",
                    background: "rgba(255,179,74,0.08)",
                    padding: 12,
                    borderRadius: 14,
                    color: MUTED,
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ color: TEXT }}>Energy balance note</strong>
                  <br />
                  Fat loss occurs when{" "}
                  <strong style={{ color: TEXT }}>calories out</strong> exceeds{" "}
                  <strong style={{ color: TEXT }}>calories in</strong>.
                  <div style={{ height: 1, background: "rgba(255,255,255,0.10)", margin: "12px 0" }} />
                  <div style={{ color: MUTED2, fontSize: 12, lineHeight: 1.45 }}>
                    Real-world changes vary with glycogen, water, sodium, and adherence.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Responsive override for day-totals-grid on small screens */}
      <style>{`
        @media (max-width: 680px) {
          .day-totals-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

// --- NutritionView (main export) ---

export default function NutritionView({
  plan,
  token: _token,
  primaryColor: _primaryColor,
  onFeedback,
  clientName,
  goal,
}: NutritionViewProps) {
  const sortedDays = [...plan.days].sort((a, b) => a.day_number - b.day_number);
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

  function openFeedback(meal: Meal) {
    onFeedback(meal);
  }

  function openGeneralFeedback() {
    // Pass a synthetic "general" meal object — the parent PortalDashboard handles drawer state
    onFeedback({
      id: "",
      meal_type: "general",
      title: "General",
      sort_order: 0,
      components: [],
    });
  }

  const bgStyle: React.CSSProperties = {
    background: `
      radial-gradient(800px 600px at 20% 10%, rgba(255,179,74,.10), transparent 60%),
      radial-gradient(700px 500px at 80% 0%, rgba(59,130,246,.12), transparent 55%),
      radial-gradient(600px 400px at 70% 90%, rgba(74,222,128,.08), transparent 55%),
      linear-gradient(180deg, #07081a, #0b0d24)
    `,
    minHeight: "100%",
    padding: "0 0 48px",
    color: TEXT,
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  };

  const planNotes =
    plan.notes && plan.notes.trim()
      ? plan.notes
      : "Hydration 2–3L/day. Keep steps consistent. Use swap options if appetite or schedule changes.";

  return (
    <div style={bgStyle}>
      {/* Header — non-sticky inside tab container */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "18px 18px",
          background: "linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03))",
          border: `1px solid ${BORDER}`,
          borderRadius: 18,
          boxShadow: "0 20px 60px rgba(0,0,0,.45)",
          backdropFilter: "blur(12px)",
          flexWrap: "wrap",
        }}
      >
        {/* Brand / title */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(255,179,74,0.4), rgba(59,130,246,0.4))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              boxShadow: "0 10px 30px rgba(0,0,0,.35)",
              flexShrink: 0,
            }}
          >
            🥗
          </div>
          <div>
            <div style={{ fontWeight: 800, letterSpacing: 0.2, fontSize: 16, lineHeight: 1.1, color: TEXT }}>
              Nutrition Engine
            </div>
            <div style={{ color: MUTED, fontSize: 13, marginTop: 3 }}>
              A meal plan just for you
            </div>
          </div>
        </div>

        {/* Pills + button */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
          {clientName && (
            <div style={{ padding: "10px 12px", border: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.04)", borderRadius: 999, color: MUTED, fontSize: 13, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
              <span>Client</span>
              <strong style={{ color: TEXT, fontWeight: 700 }}>{clientName}</strong>
            </div>
          )}
          <div style={{ padding: "10px 12px", border: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.04)", borderRadius: 999, color: MUTED, fontSize: 13, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
            <span>Period</span>
            <strong style={{ color: TEXT, fontWeight: 700 }}>{fmtPeriod(plan.start_date, plan.end_date)}</strong>
          </div>
          {goal && (
            <div style={{ padding: "10px 12px", border: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.04)", borderRadius: 999, color: MUTED, fontSize: 13, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
              <span>Goal</span>
              <strong style={{ color: TEXT, fontWeight: 700 }}>{goal}</strong>
            </div>
          )}
          <button
            onClick={openGeneralFeedback}
            style={{
              border: "1px solid rgba(255,179,74,0.35)",
              background: "linear-gradient(180deg, rgba(255,179,74,.20), rgba(255,179,74,.10))",
              color: TEXT,
              padding: "10px 14px",
              borderRadius: 999,
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 13,
              whiteSpace: "nowrap",
            }}
          >
            Give feedback
          </button>
        </div>
      </div>

      {/* Two-column main layout */}
      <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "1.4fr 0.6fr",
          gap: 16,
        }}
        className="nutrition-main-grid"
      >
        {/* LEFT: Plan card */}
        <section
          style={{
            background: CARD_BG,
            border: `1px solid ${BORDER}`,
            borderRadius: 18,
            boxShadow: "0 20px 60px rgba(0,0,0,.45)",
            overflow: "hidden",
          }}
        >
          {/* Plan card header */}
          <div
            style={{
              padding: "16px 16px 12px",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 14,
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: 16, letterSpacing: 0.2, color: TEXT, fontWeight: 700 }}>
                Meal plan
              </h2>
              <div style={{ marginTop: 4, color: MUTED, fontSize: 13 }}>
                Clean components • Automatic macros • Coach-approved changes
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center", color: MUTED, fontSize: 13 }}>
              {plan.version != null && (
                <span
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: `1px solid ${BORDER}`,
                    background: "rgba(255,255,255,0.04)",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    fontSize: 12,
                    color: MUTED,
                  }}
                >
                  Version: <strong style={{ color: TEXT }}>v{plan.version}</strong>
                </span>
              )}
              <span
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: `1px solid ${BORDER}`,
                  background: "rgba(255,255,255,0.04)",
                  fontSize: 12,
                  color: MUTED,
                }}
              >
                Published: <strong style={{ color: TEXT }}>{fmtPublished(plan.published_at)}</strong>
              </span>
            </div>
          </div>

          {/* Day cards */}
          {sortedDays.map((day) => (
            <DayCard
              key={day.id}
              day={day}
              isOpen={expandedDays.has(day.id)}
              onToggle={() => toggleDay(day.id)}
              onFeedback={openFeedback}
            />
          ))}
        </section>

        {/* RIGHT: Notes rail */}
        <aside style={{ display: "grid", gap: 16, alignContent: "start" }}>
          {/* Plan notes */}
          <section
            style={{
              background: CARD_BG,
              border: `1px solid ${BORDER}`,
              borderRadius: 18,
              boxShadow: "0 20px 60px rgba(0,0,0,.45)",
              padding: "14px 14px 14px",
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 14, color: TEXT, fontWeight: 700 }}>Plan notes</h3>
            <p style={{ margin: 0, color: MUTED, fontSize: 13, lineHeight: 1.5 }}>{planNotes}</p>
          </section>

          {/* How to request changes */}
          <section
            style={{
              background: CARD_BG,
              border: `1px solid ${BORDER}`,
              borderRadius: 18,
              boxShadow: "0 20px 60px rgba(0,0,0,.45)",
              padding: "14px 14px 14px",
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 14, color: TEXT, fontWeight: 700 }}>How to request changes</h3>
            <p style={{ margin: 0, color: MUTED, fontSize: 13, lineHeight: 1.5 }}>
              Tap <strong style={{ color: TEXT }}>Give feedback</strong>. Select the meal. Describe what you want changed. Your coach will review and publish an updated version.
            </p>
            <div
              style={{
                marginTop: 10,
                border: "1px solid rgba(255,179,74,0.25)",
                background: "rgba(255,179,74,0.08)",
                padding: 12,
                borderRadius: 14,
                color: MUTED,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: TEXT }}>Example</strong>
              <br />
              &ldquo;Swap chicken for beef at lunch. Keep calories similar.&rdquo;
            </div>
          </section>

          {/* Coach approval */}
          <section
            style={{
              background: CARD_BG,
              border: `1px solid ${BORDER}`,
              borderRadius: 18,
              boxShadow: "0 20px 60px rgba(0,0,0,.45)",
              padding: "14px 14px 14px",
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 14, color: TEXT, fontWeight: 700 }}>Coach approval</h3>
            <p style={{ margin: 0, color: MUTED, fontSize: 13, lineHeight: 1.5 }}>
              AI can draft substitutions. Your coach confirms before any changes are deployed.
            </p>
          </section>
        </aside>
      </div>

      {/* Responsive layout for mobile */}
      <style>{`
        @media (max-width: 980px) {
          .nutrition-main-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
