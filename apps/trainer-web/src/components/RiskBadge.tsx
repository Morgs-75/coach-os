import { clsx } from "clsx";
import type { RiskTier } from "@/types";

interface RiskBadgeProps {
  tier: RiskTier | null | undefined;
  showLabel?: boolean;
}

const tierConfig = {
  green: { label: "Healthy", bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" },
  amber: { label: "At Risk", bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  red: { label: "High Risk", bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
};

export function RiskBadge({ tier, showLabel = true }: RiskBadgeProps) {
  if (!tier) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        {showLabel && "Unknown"}
      </span>
    );
  }

  const config = tierConfig[tier];

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
        config.bg,
        config.text
      )}
    >
      <span className={clsx("w-1.5 h-1.5 rounded-full", config.dot)} />
      {showLabel && config.label}
    </span>
  );
}
