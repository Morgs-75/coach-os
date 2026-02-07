"use client";

import { useState, useEffect } from "react";
import { formatCurrencyLedger } from "@/lib/utils";
import { clsx } from "clsx";
import { TransactionCodingModal } from "@/components/my-accounts/TransactionCodingModal";
import type { BankTransactionWithRelations, ChartOfAccount } from "@/types";

type IssueSeverity = "high" | "medium" | "low";

interface AuditIssue {
  id: string;
  transaction_id: string;
  transaction_date: string;
  description: string;
  amount_cents: number;
  current_account: string;
  current_tax_treatment: string;
  issue_type: string;
  severity: IssueSeverity;
  message: string;
  suggestion: string;
  suggested_account_id?: string;
  suggested_account_name?: string;
  suggested_tax_treatment?: string;
  confidence: number;
}

interface AuditSummary {
  total_issues: number;
  high_severity: number;
  medium_severity: number;
  low_severity: number;
  potential_tax_impact: number;
}

export default function AuditPage() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [issues, setIssues] = useState<AuditIssue[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [lastAudit, setLastAudit] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | IssueSeverity>("all");
  const [processing, setProcessing] = useState<string | null>(null);

  // Transaction modal state
  const [transactions, setTransactions] = useState<BankTransactionWithRelations[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<BankTransactionWithRelations | null>(null);
  const [loadingTransaction, setLoadingTransaction] = useState<string | null>(null);

  useEffect(() => {
    loadAudit();
    loadTransactionsAndAccounts();
  }, []);

  async function loadTransactionsAndAccounts() {
    try {
      const [txResponse, coaResponse] = await Promise.all([
        fetch("/api/my-accounts/transactions"),
        fetch("/api/my-accounts/chart-of-accounts"),
      ]);
      const [txData, coaData] = await Promise.all([
        txResponse.json(),
        coaResponse.json(),
      ]);
      setTransactions(txData.transactions || []);
      setAccounts(coaData.accounts || []);
    } catch (error) {
      console.error("Failed to load transactions:", error);
    }
  }

  async function handleViewTransaction(transactionId: string) {
    setLoadingTransaction(transactionId);

    // Find the transaction in the loaded data
    let txn = transactions.find(t => t.id === transactionId);

    // If not found, try fetching fresh data
    if (!txn) {
      try {
        const response = await fetch("/api/my-accounts/transactions");
        const data = await response.json();
        setTransactions(data.transactions || []);
        txn = (data.transactions || []).find((t: BankTransactionWithRelations) => t.id === transactionId);
      } catch (error) {
        console.error("Failed to fetch transaction:", error);
      }
    }

    if (txn) {
      setEditingTransaction(txn);
    }
    setLoadingTransaction(null);
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

      if (response.ok) {
        // Update local transaction state
        const selectedAccount = accounts.find((a) => a.id === accountId);
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === transactionId
              ? {
                  ...t,
                  account_id: accountId,
                  account: selectedAccount,
                  tax_treatment: (taxTreatment || selectedAccount?.tax_treatment || "gst") as "gst" | "gst_free" | "bas_excluded",
                  status: selectedAccount?.code === "OTH-003" ? "excluded" : "coded",
                  coded_at: new Date().toISOString(),
                }
              : t
          )
        );

        // Remove the related issue from the audit list
        const relatedIssue = issues.find(i => i.transaction_id === transactionId);
        if (relatedIssue) {
          setIssues(prev => prev.filter(i => i.transaction_id !== transactionId));
          if (summary) {
            setSummary({
              ...summary,
              total_issues: summary.total_issues - 1,
              high_severity: summary.high_severity - (relatedIssue.severity === "high" ? 1 : 0),
              medium_severity: summary.medium_severity - (relatedIssue.severity === "medium" ? 1 : 0),
              low_severity: summary.low_severity - (relatedIssue.severity === "low" ? 1 : 0),
            });
          }
        }
      }

      setEditingTransaction(null);
    } catch (error) {
      console.error("Failed to code transaction:", error);
    }
  }

  async function loadAudit() {
    setLoading(true);
    try {
      const response = await fetch("/api/my-accounts/audit");
      const data = await response.json();
      setIssues(data.issues || []);
      setSummary(data.summary || null);
      setLastAudit(data.last_audit || null);
    } catch (error) {
      console.error("Failed to load audit:", error);
    }
    setLoading(false);
  }

  async function runNewAudit() {
    setRunning(true);
    // Simulate audit running
    await new Promise(resolve => setTimeout(resolve, 2000));
    await loadAudit();
    setRunning(false);
  }

  async function handleAction(issueId: string, action: "accept_suggestion" | "dismiss") {
    setProcessing(issueId);
    try {
      const issue = issues.find(i => i.id === issueId);
      await fetch("/api/my-accounts/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          issue_id: issueId,
          transaction_id: issue?.transaction_id,
        }),
      });

      // Remove the issue from the list
      setIssues(prev => prev.filter(i => i.id !== issueId));
      if (summary) {
        const removedIssue = issues.find(i => i.id === issueId);
        if (removedIssue) {
          setSummary({
            ...summary,
            total_issues: summary.total_issues - 1,
            high_severity: summary.high_severity - (removedIssue.severity === "high" ? 1 : 0),
            medium_severity: summary.medium_severity - (removedIssue.severity === "medium" ? 1 : 0),
            low_severity: summary.low_severity - (removedIssue.severity === "low" ? 1 : 0),
          });
        }
      }
    } catch (error) {
      console.error("Failed to process action:", error);
    }
    setProcessing(null);
  }

  const filteredIssues = filter === "all"
    ? issues
    : issues.filter(i => i.severity === filter);

  const severityColors = {
    high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    medium: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  };

  const issueTypeLabels: Record<string, string> = {
    wrong_category: "Wrong Category",
    wrong_tax_treatment: "Tax Treatment Error",
    duplicate_suspected: "Possible Duplicate",
    unusual_amount: "Unusual Amount",
    inconsistent_coding: "Inconsistent Coding",
    personal_as_business: "Personal or Business?",
    missing_gst: "Missing GST",
    split_recommended: "Split Recommended",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading audit results...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            myAccountant - AI Audit
          </h1>
          {lastAudit && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Last audit: {new Date(lastAudit).toLocaleString("en-AU")}
            </p>
          )}
        </div>
        <button
          onClick={runNewAudit}
          disabled={running}
          className="btn-primary flex items-center gap-2"
        >
          {running ? (
            <>
              <span className="animate-spin">⟳</span>
              Running Audit...
            </>
          ) : (
            <>
              <span>🔍</span>
              Run New Audit
            </>
          )}
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="card p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Issues</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {summary.total_issues}
            </p>
          </div>
          <div className="card p-4 border-l-4 border-red-500">
            <p className="text-sm text-gray-500 dark:text-gray-400">High Priority</p>
            <p className="text-2xl font-bold text-red-600">{summary.high_severity}</p>
          </div>
          <div className="card p-4 border-l-4 border-amber-500">
            <p className="text-sm text-gray-500 dark:text-gray-400">Medium</p>
            <p className="text-2xl font-bold text-amber-600">{summary.medium_severity}</p>
          </div>
          <div className="card p-4 border-l-4 border-blue-500">
            <p className="text-sm text-gray-500 dark:text-gray-400">Low</p>
            <p className="text-2xl font-bold text-blue-600">{summary.low_severity}</p>
          </div>
          <div className="card p-4 bg-red-50 dark:bg-red-950">
            <p className="text-sm text-gray-500 dark:text-gray-400">Potential Tax Impact</p>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrencyLedger(summary.potential_tax_impact)}
            </p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter:</span>
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {(["all", "high", "medium", "low"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                "px-3 py-1.5 text-sm rounded-md transition-colors capitalize",
                filter === f
                  ? "bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-gray-100"
                  : "text-gray-600 dark:text-gray-400"
              )}
            >
              {f === "all" ? `All (${issues.length})` : f}
            </button>
          ))}
        </div>
      </div>

      {/* Issues List */}
      {filteredIssues.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-4">✅</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No Issues Found
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {issues.length === 0
              ? "Your books look clean! Run an audit to check for any issues."
              : "No issues match the current filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredIssues.map((issue) => (
            <div
              key={issue.id}
              className={clsx(
                "card overflow-hidden",
                processing === issue.id && "opacity-50"
              )}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={clsx(
                        "px-2 py-0.5 rounded text-xs font-medium",
                        severityColors[issue.severity]
                      )}>
                        {issue.severity.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                        {issueTypeLabels[issue.issue_type] || issue.issue_type}
                      </span>
                      <span className="text-xs text-gray-400">
                        {Math.round(issue.confidence * 100)}% confidence
                      </span>
                    </div>

                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      {issue.message}
                    </h3>

                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      <span className="font-medium">{issue.description}</span>
                      <span className="mx-2">•</span>
                      <span>{formatCurrencyLedger(issue.amount_cents)}</span>
                      <span className="mx-2">•</span>
                      <span>{new Date(issue.transaction_date).toLocaleDateString("en-AU")}</span>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <span className="font-medium">💡 Suggestion:</span> {issue.suggestion}
                      </p>
                      {issue.suggested_account_name && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          Recode to: <span className="font-medium">{issue.suggested_account_name}</span>
                          {issue.suggested_tax_treatment && (
                            <> ({issue.suggested_tax_treatment.replace("_", " ")})</>
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleAction(issue.id, "accept_suggestion")}
                      disabled={processing === issue.id}
                      className="btn-primary text-sm whitespace-nowrap"
                    >
                      Apply Fix
                    </button>
                    <button
                      onClick={() => handleAction(issue.id, "dismiss")}
                      disabled={processing === issue.id}
                      className="btn-secondary text-sm whitespace-nowrap"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => handleViewTransaction(issue.transaction_id)}
                      disabled={loadingTransaction === issue.transaction_id}
                      className="text-xs text-blue-600 hover:text-blue-700 text-center disabled:opacity-50"
                    >
                      {loadingTransaction === issue.transaction_id ? "Loading..." : "View Transaction"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                Currently: <span className="font-medium">{issue.current_account}</span>
                <span className="mx-2">•</span>
                Tax: <span className="font-medium">{issue.current_tax_treatment.replace("_", " ")}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Transaction Coding Modal */}
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
