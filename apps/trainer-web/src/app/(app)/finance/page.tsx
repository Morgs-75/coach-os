import { createClient } from "@/lib/supabase/server";
import { MetricCard } from "@/components/MetricCard";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { MoneyEventType } from "@coach-os/shared";
import { clsx } from "clsx";

async function getOrgId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  return membership?.org_id ?? null;
}

const eventTypeConfig: Record<MoneyEventType, { label: string; color: string }> = {
  INCOME: { label: "Income", color: "text-green-600" },
  REFUND: { label: "Refund", color: "text-red-600" },
  FEE: { label: "Stripe Fee", color: "text-gray-500" },
  PLATFORM_FEE: { label: "Platform Fee", color: "text-purple-600" },
  PAYOUT: { label: "Payout", color: "text-blue-600" },
  EXPENSE: { label: "Expense", color: "text-orange-600" },
  ADJUSTMENT: { label: "Adjustment", color: "text-gray-600" },
};

export default async function FinancePage() {
  const supabase = await createClient();
  const orgId = await getOrgId(supabase);

  if (!orgId) {
    return <div>No organization found</div>;
  }

  // Get monthly summary
  const { data: monthlyData } = await supabase
    .from("finance_monthly")
    .select("*")
    .eq("org_id", orgId)
    .order("period", { ascending: false })
    .limit(12);

  // Get recent transactions
  const { data: transactions } = await supabase
    .from("money_events")
    .select("*, clients(full_name)")
    .eq("org_id", orgId)
    .order("event_date", { ascending: false })
    .limit(50);

  const currentMonth = monthlyData?.[0];
  const lastMonth = monthlyData?.[1];

  // Calculate quarter GST
  const currentQuarter = Math.floor(new Date().getMonth() / 3);
  const quarterMonths = monthlyData?.filter((m) => {
    const monthNum = parseInt(m.period.split("-")[1]) - 1;
    return Math.floor(monthNum / 3) === currentQuarter;
  }) ?? [];

  const quarterGST = quarterMonths.reduce((sum, m) => {
    // GST collected on income minus GST paid on platform fees
    const gstCollected = Math.round((m.cash_in_cents ?? 0) / 11);
    const gstPaid = Math.round((m.platform_fees_cents ?? 0) / 11);
    return sum + gstCollected - gstPaid;
  }, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
        <button className="btn-secondary">Export CSV</button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          label="This Month Income"
          value={formatCurrency(currentMonth?.cash_in_cents ?? 0)}
          variant="success"
        />
        <MetricCard
          label="This Month Fees"
          value={formatCurrency(Math.abs(currentMonth?.fees_cents ?? 0) + Math.abs(currentMonth?.platform_fees_cents ?? 0))}
          variant="default"
        />
        <MetricCard
          label="Net This Month"
          value={formatCurrency(currentMonth?.net_cents ?? 0)}
          variant="default"
        />
        <MetricCard
          label="Quarter GST Liability"
          value={formatCurrency(quarterGST)}
          variant="warning"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Monthly Breakdown */}
        <div className="lg:col-span-1">
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Monthly Summary</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {monthlyData?.slice(0, 6).map((month: any) => (
                <div key={month.period} className="px-6 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">{month.period}</span>
                    <span className={clsx(
                      "font-semibold",
                      month.net_cents >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {formatCurrency(month.net_cents)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">In: {formatCurrency(month.cash_in_cents)}</span>
                    <span className="text-gray-500">Out: {formatCurrency(Math.abs(month.cash_out_cents))}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Transactions */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions?.map((tx: any) => {
                    const config = eventTypeConfig[tx.type as MoneyEventType];
                    return (
                      <tr key={tx.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                          {formatDate(tx.event_date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={clsx("text-sm font-medium", config.color)}>
                            {config.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                          {tx.clients?.full_name ?? "-"}
                        </td>
                        <td className={clsx(
                          "px-6 py-4 text-sm font-medium text-right whitespace-nowrap",
                          tx.amount_cents >= 0 ? "text-green-600" : "text-red-600"
                        )}>
                          {tx.amount_cents >= 0 ? "+" : ""}{formatCurrency(tx.amount_cents, tx.currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
