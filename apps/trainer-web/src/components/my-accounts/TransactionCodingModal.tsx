"use client";

import { useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { BankTransactionWithRelations, ChartOfAccount } from "@/types";
import { AccountPicker } from "./AccountPicker";
import { PlatformMatchBadge } from "./PlatformMatchBadge";
import { clsx } from "clsx";

interface Split {
  id: string;
  accountId: string;
  amountCents: number;
  taxTreatment: string;
  description: string;
}

interface TransactionCodingModalProps {
  transaction: BankTransactionWithRelations;
  accounts: ChartOfAccount[];
  onSave: (
    transactionId: string,
    accountId: string,
    taxTreatment?: string,
    notes?: string,
    splits?: Split[],
    rememberRule?: { matchField: string; matchValue: string }
  ) => void;
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

  // Split transaction state - initialize from existing splits if present
  const existingSplits = transaction.splits?.map(s => ({
    id: s.id,
    accountId: s.account_id,
    amountCents: s.amount_cents,
    taxTreatment: s.tax_treatment,
    description: s.description || "",
  })) || [];
  const [isSplit, setIsSplit] = useState(existingSplits.length > 0);
  const [splits, setSplits] = useState<Split[]>(existingSplits);

  // Remember rule state
  const [rememberThis, setRememberThis] = useState(false);
  const [matchField, setMatchField] = useState<"merchant" | "description">("merchant");

  const selectedAccount = accounts.find((a) => a.id === accountId);

  // Calculate split totals
  const splitTotal = splits.reduce((sum, s) => sum + s.amountCents, 0);
  const remainingAmount = transaction.amount_cents - splitTotal;

  // Initialize splits for payment fee scenario
  function initializeFeeSplt() {
    const feePercent = 0.05; // 5% default
    const grossAmount = Math.round(transaction.amount_cents / (1 - feePercent));
    const feeAmount = grossAmount - transaction.amount_cents;

    // Find payment fees account
    const feeAccount = accounts.find(a =>
      a.name.toLowerCase().includes("payment") ||
      a.name.toLowerCase().includes("processing") ||
      a.name.toLowerCase().includes("bank fee") ||
      a.code === "EXP-007"
    );

    setSplits([
      {
        id: "split-1",
        accountId: accountId || "",
        amountCents: grossAmount,
        taxTreatment: "gst",
        description: "Gross revenue",
      },
      {
        id: "split-2",
        accountId: feeAccount?.id || "",
        amountCents: -feeAmount,
        taxTreatment: "gst_free",
        description: "Payment processing fee",
      },
    ]);
    setIsSplit(true);
  }

  function addSplit() {
    setSplits([
      ...splits,
      {
        id: `split-${Date.now()}`,
        accountId: "",
        amountCents: remainingAmount,
        taxTreatment: "gst",
        description: "",
      },
    ]);
  }

  function updateSplit(id: string, updates: Partial<Split>) {
    setSplits(splits.map(s => s.id === id ? { ...s, ...updates } : s));
  }

  function removeSplit(id: string) {
    setSplits(splits.filter(s => s.id !== id));
    if (splits.length <= 1) {
      setIsSplit(false);
    }
  }

  async function handleSave() {
    if (isSplit) {
      // Validate splits
      if (Math.abs(splitTotal - transaction.amount_cents) > 1) {
        alert("Split amounts must equal the transaction total");
        return;
      }
      if (splits.some(s => !s.accountId)) {
        alert("All splits must have a category selected");
        return;
      }
    } else if (!accountId) {
      return;
    }

    setSaving(true);

    const rememberRule = rememberThis ? {
      matchField,
      matchValue: matchField === "merchant"
        ? transaction.merchant_name || transaction.description
        : transaction.description,
    } : undefined;

    await onSave(
      transaction.id,
      isSplit ? splits[0].accountId : accountId,
      isSplit ? splits[0].taxTreatment : taxTreatment,
      notes,
      isSplit ? splits : undefined,
      rememberRule
    );
    setSaving(false);
  }

  async function handleExclude() {
    setSaving(true);
    const excludeAccount = accounts.find((a) => a.code === "OTH-003");
    if (excludeAccount) {
      await onSave(transaction.id, excludeAccount.id, "bas_excluded", notes);
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Code Transaction</h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:text-gray-500"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Transaction Details */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {transaction.merchant_name || transaction.description}
              </p>
              {transaction.merchant_name && (
                <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">{transaction.description}</p>
              )}
              <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
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
                  transaction.direction === "credit" ? "text-green-600" : "text-gray-900 dark:text-gray-100"
                )}
              >
                {transaction.direction === "credit" ? "+" : "-"}
                {formatCurrency(transaction.amount_cents)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
                {transaction.direction === "credit" ? "Money In" : "Money Out"}
              </p>
            </div>
          </div>
        </div>

        {/* AI Suggestion */}
        {transaction.ai_suggested_account && !isSplit && (
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
          {/* Split Toggle - available for all transactions */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Split Transaction</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {transaction.direction === "credit"
                  ? "Record gross revenue and payment fees separately"
                  : "Allocate to multiple categories (e.g., fuel + personal items)"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!isSplit && transaction.direction === "credit" && (
                <button
                  onClick={initializeFeeSplt}
                  className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                >
                  Add 5% Fee Split
                </button>
              )}
              <button
                onClick={() => {
                  if (isSplit) {
                    setIsSplit(false);
                    setSplits([]);
                  } else {
                    setIsSplit(true);
                    setSplits([{
                      id: "split-1",
                      accountId: accountId,
                      amountCents: transaction.amount_cents,
                      taxTreatment: taxTreatment,
                      description: "",
                    }]);
                  }
                }}
                className={clsx(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  isSplit ? "bg-brand-600" : "bg-gray-200"
                )}
              >
                <span
                  className={clsx(
                    "inline-block h-4 w-4 transform rounded-full bg-white dark:bg-gray-900 transition-transform",
                    isSplit ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>
          </div>

          {isSplit ? (
            /* Split Transaction UI */
            <div className="space-y-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Transaction Splits</p>

              {splits.map((split, index) => (
                <div key={split.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500">
                      Split {index + 1}
                    </span>
                    {splits.length > 1 && (
                      <button
                        onClick={() => removeSplit(split.id)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs">Category</label>
                      <AccountPicker
                        accounts={accounts}
                        value={split.accountId}
                        onChange={(id) => {
                          const account = accounts.find(a => a.id === id);
                          updateSplit(split.id, {
                            accountId: id,
                            taxTreatment: account?.tax_treatment || "gst"
                          });
                        }}
                        placeholder="Select category..."
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Amount</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 dark:text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={(split.amountCents / 100).toFixed(2)}
                          onChange={(e) => updateSplit(split.id, {
                            amountCents: Math.round(parseFloat(e.target.value || "0") * 100)
                          })}
                          className="input pl-7"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs">Tax Treatment</label>
                      <select
                        value={split.taxTreatment}
                        onChange={(e) => updateSplit(split.id, { taxTreatment: e.target.value })}
                        className="input text-sm"
                      >
                        <option value="gst">GST (10%)</option>
                        <option value="gst_free">GST Free</option>
                        <option value="bas_excluded">BAS Excluded</option>
                      </select>
                    </div>
                    <div>
                      <label className="label text-xs">Description (optional)</label>
                      <input
                        type="text"
                        value={split.description}
                        onChange={(e) => updateSplit(split.id, { description: e.target.value })}
                        className="input text-sm"
                        placeholder={transaction.direction === "credit" ? "e.g., Payment fee" : "e.g., Fuel, Snacks"}
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={addSplit}
                  className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                >
                  + Add Another Split
                </button>
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Total: </span>
                  <span className={clsx(
                    "font-medium",
                    Math.abs(splitTotal - transaction.amount_cents) <= 1
                      ? "text-green-600"
                      : "text-red-600"
                  )}>
                    {formatCurrency(splitTotal)}
                  </span>
                  <span className="text-gray-400 dark:text-gray-500"> / {formatCurrency(transaction.amount_cents)}</span>
                </div>
              </div>

              {Math.abs(splitTotal - transaction.amount_cents) > 1 && (
                <p className="text-sm text-red-600">
                  Splits must equal {formatCurrency(transaction.amount_cents)}
                  (difference: {formatCurrency(Math.abs(splitTotal - transaction.amount_cents))})
                </p>
              )}
            </div>
          ) : (
            /* Standard Single Category UI */
            <>
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
                  <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
                    GST: {formatCurrency(Math.round(transaction.amount_cents / 11))}
                  </p>
                )}
              </div>
            </>
          )}

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

          {/* Remember This Transaction */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberThis}
                onChange={(e) => setRememberThis(e.target.checked)}
                className="mt-0.5 rounded text-brand-600"
              />
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Remember this for future transactions</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Automatically code similar transactions the same way</p>
              </div>
            </label>

            {rememberThis && (
              <div className="mt-3 ml-6">
                <label className="label text-xs">Match by:</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="matchField"
                      value="merchant"
                      checked={matchField === "merchant"}
                      onChange={() => setMatchField("merchant")}
                      className="text-brand-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Merchant: <span className="font-medium">{transaction.merchant_name || transaction.description}</span>
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="matchField"
                      value="description"
                      checked={matchField === "description"}
                      onChange={() => setMatchField("description")}
                      className="text-brand-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Description pattern
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800">
          <button
            onClick={handleExclude}
            disabled={saving}
            className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 hover:text-gray-800"
          >
            Exclude from Reports
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={(!accountId && !isSplit) || saving || (isSplit && Math.abs(splitTotal - transaction.amount_cents) > 1)}
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
