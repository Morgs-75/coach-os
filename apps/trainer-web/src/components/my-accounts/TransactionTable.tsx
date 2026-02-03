"use client";

import { formatCurrency, formatDate } from "@/lib/utils";
import { clsx } from "clsx";
import type { BankTransactionWithRelations, ChartOfAccount } from "@coach-os/shared";
import { AISuggestionBadge } from "./AISuggestionBadge";
import { PlatformMatchBadge } from "./PlatformMatchBadge";
import { AccountPicker } from "./AccountPicker";

interface TransactionTableProps {
  transactions: BankTransactionWithRelations[];
  accounts: ChartOfAccount[];
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectOne: (id: string, checked: boolean) => void;
  onEdit: (transaction: BankTransactionWithRelations) => void;
  onQuickCode: (transactionId: string, accountId: string) => void;
}

export function TransactionTable({
  transactions,
  accounts,
  selectedIds,
  onSelectAll,
  onSelectOne,
  onEdit,
  onQuickCode,
}: TransactionTableProps) {
  const allSelected = transactions.length > 0 && selectedIds.size === transactions.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < transactions.length;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Description
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Category
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Amount
              </th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transactions.map((tx) => (
              <TransactionRow
                key={tx.id}
                transaction={tx}
                accounts={accounts}
                isSelected={selectedIds.has(tx.id)}
                onSelect={(checked) => onSelectOne(tx.id, checked)}
                onEdit={() => onEdit(tx)}
                onQuickCode={(accountId) => onQuickCode(tx.id, accountId)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface TransactionRowProps {
  transaction: BankTransactionWithRelations;
  accounts: ChartOfAccount[];
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onEdit: () => void;
  onQuickCode: (accountId: string) => void;
}

function TransactionRow({
  transaction: tx,
  accounts,
  isSelected,
  onSelect,
  onEdit,
  onQuickCode,
}: TransactionRowProps) {
  const statusColors = {
    uncoded: "bg-amber-50",
    ai_suggested: "bg-blue-50",
    coded: "bg-white",
    excluded: "bg-gray-50",
  };

  return (
    <tr
      className={clsx(
        "hover:bg-gray-50 transition-colors",
        statusColors[tx.status]
      )}
    >
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelect(e.target.checked)}
          className="rounded border-gray-300"
        />
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
        {formatDate(tx.transaction_date)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 truncate">
              {tx.merchant_name || tx.description}
            </p>
            {tx.merchant_name && tx.description !== tx.merchant_name && (
              <p className="text-xs text-gray-500 truncate">{tx.description}</p>
            )}
          </div>
          {tx.matched_money_event_id && (
            <PlatformMatchBadge matchType={tx.match_type} />
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        {tx.status === "coded" && tx.account ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
            {tx.account.name}
          </span>
        ) : tx.status === "ai_suggested" && tx.ai_suggested_account ? (
          <div className="flex items-center gap-2">
            <AISuggestionBadge
              confidence={tx.ai_confidence || 0}
              reasoning={tx.ai_reasoning}
              accountName={tx.ai_suggested_account.name}
            />
            <button
              onClick={() => onQuickCode(tx.ai_suggested_account_id!)}
              className="text-xs text-brand-600 hover:text-brand-700 font-medium"
            >
              Use
            </button>
          </div>
        ) : tx.status === "excluded" ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
            Excluded
          </span>
        ) : (
          <AccountPicker
            accounts={accounts}
            value=""
            onChange={onQuickCode}
            placeholder="Select category..."
            compact
          />
        )}
      </td>
      <td
        className={clsx(
          "px-4 py-3 text-sm font-medium text-right whitespace-nowrap",
          tx.direction === "credit" ? "text-green-600" : "text-gray-900"
        )}
      >
        {tx.direction === "credit" ? "+" : "-"}
        {formatCurrency(tx.amount_cents)}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={onEdit}
          className="text-gray-400 hover:text-gray-600"
          title="Edit transaction"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </td>
    </tr>
  );
}
