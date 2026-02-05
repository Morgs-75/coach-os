import { formatCurrency } from "@/lib/utils";
import { MetricCard } from "@/components/MetricCard";

interface PnLSummaryProps {
  income: number;
  expenses: number;
  netProfit: number;
  gst: number;
  monthIncome: number;
  monthExpenses: number;
  monthNet: number;
  monthGST: number;
}

export function PnLSummary({
  income,
  expenses,
  netProfit,
  gst,
  monthIncome,
  monthExpenses,
  monthNet,
  monthGST,
}: PnLSummaryProps) {
  return (
    <div className="space-y-4">
      {/* Year to Date */}
      <div>
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Year to Date</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Total Income"
            value={formatCurrency(income)}
            variant="success"
          />
          <MetricCard
            label="Total Expenses"
            value={formatCurrency(expenses)}
            variant="default"
          />
          <MetricCard
            label="Net Profit"
            value={formatCurrency(netProfit)}
            variant={netProfit >= 0 ? "success" : "danger"}
          />
          <MetricCard
            label="GST Collected"
            value={formatCurrency(gst)}
            variant="warning"
          />
        </div>
      </div>

      {/* This Month */}
      <div>
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">This Month</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Income</p>
            <p className="text-xl font-semibold text-green-600">{formatCurrency(monthIncome)}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Expenses</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(monthExpenses)}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Net</p>
            <p className={`text-xl font-semibold ${monthNet >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(monthNet)}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">GST</p>
            <p className="text-xl font-semibold text-amber-600">{formatCurrency(monthGST)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
