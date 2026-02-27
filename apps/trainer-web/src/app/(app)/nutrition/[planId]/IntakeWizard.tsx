"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface IntakeData {
  // Step: goals
  primary_goal: "fat_loss" | "muscle_gain" | "recomposition" | "maintenance" | "performance";
  current_weight_kg: number;
  target_weight_kg: number;
  timeframe_weeks: number;
  goal_priority: "aggressive" | "moderate" | "gentle";

  // Step: energy expenditure
  tdee_known: boolean;
  tdee_kcal?: number;
  // TDEE subflow (when tdee_known=false)
  sex?: "male" | "female";
  age?: number;
  height_cm?: number;
  activity_level?: "sedentary" | "light" | "moderate" | "active" | "very_active";
  training_type?: string;
  daily_steps?: number;
  // Computed
  calculated_tdee?: number;
  target_calories: number;

  // Step: diet preferences
  diet_style: string;
  likes_foods: string;
  dislikes_foods: string;
  allergies: string;
  texture_prefs: string;
  spice_level: "none" | "mild" | "medium" | "hot";

  // Step: schedule
  meals_per_day: number;
  timing_pattern: string;
  wake_time: string;
  bed_time: string;
  training_days: string;

  // Step: cooking logistics
  cooking_skill: "beginner" | "intermediate" | "advanced";
  cooking_time_min: number;
  meal_prep: boolean;
  equipment: string;
  budget_per_day_aud: number;

  // Step: plan structure
  plan_length_days: 3 | 5 | 7 | 14;
  repeat_meals_ok: boolean;
  include_snacks: boolean;
  eating_out_per_week: number;
  grocery_list: boolean;

  // Step: constraints & health
  medical_conditions: string;
  supplements: string;
  alcohol_per_week: number;

  // Step: verification
  biggest_challenge: string;
  non_negotiables: string;
}

interface IntakeWizardProps {
  planId: string;
  clientId: string | null;
  onClose: () => void;
  onGenerated: () => void;
}

// ─── TDEE Calculation ────────────────────────────────────────────────────────

function calcBMR(sex: string, weight_kg: number, height_cm: number, age: number): number {
  if (sex === "male") return 10 * weight_kg + 6.25 * height_cm - 5 * age + 5;
  return 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;
}

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

function calcTDEE(data: Partial<IntakeData>): number {
  const { sex, current_weight_kg, height_cm, age, activity_level } = data;
  if (!sex || !current_weight_kg || !height_cm || !age || !activity_level) return 0;
  const bmr = calcBMR(sex, current_weight_kg, height_cm, age);
  return Math.round(bmr * (ACTIVITY_MULTIPLIERS[activity_level] ?? 1.55));
}

function calcTargetCalories(data: Partial<IntakeData>): number {
  const tdee = data.tdee_known ? (data.tdee_kcal ?? 0) : (data.calculated_tdee ?? 0);
  if (!tdee) return 2000;
  const weightChange = (data.target_weight_kg ?? 0) - (data.current_weight_kg ?? 0);
  const weeks = data.timeframe_weeks ?? 12;
  const dailyDelta = (weightChange * 7700) / (weeks * 7);
  const target = tdee - dailyDelta;
  const minKcal = data.sex === "female" ? 1200 : 1500;
  return Math.round(Math.max(minKcal, target));
}

// ─── Shared UI atoms ─────────────────────────────────────────────────────────

const inputCls =
  "w-full px-3 py-2.5 border border-gray-200 dark:border-white/15 rounded-xl text-sm bg-white dark:bg-white/[0.04] text-gray-800 dark:text-[#eef0ff] placeholder-gray-400 dark:placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-[#ffb34a]";

const selectCls = inputCls;

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[12px] text-gray-500 dark:text-[rgba(238,240,255,0.55)] mb-1.5 font-medium">
      {children}
    </label>
  );
}

function FieldGroup({ children, cols = 1 }: { children: React.ReactNode; cols?: 1 | 2 }) {
  return (
    <div className={cols === 2 ? "grid grid-cols-2 gap-3" : "space-y-3"}>
      {children}
    </div>
  );
}

function OptionButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-3 py-2 rounded-xl border text-sm font-medium transition-colors text-left " +
        (active
          ? "border-brand-500 dark:border-[#ffb34a] bg-brand-50 dark:bg-[rgba(255,179,74,0.12)] text-brand-700 dark:text-[#ffb34a]"
          : "border-gray-200 dark:border-white/15 text-gray-600 dark:text-[rgba(238,240,255,0.7)] hover:border-gray-300 dark:hover:border-white/25")
      }
    >
      {children}
    </button>
  );
}

