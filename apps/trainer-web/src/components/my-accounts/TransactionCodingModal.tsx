"use client";

import { useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { BankTransactionWithRelations, ChartOfAccount } from "@coach-os/shared";
import { AccountPicker } from "./AccountPicker";
import { AISuggestionBadge } from "./AISuggestionBadge";
import { PlatformMatchBadge } from "./PlatformMatchBadge";
import { clsx } from "clsx";

interface TransactionCodingModalProps {
  transaction: BankTransactionWithRelations;
  accounts: ChartOfAccount[];
  onSave: (transactionId: string, accountId: string, taxTreatment?: string, notes?: string) => void;
  onClose: () => void;
}

export function TransactionCodingModal({
  transaction,
  accounts,
  onSave,
  onClose,
}: TransactionCodingModalProps) {
  const [accountId, setAccountId] = useState(transaction.account_id || "");
  const [taxTreatment, setTaxTreatment] = useState<string>(transaction.tax_treatment || "gst");
  const [notes, setNotes] = useState(transaction.notes || "");
  const [saving, setSaving] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === accountId);

  async function handleSave() {
    if (!accountId) return;
    setSaving(true);
    await onSave(transaction.id, accountId, taxTreatment, notes);
    setSaving(false);
  }

  async function handleExclude() {
    setSaving(true);
    // Find the "Personal / Exclude" account
    const excludeAccount = accounts.find((a) => a.code === "OTH-003");
    if (excludeAccount) {
      await onSave(transaction.id, excludeAccount.id, "bas_excluded", notes);
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Code Transaction</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Transaction Details */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium text-gray-900">
                {transaction.merchant_name || transaction.description}
              </p>
              {transaction.merchant_name && (
                <p className="text-sm text-gray-500">{transaction.description}</p>
              )}
              <p className="text-sm text-gray-500 mt-1">
                {formatDate(transaction.transaction_date)}
                {transaction.bank_account && (
                  <> &bull; {transaction.bank_account.account_name}</>
                )}
              </p>
              <div className="flex items-center gap-2 mt-2">
                {transaction.matched_money_event_id && (
                  <PlatformMatchBadge matchType={transaction.match_type} />
                )}
              </div>
            </div>
            <div className="text-right">
              <p
                className={clsx(
                  "text-2xl font-bold",
                  transaction.direction === "credit" ? "text-green-600" : "text-gray-900"
                )}
              >
                {transaction.direction === "credit" ? "+" : "-"}
                {formatCurrency(transaction.amount_cents)}
              </p>
              <p className="text-sm text-gray-500">
                {transaction.direction === "credit" ? "Money In" : "Money Out"}
              </p>
            </div>
          </div>
        </div>

        {/* AI Suggestion */}
        {transaction.ai_suggested_account && (
          <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-blue-600">🤖</span>
                <div>
                  <p className="font-medium text-blue-900">AI Suggestion</p>
                  <p className="text-sm text-blue-700">
                    {transaction.ai_suggested_account.name}
                    {transaction.ai_confidence && (
                      <span className="ml-2 text-blue-600">
                        ({Math.round(transaction.ai_confidence * 100)}% confident)
                      </span>
                    )}
                  </p>
                  {transaction.ai_reasoning && (
                    <p className="text-xs text-blue-600 mt-1">{transaction.ai_reasoning}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setAccountId(transaction.ai_suggested_account_id!);
                  const suggestedAccount = accounts.find(
                    (a) => a.id === transaction.ai_suggested_account_id
                  );
                  if (suggestedAccount) {
                    setTaxTreatment(suggestedAccount.tax_treatment);
                  }
                }}
                className="btn-primary"
              >
                Use Suggestion
              </button>
            </div>
          </div>
        )}

        {/* Coding Form */}
        <div className="px-6 py-6 space-y-4">
          <div>
            <label className="label">Category</label>
            <AccountPicker
              accounts={accounts}
              value={accountId}
              onChange={(id) => {
                setAccountId(id);
                const account = accounts.find((a) => a.id === id);
                if (account) {
                  setTaxTreatment(account.tax_treatment);
                }
              }}
              placeholder="Select a category..."
            />
          </div>

          <div>
            <label className="label">Tax Treatment</label>
            <select
              value={taxTreatment}
              onChange={(e) => setTaxTreatment(e.target.value)}
              className="input"
            >
              <option value="gst">GST (10%)</option>
              <option value="gst_free">GST Free</option>
              <option value="bas_excluded">BAS Excluded</option>
            </select>
            {taxTreatment === "gst" && (
              <p className="text-sm text-gray-500 mt-1">
                GST: {formatCurrency(Math.round(transaction.amount_cents / 11))}
              </p>
            )}
          </div>

          <div>
            <label className="label">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input"
              rows={2}
              placeholder="Add any notes about this transaction..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <button
            onClick={handleExclude}
            disabled={saving}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            Exclude from Reports
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!accountId || saving}
              className="btn-primary"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
