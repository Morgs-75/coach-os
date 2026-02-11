import { createClient } from "@/lib/supabase/server";
import { LedgerClient } from "./LedgerClient";
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

// Generate mock ledger data from coded transactions
function generateMockLedgerData() {
  const now = new Date();
  const entries: any[] = [];

  const dateStr = (daysAgo: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split("T")[0];
  };

  const randAmount = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min) * 100;

  // Income entries
  const incomeEntries = [
    { code: "INC-002", name: "PT Sessions", desc: "STRIPE TRANSFER" },
    { code: "INC-002", name: "PT Sessions", desc: "DIRECT CREDIT - Client Payment" },
    { code: "INC-003", name: "Group Classes", desc: "CASH DEPOSIT - Group Class" },
    { code: "INC-006", name: "Merchandise Sales", desc: "SQUARE DEPOSIT" },
  ];

  // Expense entries
  const expenseEntries = [
    { code: "EXP-001", name: "Equipment & Supplies", desc: "REBEL SPORT", tax: "gst" },
    { code: "EXP-002", name: "Gym Rent / Facility Fees", desc: "ANYTIME FITNESS", tax: "gst" },
    { code: "EXP-003", name: "Insurance", desc: "BIZCOVER INSURANCE", tax: "gst_free" },
    { code: "EXP-004", name: "Marketing & Social Media Ads", desc: "META ADS", tax: "gst" },
    { code: "EXP-006", name: "Software Subscriptions", desc: "TRUECOACH", tax: "gst" },
    { code: "EXP-007", name: "Bank Fees", desc: "MONTHLY ACCOUNT FEE", tax: "gst_free" },
    { code: "EXP-008", name: "Motor Vehicle Expenses", desc: "BP PETROL", tax: "gst" },
    { code: "EXP-009", name: "Phone & Internet", desc: "TELSTRA MOBILE", tax: "gst" },
  ];

  let entryId = 1;

  // Generate 150 ledger entries over 180 days
  for (let day = 0; day < 180; day++) {
    const entriesPerDay = Math.floor(Math.random() * 3);

    for (let e = 0; e < entriesPerDay && entries.length < 150; e++) {
      const isIncome = Math.random() < 0.4;

      if (isIncome) {
        const template = incomeEntries[Math.floor(Math.random() * incomeEntries.length)];
        entries.push({
          id: `ledger-${String(entryId++).padStart(4, "0")}`,
          org_id: "mock",
          transaction_date: dateStr(day),
          account_code: template.code,
          account_name: template.name,
          description: template.desc,
          amount_cents: randAmount(800, 5000),
          gst_cents: Math.round(randAmount(800, 5000) / 11),
          direction: "credit",
          tax_treatment: "gst",
          bank_account_name: "Business Everyday",
        });
      } else {
        const template = expenseEntries[Math.floor(Math.random() * expenseEntries.length)];
        const amount = randAmount(50, 500);
        entries.push({
          id: `ledger-${String(entryId++).padStart(4, "0")}`,
          org_id: "mock",
          transaction_date: dateStr(day),
          account_code: template.code,
          account_name: template.name,
          description: template.desc,
          amount_cents: amount,
          gst_cents: template.tax === "gst" ? Math.round(amount / 11) : 0,
          direction: "debit",
          tax_treatment: template.tax,
          bank_account_name: "Business Everyday",
        });
      }
    }
  }

  return entries.sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
}

