import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { PnLSummary } from "@/components/my-accounts/PnLSummary";
import { PnLTable } from "@/components/my-accounts/PnLTable";

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

export default async function PnLPage() {
  const supabase = await createClient();
  const orgId = await getOrgId(supabase);

  if (!orgId) {
    return <div>No organization found</div>;
  }

  // Get current financial year dates (Australian FY: July - June)
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const fyStartYear = currentMonth >= 6 ? currentYear : currentYear - 1;
  const fyStart = `${fyStartYear}-07-01`;
  const fyEnd = `${fyStartYear + 1}-06-30`;

  // Get P&L data for current FY
  const { data: pnlData } = await supabase
    .from("cashbook_pnl")
    .select("*")
    .eq("org_id", orgId)
    .gte("period", fyStart)
    .lte("period", fyEnd)
    .order("period", { ascending: true });

  // Get current month data
  const currentMonthStr = now.toISOString().slice(0, 7) + "-01";
  const currentMonthData = pnlData?.filter((p) => p.period === currentMonthStr) ?? [];

  // Calculate totals
  const totalIncome = pnlData?.filter((p) => p.category === "income")
    .reduce((sum, p) => sum + (p.net_cents || 0), 0) ?? 0;
  const totalExpenses = pnlData?.filter((p) => p.category === "expense")
    .reduce((sum, p) => sum + Math.abs(p.net_cents || 0), 0) ?? 0;
  const netProfit = totalIncome - totalExpenses;
  const totalGST = pnlData?.reduce((sum, p) => sum + (p.gst_cents || 0), 0) ?? 0;

  // Current month totals
  const monthIncome = currentMonthData.filter((p) => p.category === "income")
    .reduce((sum, p) => sum + (p.net_cents || 0), 0);
  const monthExpenses = currentMonthData.filter((p) => p.category === "expense")
    .reduce((sum, p) => sum + Math.abs(p.net_cents || 0), 0);
  const monthNet = monthIncome - monthExpenses;
  const monthGST = currentMonthData.reduce((sum, p) => sum + (p.gst_cents || 0), 0);

  // Group by account for the table
  interface AccountTotal {
    account_id: string;
    account_code: string;
    account_name: string;
    category: string;
    total_cents: number;
    gst_cents: number;
    transaction_count: number;
  }

  const accountTotals = pnlData?.reduce((acc, item) => {
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
  }, {} as Record<string, AccountTotal>) ?? {};

  const allAccounts = Object.values(accountTotals) as AccountTotal[];

  const incomeAccounts = allAccounts
    .filter((a) => a.category === "income")
    .sort((a, b) => b.total_cents - a.total_cents);

  const expenseAccounts = allAccounts
    .filter((a) => a.category === "expense")
    .sort((a, b) => Math.abs(b.total_cents) - Math.abs(a.total_cents));

  return (
    <div className="space-y-8">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Financial Year {fyStartYear}/{fyStartYear + 1}
          </h2>
          <p className="text-sm text-gray-500">
            1 July {fyStartYear} - 30 June {fyStartYear + 1}
          </p>
        </div>
        <button className="btn-secondary">Export PDF</button>
      </div>

      {/* Summary Cards */}
      <PnLSummary
        income={totalIncome}
        expenses={totalExpenses}
        netProfit={netProfit}
        gst={totalGST}
        monthIncome={monthIncome}
        monthExpenses={monthExpenses}
        monthNet={monthNet}
        monthGST={monthGST}
      />

      {/* P&L Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Income */}
        <PnLTable
          title="Income"
          accounts={incomeAccounts}
          total={totalIncome}
          variant="income"
        />

        {/* Expenses */}
        <PnLTable
          title="Expenses"
          accounts={expenseAccounts}
          total={totalExpenses}
          variant="expense"
        />
      </div>

      {/* Net Profit Summary */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Net Profit (Loss)</h3>
            <p className="text-sm text-gray-500">Total Income - Total Expenses</p>
          </div>
          <div className="text-right">
            <p className={`text-3xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(netProfit)}
            </p>
            <p className="text-sm text-gray-500">
              {((netProfit / totalIncome) * 100).toFixed(1)}% margin
            </p>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {(!pnlData || pnlData.length === 0) && (
        <div className="card p-12 text-center">
          <p className="text-gray-500 mb-4">
            No coded transactions yet. Code your transactions to see P&L data.
          </p>
          <a href="/my-accounts/transactions" className="btn-primary">
            Go to Transactions
          </a>
        </div>
      )}
    </div>
  );
}
