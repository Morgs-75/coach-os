"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { clsx } from "clsx";

const tabs = [
  { name: "Overview", href: "/my-accounts" },
  { name: "Transactions", href: "/my-accounts/transactions" },
  { name: "P&L", href: "/my-accounts/pnl" },
  { name: "Ledger", href: "/my-accounts/ledger" },
  { name: "Accounts", href: "/my-accounts/accounts" },
  { name: "Settings", href: "/my-accounts/settings" },
];

interface AuditSummary {
  total_issues: number;
  high_severity: number;
  medium_severity: number;
  potential_tax_impact: number;
}

export default function MyAccountsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [auditSummary, setAuditSummary] = useState<AuditSummary | null>(null);
  const isAuditPage = pathname === "/my-accounts/audit";

  useEffect(() => {
    fetchAuditSummary();
  }, []);

  async function fetchAuditSummary() {
    try {
      const response = await fetch("/api/my-accounts/audit");
      if (response.ok) {
        const data = await response.json();
        setAuditSummary(data.summary);
      }
    } catch {
      // Silently fail
    }
  }

  const hasIssues = auditSummary && auditSummary.total_issues > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">myAccounts</h1>

        {/* Audit Launcher Button */}
        <Link
          href="/my-accounts/audit"
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            isAuditPage
              ? "bg-blue-600 text-white"
              : hasIssues
                ? "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-200 dark:hover:bg-amber-800"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          )}
        >
          <span>🤖</span>
          <span>myAccountant</span>
          {hasIssues && !isAuditPage && (
            <span className={clsx(
              "px-2 py-0.5 rounded-full text-xs font-bold",
              auditSummary.high_severity > 0
                ? "bg-red-500 text-white"
                : "bg-amber-500 text-white"
            )}>
              {auditSummary.total_issues}
            </span>
          )}
        </Link>
      </div>

      {/* Audit Alert Banner - Shows on all pages except audit page when there are high severity issues */}
      {hasIssues && auditSummary.high_severity > 0 && !isAuditPage && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-semibold text-red-800 dark:text-red-200">
                  {auditSummary.high_severity} high priority issue{auditSummary.high_severity !== 1 ? "s" : ""} found
                </p>
                <p className="text-sm text-red-600 dark:text-red-400">
                  myAccountant has detected potential errors that may affect your tax reporting
                </p>
              </div>
            </div>
            <Link
              href="/my-accounts/audit"
              className="btn-primary bg-red-600 hover:bg-red-700 text-sm"
            >
              Review Issues
            </Link>
          </div>
        </div>
      )}

      <div className="border-b border-gray-200 dark:border-gray-800 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href ||
              (tab.href !== "/my-accounts" && pathname.startsWith(tab.href));
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={clsx(
                  "whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors",
                  isActive
                    ? "border-brand-500 text-brand-600 dark:text-brand-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600"
                )}
              >
                {tab.name}
              </Link>
            );
          })}
          {/* Audit Tab */}
          <Link
            href="/my-accounts/audit"
            className={clsx(
              "whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2",
              isAuditPage
                ? "border-brand-500 text-brand-600 dark:text-brand-400"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600"
            )}
          >
            🤖 Audit
            {hasIssues && (
              <span className={clsx(
                "px-1.5 py-0.5 rounded-full text-xs font-medium",
                auditSummary.high_severity > 0
                  ? "bg-red-500 text-white"
                  : "bg-amber-500 text-white"
              )}>
                {auditSummary.total_issues}
              </span>
            )}
          </Link>
        </nav>
      </div>

      {children}
    </div>
  );
}
