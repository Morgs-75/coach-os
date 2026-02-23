"use client";

import { useRouter } from "next/navigation";
import { clsx } from "clsx";

interface Props {
  from: string;
  to: string;
}

function today() {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA");
}

function startOfWeek(offset = 0) {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday
  d.setDate(d.getDate() + diff + offset * 7);
  return d.toLocaleDateString("en-CA");
}

function startOfMonth(offset = 0) {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offset, 1).toLocaleDateString("en-CA");
}

function endOfMonth(offset = 0) {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offset + 1, 0).toLocaleDateString("en-CA");
}

const PRESETS = [
  { label: "Today", from: () => today(), to: () => today() },
  { label: "This Week", from: () => startOfWeek(0), to: () => addDays(startOfWeek(0), 6) },
  { label: "Next Week", from: () => startOfWeek(1), to: () => addDays(startOfWeek(1), 6) },
  { label: "This Month", from: () => startOfMonth(0), to: () => endOfMonth(0) },
  { label: "Next Month", from: () => startOfMonth(1), to: () => endOfMonth(1) },
  { label: "Next 30 Days", from: () => today(), to: () => addDays(today(), 29) },
];

export default function DashboardDateFilter({ from, to }: Props) {
  const router = useRouter();

  const push = (f: string, t: string) => {
    router.push(`/dashboard?from=${f}&to=${t}`);
  };

  const activePreset = PRESETS.find(p => p.from() === from && p.to() === to)?.label;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Preset buttons */}
        <div className="flex flex-wrap gap-1">
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => push(p.from(), p.to())}
              className={clsx(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                activePreset === p.label
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs text-gray-400">From</span>
          <input
            type="date"
            value={from}
            onChange={e => push(e.target.value, to)}
            className="text-xs border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-blue-400"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={e => push(from, e.target.value)}
            className="text-xs border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-blue-400"
          />
        </div>
      </div>
    </div>
  );
}