// Mock chart of accounts
const MOCK_ACCOUNTS = [
  { id: "acc-001", code: "INC-001", name: "Client Training Income", category: "income" },
  { id: "acc-002", code: "INC-002", name: "PT Sessions", category: "income" },
  { id: "acc-003", code: "INC-003", name: "Group Classes", category: "income" },
  { id: "acc-006", code: "INC-006", name: "Merchandise Sales", category: "income" },
  { id: "acc-101", code: "EXP-001", name: "Equipment & Supplies", category: "expense" },
  { id: "acc-102", code: "EXP-002", name: "Gym Rent / Facility Fees", category: "expense" },
  { id: "acc-103", code: "EXP-003", name: "Insurance", category: "expense" },
  { id: "acc-104", code: "EXP-004", name: "Marketing & Social Media Ads", category: "expense" },
  { id: "acc-106", code: "EXP-006", name: "Software Subscriptions", category: "expense" },
  { id: "acc-107", code: "EXP-007", name: "Bank Fees", category: "expense" },
  { id: "acc-108", code: "EXP-008", name: "Motor Vehicle Expenses", category: "expense" },
  { id: "acc-109", code: "EXP-009", name: "Phone & Internet", category: "expense" },
  { id: "acc-201", code: "OTH-001", name: "Owner Drawings", category: "other" },
  { id: "acc-203", code: "OTH-003", name: "Personal / Exclude", category: "other" },
];

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
  const { data: accounts, error: accountsError } = await supabase
    .from("chart_of_accounts")
    .select("*")
    .or(`org_id.eq.${orgId},org_id.is.null`)
    .eq("is_active", true)
    .order("display_order");

  // Use mock accounts if DB error
  const accountsList = accountsError ? MOCK_ACCOUNTS : (accounts || []);

  // Build query for ledger
  let query = supabase
    .from("cashbook_ledger")
    .select("*")
    .eq("org_id", orgId)
    .order("transaction_date", { ascending: false });

  // Apply filters
  const awaitedParams = await searchParams;
  if (awaitedParams.account) {
    query = query.eq("account_code", awaitedParams.account);
  }
  if (awaitedParams.start) {
    query = query.gte("transaction_date", awaitedParams.start);
  }
  if (awaitedParams.end) {
    query = query.lte("transaction_date", awaitedParams.end);
  }

  const { data: ledgerData, error: ledgerError } = await query.limit(500);

  // Use mock data if DB error (expected when tables don't exist yet)
  let finalLedgerData = ledgerData || [];
  if (ledgerError) {
    let mockData = generateMockLedgerData();

    // Apply filters to mock data
    if (awaitedParams.account) {
      mockData = mockData.filter(e => e.account_code === awaitedParams.account);
    }
    if (awaitedParams.start) {
      mockData = mockData.filter(e => e.transaction_date >= awaitedParams.start!);
    }
    if (awaitedParams.end) {
      mockData = mockData.filter(e => e.transaction_date <= awaitedParams.end!);
    }
    finalLedgerData = mockData;
  }

  // Calculate running balance and totals
  let runningBalance = 0;
  const ledgerWithBalance = finalLedgerData.slice().reverse().map((entry: any) => {
    const signedAmount = entry.direction === "credit" ? entry.amount_cents : -entry.amount_cents;
    runningBalance += signedAmount;
    return { ...entry, running_balance: runningBalance };
  }).reverse();

  const totalDebits = finalLedgerData.filter((e: any) => e.direction === "debit")
    .reduce((sum: number, e: any) => sum + e.amount_cents, 0);
  const totalCredits = finalLedgerData.filter((e: any) => e.direction === "credit")
    .reduce((sum: number, e: any) => sum + e.amount_cents, 0);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="card p-4">
        <form className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Account:</label>
            <select
              name="account"
              defaultValue={awaitedParams.account || ""}
              className="input py-1.5 w-56"
            >
              <option value="">All Accounts</option>
              <optgroup label="Income">
                {accountsList.filter((a: any) => a.category === "income").map((account: any) => (
                  <option key={account.id} value={account.code}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Expenses">
                {accountsList.filter((a: any) => a.category === "expense").map((account: any) => (
                  <option key={account.id} value={account.code}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Other">
                {accountsList.filter((a: any) => a.category === "other").map((account: any) => (
                  <option key={account.id} value={account.code}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">From:</label>
            <input
              type="date"
              name="start"
              defaultValue={awaitedParams.start || ""}
              className="input py-1.5"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">To:</label>
            <input
              type="date"
              name="end"
              defaultValue={awaitedParams.end || ""}
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

      {/* Ledger Content */}
      <LedgerClient
        entries={ledgerWithBalance}
        accounts={accountsList}
        totalDebits={totalDebits}
        totalCredits={totalCredits}
      />
    </div>
  );
}
