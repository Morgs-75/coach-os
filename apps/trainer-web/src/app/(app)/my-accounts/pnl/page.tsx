"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { clsx } from "clsx";

type DateRangeOption = "this_month" | "last_month" | "this_quarter" | "last_quarter" | "this_fy" | "last_fy" | "custom";

interface AccountTotal {
  account_id: string;
  account_code: string;
  account_name: string;
  category: string;
  total_cents: number;
  gst_cents: number;
  transaction_count: number;
}

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

export default function PnLPage() {
  const [loading, setLoading] = useState(true);
  const [pnlData, setPnlData] = useState<PnLData[]>([]);
  const [dateRange, setDateRange] = useState<DateRangeOption>("this_fy");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const supabase = createClient();

  // Calculate date ranges
  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Australian FY: July - June
    const fyStartYear = currentMonth >= 6 ? currentYear : currentYear - 1;

    let start: string;
    let end: string;

    switch (dateRange) {
      case "this_month":
        start = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;
        end = new Date(currentYear, currentMonth + 1, 0).toISOString().split("T")[0];
        break;
      case "last_month":
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        start = `${lastMonthYear}-${String(lastMonth + 1).padStart(2, "0")}-01`;
        end = new Date(lastMonthYear, lastMonth + 1, 0).toISOString().split("T")[0];
        break;
      case "this_quarter":
        const qStart = Math.floor(currentMonth / 3) * 3;
        start = `${currentYear}-${String(qStart + 1).padStart(2, "0")}-01`;
        end = new Date(currentYear, qStart + 3, 0).toISOString().split("T")[0];
        break;
      case "last_quarter":
        const lqStart = Math.floor(currentMonth / 3) * 3 - 3;
        const lqYear = lqStart < 0 ? currentYear - 1 : currentYear;
        const lqMonth = lqStart < 0 ? lqStart + 12 : lqStart;
        start = `${lqYear}-${String(lqMonth + 1).padStart(2, "0")}-01`;
        end = new Date(lqYear, lqMonth + 3, 0).toISOString().split("T")[0];
        break;
      case "this_fy":
        start = `${fyStartYear}-07-01`;
        end = `${fyStartYear + 1}-06-30`;
        break;
      case "last_fy":
        start = `${fyStartYear - 1}-07-01`;
        end = `${fyStartYear}-06-30`;
        break;
      case "custom":
        start = customStart || `${currentYear}-01-01`;
        end = customEnd || now.toISOString().split("T")[0];
        break;
      default:
        start = `${fyStartYear}-07-01`;
        end = `${fyStartYear + 1}-06-30`;
    }

    setStartDate(start);
    setEndDate(end);
  }, [dateRange, customStart, customEnd]);

  // Load P&L data
  useEffect(() => {
    if (!startDate || !endDate) return;

    async function loadData() {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from("org_members")
        .select("org_id")
        .eq("user_id", user.id)
        .single();

      if (!membership?.org_id) return;

      const { data } = await supabase
        .from("cashbook_pnl")
        .select("*")
        .eq("org_id", membership.org_id)
        .gte("period", startDate)
        .lte("period", endDate);

      setPnlData(data || []);
      setLoading(false);
    }

    loadData();
  }, [startDate, endDate]);

  // Group by account
  const accountTotals = pnlData.reduce((acc, item) => {
    const key = item.account_id;
    if (!acc[key]) {
      acc[key] = {
        account_id: item.account_id,
        account_code: item.account_code,
        account_name: item.account_name,
        category: item.category,
        total_cents: 0,
        gst_cents: 0,
        transaction_count: 0,
      };
    }
    acc[key].total_cents += item.net_cents || 0;
    acc[key].gst_cents += item.gst_cents || 0;
    acc[key].transaction_count += item.transaction_count || 0;
    return acc;
  }, {} as Record<string, AccountTotal>);

  const allAccounts = Object.values(accountTotals) as AccountTotal[];

  const incomeAccounts = allAccounts
    .filter((a) => a.category === "income")
    .sort((a, b) => b.total_cents - a.total_cents);

  const expenseAccounts = allAccounts
    .filter((a) => a.category === "expense")
    .sort((a, b) => Math.abs(b.total_cents) - Math.abs(a.total_cents));

  // Calculate totals
  const totalIncome = incomeAccounts.reduce((sum, a) => sum + a.total_cents, 0);
  const totalExpenses = expenseAccounts.reduce((sum, a) => sum + Math.abs(a.total_cents), 0);
  const netProfit = totalIncome - totalExpenses;
  const totalGST = allAccounts.reduce((sum, a) => sum + a.gst_cents, 0);

  const dateRangeLabel = {
    this_month: "This Month",
    last_month: "Last Month",
    this_quarter: "This Quarter",
    last_quarter: "Last Quarter",
    this_fy: "This Financial Year",
    last_fy: "Last Financial Year",
    custom: "Custom Range",
  }[dateRange];

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Period:</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRangeOption)}
              className="input py-1.5 w-48"
            >
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_quarter">This Quarter</option>
              <option value="last_quarter">Last Quarter</option>
              <option value="this_fy">This Financial Year</option>
              <option value="last_fy">Last Financial Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {dateRange === "custom" && (
            <>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">From:</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="input py-1.5"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">To:</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="input py-1.5"
                />
              </div>
            </>
          )}

          <div className="flex-1" />

          <div className="text-sm text-gray-500">
            {startDate && endDate && (
              <>
                {new Date(startDate).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                {" - "}
                {new Date(endDate).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
              </>
            )}
          </div>

          <button className="btn-secondary">
            Export PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card p-12 text-center text-gray-500">Loading P&L data...</div>
      ) : pnlData.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-500 mb-4">
            No coded transactions for this period. Code your transactions to see P&L data.
          </p>
          <a href="/my-accounts/transactions" className="btn-primary">
            Go to Transactions
          </a>
        </div>
      ) : (
        /* Traditional P&L Statement */
        <div className="card">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-xl font-bold text-gray-900 text-center">Profit & Loss Statement</h2>
            <p className="text-sm text-gray-500 text-center mt-1">{dateRangeLabel}</p>
          </div>

          <div className="divide-y divide-gray-200">
            {/* INCOME SECTION */}
            <div className="px-6 py-4">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Income</h3>
              <table className="w-full">
                <tbody>
                  {incomeAccounts.map((account) => (
                    <tr key={account.account_id} className="hover:bg-gray-50">
                      <td className="py-2 text-sm text-gray-700 pl-4">
                        {account.account_name}
                      </td>
                      <td className="py-2 text-sm text-gray-900 text-right w-32">
                        {formatCurrency(account.total_cents)}
                      </td>
                    </tr>
                  ))}
                  {incomeAccounts.length === 0 && (
                    <tr>
                      <td className="py-2 text-sm text-gray-500 pl-4 italic">No income recorded</td>
                      <td className="py-2 text-sm text-gray-500 text-right w-32">$0.00</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-300">
                    <td className="py-3 text-sm font-semibold text-gray-900">Total Income</td>
                    <td className="py-3 text-sm font-bold text-green-600 text-right w-32">
                      {formatCurrency(totalIncome)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* EXPENSES SECTION */}
            <div className="px-6 py-4">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Less: Expenses</h3>
              <table className="w-full">
                <tbody>
                  {expenseAccounts.map((account) => (
                    <tr key={account.account_id} className="hover:bg-gray-50">
                      <td className="py-2 text-sm text-gray-700 pl-4">
                        {account.account_name}
                      </td>
                      <td className="py-2 text-sm text-gray-900 text-right w-32">
                        {formatCurrency(Math.abs(account.total_cents))}
                      </td>
                    </tr>
                  ))}
                  {expenseAccounts.length === 0 && (
                    <tr>
                      <td className="py-2 text-sm text-gray-500 pl-4 italic">No expenses recorded</td>
                      <td className="py-2 text-sm text-gray-500 text-right w-32">$0.00</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-300">
                    <td className="py-3 text-sm font-semibold text-gray-900">Total Expenses</td>
                    <td className="py-3 text-sm font-bold text-red-600 text-right w-32">
                      ({formatCurrency(totalExpenses)})
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* NET PROFIT SECTION */}
            <div className="px-6 py-6 bg-gray-50">
              <table className="w-full">
                <tbody>
                  <tr>
                    <td className="py-2 text-lg font-bold text-gray-900">Net Profit / (Loss)</td>
                    <td className={clsx(
                      "py-2 text-xl font-bold text-right w-32",
                      netProfit >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {netProfit < 0 && "("}
                      {formatCurrency(Math.abs(netProfit))}
                      {netProfit < 0 && ")"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* GST SUMMARY */}
            <div className="px-6 py-4 bg-amber-50">
              <table className="w-full">
                <tbody>
                  <tr>
                    <td className="py-2 text-sm font-medium text-amber-900">GST Collected on Income</td>
                    <td className="py-2 text-sm text-amber-900 text-right w-32">
                      {formatCurrency(Math.round(totalIncome / 11))}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-sm font-medium text-amber-900">GST Paid on Expenses</td>
                    <td className="py-2 text-sm text-amber-900 text-right w-32">
                      ({formatCurrency(Math.round(totalExpenses / 11))})
                    </td>
                  </tr>
                  <tr className="border-t border-amber-300">
                    <td className="py-2 text-sm font-bold text-amber-900">Net GST Payable / (Refund)</td>
                    <td className="py-2 text-sm font-bold text-amber-900 text-right w-32">
                      {formatCurrency(Math.round(totalIncome / 11) - Math.round(totalExpenses / 11))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {!loading && pnlData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-sm text-gray-500">Total Income</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-500">Total Expenses</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-500">Net Profit</p>
            <p className={clsx("text-2xl font-bold", netProfit >= 0 ? "text-green-600" : "text-red-600")}>
              {formatCurrency(netProfit)}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-500">Profit Margin</p>
            <p className="text-2xl font-bold text-gray-900">
              {totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : 0}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
