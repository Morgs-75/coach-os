"use client";

import { useState } from "react";
import { formatCurrencyLedger } from "@/lib/utils";
import { LedgerTable } from "@/components/my-accounts/LedgerTable";
import { TransactionCodingModal } from "@/components/my-accounts/TransactionCodingModal";
import Link from "next/link";
import { clsx } from "clsx";
import type { CashbookLedger, ChartOfAccount } from "@/types";

type ViewMode = "chronological" | "by-account";

type LedgerEntry = CashbookLedger & { running_balance: number };

interface LedgerClientProps {
  entries: LedgerEntry[];
  accounts: ChartOfAccount[];
  totalDebits: number;
  totalCredits: number;
}

export function LedgerClient({ entries, accounts, totalDebits, totalCredits }: LedgerClientProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("chronological");
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null);
  const [localEntries, setLocalEntries] = useState(entries);

  // Convert ledger entry to transaction format for the modal
  const entryToTransaction = (entry: LedgerEntry) => ({
    id: entry.id,
    org_id: entry.org_id || "mock",
    bank_account_id: "ba-001",
    basiq_transaction_id: "",
    transaction_date: entry.transaction_date,
    post_date: null,
    description: entry.description,
    merchant_name: entry.merchant_name || null,
    merchant_category: null,
    reference: null,
    amount_cents: entry.amount_cents,
    direction: entry.direction,
    status: (entry.status || "coded") as "coded",
    is_split: false,
    account_id: accounts.find(a => a.code === entry.account_code)?.id || null,
    account: accounts.find(a => a.code === entry.account_code) || null,
    tax_treatment: "gst" as const,
    gst_cents: entry.gst_cents,
    notes: entry.notes || null,
    coded_at: new Date().toISOString(),
    coded_by: null,
    ai_suggested_account_id: null,
    ai_suggested_account: null,
    ai_confidence: null,
    ai_reasoning: null,
    matched_money_event_id: entry.matched_money_event_id || null,
    match_type: entry.match_type || null,
    bank_account: { id: "ba-001", account_name: entry.bank_account_name, institution_name: "Bank" },
    splits: undefined,
    created_at: new Date().toISOString(),
  });

  const handleSaveTransaction = async (
    transactionId: string,
    accountId: string,
    taxTreatment?: string,
    notes?: string
  ) => {
    // Update local state
    const updatedAccount = accounts.find(a => a.id === accountId);
    if (updatedAccount) {
      setLocalEntries(prev => prev.map(entry =>
        entry.id === transactionId
          ? {
              ...entry,
              account_code: updatedAccount.code,
              account_name: updatedAccount.name,
              tax_treatment: taxTreatment || "gst",
              gst_cents: taxTreatment === "gst" ? Math.round(entry.amount_cents / 11) : 0,
            }
          : entry
      ));
    }
    setEditingEntry(null);
  };

  // Group entries by account
  const entriesByAccount = localEntries.reduce((acc, entry) => {
    const key = entry.account_code;
    if (!acc[key]) {
      acc[key] = {
        code: entry.account_code,
        name: entry.account_name,
        entries: [],
        totalDebits: 0,
        totalCredits: 0,
      };
    }
    acc[key].entries.push(entry);
    if (entry.direction === "debit") {
      acc[key].totalDebits += entry.amount_cents;
    } else {
      acc[key].totalCredits += entry.amount_cents;
    }
    return acc;
  }, {} as Record<string, { code: string; name: string; entries: LedgerEntry[]; totalDebits: number; totalCredits: number }>);

  // Sort accounts alphabetically by name
  const sortedAccounts = Object.values(entriesByAccount).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setViewMode("chronological")}
            className={clsx(
              "px-3 py-1.5 text-sm rounded-md transition-colors",
              viewMode === "chronological"
                ? "bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-gray-100"
                : "text-gray-600 dark:text-gray-400"
            )}
          >
            Chronological
          </button>
          <button
            onClick={() => setViewMode("by-account")}
            className={clsx(
              "px-3 py-1.5 text-sm rounded-md transition-colors",
              viewMode === "by-account"
                ? "bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-gray-100"
                : "text-gray-600 dark:text-gray-400"
            )}
          >
            By Account
          </button>
        </div>

        <div className="text-sm text-gray-500 dark:text-gray-400">
          {localEntries.length} entries
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-6">
        <div className="card p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Debits</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{formatCurrencyLedger(totalDebits)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Credits</p>
          <p className="text-2xl font-semibold text-green-600">{formatCurrencyLedger(totalCredits)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Net Movement</p>
          <p className={clsx(
            "text-2xl font-semibold",
            totalCredits - totalDebits >= 0 ? "text-green-600" : "text-red-600"
          )}>
            {formatCurrencyLedger(totalCredits - totalDebits)}
          </p>
        </div>
      </div>

      {/* Ledger Display */}
      {localEntries.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            No ledger entries found. Code your transactions to see them here.
          </p>
          <Link href="/my-accounts/transactions" className="btn-primary">
            Go to Transactions
          </Link>
        </div>
      ) : viewMode === "chronological" ? (
        <LedgerTable entries={localEntries} onEdit={setEditingEntry} />
      ) : (
        /* By Account View */
        <div className="space-y-6">
          {sortedAccounts.map((account) => (
            <div key={account.code} className="card overflow-hidden">
              {/* Account Header */}
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    {account.code} - {account.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {account.entries.length} transaction{account.entries.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Debits: <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrencyLedger(account.totalDebits)}</span>
                    {" | "}
                    Credits: <span className="font-medium text-green-600">{formatCurrencyLedger(account.totalCredits)}</span>
                  </p>
                  <p className={clsx(
                    "text-lg font-semibold",
                    account.totalCredits - account.totalDebits >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    Net: {formatCurrencyLedger(account.totalCredits - account.totalDebits)}
                  </p>
                </div>
              </div>

              {/* Account Transactions Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full" style={{ fontSize: "9pt" }}>
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                      <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Date</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Description</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">Debit</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">Credit</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">GST</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {account.entries
                      .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
                      .map((entry) => (
                        <tr
                          key={entry.id}
                          onClick={() => setEditingEntry(entry)}
                          className="hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer"
                        >
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100 whitespace-nowrap">
                            {new Date(entry.transaction_date).toLocaleDateString("en-AU", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                            <span className="hover:text-blue-600 hover:underline">{entry.description}</span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">
                            {entry.direction === "debit" ? formatCurrencyLedger(entry.amount_cents) : "-"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-green-600">
                            {entry.direction === "credit" ? formatCurrencyLedger(entry.amount_cents) : "-"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">
                            {entry.gst_cents > 0 ? formatCurrencyLedger(entry.gst_cents) : "-"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 dark:bg-gray-800 font-semibold">
                      <td colSpan={2} className="px-3 py-2 text-gray-900 dark:text-gray-100">
                        Account Total
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">
                        {formatCurrencyLedger(account.totalDebits)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-green-600">
                        {formatCurrencyLedger(account.totalCredits)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">
                        {formatCurrencyLedger(account.entries.reduce((sum, e) => sum + e.gst_cents, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editingEntry && (
        <TransactionCodingModal
          transaction={entryToTransaction(editingEntry) as any}
          accounts={accounts as any}
          onSave={handleSaveTransaction}
          onClose={() => setEditingEntry(null)}
        />
      )}
    </div>
  );
}