// ─── Step components ──────────────────────────────────────────────────────────

function StepConsent({ onAccept }: { onAccept: () => void }) {
  const [checked, setChecked] = useState(false);
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-[rgba(238,240,255,0.7)] leading-relaxed">
        This wizard collects health and lifestyle information to generate a personalised
        meal plan using AI. The information is used only for plan generation and is stored
        on this plan record.
      </p>
      <div className="bg-amber-50 dark:bg-[rgba(255,179,74,0.08)] border border-amber-200 dark:border-[rgba(255,179,74,0.25)] rounded-xl p-3 text-sm text-amber-700 dark:text-[#ffb34a]">
        <strong>Important:</strong> Calorie and macro targets are estimates only. Always
        consider the client&apos;s medical history and consult a registered dietitian for
        clinical nutrition advice.
      </div>
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-white/20 accent-brand-600"
        />
        <span className="text-sm text-gray-700 dark:text-[rgba(238,240,255,0.85)]">
          I understand this generates an AI estimate, not clinical nutrition advice, and
          I&apos;ve confirmed this is appropriate for my client.
        </span>
      </label>
      <button
        onClick={onAccept}
        disabled={!checked}
        className="w-full bg-brand-600 dark:bg-[rgba(255,179,74,0.2)] dark:border dark:border-[rgba(255,179,74,0.4)] text-white dark:text-[#ffb34a] py-2.5 rounded-xl text-sm font-bold hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Continue
      </button>
    </div>
  );
}

function StepGoals({
  data,
  onChange,
}: {
  data: Partial<IntakeData>;
  onChange: (d: Partial<IntakeData>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Primary goal</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["fat_loss", "muscle_gain", "recomposition", "maintenance", "performance"] as const).map((g) => (
            <OptionButton
              key={g}
              active={data.primary_goal === g}
              onClick={() => onChange({ primary_goal: g })}
            >
              {{ fat_loss: "Fat loss", muscle_gain: "Muscle gain", recomposition: "Recomposition", maintenance: "Maintenance", performance: "Performance" }[g]}
            </OptionButton>
          ))}
        </div>
      </div>
      <FieldGroup cols={2}>
        <div>
          <Label>Current weight (kg)</Label>
          <input
            type="number"
            min="30"
            max="300"
            step="0.5"
            value={data.current_weight_kg ?? ""}
            onChange={(e) => onChange({ current_weight_kg: Number(e.target.value) })}
            className={inputCls}
            placeholder="e.g. 85"
          />
        </div>
        <div>
          <Label>Target weight (kg)</Label>
          <input
            type="number"
            min="30"
            max="300"
            step="0.5"
            value={data.target_weight_kg ?? ""}
            onChange={(e) => onChange({ target_weight_kg: Number(e.target.value) })}
            className={inputCls}
            placeholder="e.g. 78"
          />
        </div>
      </FieldGroup>
      <FieldGroup cols={2}>
        <div>
          <Label>Timeframe (weeks)</Label>
          <input
            type="number"
            min="2"
            max="52"
            value={data.timeframe_weeks ?? ""}
            onChange={(e) => onChange({ timeframe_weeks: Number(e.target.value) })}
            className={inputCls}
            placeholder="e.g. 12"
          />
        </div>
        <div>
          <Label>Approach</Label>
          <select
            value={data.goal_priority ?? "moderate"}
            onChange={(e) => onChange({ goal_priority: e.target.value as IntakeData["goal_priority"] })}
            className={selectCls}
          >
            <option value="gentle">Gentle — slow & sustainable</option>
            <option value="moderate">Moderate — steady progress</option>
            <option value="aggressive">Aggressive — faster results</option>
          </select>
        </div>
      </FieldGroup>
    </div>
  );
}

