"use client";

import type { ChartOfAccount } from "@coach-os/shared";
import { AccountPicker } from "./AccountPicker";

interface BulkCodingBarProps {
  selectedCount: number;
  accounts: ChartOfAccount[];
  onBulkCode: (accountId: string) => void;
  onAICategorize: () => void;
  onClearSelection: () => void;
}

export function BulkCodingBar({
  selectedCount,
  accounts,
  onBulkCode,
  onAICategorize,
  onClearSelection,
}: BulkCodingBarProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
      <div className="bg-gray-900 text-white rounded-lg shadow-xl px-6 py-4 flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="bg-brand-500 text-white text-sm font-bold px-2 py-0.5 rounded">
            {selectedCount}
          </span>
          <span className="text-gray-300">selected</span>
        </div>

        <div className="h-6 w-px bg-gray-700" />

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">Bulk code as:</span>
          <div className="w-48">
            <AccountPicker
              accounts={accounts}
              value=""
              onChange={onBulkCode}
              placeholder="Select category..."
              compact
            />
          </div>
        </div>

        <button
          onClick={onAICategorize}
          className="btn-secondary text-sm bg-white/10 border-white/20 hover:bg-white/20 text-white"
        >
          🤖 AI Categorize
        </button>

        <div className="h-6 w-px bg-gray-700" />

        <button
          onClick={onClearSelection}
          className="text-gray-400 hover:text-white text-sm"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
