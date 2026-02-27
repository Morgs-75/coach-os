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
  note?: string | null;
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

// --- Theme tokens ---

interface Tokens {
  pageBg: string;
  text: string;
  muted: string;
  muted2: string;
  border: string;
  cardBg: string;
  cardShadow: string;
  mealBg: string;
  cellBorder: string;
  headerCellBg: string;
  totalRowBg: string;
  kpiBoxBg: string;
  macroBg: string;
  macroBorder: string;
  legendCardBg: string;
  legendCardBorder: string;
  stackBarBg: string;
  stackBarBorder: string;
  chevBg: string;
  pillBg: string;
  feedbackBtnBg: string;
  feedbackBtnBorder: string;
}

function getTokens(dark: boolean): Tokens {
  if (dark) {
    return {
      pageBg: `
        radial-gradient(800px 600px at 20% 10%, rgba(255,179,74,.10), transparent 60%),
        radial-gradient(700px 500px at 80% 0%, rgba(59,130,246,.12), transparent 55%),
        radial-gradient(600px 400px at 70% 90%, rgba(74,222,128,.08), transparent 55%),
        linear-gradient(180deg, #07081a, #0b0d24)
      `,
      text: "#eef0ff",
      muted: "rgba(238,240,255,0.70)",
      muted2: "rgba(238,240,255,0.55)",
      border: "rgba(255,255,255,0.10)",
      cardBg: "linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03))",
      cardShadow: "0 20px 60px rgba(0,0,0,.45)",
      mealBg: "rgba(16,20,58,0.55)",
      cellBorder: "rgba(255,255,255,0.06)",
      headerCellBg: "rgba(255,255,255,0.02)",
      totalRowBg: "rgba(255,255,255,0.02)",
      kpiBoxBg: "rgba(255,255,255,0.03)",
      macroBg: "rgba(255,255,255,0.03)",
      macroBorder: "rgba(255,255,255,0.10)",
      legendCardBg: "rgba(0,0,0,0.18)",
      legendCardBorder: "rgba(255,255,255,0.10)",
      stackBarBg: "rgba(0,0,0,0.25)",
      stackBarBorder: "rgba(255,255,255,0.10)",
      chevBg: "rgba(255,255,255,0.03)",
      pillBg: "rgba(255,255,255,0.04)",
      feedbackBtnBg: "rgba(255,255,255,0.03)",
      feedbackBtnBorder: "rgba(255,255,255,0.10)",
    };
  }
  return {
    pageBg: "linear-gradient(180deg, #f1f5f9, #e2e8f0)",
    text: "#0f172a",
    muted: "#64748b",
    muted2: "#94a3b8",
    border: "rgba(0,0,0,0.10)",
    cardBg: "#ffffff",
    cardShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.04)",
    mealBg: "#f8fafc",
    cellBorder: "rgba(0,0,0,0.07)",
    headerCellBg: "#f8fafc",
    totalRowBg: "#f1f5f9",
    kpiBoxBg: "#f8fafc",
    macroBg: "#f8fafc",
    macroBorder: "rgba(0,0,0,0.09)",
    legendCardBg: "#f1f5f9",
    legendCardBorder: "rgba(0,0,0,0.09)",
    stackBarBg: "rgba(0,0,0,0.07)",
    stackBarBorder: "rgba(0,0,0,0.09)",
    chevBg: "#f1f5f9",
    pillBg: "#f1f5f9",
    feedbackBtnBg: "#f8fafc",
    feedbackBtnBorder: "rgba(0,0,0,0.12)",
  };
}

// Macro bar colors — same in both themes
const CARB_COLOR = "#4ade80";
const PROT_COLOR = "#3b82f6";
const FAT_COLOR  = "#ffb34a";
const AMBER      = "#ffb34a";

// --- Calculation helpers ---

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

interface MealTotals { carb_g: number; protein_g: number; fat_g: number; energy_kcal: number; }
interface DayTotals  { carb_g: number; protein_g: number; fat_g: number; energy_kcal: number; }