function StepEnergy({
  data,
  onChange,
}: {
  data: Partial<IntakeData>;
  onChange: (d: Partial<IntakeData>) => void;
}) {
  const estimatedTDEE = data.tdee_known ? null : calcTDEE(data);
  const targetKcal = calcTargetCalories({ ...data, calculated_tdee: estimatedTDEE ?? undefined });

  return (
    <div className="space-y-4">
      <div>
        <Label>Do you know the client&apos;s TDEE?</Label>
        <div className="flex gap-2">
          <OptionButton active={data.tdee_known === true} onClick={() => onChange({ tdee_known: true })}>
            Yes — I&apos;ll enter it
          </OptionButton>
          <OptionButton active={data.tdee_known === false} onClick={() => onChange({ tdee_known: false })}>
            No — estimate it
          </OptionButton>
        </div>
      </div>

      {data.tdee_known === true && (
        <div>
          <Label>Known TDEE (kcal/day)</Label>
          <input
            type="number"
            min="1000"
            max="8000"
            step="50"
            value={data.tdee_kcal ?? ""}
            onChange={(e) => onChange({ tdee_kcal: Number(e.target.value) })}
            className={inputCls}
            placeholder="e.g. 2400"
          />
        </div>
      )}

      {data.tdee_known === false && (
        <div className="space-y-3">
          <FieldGroup cols={2}>
            <div>
              <Label>Sex</Label>
              <select
                value={data.sex ?? ""}
                onChange={(e) => onChange({ sex: e.target.value as IntakeData["sex"] })}
                className={selectCls}
              >
                <option value="">Select…</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div>
              <Label>Age</Label>
              <input
                type="number"
                min="16"
                max="100"
                value={data.age ?? ""}
                onChange={(e) => onChange({ age: Number(e.target.value) })}
                className={inputCls}
                placeholder="e.g. 32"
              />
            </div>
          </FieldGroup>
          <div>
            <Label>Height (cm)</Label>
            <input
              type="number"
              min="100"
              max="250"
              value={data.height_cm ?? ""}
              onChange={(e) => onChange({ height_cm: Number(e.target.value) })}
              className={inputCls}
              placeholder="e.g. 175"
            />
          </div>
          <div>
            <Label>Activity level</Label>
            <select
              value={data.activity_level ?? ""}
              onChange={(e) => onChange({ activity_level: e.target.value as IntakeData["activity_level"] })}
              className={selectCls}
            >
              <option value="">Select…</option>
              <option value="sedentary">Sedentary — desk job, little exercise</option>
              <option value="light">Light — 1–3 sessions/week</option>
              <option value="moderate">Moderate — 3–5 sessions/week</option>
              <option value="active">Active — hard training 6–7 days</option>
              <option value="very_active">Very active — physical job + training</option>
            </select>
          </div>
          <FieldGroup cols={2}>
            <div>
              <Label>Training type</Label>
              <input
                type="text"
                value={data.training_type ?? ""}
                onChange={(e) => onChange({ training_type: e.target.value })}
                className={inputCls}
                placeholder="e.g. weights + cardio"
              />
            </div>
            <div>
              <Label>Daily steps (approx.)</Label>
              <input
                type="number"
                min="0"
                max="30000"
                step="500"
                value={data.daily_steps ?? ""}
                onChange={(e) => onChange({ daily_steps: Number(e.target.value) })}
                className={inputCls}
                placeholder="e.g. 8000"
              />
            </div>
          </FieldGroup>
          {estimatedTDEE !== null && estimatedTDEE > 0 && (
            <div className="bg-brand-50 dark:bg-[rgba(255,179,74,0.08)] border border-brand-200 dark:border-[rgba(255,179,74,0.25)] rounded-xl px-3 py-2.5 text-sm">
              <span className="text-gray-500 dark:text-[rgba(238,240,255,0.55)]">Estimated TDEE: </span>
              <span className="font-bold text-brand-700 dark:text-[#ffb34a]">{estimatedTDEE} kcal/day</span>
            </div>
          )}
        </div>
      )}

      {targetKcal > 0 && (
        <div className="bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm">
          <span className="text-gray-500 dark:text-[rgba(238,240,255,0.55)]">Target calories: </span>
          <span className="font-bold text-gray-900 dark:text-[#eef0ff]">{targetKcal} kcal/day</span>
          <span className="text-gray-400 dark:text-[rgba(238,240,255,0.4)] ml-2 text-[11px]">(guardrail-adjusted)</span>
        </div>
      )}
    </div>
  );
}

// ─── Food checkbox grid ───────────────────────────────────────────────────────

const FOOD_CATEGORIES = [
  { label: "Proteins", items: ["Chicken breast", "Beef mince", "Salmon", "Tuna", "Eggs", "Greek yoghurt", "Tofu"] },
  { label: "Carbs", items: ["Oats", "White rice", "Sweet potato", "Potato", "Wholegrain bread", "Banana"] },
  { label: "Vegetables", items: ["Broccoli", "Spinach", "Mixed salad", "Capsicum", "Carrot", "Zucchini"] },
  { label: "Fruits", items: ["Apple", "Orange", "Berries", "Mango"] },
  { label: "Dairy & Fats", items: ["Skim milk", "Cheese", "Avocado", "Almonds", "Peanut butter"] },
];

function parseItems(s: string): string[] {
  return s ? s.split(",").map((x) => x.trim()).filter(Boolean) : [];
}

