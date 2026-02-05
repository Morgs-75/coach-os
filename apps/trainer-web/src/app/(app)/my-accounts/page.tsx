import { createClient } from "@/lib/supabase/server";
import { MetricCard } from "@/components/MetricCard";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ConnectBankButton } from "@/components/my-accounts/ConnectBankButton";
import Link from "next/link";
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

export default async function MyAccountsOverview() {
  const supabase = await createClient();
  const orgId = await getOrgId(supabase);

  if (!orgId) {
    return <div>No organization found</div>;
  }

  // Check if connected to Basiq
  const { data: basiqConnection } = await supabase
    .from("basiq_connections")
    .select("*")
    .eq("org_id", orgId)
    .single();

  // Get bank accounts
  const { data: bankAccounts } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true);

  // Get uncoded summary
  const { data: uncodedSummary } = await supabase
    .from("cashbook_uncoded_summary")
    .select("*")
    .eq("org_id", orgId)
    .single();

  // Get current month P&L summary
  const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
  const { data: pnlData } = await supabase
    .from("cashbook_pnl")
    .select("*")
    .eq("org_id", orgId)
    .gte("period", currentMonth);

  // Calculate totals
  const income = pnlData?.filter(p => p.category === "income")
    .reduce((sum, p) => sum + (p.net_cents || 0), 0) ?? 0;
  const expenses = pnlData?.filter(p => p.category === "expense")
    .reduce((sum, p) => sum + Math.abs(p.net_cents || 0), 0) ?? 0;
  const netProfit = income - expenses;
  const gstCollected = pnlData?.reduce((sum, p) => sum + (p.gst_cents || 0), 0) ?? 0;

  // Get recent transactions
  const { data: recentTransactions } = await supabase
    .from("bank_transactions")
    .select("*, bank_accounts(account_name), chart_of_accounts(name, code)")
    .eq("org_id", orgId)
    .order("transaction_date", { ascending: false })
    .limit(10);

  // Show onboarding if not connected
  if (!basiqConnection || basiqConnection.consent_status !== "active") {
    return (
      <div className="card p-12 text-center">
        <div className="max-w-md mx-auto">
          <div className="text-5xl mb-4">🏦</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Connect Your Bank Account
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Connect your business bank account to automatically import transactions.
            We'll help you categorize them and generate P&L reports.
          </p>
          <ConnectBankButton />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
            Powered by Basiq. Bank-level security. Read-only access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          label="Income (This Month)"
          value={formatCurrency(income)}
          variant="success"
        />
        <MetricCard
          label="Expenses (This Month)"
          value={formatCurrency(expenses)}
          variant="default"
        />
        <MetricCard
          label="Net Profit"
          value={formatCurrency(netProfit)}
          variant={netProfit >= 0 ? "success" : "danger"}
        />
        <Link href="/my-accounts/transactions" className="block">
          <MetricCard
            label="Needs Attention"
            value={(uncodedSummary?.uncoded_count ?? 0) + (uncodedSummary?.ai_suggested_count ?? 0)}
            variant={(uncodedSummary?.uncoded_count ?? 0) > 0 ? "warning" : "default"}
          />
        </Link>
      </div>

      {/* Uncoded Alert */}
      {(uncodedSummary?.uncoded_count ?? 0) > 0 && (
        <div className="card bg-amber-50 border-amber-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-amber-600 text-xl">⚠️</span>
              <div>
                <p className="font-medium text-amber-900">
                  {uncodedSummary?.uncoded_count} uncoded transactions
                </p>
                <p className="text-sm text-amber-700">
                  {uncodedSummary?.ai_suggested_count ?? 0} have AI suggestions ready to review
                </p>
              </div>
            </div>
            <Link href="/my-accounts/transactions?status=uncoded" className="btn-primary">
              Review Now
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Bank Accounts */}
        <div className="lg:col-span-1">
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Bank Accounts</h2>
              <ConnectBankButton variant="small" />
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {bankAccounts?.map((account: any) => (
                <div key={account.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{account.account_name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{account.institution_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(account.current_balance_cents ?? 0)}
                      </p>
                      {account.last_sync_at && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Synced {formatDate(account.last_sync_at)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {(!bankAccounts || bankAccounts.length === 0) && (
                <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  No bank accounts connected
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Transactions</h2>
              <Link href="/my-accounts/transactions" className="text-sm text-brand-600 hover:text-brand-700">
                View All
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Category</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {recentTransactions?.map((tx: any) => (
                    <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800">
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(tx.transaction_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-xs">
                          {tx.merchant_name || tx.description}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {tx.status === "coded" && tx.chart_of_accounts ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            {tx.chart_of_accounts.name}
                          </span>
                        ) : tx.status === "ai_suggested" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            AI Suggested
                          </span>
                        ) : tx.status === "excluded" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:text-gray-400">
                            Excluded
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                            Uncoded
                          </span>
                        )}
                      </td>
                      <td className={clsx(
                        "px-6 py-4 text-sm font-medium text-right whitespace-nowrap",
                        tx.direction === "credit" ? "text-green-600" : "text-gray-900 dark:text-gray-100"
                      )}>
                        {tx.direction === "credit" ? "+" : "-"}{formatCurrency(tx.amount_cents)}
                      </td>
                    </tr>
                  ))}
                  {(!recentTransactions || recentTransactions.length === 0) && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                        No transactions yet. Sync your bank to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