function calcMealTotals(meal: Meal): MealTotals {
  return meal.components.reduce(
    (acc, comp) => ({
      carb_g:      acc.carb_g      + scaledMacro(comp.food_item, comp.qty_g, "carb_g"),
      protein_g:   acc.protein_g   + scaledMacro(comp.food_item, comp.qty_g, "protein_g"),
      fat_g:       acc.fat_g       + scaledMacro(comp.food_item, comp.qty_g, "fat_g"),
      energy_kcal: acc.energy_kcal + scaledMacro(comp.food_item, comp.qty_g, "energy_kcal"),
    }),
    { carb_g: 0, protein_g: 0, fat_g: 0, energy_kcal: 0 }
  );
}

function calcDayTotals(day: Day): DayTotals {
  return day.meals.reduce(
    (acc, meal) => {
      const t = calcMealTotals(meal);
      return {
        carb_g:      acc.carb_g      + t.carb_g,
        protein_g:   acc.protein_g   + t.protein_g,
        fat_g:       acc.fat_g       + t.fat_g,
        energy_kcal: acc.energy_kcal + t.energy_kcal,
      };
    },
    { carb_g: 0, protein_g: 0, fat_g: 0, energy_kcal: 0 }
  );
}

function fmtDayLabel(day: Day): string {
  if (!day.date) return `Day ${day.day_number}`;
  try { return new Date(day.date).toLocaleDateString("en-AU", { weekday: "long" }); }
  catch { return `Day ${day.day_number}`; }
}