function FoodCheckboxGrid({
  value,
  onChange,
  accent = "green",
}: {
  value: string;
  onChange: (val: string) => void;
  accent?: "green" | "red";
}) {
  const selected = parseItems(value);
  const activeCls =
    accent === "green"
      ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
      : "border-red-400 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400";
  const inactiveCls =
    "border-gray-200 dark:border-white/10 text-gray-500 dark:text-[rgba(238,240,255,0.55)] hover:border-gray-300 dark:hover:border-white/20";

  function toggle(item: string) {
    const next = selected.includes(item)
      ? selected.filter((x) => x !== item)
      : [...selected, item];
    onChange(next.join(", "));
  }

  return (
    <div className="space-y-2.5">
      {FOOD_CATEGORIES.map((cat) => (
        <div key={cat.label}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-[rgba(238,240,255,0.35)] mb-1.5">
            {cat.label}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {cat.items.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => toggle(item)}
                className={
                  "px-2.5 py-1 rounded-lg border text-[12px] font-medium transition-colors " +
                  (selected.includes(item) ? activeCls : inactiveCls)
                }
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StepDietPreferences({
  data,
  onChange,
}: {
  data: Partial<IntakeData>;
  onChange: (d: Partial<IntakeData>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Diet style</Label>
        <div className="grid grid-cols-2 gap-2">
          {["Omnivore", "Vegetarian", "Vegan", "Pescatarian", "Keto / low carb", "Paleo", "Gluten-free", "Other"].map((s) => (
            <OptionButton
              key={s}
              active={data.diet_style === s}
              onClick={() => onChange({ diet_style: s })}
            >
              {s}
            </OptionButton>
          ))}
        </div>
      </div>
      <div>
        <Label>Foods the client enjoys</Label>
        <FoodCheckboxGrid
          value={data.likes_foods ?? ""}
          onChange={(val) => onChange({ likes_foods: val })}
          accent="green"
        />
      </div>
      <div>
        <Label>Foods to avoid</Label>
        <FoodCheckboxGrid
          value={data.dislikes_foods ?? ""}
          onChange={(val) => onChange({ dislikes_foods: val })}
          accent="red"
        />
      </div>
      <div>
        <Label>Allergies or intolerances</Label>
        <input
          type="text"
          value={data.allergies ?? ""}
          onChange={(e) => onChange({ allergies: e.target.value })}
          className={inputCls}
          placeholder="e.g. lactose, gluten, nuts — or none"
        />
      </div>
      <FieldGroup cols={2}>
        <div>
          <Label>Texture preferences</Label>
          <input
            type="text"
            value={data.texture_prefs ?? ""}
            onChange={(e) => onChange({ texture_prefs: e.target.value })}
            className={inputCls}
            placeholder="e.g. no mushy foods"
          />
        </div>
        <div>
          <Label>Spice tolerance</Label>
          <select
            value={data.spice_level ?? "mild"}
            onChange={(e) => onChange({ spice_level: e.target.value as IntakeData["spice_level"] })}
            className={selectCls}
          >
            <option value="none">None — no spice</option>
            <option value="mild">Mild</option>
            <option value="medium">Medium</option>
            <option value="hot">Hot</option>
          </select>
        </div>
      </FieldGroup>
    </div>
  );
}

function StepSchedule({
  data,
  onChange,
}: {
  data: Partial<IntakeData>;
  onChange: (d: Partial<IntakeData>) => void;
}) {
  return (
    <div className="space-y-4">
      <FieldGroup cols={2}>
        <div>
          <Label>Meals per day</Label>
          <select
            value={data.meals_per_day ?? 4}
            onChange={(e) => onChange({ meals_per_day: Number(e.target.value) })}
            className={selectCls}
          >
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n} meals</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Eating pattern</Label>
          <select
            value={data.timing_pattern ?? ""}
            onChange={(e) => onChange({ timing_pattern: e.target.value })}
            className={selectCls}
          >
            <option value="">Select…</option>
            <option value="standard">Standard (3 meals + snacks)</option>
            <option value="intermittent_16_8">Intermittent fasting 16:8</option>
            <option value="intermittent_18_6">Intermittent fasting 18:6</option>
            <option value="2_meals">2 large meals</option>
            <option value="grazing">Grazing (frequent small meals)</option>
          </select>
        </div>
      </FieldGroup>
      <FieldGroup cols={2}>
        <div>
          <Label>Usual wake time</Label>
          <input
            type="time"
            value={data.wake_time ?? "06:30"}
            onChange={(e) => onChange({ wake_time: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <Label>Usual bed time</Label>
          <input
            type="time"
            value={data.bed_time ?? "22:30"}
            onChange={(e) => onChange({ bed_time: e.target.value })}
            className={inputCls}
          />
        </div>
      </FieldGroup>
      <div>
        <Label>Training days</Label>
        <div className="flex gap-1.5">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => {
            const selected = parseItems(data.training_days ?? "").includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => {
                  const days = parseItems(data.training_days ?? "");
                  const next = selected
                    ? days.filter((d) => d !== day)
                    : [...days, day];
                  // preserve Mon–Sun order
                  const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
                  onChange({ training_days: order.filter((d) => next.includes(d)).join(", ") });
                }}
                className={
                  "flex-1 py-2 rounded-xl border text-[12px] font-semibold transition-colors " +
                  (selected
                    ? "border-brand-500 dark:border-[#ffb34a] bg-brand-50 dark:bg-[rgba(255,179,74,0.12)] text-brand-700 dark:text-[#ffb34a]"
                    : "border-gray-200 dark:border-white/15 text-gray-500 dark:text-[rgba(238,240,255,0.55)] hover:border-gray-300 dark:hover:border-white/25")
                }
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StepCooking({
  data,
  onChange,
}: {
  data: Partial<IntakeData>;
  onChange: (d: Partial<IntakeData>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Cooking skill</Label>
        <div className="flex gap-2">
          {(["beginner", "intermediate", "advanced"] as const).map((s) => (
            <OptionButton
              key={s}
              active={data.cooking_skill === s}
              onClick={() => onChange({ cooking_skill: s })}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </OptionButton>
          ))}
        </div>
      </div>
      <FieldGroup cols={2}>
        <div>
          <Label>Max cook time per meal (min)</Label>
          <select
            value={data.cooking_time_min ?? 30}
            onChange={(e) => onChange({ cooking_time_min: Number(e.target.value) })}
            className={selectCls}
          >
            <option value={10}>Under 10 min</option>
            <option value={20}>Under 20 min</option>
            <option value={30}>Under 30 min</option>
            <option value={45}>Under 45 min</option>
            <option value={60}>Up to 1 hour</option>
          </select>
        </div>
        <div>
          <Label>Daily food budget (AUD)</Label>
          <select
            value={data.budget_per_day_aud ?? 20}
            onChange={(e) => onChange({ budget_per_day_aud: Number(e.target.value) })}
            className={selectCls}
          >
            <option value={10}>Under $10</option>
            <option value={15}>Under $15</option>
            <option value={20}>Under $20</option>
            <option value={30}>Under $30</option>
            <option value={50}>$30+</option>
          </select>
        </div>
      </FieldGroup>
      <div>
        <Label>Available equipment</Label>
        <div className="flex flex-wrap gap-1.5">
          {["Stovetop", "Oven", "Microwave", "Air fryer", "Slow cooker", "Rice cooker", "Blender", "BBQ"].map((item) => {
            const selected = parseItems(data.equipment ?? "").includes(item);
            return (
              <button
                key={item}
                type="button"
                onClick={() => {
                  const current = parseItems(data.equipment ?? "");
                  const next = selected ? current.filter((x) => x !== item) : [...current, item];
                  onChange({ equipment: next.join(", ") });
                }}
                className={
                  "px-2.5 py-1 rounded-lg border text-[12px] font-medium transition-colors " +
                  (selected
                    ? "border-brand-500 dark:border-[#ffb34a] bg-brand-50 dark:bg-[rgba(255,179,74,0.12)] text-brand-700 dark:text-[#ffb34a]"
                    : "border-gray-200 dark:border-white/15 text-gray-500 dark:text-[rgba(238,240,255,0.55)] hover:border-gray-300 dark:hover:border-white/25")
                }
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="mealPrep"
          checked={data.meal_prep ?? false}
          onChange={(e) => onChange({ meal_prep: e.target.checked })}
          className="w-4 h-4 rounded border-gray-300 accent-brand-600"
        />
        <label htmlFor="mealPrep" className="text-sm text-gray-700 dark:text-[rgba(238,240,255,0.85)] cursor-pointer">
          Client does batch meal prep (bulk cook on weekends)
        </label>
      </div>
    </div>
  );
}

function StepPlanStructure({
  data,
  onChange,
}: {
  data: Partial<IntakeData>;
  onChange: (d: Partial<IntakeData>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Plan length</Label>
        <div className="flex gap-2">
          {([3, 5, 7, 14] as const).map((n) => (
            <OptionButton
              key={n}
              active={data.plan_length_days === n}
              onClick={() => onChange({ plan_length_days: n })}
            >
              {n} days
            </OptionButton>
          ))}
        </div>
      </div>
      <FieldGroup cols={2}>
        <div>
          <Label>Eating out per week</Label>
          <select
            value={data.eating_out_per_week ?? 1}
            onChange={(e) => onChange({ eating_out_per_week: Number(e.target.value) })}
            className={selectCls}
          >
            <option value={0}>Never</option>
            <option value={1}>1 meal</option>
            <option value={2}>2 meals</option>
            <option value={3}>3+ meals</option>
          </select>
        </div>
        <div className="space-y-3 pt-1">
          {[
            { key: "repeat_meals_ok", label: "Repeat meals across days" },
            { key: "include_snacks", label: "Include snacks" },
            { key: "grocery_list", label: "Generate grocery list" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <input
                type="checkbox"
                id={key}
                checked={(data as Record<string, boolean>)[key] ?? false}
                onChange={(e) => onChange({ [key]: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 accent-brand-600"
              />
              <label htmlFor={key} className="text-sm text-gray-700 dark:text-[rgba(238,240,255,0.85)] cursor-pointer">
                {label}
              </label>
            </div>
          ))}
        </div>
      </FieldGroup>
    </div>
  );
}

function StepConstraints({
  data,
  onChange,
}: {
  data: Partial<IntakeData>;
  onChange: (d: Partial<IntakeData>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Medical conditions relevant to diet</Label>
        <input
          type="text"
          value={data.medical_conditions ?? ""}
          onChange={(e) => onChange({ medical_conditions: e.target.value })}
          className={inputCls}
          placeholder="e.g. type 2 diabetes, IBS, high cholesterol — or none"
        />
      </div>
      <div>
        <Label>Supplements currently taken</Label>
        <div className="flex flex-wrap gap-1.5">
          {["Protein powder", "Creatine", "Fish oil", "Multivitamin", "Magnesium", "Vitamin D", "Pre-workout", "BCAAs", "Collagen", "Probiotics"].map((item) => {
            const selected = parseItems(data.supplements ?? "").includes(item);
            return (
              <button
                key={item}
                type="button"
                onClick={() => {
                  const current = parseItems(data.supplements ?? "");
                  const next = selected ? current.filter((x) => x !== item) : [...current, item];
                  onChange({ supplements: next.join(", ") });
                }}
                className={
                  "px-2.5 py-1 rounded-lg border text-[12px] font-medium transition-colors " +
                  (selected
                    ? "border-brand-500 dark:border-[#ffb34a] bg-brand-50 dark:bg-[rgba(255,179,74,0.12)] text-brand-700 dark:text-[#ffb34a]"
                    : "border-gray-200 dark:border-white/15 text-gray-500 dark:text-[rgba(238,240,255,0.55)] hover:border-gray-300 dark:hover:border-white/25")
                }
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <Label>Alcoholic drinks per week (approx.)</Label>
        <select
          value={data.alcohol_per_week ?? 0}
          onChange={(e) => onChange({ alcohol_per_week: Number(e.target.value) })}
          className={selectCls}
        >
          <option value={0}>None</option>
          <option value={2}>1–2</option>
          <option value={5}>3–5</option>
          <option value={7}>6–7</option>
          <option value={14}>8+</option>
        </select>
      </div>
    </div>
  );
}

function StepVerification({
  data,
  onChange,
}: {
  data: Partial<IntakeData>;
  onChange: (d: Partial<IntakeData>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Client&apos;s biggest challenge with eating</Label>
        <input
          type="text"
          value={data.biggest_challenge ?? ""}
          onChange={(e) => onChange({ biggest_challenge: e.target.value })}
          className={inputCls}
          placeholder="e.g. skipping breakfast, late-night snacking, portion sizes"
        />
      </div>
      <div>
        <Label>Non-negotiables (must-haves or must-avoids)</Label>
        <input
          type="text"
          value={data.non_negotiables ?? ""}
          onChange={(e) => onChange({ non_negotiables: e.target.value })}
          className={inputCls}
          placeholder="e.g. must have coffee in the morning, no tofu ever"
        />
      </div>
    </div>
  );
}

// ─── Step config ──────────────────────────────────────────────────────────────

const STEPS = [
  { id: "consent", title: "Before we start" },
  { id: "goals", title: "Goals" },
  { id: "energy", title: "Energy needs" },
  { id: "diet", title: "Food preferences" },
  { id: "schedule", title: "Schedule" },
  { id: "cooking", title: "Cooking & budget" },
  { id: "structure", title: "Plan structure" },
  { id: "constraints", title: "Health & constraints" },
  { id: "verify", title: "Final check" },
];

// ─── Goal mapping for client pre-fill ────────────────────────────────────────

const CLIENT_GOAL_MAP: Record<string, IntakeData["primary_goal"]> = {
  "lose weight": "fat_loss",
  "weight loss": "fat_loss",
  "fat loss": "fat_loss",
  "build muscle": "muscle_gain",
  "muscle gain": "muscle_gain",
  "improve body composition": "recomposition",
  "body recomposition": "recomposition",
  "increase strength": "performance",
  "sports performance": "performance",
  "general fitness": "maintenance",
  "maintain weight": "maintenance",
};

function calcAgeFromDob(dob: string): number {
  const d = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export default function IntakeWizard({ planId, clientId, onClose, onGenerated }: IntakeWizardProps) {
  const supabase = createClient();
  const [step, setStep] = useState(0);
  const [prefilled, setPrefilled] = useState(false);
  const [restoredFromPlan, setRestoredFromPlan] = useState(false);
  const [data, setData] = useState<Partial<IntakeData>>({
    primary_goal: "fat_loss",
    timeframe_weeks: 12,
    goal_priority: "moderate",
    tdee_known: false,
    activity_level: "moderate",
    diet_style: "Omnivore",
    spice_level: "mild",
    meals_per_day: 4,
    timing_pattern: "standard",
    wake_time: "06:30",
    bed_time: "22:30",
    cooking_skill: "intermediate",
    cooking_time_min: 30,
    budget_per_day_aud: 20,
    meal_prep: false,
    plan_length_days: 7,
    repeat_meals_ok: true,
    include_snacks: true,
    eating_out_per_week: 1,
    grocery_list: false,
    alcohol_per_week: 0,
    likes_foods: "",
    dislikes_foods: "",
    allergies: "",
    texture_prefs: "",
    equipment: "",
    medical_conditions: "",
    supplements: "",
    training_days: "",
    biggest_challenge: "",
    non_negotiables: "",
  });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill on mount: plan intake_data wins over client profile
  useEffect(() => {
    async function load() {
      // 1. Try plan's saved intake_data first
      try {
        const planRes = await fetch(`/api/nutrition/plans/${planId}`);
        if (planRes.ok) {
          const { plan } = await planRes.json();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const saved = plan?.intake_data as Record<string, any> | null;
          if (saved && Object.keys(saved).length > 0) {
            setData((prev) => ({ ...prev, ...saved }));
            setPrefilled(true);
            setRestoredFromPlan(true);
            return; // skip client profile — plan data is already more complete
          }
        }
      } catch {
        // ignore — fall through to client profile
      }

      // 2. Fall back to client profile fields
      if (!clientId) return;
      const { data: c } = await supabase
        .from("clients")
        .select("gender, date_of_birth, weight_kg, height_cm, target_weight_kg, dietary_restrictions, health_conditions, goals")
        .eq("id", clientId)
        .single();
      if (!c) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = c as Record<string, any>;
      const patch: Partial<IntakeData> = {};
      if (p.gender === "male" || p.gender === "female") patch.sex = p.gender as "male" | "female";
      if (p.date_of_birth) patch.age = calcAgeFromDob(p.date_of_birth);
      if (p.weight_kg) patch.current_weight_kg = p.weight_kg;
      if (p.height_cm) patch.height_cm = p.height_cm;
      if (p.target_weight_kg) patch.target_weight_kg = p.target_weight_kg;
      if (p.dietary_restrictions?.length) patch.allergies = (p.dietary_restrictions as string[]).join(", ");
      if (p.health_conditions?.length) patch.medical_conditions = (p.health_conditions as string[]).join(", ");
      if (p.goals?.length) {
        const mapped = CLIENT_GOAL_MAP[(p.goals[0] as string).toLowerCase()];
        if (mapped) patch.primary_goal = mapped;
      }
      if (Object.keys(patch).length > 0) {
        setData((prev) => ({ ...prev, ...patch }));
        setPrefilled(true);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, clientId]);

  function patch(patch: Partial<IntakeData>) {
    setData((prev) => ({ ...prev, ...patch }));
  }

  // Recompute derived fields before submitting
  function buildFinalData(): IntakeData {
    const estimatedTDEE = data.tdee_known ? undefined : calcTDEE(data);
    const withTDEE = { ...data, calculated_tdee: estimatedTDEE };
    const target = calcTargetCalories(withTDEE);
    return {
      ...withTDEE,
      target_calories: target,
    } as IntakeData;
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    const finalData = buildFinalData();

    try {
      const res = await fetch(`/api/nutrition/plans/${planId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intake_data: finalData,
          plan_length_days: finalData.plan_length_days,
        }),
      });
      if (res.ok) {
        onGenerated();
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Generation failed");
      }
    } catch {
      setError("Generation failed — network error");
    } finally {
      setGenerating(false);
    }
  }

  const currentStep = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
  const estimatedTDEE = data.tdee_known ? undefined : calcTDEE(data);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#0b0d24] border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900 dark:text-[#eef0ff]">
                {currentStep.title}
              </h2>
              {prefilled && (
                <span className="text-[10px] bg-brand-50 dark:bg-[rgba(255,179,74,0.1)] text-brand-600 dark:text-[#ffb34a] border border-brand-100 dark:border-[rgba(255,179,74,0.25)] px-2 py-0.5 rounded-full font-medium">
                  {restoredFromPlan ? "Restored from last time" : "Profile pre-filled"}
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400 dark:text-[rgba(238,240,255,0.45)] mt-0.5">
              Step {step + 1} of {STEPS.length}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 border border-gray-100 dark:border-white/10 rounded-xl px-2.5 py-1.5 text-xs transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-100 dark:bg-white/5 flex-shrink-0">
          <div
            className="h-full bg-brand-500 dark:bg-[#ffb34a] transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {currentStep.id === "consent" && (
            <StepConsent onAccept={() => setStep(1)} />
          )}
          {currentStep.id === "goals" && (
            <StepGoals data={data} onChange={patch} />
          )}
          {currentStep.id === "energy" && (
            <StepEnergy
              data={{ ...data, calculated_tdee: estimatedTDEE }}
              onChange={patch}
            />
          )}
          {currentStep.id === "diet" && (
            <StepDietPreferences data={data} onChange={patch} />
          )}
          {currentStep.id === "schedule" && (
            <StepSchedule data={data} onChange={patch} />
          )}
          {currentStep.id === "cooking" && (
            <StepCooking data={data} onChange={patch} />
          )}
          {currentStep.id === "structure" && (
            <StepPlanStructure data={data} onChange={patch} />
          )}
          {currentStep.id === "constraints" && (
            <StepConstraints data={data} onChange={patch} />
          )}
          {currentStep.id === "verify" && (
            <>
              <StepVerification data={data} onChange={patch} />
              {/* Summary */}
              <div className="mt-4 bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/10 rounded-xl p-3 space-y-1 text-[12px] text-gray-500 dark:text-[rgba(238,240,255,0.55)]">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-[rgba(238,240,255,0.4)] mb-2">Plan summary</div>
                <div><span className="text-gray-700 dark:text-[rgba(238,240,255,0.8)]">Goal:</span> {data.primary_goal?.replace(/_/g, " ")}</div>
                <div><span className="text-gray-700 dark:text-[rgba(238,240,255,0.8)]">Target:</span> {buildFinalData().target_calories} kcal/day</div>
                <div><span className="text-gray-700 dark:text-[rgba(238,240,255,0.8)]">Plan:</span> {data.plan_length_days} days · {data.meals_per_day} meals/day</div>
                <div><span className="text-gray-700 dark:text-[rgba(238,240,255,0.8)]">Diet:</span> {data.diet_style}</div>
                {data.allergies && <div><span className="text-gray-700 dark:text-[rgba(238,240,255,0.8)]">Allergies:</span> {data.allergies}</div>}
              </div>
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-5 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-100 dark:border-red-900 text-sm text-red-600 dark:text-red-400 flex-shrink-0">
            {error}
          </div>
        )}

        {/* Footer nav — not shown on consent step (it has its own CTA) */}
        {currentStep.id !== "consent" && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 dark:border-white/10 flex-shrink-0">
            <button
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={isFirst || step === 1}
              className="px-4 py-2 rounded-xl text-sm border border-gray-200 dark:border-white/15 text-gray-600 dark:text-[rgba(238,240,255,0.7)] hover:bg-gray-50 dark:hover:bg-white/[0.04] disabled:opacity-40 transition-colors"
            >
              Back
            </button>
            {isLast ? (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="bg-brand-600 dark:bg-[rgba(255,179,74,0.2)] dark:border dark:border-[rgba(255,179,74,0.4)] text-white dark:text-[#ffb34a] px-5 py-2 rounded-xl text-sm font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {generating && (
                  <span className="w-3.5 h-3.5 border-2 border-current/40 border-t-current rounded-full animate-spin" />
                )}
                {generating ? "Generating…" : "Generate plan"}
              </button>
            ) : (
              <button
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                className="bg-brand-600 dark:bg-[rgba(255,179,74,0.2)] dark:border dark:border-[rgba(255,179,74,0.4)] text-white dark:text-[#ffb34a] px-5 py-2 rounded-xl text-sm font-bold hover:bg-brand-700 transition-colors"
              >
                Next
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
