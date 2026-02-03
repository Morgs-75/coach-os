"use client";

import { useState } from "react";
import { clsx } from "clsx";

interface AISuggestionBadgeProps {
  confidence: number;
  reasoning: string | null;
  accountName: string;
}

export function AISuggestionBadge({
  confidence,
  reasoning,
  accountName,
}: AISuggestionBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const confidencePercent = Math.round(confidence * 100);
  const confidenceLevel =
    confidence >= 0.85 ? "high" : confidence >= 0.6 ? "medium" : "low";

  const colors = {
    high: "bg-green-100 text-green-800 border-green-200",
    medium: "bg-blue-100 text-blue-800 border-blue-200",
    low: "bg-amber-100 text-amber-800 border-amber-200",
  };

  return (
    <div className="relative">
      <button
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={clsx(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border",
          colors[confidenceLevel]
        )}
      >
        <span>🤖</span>
        <span>{accountName}</span>
        <span className="opacity-75">({confidencePercent}%)</span>
      </button>

      {showTooltip && reasoning && (
        <div className="absolute z-50 bottom-full left-0 mb-1 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg">
          <p className="font-medium mb-1">AI Reasoning:</p>
          <p>{reasoning}</p>
          <div
            className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"
          />
        </div>
      )}
    </div>
  );
}
