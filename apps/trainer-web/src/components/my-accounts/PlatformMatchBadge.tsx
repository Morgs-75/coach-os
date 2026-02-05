"use client";

import { clsx } from "clsx";

interface PlatformMatchBadgeProps {
  matchType: string | null;
}

export function PlatformMatchBadge({ matchType }: PlatformMatchBadgeProps) {
  if (!matchType) return null;

  const config = {
    exact: {
      label: "Matched",
      color: "bg-purple-100 text-purple-800",
      icon: "✓",
    },
    fuzzy: {
      label: "Likely Match",
      color: "bg-purple-50 text-purple-700",
      icon: "~",
    },
    aggregated: {
      label: "Aggregated",
      color: "bg-indigo-100 text-indigo-800",
      icon: "Σ",
    },
  }[matchType] || {
    label: "Matched",
    color: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
    icon: "•",
  };

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium",
        config.color
      )}
      title={`${matchType === "exact" ? "Exact match" : matchType === "fuzzy" ? "Fuzzy match (amount & date)" : "Aggregated payout"} with platform payment`}
    >
      <span>{config.icon}</span>
      <span>Platform</span>
    </span>
  );
}
