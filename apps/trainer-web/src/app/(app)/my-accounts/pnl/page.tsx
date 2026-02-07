"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { clsx } from "clsx";

type ViewMode = "monthly" | "summary";

interface PnLData {
  org_id: string;
  period: string;
  category: string;
  account_id: string;
  account_code: string;
  account_name: string;
  net_cents: number;
  gst_cents: number;
  transaction_count: number;
}

// Generate mock P&L data for multiple months
function generateMockPnLData(): PnLData[] {
  const data: PnLData[] = [];
  const now = new Date();

  // Generate data for the last 12 months
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    // Randomize amounts slightly for each month
    const variation = () => 0.8 + Math.random() * 0.4; // 80% to 120%

    // Income
    data.push({ org_id: "mock", period, category: "income", account_id: "acc-101", account_code: "INC-001", account_name: "PT Sessions", net_cents: Math.round(800000 * variation()), gst_cents: 0, transaction_count: 10 + Math.floor(Math.random() * 5) });
    data.push({ org_id: "mock", period, category: "income", account_id: "acc-102", account_code: "INC-002", account_name: "Group Classes", net_cents: Math.round(300000 * variation()), gst_cents: 0, transaction_count: 6 + Math.floor(Math.random() * 4) });
    if (Math.random() > 0.3) {
      data.push({ org_id: "mock", period, category: "income", account_id: "acc-103", account_code: "INC-003", account_name: "Online Coaching", net_cents: Math.round(150000 * variation()), gst_cents: 0, transaction_count: 2 + Math.floor(Math.random() * 3) });
    }

    // Expenses
    data.push({ org_id: "mock", period, category: "expense", account_id: "acc-201", account_code: "EXP-001", account_name: "Gym Rent", net_cents: -180000, gst_cents: 0, transaction_count: 1 });
    data.push({ org_id: "mock", period, category: "expense", account_id: "acc-202", account_code: "EXP-002", account_name: "Equipment", net_cents: Math.round(-40000 * variation()), gst_cents: 0, transaction_count: 1 + Math.floor(Math.random() * 2) });
    data.push({ org_id: "mock", period, category: "expense", account_id: "acc-203", account_code: "EXP-003", account_name: "Marketing", net_cents: Math.round(-25000 * variation()), gst_cents: 0, transaction_count: 2 + Math.floor(Math.random() * 3) });
    data.push({ org_id: "mock", period, category: "expense", account_id: "acc-204", account_code: "EXP-004", account_name: "Insurance", net_cents: -15000, gst_cents: 0, transaction_count: 1 });
    data.push({ org_id: "mock", period, category: "expense", account_id: "acc-205", account_code: "EXP-005", account_name: "Payment Processing", net_cents: Math.round(-12000 * variation()), gst_cents: 0, transaction_count: 10 });
  }

  return data;
}

