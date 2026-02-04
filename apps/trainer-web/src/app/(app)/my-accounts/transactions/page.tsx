"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TransactionTable } from "@/components/my-accounts/TransactionTable";
import { TransactionCodingModal } from "@/components/my-accounts/TransactionCodingModal";
import { BulkCodingBar } from "@/components/my-accounts/BulkCodingBar";
import type { BankTransactionWithRelations, ChartOfAccount } from "@coach-os/shared";
import { useSearchParams } from "next/navigation";

type FilterStatus = "all" | "uncoded" | "ai_suggested" | "coded" | "excluded";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<BankTransactionWithRelations[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingTransaction, setEditingTransaction] = useState<BankTransactionWithRelations | null>(null);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [bankAccountFilter, setBankAccountFilter] = useState<string>("all");
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const searchParams = useSearchParams();

  useEffect(() => {
    const statusParam = searchParams.get("status");
    if (statusParam && ["uncoded", "ai_suggested", "coded", "excluded"].includes(statusParam)) {
      setStatusFilter(statusParam as FilterStatus);
    }
  }, [searchParams]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load transactions
      let url = "/api/my-accounts/transactions?";
      if (statusFilter !== "all") url += `status=${statusFilter}&`;
      if (bankAccountFilter !== "all") url += `bank_account_id=${bankAccountFilter}&`;
      if (dateRange.start) url += `start_date=${dateRange.start}&`;
      if (dateRange.end) url += `end_date=${dateRange.end}&`;

      const txResponse = await fetch(url);
      const txData = await txResponse.json();
      setTransactions(txData.transactions || []);

      // Load chart of accounts
      const coaResponse = await fetch("/api/my-accounts/chart-of-accounts");
      const coaData = await coaResponse.json();
      setAccounts(coaData.accounts || []);

      // Load bank accounts
      const bankResponse = await fetch("/api/my-accounts/accounts");
      const bankData = await bankResponse.json();
      setBankAccounts(bankData.accounts || []);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, bankAccountFilter, dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSync() {
    setSyncing(true);
    try {
      await fetch("/api/my-accounts/sync", { method: "POST" });
      await loadData();
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setSyncing(false);
    }
  }

  async function handleCodeTransaction(
    transactionId: string,
    accountId: string,
    taxTreatment?: string,
    notes?: string,
    splits?: Array<{ id: string; accountId: string; amountCents: number; taxTreatment: string; description: string }>,
    rememberRule?: { matchField: string; matchValue: string }
  ) {
    try {
      const response = await fetch(`/api/my-accounts/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: accountId,
          tax_treatment: taxTreatment,
          notes,
          splits,
          remember_rule: rememberRule,
        }),
      });
      const data = await response.json();

      // In mock mode, update local state directly since data isn't persisted
      if (data._mock || response.ok) {
        const selectedAccount = accounts.find((a) => a.id === accountId);
        const status = selectedAccount?.code === "OTH-003" ? "excluded" : "coded";

        setTransactions((prev) =>
          prev.map((t) =>
            t.id === transactionId
              ? {
                  ...t,
                  account_id: accountId,
                  account: selectedAccount || null,
                  tax_treatment: taxTreatment || selectedAccount?.tax_treatment || "gst",
                  status,
                  notes: notes || t.notes,
                  coded_at: new Date().toISOString(),
                  splits: splits || undefined,
                }
              : t
          )
        );

        // If remember rule was set, show a brief confirmation
        if (rememberRule) {
          console.log("Created coding rule for:", rememberRule.matchValue);
        }
      }

      setEditingTransaction(null);
    } catch (error) {
      console.error("Failed to code transaction:", error);
    }
  }

  async function handleBulkCode(accountId: string) {
    try {
      const response = await fetch("/api/my-accounts/transactions/bulk-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_ids: Array.from(selectedIds),
          account_id: accountId,
        }),
      });
      const data = await response.json();

      // In mock mode, update local state directly
      if (data._mock || response.ok) {
        const selectedAccount = accounts.find((a) => a.id === accountId);
        const status = selectedAccount?.code === "OTH-003" ? "excluded" : "coded";

        setTransactions((prev) =>
          prev.map((t) =>
            selectedIds.has(t.id)
              ? {
                  ...t,
                  account_id: accountId,
                  account: selectedAccount || null,
                  tax_treatment: selectedAccount?.tax_treatment || "gst",
                  status,
                  coded_at: new Date().toISOString(),
                }
              : t
          )
        );
      }

      setSelectedIds(new Set());
    } catch (error) {
      console.error("Failed to bulk code:", error);
    }
  }

  async function handleAICategorize() {
    const uncoded = transactions.filter(
      (t) => selectedIds.has(t.id) && t.status === "uncoded"
    );

    if (uncoded.length === 0) return;

    try {
      const response = await fetch("/api/my-accounts/ai-categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions: uncoded.map((t) => ({
            transaction_id: t.id,
            description: t.description,
            merchant_name: t.merchant_name,
            amount_cents: t.amount_cents,
            direction: t.direction,
          })),
        }),
      });

      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      console.error("AI categorization failed:", error);
    }
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(transactions.map((t) => t.id)));
    } else {
      setSelectedIds(new Set());
    }
  }

  function handleSelectOne(id: string, checked: boolean) {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  }

  const counts = {
    all: transactions.length,
    uncoded: transactions.filter((t) => t.status === "uncoded").length,
    ai_suggested: transactions.filter((t) => t.status === "ai_suggested").length,
    coded: transactions.filter((t) => t.status === "coded").length,
    excluded: transactions.filter((t) => t.status === "excluded").length,
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
              className="input py-1.5 w-40"
            >
              <option value="all">All ({counts.all})</option>
              <option value="uncoded">Uncoded ({counts.uncoded})</option>
              <option value="ai_suggested">AI Suggested ({counts.ai_suggested})</option>
              <option value="coded">Coded ({counts.coded})</option>
              <option value="excluded">Excluded ({counts.excluded})</option>
            </select>
          </div>

          {/* Bank Account Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Account:</label>
            <select
              value={bankAccountFilter}
              onChange={(e) => setBankAccountFilter(e.target.value)}
              className="input py-1.5 w-48"
            >
              <option value="all">All Accounts</option>
              {bankAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.account_name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">From:</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="input py-1.5"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">To:</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="input py-1.5"
            />
          </div>

          <div className="flex-1" />

          {/* Sync Button */}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn-secondary"
          >
            {syncing ? "Syncing..." : "Sync Now"}
          </button>
        </div>
      </div>

      {/* Transaction Table */}
      {loading ? (
        <div className="card p-12 text-center text-gray-500">
          Loading transactions...
        </div>
      ) : transactions.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-500 mb-4">No transactions found</p>
          <button onClick={handleSync} className="btn-primary">
            Sync Transactions
          </button>
        </div>
      ) : (
        <TransactionTable
          transactions={transactions}
          accounts={accounts}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          onSelectOne={handleSelectOne}
          onEdit={setEditingTransaction}
          onQuickCode={handleCodeTransaction}
        />
      )}

      {/* Bulk Coding Bar */}
      {selectedIds.size > 0 && (
        <BulkCodingBar
          selectedCount={selectedIds.size}
          accounts={accounts}
          onBulkCode={handleBulkCode}
          onAICategorize={handleAICategorize}
          onClearSelection={() => setSelectedIds(new Set())}
        />
      )}

      {/* Coding Modal */}
      {editingTransaction && (
        <TransactionCodingModal
          transaction={editingTransaction}
          accounts={accounts}
          onSave={handleCodeTransaction}
          onClose={() => setEditingTransaction(null)}
        />
      )}
    </div>
  );
}
