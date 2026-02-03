import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { LedgerTable } from "@/components/my-accounts/LedgerTable";
import Link from "next/link";

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

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: { account?: string; start?: string; end?: string };
}) {
  const supabase = await createClient();
  const orgId = await getOrgId(supabase);

  if (!orgId) {
    return <div>No organization found</div>;
  }

  // Get chart of accounts for filter
  const { data: accounts } = await supabase
    .from("chart_of_accounts")
    .select("*")
    .or(`org_id.eq.${orgId},org_id.is.null`)
    .eq("is_active", true)
    .order("display_order");

  // Build query for ledger
  let query = supabase
    .from("cashbook_ledger")
    .select("*")
    .eq("org_id", orgId)
    .order("transaction_date", { ascending: false });

  // Apply filters
  if (searchParams.account) {
    query = query.eq("account_code", searchParams.account);
  }
  if (searchParams.start) {
    query = query.gte("transaction_date", searchParams.start);
  }
  if (searchParams.end) {
    query = query.lte("transaction_date", searchParams.end);
  }

  const { data: ledgerData } = await query.limit(500);

  // Calculate running balance and totals
  let runningBalance = 0;
  const ledgerWithBalance = (ledgerData ?? []).reverse().map((entry) => {
    const signedAmount = entry.direction === "credit" ? entry.amount_cents : -entry.amount_cents;
    runningBalance += signedAmount;
    return { ...entry, running_balance: runningBalance };
  }).reverse();

  const totalDebits = ledgerData?.filter((e) => e.direction === "debit")
    .reduce((sum, e) => sum + e.amount_cents, 0) ?? 0;
  const totalCredits = ledgerData?.filter((e) => e.direction === "credit")
    .reduce((sum, e) => sum + e.amount_cents, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="card p-4">
        <form className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Account:</label>
            <select
              name="account"
              defaultValue={searchParams.account || ""}
              className="input py-1.5 w-56"
            >
              <option value="">All Accounts</option>
              <optgroup label="Income">
                {accounts?.filter((a) => a.category === "income").map((account) => (
                  <option key={account.id} value={account.code}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Expenses">
                {accounts?.filter((a) => a.category === "expense").map((account) => (
                  <option key={account.id} value={account.code}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Other">
                {accounts?.filter((a) => a.category === "other").map((account) => (
                  <option key={account.id} value={account.code}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">From:</label>
            <input
              type="date"
              name="start"
              defaultValue={searchParams.start || ""}
              className="input py-1.5"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">To:</label>
            <input
              type="date"
              name="end"
              defaultValue={searchParams.end || ""}
              className="input py-1.5"
            />
          </div>

          <button type="submit" className="btn-secondary">
            Apply Filters
          </button>

          <div className="flex-1" />

          <button type="button" className="btn-secondary">
            Export CSV
          </button>
        </form>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-6">
        <div className="card p-4">
          <p className="text-sm text-gray-500">Total Debits</p>
          <p className="text-2xl font-semibold text-gray-900">{formatCurrency(totalDebits)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Total Credits</p>
          <p className="text-2xl font-semibold text-green-600">{formatCurrency(totalCredits)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Net Movement</p>
          <p className={`text-2xl font-semibold ${totalCredits - totalDebits >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(totalCredits - totalDebits)}
          </p>
        </div>
      </div>

      {/* Ledger Table */}
      {ledgerWithBalance.length > 0 ? (
        <LedgerTable entries={ledgerWithBalance} />
      ) : (
        <div className="card p-12 text-center">
          <p className="text-gray-500 mb-4">
            No ledger entries found. Code your transactions to see them here.
          </p>
          <Link href="/my-accounts/transactions" className="btn-primary">
            Go to Transactions
          </Link>
        </div>
      )}
    </div>
  );
}