function fmtDayDate(day: Day): string {
  if (!day.date) return "";
  try {
    return new Date(day.date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  } catch { return ""; }
}

function fmtPeriod(start: string, end: string): string {
  try {
    const s = new Date(start).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
    const e = new Date(end).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
    return `${s} – ${e}`;
  } catch { return `${start} – ${end}`; }
}

function fmtPublished(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  } catch { return iso; }
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// --- MealTable ---

interface MealTableProps {
  meal: Meal;
  t: Tokens;
  onFeedback: () => void;
}

function MealTable({ meal, t, onFeedback }: MealTableProps) {
  const mealTotals = calcMealTotals(meal);
  const sortedComponents = [...meal.components].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const mealHeading = meal.title
    ? `${capitalize(meal.meal_type)} — ${meal.title}`
    : capitalize(meal.meal_type);

  return (
    <div style={{ background: t.mealBg, border: `1px solid ${t.border}`, borderRadius: 14, overflow: "hidden" }}>
      {/* Meal header */}
      <div style={{ padding: "12px 12px 10px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, color: t.text, fontWeight: 700 }}>{mealHeading}</h3>
          {meal.note && (
            <div style={{ marginTop: 4, color: t.muted, fontSize: 12 }}>{meal.note}</div>
          )}
        </div>
        <button
          onClick={onFeedback}
          style={{
            fontSize: 12, padding: "7px 10px", borderRadius: 999,
            border: `1px solid ${t.feedbackBtnBorder}`,
            background: t.feedbackBtnBg,
            color: t.muted, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
          }}
        >
          Comment
        </button>
      </div>

      {/* Component table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {["Component", "Qty", "Unit", "C (g)", "P (g)", "F (g)", "kcal"].map((col, i) => (
                <th
                  key={col}
                  style={{
                    textAlign: i === 0 ? "left" : "right",
                    color: t.muted, fontWeight: 700, padding: "10px 12px",
                    borderTop: `1px solid ${t.border}`,
                    borderBottom: `1px solid ${t.border}`,
                    background: t.headerCellBg,
                    whiteSpace: "nowrap",
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedComponents.map((comp) => {
              const name = comp.food_item ? comp.food_item.food_name : comp.custom_name ?? "—";
              const hasFood = !!comp.food_item;
              const tdBase: React.CSSProperties = {
                padding: "10px 12px",
                borderBottom: `1px solid ${t.cellBorder}`,
                color: t.text,
                verticalAlign: "top",
              };
              return (
                <tr key={comp.id}>
                  <td style={tdBase}>{name}</td>
                  <td style={{ ...tdBase, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtQty(comp.qty_g)}</td>
                  <td style={{ ...tdBase, color: t.muted }}>g</td>
                  <td style={{ ...tdBase, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{hasFood ? scaledMacro(comp.food_item, comp.qty_g, "carb_g").toFixed(1) : "—"}</td>
                  <td style={{ ...tdBase, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{hasFood ? scaledMacro(comp.food_item, comp.qty_g, "protein_g").toFixed(1) : "—"}</td>
                  <td style={{ ...tdBase, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{hasFood ? scaledMacro(comp.food_item, comp.qty_g, "fat_g").toFixed(1) : "—"}</td>
                  <td style={{ ...tdBase, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{hasFood ? scaledMacro(comp.food_item, comp.qty_g, "energy_kcal").toFixed(0) : "—"}</td>
                </tr>
              );
            })}
            {/* Meal total row */}
            <tr>
              {[
                { content: <strong>Meal total</strong>, align: "left" as const },
                { content: null, align: "right" as const },
                { content: null, align: "right" as const },
                { content: <>{mealTotals.carb_g.toFixed(1)}</>, align: "right" as const },
                { content: <>{mealTotals.protein_g.toFixed(1)}</>, align: "right" as const },
                { content: <>{mealTotals.fat_g.toFixed(1)}</>, align: "right" as const },
                { content: <>{mealTotals.energy_kcal.toFixed(0)}</>, align: "right" as const },
              ].map((cell, i) => (
                <td
                  key={i}
                  style={{
                    padding: "10px 12px",
                    borderTop: `1px solid ${t.border}`,
                    background: t.totalRowBg,
                    fontWeight: 800, color: t.text,
                    textAlign: cell.align,
                    fontVariantNumeric: i > 2 ? "tabular-nums" : undefined,
                  }}
                >
                  {cell.content}
                </td>
              ))}
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
  t: Tokens;
  onToggle: () => void;
  onFeedback: (meal: Meal) => void;
}

function DayCard({ day, isOpen, t, onToggle, onFeedback }: DayCardProps) {
  const dayTotals = calcDayTotals(day);
  const sortedMeals = [...day.meals].sort((a, b) => a.sort_order - b.sort_order);

  const carbKcal = dayTotals.carb_g * 4;
  const protKcal = dayTotals.protein_g * 4;
  const fatKcal  = dayTotals.fat_g * 9;
  const totalMacroKcal = carbKcal + protKcal + fatKcal;
  const carbPct = totalMacroKcal > 0 ? (carbKcal / totalMacroKcal) * 100 : 0;
  const protPct = totalMacroKcal > 0 ? (protKcal / totalMacroKcal) * 100 : 0;
  const fatPct  = totalMacroKcal > 0 ? (fatKcal  / totalMacroKcal) * 100 : 0;

  const dayLabel = fmtDayLabel(day);
  const dayDate  = fmtDayDate(day);

  return (
    <div style={{ borderTop: `1px solid ${t.border}`, padding: "14px 16px" }}>
      {/* Day header */}
      <div
        onClick={onToggle}
        role="button"
        aria-label={`Toggle Day ${day.day_number}`}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, cursor: "pointer", userSelect: "none" }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: t.text }}>
            Day {day.day_number}{dayLabel !== `Day ${day.day_number}` ? ` — ${dayLabel}` : ""}
          </span>
          {dayDate && <span style={{ color: t.muted, fontSize: 13 }}>{dayDate}</span>}
        </div>
        <div style={{
          width: 28, height: 28, borderRadius: 10, display: "grid", placeItems: "center",
          border: `1px solid ${t.border}`, background: t.chevBg, color: t.text, fontSize: 14, flexShrink: 0,
        }}>
          {isOpen ? "▾" : "▸"}
        </div>
      </div>

      {/* Day body */}
      {isOpen && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "grid", gap: 12 }}>
            {sortedMeals.map((meal) => (
              <MealTable key={meal.id} meal={meal} t={t} onFeedback={() => onFeedback(meal)} />
            ))}
          </div>

          {/* Day totals */}
          <div style={{ marginTop: 14, background: t.mealBg, border: `1px solid ${t.border}`, borderRadius: 14, padding: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="day-totals-grid">
              {/* Left: KPI + macro bar */}
              <div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {[
                    { label: "Total carbs",    value: `${dayTotals.carb_g.toFixed(1)}g` },
                    { label: "Total protein",  value: `${dayTotals.protein_g.toFixed(1)}g` },
                    { label: "Total fat",      value: `${dayTotals.fat_g.toFixed(1)}g` },
                    { label: "Total calories", value: Math.round(dayTotals.energy_kcal).toLocaleString() },
                  ].map((kpi) => (
                    <div key={kpi.label} style={{ flex: 1, minWidth: 100, border: `1px solid ${t.border}`, background: t.kpiBoxBg, borderRadius: 14, padding: "10px 10px" }}>
                      <div style={{ color: t.muted, fontSize: 12 }}>{kpi.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4, color: t.text }}>{kpi.value}</div>
                    </div>
                  ))}
                </div>

                {/* Macro split bar */}
                <div style={{ marginTop: 12, border: `1px solid ${t.macroBorder}`, background: t.macroBg, borderRadius: 14, padding: 12 }}>
                  <h4 style={{ margin: "0 0 10px", fontSize: 13, color: t.muted, fontWeight: 600 }}>
                    Macro split (calories) — stacked bar
                  </h4>
                  <div style={{
                    height: 14, borderRadius: 999, overflow: "hidden", display: "flex",
                    border: `1px solid ${t.stackBarBorder}`, background: t.stackBarBg,
                  }} aria-label="Macro split stacked bar">
                    <div style={{ width: `${carbPct}%`, height: "100%", background: `linear-gradient(90deg, rgba(74,222,128,.95), rgba(74,222,128,.55))` }} />
                    <div style={{ width: `${protPct}%`, height: "100%", background: `linear-gradient(90deg, rgba(59,130,246,.95), rgba(59,130,246,.55))` }} />
                    <div style={{ width: `${fatPct}%`,  height: "100%", background: `linear-gradient(90deg, rgba(255,179,74,.95), rgba(255,179,74,.55))` }} />
                  </div>

                  {/* Legend */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
                    {[
                      { key: "carb", color: CARB_COLOR, label: "Carbs",   g: dayTotals.carb_g,    kcal: carbKcal, pct: carbPct },
                      { key: "prot", color: PROT_COLOR, label: "Protein", g: dayTotals.protein_g, kcal: protKcal, pct: protPct },
                      { key: "fat",  color: FAT_COLOR,  label: "Fat",     g: dayTotals.fat_g,     kcal: fatKcal,  pct: fatPct  },
                    ].map((m) => (
                      <div key={m.key} style={{
                        border: `1px solid ${t.legendCardBorder}`, background: t.legendCardBg,
                        borderRadius: 14, padding: 10,
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 10, height: 10, borderRadius: "50%", background: m.color, flexShrink: 0, opacity: 0.9 }} />
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 13, color: t.text }}>{m.label}</div>
                            <div style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>{m.g.toFixed(1)}g • {Math.round(m.kcal)} kcal</div>
                          </div>
                        </div>
                        <div style={{ fontVariantNumeric: "tabular-nums", textAlign: "right", fontWeight: 800, fontSize: 13, color: t.text }}>
                          {m.pct.toFixed(0)}%
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 10, color: t.muted2, fontSize: 12, lineHeight: 1.45 }}>
                    Minor differences can occur due to rounding and source energy values.
                  </div>
                </div>
              </div>

              {/* Right: energy balance callout */}
              <div>
                <div style={{
                  border: "1px solid rgba(255,179,74,0.25)", background: "rgba(255,179,74,0.08)",
                  padding: 12, borderRadius: 14, color: t.muted, fontSize: 13, lineHeight: 1.5,
                }}>
                  <strong style={{ color: t.text }}>Energy balance note</strong><br />
                  Fat loss occurs when <strong style={{ color: t.text }}>calories out</strong> exceeds{" "}
                  <strong style={{ color: t.text }}>calories in</strong>.
                  <div style={{ height: 1, background: t.border, margin: "12px 0" }} />
                  <div style={{ color: t.muted2, fontSize: 12, lineHeight: 1.45 }}>
                    Real-world changes vary with glycogen, water, sodium, and adherence.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 680px) { .day-totals-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}

// --- Theme toggle button ---

function ThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  const t = getTokens(dark);
  return (
    <button
      onClick={onToggle}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 36, height: 36, borderRadius: 999, flexShrink: 0,
        border: `1px solid ${t.border}`, background: t.pillBg,
        color: t.text, cursor: "pointer", transition: "opacity .15s",
      }}
    >
      {dark ? (
        // Sun icon
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1"  x2="12" y2="3"  />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22"   x2="5.64"  y2="5.64"  />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1"  y1="12" x2="3"  y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36" />
          <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"  />
        </svg>
      ) : (
        // Moon icon
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
        </svg>
      )}
    </button>
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
  const [dark, setDark] = useState(true);
  const t = getTokens(dark);

  const sortedDays = [...plan.days].sort((a, b) => a.day_number - b.day_number);
  const firstDayId = sortedDays[0]?.id ?? "";
  const [expandedDays, setExpandedDays] = useState<Set<string>>(
    new Set(firstDayId ? [firstDayId] : [])
  );

  function toggleDay(dayId: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      next.has(dayId) ? next.delete(dayId) : next.add(dayId);
      return next;
    });
  }

  function openGeneralFeedback() {
    onFeedback({ id: "", meal_type: "general", title: "General", sort_order: 0, components: [] });
  }

  const planNotes =
    plan.notes?.trim() ||
    "Hydration 2–3L/day. Keep steps consistent. Use swap options if appetite or schedule changes.";

  return (
    <div style={{
      background: t.pageBg, minHeight: "100vh", padding: "0 0 64px",
      color: t.text,
      fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      transition: "background .25s, color .25s",
    }}>
      {/* Inner wrap — matches Engine_Nutrition .wrap */}
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 18px 0" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        padding: "18px 18px",
        background: t.cardBg,
        border: `1px solid ${t.border}`,
        borderRadius: 18,
        boxShadow: t.cardShadow,
        backdropFilter: "blur(12px)",
        flexWrap: "wrap",
        position: "sticky", top: 14, zIndex: 10,
      }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, flexShrink: 0,
            background: "linear-gradient(135deg, rgba(255,179,74,0.4), rgba(59,130,246,0.4))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, boxShadow: "0 10px 30px rgba(0,0,0,.25)",
          }}>
            🥗
          </div>
          <div>
            <div style={{ fontWeight: 800, letterSpacing: 0.2, fontSize: 16, lineHeight: 1.1, color: t.text }}>
              Engine Nutrition
            </div>
            <div style={{ color: t.muted, fontSize: 13, marginTop: 3 }}>
              A meal plan just for you
            </div>
          </div>
        </div>

        {/* Pills + toggle + feedback button */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
          {clientName && (
            <div style={{ padding: "10px 12px", border: `1px solid ${t.border}`, background: t.pillBg, borderRadius: 999, color: t.muted, fontSize: 13, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
              <span>Client</span>
              <strong style={{ color: t.text, fontWeight: 700 }}>{clientName}</strong>
            </div>
          )}
          <div style={{ padding: "10px 12px", border: `1px solid ${t.border}`, background: t.pillBg, borderRadius: 999, color: t.muted, fontSize: 13, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
            <span>Period</span>
            <strong style={{ color: t.text, fontWeight: 700 }}>{fmtPeriod(plan.start_date, plan.end_date)}</strong>
          </div>
          {goal && (
            <div style={{ padding: "10px 12px", border: `1px solid ${t.border}`, background: t.pillBg, borderRadius: 999, color: t.muted, fontSize: 13, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
              <span>Goal</span>
              <strong style={{ color: t.text, fontWeight: 700 }}>{goal}</strong>
            </div>
          )}
          <ThemeToggle dark={dark} onToggle={() => setDark((d) => !d)} />
          <button
            onClick={openGeneralFeedback}
            style={{
              border: `1px solid ${AMBER}55`,
              background: `linear-gradient(180deg, ${AMBER}33, ${AMBER}1a)`,
              color: t.text, padding: "10px 14px", borderRadius: 999,
              fontWeight: 700, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap",
            }}
          >
            Give feedback
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1.4fr 0.6fr", gap: 16 }} className="nutrition-main-grid">

        {/* LEFT: Plan card */}
        <section style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 18, boxShadow: t.cardShadow, overflow: "hidden" }}>
          <div style={{ padding: "16px 16px 12px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, letterSpacing: 0.2, color: t.text, fontWeight: 700 }}>Meal plan</h2>
              <div style={{ marginTop: 4, color: t.muted, fontSize: 13 }}>
                Clean components • Automatic macros • Coach-approved changes
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center", color: t.muted, fontSize: 13 }}>
              {plan.version != null && (
                <span style={{ padding: "6px 10px", borderRadius: 999, border: `1px solid ${t.border}`, background: t.pillBg, fontFamily: "ui-monospace, monospace", fontSize: 12, color: t.muted }}>
                  Version: <strong style={{ color: t.text }}>v{plan.version}</strong>
                </span>
              )}
              <span style={{ padding: "6px 10px", borderRadius: 999, border: `1px solid ${t.border}`, background: t.pillBg, fontSize: 12, color: t.muted }}>
                Published: <strong style={{ color: t.text }}>{fmtPublished(plan.published_at)}</strong>
              </span>
            </div>
          </div>

          {sortedDays.map((day) => (
            <DayCard
              key={day.id}
              day={day}
              t={t}
              isOpen={expandedDays.has(day.id)}
              onToggle={() => toggleDay(day.id)}
              onFeedback={onFeedback}
            />
          ))}
        </section>

        {/* RIGHT: Notes rail */}
        <aside style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <section style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 18, boxShadow: t.cardShadow, padding: 14 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 14, color: t.text, fontWeight: 700 }}>Plan notes</h3>
            <p style={{ margin: 0, color: t.muted, fontSize: 13, lineHeight: 1.5 }}>{planNotes}</p>
          </section>

          <section style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 18, boxShadow: t.cardShadow, padding: 14 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 14, color: t.text, fontWeight: 700 }}>How to request changes</h3>
            <p style={{ margin: 0, color: t.muted, fontSize: 13, lineHeight: 1.5 }}>
              Tap <strong style={{ color: t.text }}>Give feedback</strong>. Select the meal. Describe what you want changed. Your coach will review and publish an updated version.
            </p>
            <div style={{ marginTop: 10, border: "1px solid rgba(255,179,74,0.25)", background: "rgba(255,179,74,0.08)", padding: 12, borderRadius: 14, color: t.muted, fontSize: 13, lineHeight: 1.5 }}>
              <strong style={{ color: t.text }}>Example</strong><br />
              &ldquo;Swap chicken for beef at lunch. Keep calories similar.&rdquo;
            </div>
          </section>

          <section style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 18, boxShadow: t.cardShadow, padding: 14 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 14, color: t.text, fontWeight: 700 }}>Coach approval</h3>
            <p style={{ margin: 0, color: t.muted, fontSize: 13, lineHeight: 1.5 }}>
              AI can draft substitutions. Your coach confirms before any changes are deployed.
            </p>
          </section>
        </aside>
      </div>

      <style>{`
        @media (max-width: 980px) { .nutrition-main-grid { grid-template-columns: 1fr !important; } }
      `}</style>
      </div>{/* /inner wrap */}
    </div>
  );
}