export default function PnLPage() {
  const [loading, setLoading] = useState(true);
  const [pnlData, setPnlData] = useState<PnLData[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const supabase = createClient();

  // Set default date range (last 6 months)
  useEffect(() => {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const formatDate = (d: Date) => d.toISOString().split("T")[0];
    setStartDate(formatDate(sixMonthsAgo));
    setEndDate(formatDate(now));
  }, []);

  // Load P&L data
  useEffect(() => {
    if (!startDate || !endDate) return;

    async function loadData() {
      setLoading(true);

      try {
        const { data: { user } } = await supabase.auth.getUser();

        // Use mock data
        const mockData = generateMockPnLData();
        const startMonth = startDate.slice(0, 7);
        const endMonth = endDate.slice(0, 7);
        const filtered = mockData.filter(d => d.period >= startMonth && d.period <= endMonth);
        setPnlData(filtered);

      } catch (err) {
        console.log("Using mock P&L data");
        const mockData = generateMockPnLData();
        setPnlData(mockData);
      }

      setLoading(false);
    }

    loadData();
  }, [startDate, endDate]);

  // Get unique months in the data, sorted
  const months = useMemo(() => {
    const uniqueMonths = [...new Set(pnlData.map(d => d.period))].sort();
    return uniqueMonths;
  }, [pnlData]);

  // Get unique accounts
  const accounts = useMemo(() => {
    const accountMap = new Map<string, { id: string; code: string; name: string; category: string }>();
    pnlData.forEach(d => {
      if (!accountMap.has(d.account_id)) {
        accountMap.set(d.account_id, {
          id: d.account_id,
          code: d.account_code,
          name: d.account_name,
          category: d.category,
        });
      }
    });
    return Array.from(accountMap.values());
  }, [pnlData]);

  const incomeAccounts = accounts.filter(a => a.category === "income").sort((a, b) => a.name.localeCompare(b.name));
  const expenseAccounts = accounts.filter(a => a.category === "expense").sort((a, b) => a.name.localeCompare(b.name));

  // Build data matrix: account -> month -> amount
  const dataMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, number>> = {};
    pnlData.forEach(d => {
      if (!matrix[d.account_id]) matrix[d.account_id] = {};
      matrix[d.account_id][d.period] = (matrix[d.account_id][d.period] || 0) + d.net_cents;
    });
    return matrix;
  }, [pnlData]);

  // Calculate totals per month
  const monthlyTotals = useMemo(() => {
    const totals: Record<string, { income: number; expense: number; net: number }> = {};
    months.forEach(month => {
      totals[month] = { income: 0, expense: 0, net: 0 };
    });
    pnlData.forEach(d => {
      if (d.category === "income") {
        totals[d.period].income += d.net_cents;
      } else if (d.category === "expense") {
        totals[d.period].expense += Math.abs(d.net_cents);
      }
    });
    months.forEach(month => {
      totals[month].net = totals[month].income - totals[month].expense;
    });
    return totals;
  }, [pnlData, months]);

  // Format month for display
  function formatMonth(period: string) {
    const [year, month] = period.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-AU", { month: "short", year: "2-digit" });
  }

  // Grand totals
  const grandTotals = useMemo(() => {
    let income = 0, expense = 0;
    Object.values(monthlyTotals).forEach(t => {
      income += t.income;
      expense += t.expense;
    });
    return { income, expense, net: income - expense };
  }, [monthlyTotals]);

  if (loading) {
    return <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading P&L data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Date Range */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">From:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input py-1.5"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">To:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input py-1.5"
            />
          </div>

          <div className="flex-1" />

          {/* View Toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode("monthly")}
              className={clsx(
                "px-3 py-1.5 text-sm rounded-md transition-colors",
                viewMode === "monthly" ? "bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-gray-100" : "text-gray-600 dark:text-gray-400"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setViewMode("summary")}
              className={clsx(
                "px-3 py-1.5 text-sm rounded-md transition-colors",
                viewMode === "summary" ? "bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-gray-100" : "text-gray-600 dark:text-gray-400"
              )}
            >
              Summary
            </button>
          </div>

          <button className="btn-secondary">Export</button>
        </div>
      </div>

      {pnlData.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">No data for this period</p>
        </div>
      ) : viewMode === "monthly" ? (
        /* Monthly Columns View - Compact */
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-fixed" style={{ fontSize: '8pt' }}>
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-2 py-1.5 text-left font-semibold text-gray-900 dark:text-gray-100 sticky left-0 bg-gray-50 dark:bg-gray-800" style={{ minWidth: '200px', maxWidth: '300px' }}>
                    Account
                  </th>
                  {months.map(month => (
                    <th key={month} className="px-2 py-1.5 text-right font-semibold text-gray-900 dark:text-gray-100" style={{ minWidth: '100px', maxWidth: '150px' }}>
                      {formatMonth(month)}
                    </th>
                  ))}
                  <th className="px-2 py-1.5 text-right font-bold text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-700" style={{ minWidth: '100px', maxWidth: '150px' }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {/* Income Section */}
                <tr className="bg-green-50">
                  <td colSpan={months.length + 2} className="px-2 py-1 font-bold text-green-800 uppercase tracking-wide">
                    Income
                  </td>
                </tr>
                {incomeAccounts.map(account => {
                  const rowTotal = months.reduce((sum, m) => sum + (dataMatrix[account.id]?.[m] || 0), 0);
                  return (
                    <tr key={account.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800">
                      <td className="px-2 py-1 text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-gray-900">
                        {account.name}
                      </td>
                      {months.map(month => (
                        <td key={month} className="px-2 py-1 text-right text-gray-700 dark:text-gray-300 tabular-nums">
                          {dataMatrix[account.id]?.[month]
                            ? formatCurrency(dataMatrix[account.id][month])
                            : <span className="text-gray-300">-</span>
                          }
                        </td>
                      ))}
                      <td className="px-2 py-1 text-right font-medium text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 tabular-nums">
                        {formatCurrency(rowTotal)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-green-50 font-semibold">
                  <td className="px-2 py-1 text-green-800 sticky left-0 bg-green-50">
                    Total Income
                  </td>
                  {months.map(month => (
                    <td key={month} className="px-2 py-1 text-right text-green-700 tabular-nums">
                      {formatCurrency(monthlyTotals[month].income)}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right font-bold text-green-800 bg-green-100 tabular-nums">
                    {formatCurrency(grandTotals.income)}
                  </td>
                </tr>

                {/* Expenses Section */}
                <tr className="bg-red-50">
                  <td colSpan={months.length + 2} className="px-2 py-1 font-bold text-red-800 uppercase tracking-wide">
                    Expenses
                  </td>
                </tr>
                {expenseAccounts.map(account => {
                  const rowTotal = months.reduce((sum, m) => sum + Math.abs(dataMatrix[account.id]?.[m] || 0), 0);
                  return (
                    <tr key={account.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800">
                      <td className="px-2 py-1 text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-gray-900">
                        {account.name}
                      </td>
                      {months.map(month => (
                        <td key={month} className="px-2 py-1 text-right text-gray-700 dark:text-gray-300 tabular-nums">
                          {dataMatrix[account.id]?.[month]
                            ? formatCurrency(Math.abs(dataMatrix[account.id][month]))
                            : <span className="text-gray-300">-</span>
                          }
                        </td>
                      ))}
                      <td className="px-2 py-1 text-right font-medium text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 tabular-nums">
                        {formatCurrency(rowTotal)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-red-50 font-semibold">
                  <td className="px-2 py-1 text-red-800 sticky left-0 bg-red-50">
                    Total Expenses
                  </td>
                  {months.map(month => (
                    <td key={month} className="px-2 py-1 text-right text-red-700 tabular-nums">
                      ({formatCurrency(monthlyTotals[month].expense)})
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right font-bold text-red-800 bg-red-100 tabular-nums">
                    ({formatCurrency(grandTotals.expense)})
                  </td>
                </tr>

                {/* Net Profit */}
                <tr className="bg-gray-100 dark:bg-gray-700 font-bold">
                  <td className="px-2 py-1.5 text-gray-900 dark:text-gray-100 sticky left-0 bg-gray-100 dark:bg-gray-700">
                    Net Profit
                  </td>
                  {months.map(month => (
                    <td
                      key={month}
                      className={clsx(
                        "px-2 py-1.5 text-right tabular-nums",
                        monthlyTotals[month].net >= 0 ? "text-green-700" : "text-red-700"
                      )}
                    >
                      {monthlyTotals[month].net < 0 && "("}
                      {formatCurrency(Math.abs(monthlyTotals[month].net))}
                      {monthlyTotals[month].net < 0 && ")"}
                    </td>
                  ))}
                  <td className={clsx(
                    "px-2 py-1.5 text-right bg-gray-200 tabular-nums",
                    grandTotals.net >= 0 ? "text-green-800" : "text-red-800"
                  )}>
                    {grandTotals.net < 0 && "("}
                    {formatCurrency(Math.abs(grandTotals.net))}
                    {grandTotals.net < 0 && ")"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Summary View */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Income Card */}
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-green-50">
              <h3 className="font-semibold text-green-800">Income</h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {incomeAccounts.map(account => {
                const total = months.reduce((sum, m) => sum + (dataMatrix[account.id]?.[m] || 0), 0);
                return (
                  <div key={account.id} className="px-6 py-3 flex justify-between">
                    <span className="text-gray-700 dark:text-gray-300">{account.name}</span>
                    <span className="font-medium">{formatCurrency(total)}</span>
                  </div>
                );
              })}
              <div className="px-6 py-3 flex justify-between bg-green-50 font-bold">
                <span className="text-green-800">Total Income</span>
                <span className="text-green-700">{formatCurrency(grandTotals.income)}</span>
              </div>
            </div>
          </div>

          {/* Expenses Card */}
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-red-50">
              <h3 className="font-semibold text-red-800">Expenses</h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {expenseAccounts.map(account => {
                const total = months.reduce((sum, m) => sum + Math.abs(dataMatrix[account.id]?.[m] || 0), 0);
                return (
                  <div key={account.id} className="px-6 py-3 flex justify-between">
                    <span className="text-gray-700 dark:text-gray-300">{account.name}</span>
                    <span className="font-medium">{formatCurrency(total)}</span>
                  </div>
                );
              })}
              <div className="px-6 py-3 flex justify-between bg-red-50 font-bold">
                <span className="text-red-800">Total Expenses</span>
                <span className="text-red-700">({formatCurrency(grandTotals.expense)})</span>
              </div>
            </div>
          </div>

          {/* Net Profit Card */}
          <div className="card lg:col-span-2">
            <div className={clsx(
              "px-6 py-6 flex justify-between items-center",
              grandTotals.net >= 0 ? "bg-green-50" : "bg-red-50"
            )}>
              <span className="text-xl font-bold text-gray-900 dark:text-gray-100">Net Profit / (Loss)</span>
              <span className={clsx(
                "text-3xl font-bold",
                grandTotals.net >= 0 ? "text-green-700" : "text-red-700"
              )}>
                {grandTotals.net < 0 && "("}
                {formatCurrency(Math.abs(grandTotals.net))}
                {grandTotals.net < 0 && ")"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2" style={{ fontSize: '8pt' }}>
        <div className="card p-2">
          <p className="text-gray-500 dark:text-gray-400">Avg Monthly Income</p>
          <p className="font-bold text-green-600 tabular-nums">
            {formatCurrency(Math.round(grandTotals.income / Math.max(months.length, 1)))}
          </p>
        </div>
        <div className="card p-2">
          <p className="text-gray-500 dark:text-gray-400">Avg Monthly Expenses</p>
          <p className="font-bold text-red-600 tabular-nums">
            {formatCurrency(Math.round(grandTotals.expense / Math.max(months.length, 1)))}
          </p>
        </div>
        <div className="card p-2">
          <p className="text-gray-500 dark:text-gray-400">Avg Monthly Profit</p>
          <p className={clsx("font-bold tabular-nums", grandTotals.net >= 0 ? "text-green-600" : "text-red-600")}>
            {formatCurrency(Math.round(grandTotals.net / Math.max(months.length, 1)))}
          </p>
        </div>
        <div className="card p-2">
          <p className="text-gray-500 dark:text-gray-400">Profit Margin</p>
          <p className="font-bold text-gray-900 dark:text-gray-100 tabular-nums">
            {grandTotals.income > 0 ? ((grandTotals.net / grandTotals.income) * 100).toFixed(1) : 0}%
          </p>
        </div>
      </div>
    </div>
  );
}
