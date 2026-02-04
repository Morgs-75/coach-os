import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Mock bank accounts
const MOCK_BANK_ACCOUNTS = [
  { id: "ba-001", account_name: "Business Everyday", institution_name: "Commonwealth Bank" },
  { id: "ba-002", account_name: "Business Savings", institution_name: "Commonwealth Bank" },
];

// Mock chart of accounts for transaction references
const MOCK_ACCOUNTS = {
  "acc-001": { id: "acc-001", code: "INC-001", name: "Client Training Income", category: "income", tax_treatment: "gst" },
  "acc-002": { id: "acc-002", code: "INC-002", name: "PT Sessions", category: "income", tax_treatment: "gst" },
  "acc-003": { id: "acc-003", code: "INC-003", name: "Group Classes", category: "income", tax_treatment: "gst" },
  "acc-006": { id: "acc-006", code: "INC-006", name: "Merchandise Sales", category: "income", tax_treatment: "gst" },
  "acc-101": { id: "acc-101", code: "EXP-001", name: "Equipment & Supplies", category: "expense", tax_treatment: "gst" },
  "acc-102": { id: "acc-102", code: "EXP-002", name: "Gym Rent / Facility Fees", category: "expense", tax_treatment: "gst" },
  "acc-103": { id: "acc-103", code: "EXP-003", name: "Insurance", category: "expense", tax_treatment: "gst_free" },
  "acc-104": { id: "acc-104", code: "EXP-004", name: "Marketing & Social Media Ads", category: "expense", tax_treatment: "gst" },
  "acc-106": { id: "acc-106", code: "EXP-006", name: "Software Subscriptions", category: "expense", tax_treatment: "gst" },
  "acc-107": { id: "acc-107", code: "EXP-007", name: "Bank Fees", category: "expense", tax_treatment: "gst_free" },
  "acc-108": { id: "acc-108", code: "EXP-008", name: "Motor Vehicle Expenses", category: "expense", tax_treatment: "gst" },
  "acc-109": { id: "acc-109", code: "EXP-009", name: "Phone & Internet", category: "expense", tax_treatment: "gst" },
  "acc-201": { id: "acc-201", code: "OTH-001", name: "Owner Drawings", category: "other", tax_treatment: "bas_excluded" },
  "acc-203": { id: "acc-203", code: "OTH-003", name: "Personal / Exclude", category: "other", tax_treatment: "bas_excluded" },
};

// Generate mock transactions for testing
function generateMockTransactions() {
  const now = new Date();
  const transactions = [];

  // Helper to create a date string
  const dateStr = (daysAgo: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split("T")[0];
  };

  // Coded transactions (income)
  transactions.push(
    { id: "txn-001", transaction_date: dateStr(1), description: "STRIPE TRANSFER", merchant_name: "Stripe", amount_cents: 245000, direction: "credit", status: "coded", account_id: "acc-002", account: MOCK_ACCOUNTS["acc-002"], bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: "gst", matched_money_event_id: "me-001", match_type: "exact", ai_suggested_account_id: null, ai_suggested_account: null, ai_confidence: null, ai_reasoning: null },
    { id: "txn-002", transaction_date: dateStr(3), description: "STRIPE TRANSFER", merchant_name: "Stripe", amount_cents: 189500, direction: "credit", status: "coded", account_id: "acc-002", account: MOCK_ACCOUNTS["acc-002"], bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: "gst", matched_money_event_id: "me-002", match_type: "exact", ai_suggested_account_id: null, ai_suggested_account: null, ai_confidence: null, ai_reasoning: null },
    { id: "txn-003", transaction_date: dateStr(5), description: "DIRECT CREDIT - Sarah M PT Session", merchant_name: null, amount_cents: 8500, direction: "credit", status: "coded", account_id: "acc-002", account: MOCK_ACCOUNTS["acc-002"], bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: "gst", matched_money_event_id: null, match_type: null, ai_suggested_account_id: null, ai_suggested_account: null, ai_confidence: null, ai_reasoning: null },
    { id: "txn-004", transaction_date: dateStr(7), description: "STRIPE TRANSFER", merchant_name: "Stripe", amount_cents: 312000, direction: "credit", status: "coded", account_id: "acc-002", account: MOCK_ACCOUNTS["acc-002"], bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: "gst", matched_money_event_id: "me-003", match_type: "fuzzy", ai_suggested_account_id: null, ai_suggested_account: null, ai_confidence: null, ai_reasoning: null },
    { id: "txn-005", transaction_date: dateStr(8), description: "CASH DEPOSIT - Group Class", merchant_name: null, amount_cents: 15000, direction: "credit", status: "coded", account_id: "acc-003", account: MOCK_ACCOUNTS["acc-003"], bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: "gst", matched_money_event_id: null, match_type: null, ai_suggested_account_id: null, ai_suggested_account: null, ai_confidence: null, ai_reasoning: null },
  );

  // Coded transactions (expenses)
  transactions.push(
    { id: "txn-101", transaction_date: dateStr(2), description: "ANYTIME FITNESS MEMBERSHIP", merchant_name: "Anytime Fitness", amount_cents: 45000, direction: "debit", status: "coded", account_id: "acc-102", account: MOCK_ACCOUNTS["acc-102"], bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: "gst", matched_money_event_id: null, match_type: null, ai_suggested_account_id: null, ai_suggested_account: null, ai_confidence: null, ai_reasoning: null },
    { id: "txn-102", transaction_date: dateStr(4), description: "META ADS 4829173", merchant_name: "Meta", amount_cents: 12500, direction: "debit", status: "coded", account_id: "acc-104", account: MOCK_ACCOUNTS["acc-104"], bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: "gst", matched_money_event_id: null, match_type: null, ai_suggested_account_id: null, ai_suggested_account: null, ai_confidence: null, ai_reasoning: null },
    { id: "txn-103", transaction_date: dateStr(6), description: "TRUECOACH SUBSCRIPTION", merchant_name: "TrueCoach", amount_cents: 4900, direction: "debit", status: "coded", account_id: "acc-106", account: MOCK_ACCOUNTS["acc-106"], bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: "gst", matched_money_event_id: null, match_type: null, ai_suggested_account_id: null, ai_suggested_account: null, ai_confidence: null, ai_reasoning: null },
    { id: "txn-104", transaction_date: dateStr(9), description: "TELSTRA MOBILE", merchant_name: "Telstra", amount_cents: 7900, direction: "debit", status: "coded", account_id: "acc-109", account: MOCK_ACCOUNTS["acc-109"], bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: "gst", matched_money_event_id: null, match_type: null, ai_suggested_account_id: null, ai_suggested_account: null, ai_confidence: null, ai_reasoning: null },
    { id: "txn-105", transaction_date: dateStr(10), description: "BP PETROL MOORABBIN", merchant_name: "BP", amount_cents: 8745, direction: "debit", status: "coded", account_id: "acc-108", account: MOCK_ACCOUNTS["acc-108"], bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: "gst", matched_money_event_id: null, match_type: null, ai_suggested_account_id: null, ai_suggested_account: null, ai_confidence: null, ai_reasoning: null },
    { id: "txn-106", transaction_date: dateStr(12), description: "MONTHLY ACCOUNT FEE", merchant_name: "Commonwealth Bank", amount_cents: 1000, direction: "debit", status: "coded", account_id: "acc-107", account: MOCK_ACCOUNTS["acc-107"], bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: "gst_free", matched_money_event_id: null, match_type: null, ai_suggested_account_id: null, ai_suggested_account: null, ai_confidence: null, ai_reasoning: null },
    { id: "txn-107", transaction_date: dateStr(15), description: "REBEL SPORT MELBOURNE", merchant_name: "Rebel Sport", amount_cents: 15900, direction: "debit", status: "coded", account_id: "acc-101", account: MOCK_ACCOUNTS["acc-101"], bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: "gst", matched_money_event_id: null, match_type: null, ai_suggested_account_id: null, ai_suggested_account: null, ai_confidence: null, ai_reasoning: null },
  );

  // Uncoded transactions with AI suggestions
  transactions.push(
    { id: "txn-201", transaction_date: dateStr(0), description: "STRIPE TRANSFER", merchant_name: "Stripe", amount_cents: 178500, direction: "credit", status: "uncoded", account_id: null, account: null, bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: null, matched_money_event_id: null, match_type: null, ai_suggested_account_id: "acc-002", ai_suggested_account: MOCK_ACCOUNTS["acc-002"], ai_confidence: 0.95, ai_reasoning: "Stripe deposits are typically PT session income based on your coding history" },
    { id: "txn-202", transaction_date: dateStr(1), description: "GOOGLE ADS 7482910", merchant_name: "Google", amount_cents: 8900, direction: "debit", status: "uncoded", account_id: null, account: null, bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: null, matched_money_event_id: null, match_type: null, ai_suggested_account_id: "acc-104", ai_suggested_account: MOCK_ACCOUNTS["acc-104"], ai_confidence: 0.92, ai_reasoning: "Google Ads charges are marketing expenses" },
    { id: "txn-203", transaction_date: dateStr(2), description: "AMAZON PRIME MEMBERSHIP", merchant_name: "Amazon", amount_cents: 990, direction: "debit", status: "uncoded", account_id: null, account: null, bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: null, matched_money_event_id: null, match_type: null, ai_suggested_account_id: "acc-203", ai_suggested_account: MOCK_ACCOUNTS["acc-203"], ai_confidence: 0.78, ai_reasoning: "Amazon Prime appears to be a personal subscription" },
    { id: "txn-204", transaction_date: dateStr(3), description: "7-ELEVEN MOORABBIN", merchant_name: "7-Eleven", amount_cents: 4500, direction: "debit", status: "uncoded", account_id: null, account: null, bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: null, matched_money_event_id: null, match_type: null, ai_suggested_account_id: "acc-108", ai_suggested_account: MOCK_ACCOUNTS["acc-108"], ai_confidence: 0.65, ai_reasoning: "Convenience store near your gym - likely fuel or snacks" },
    { id: "txn-205", transaction_date: dateStr(4), description: "CANVA SUBSCRIPTION", merchant_name: "Canva", amount_cents: 1799, direction: "debit", status: "uncoded", account_id: null, account: null, bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: null, matched_money_event_id: null, match_type: null, ai_suggested_account_id: "acc-106", ai_suggested_account: MOCK_ACCOUNTS["acc-106"], ai_confidence: 0.88, ai_reasoning: "Canva is a design software - likely for marketing materials" },
    { id: "txn-206", transaction_date: dateStr(5), description: "DIRECT CREDIT - John D", merchant_name: null, amount_cents: 17000, direction: "credit", status: "uncoded", account_id: null, account: null, bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: null, matched_money_event_id: null, match_type: null, ai_suggested_account_id: "acc-002", ai_suggested_account: MOCK_ACCOUNTS["acc-002"], ai_confidence: 0.82, ai_reasoning: "Direct credit from individual - likely client payment for PT sessions" },
    { id: "txn-207", transaction_date: dateStr(6), description: "WOOLWORTHS CHADSTONE", merchant_name: "Woolworths", amount_cents: 8750, direction: "debit", status: "uncoded", account_id: null, account: null, bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: null, matched_money_event_id: null, match_type: null, ai_suggested_account_id: "acc-203", ai_suggested_account: MOCK_ACCOUNTS["acc-203"], ai_confidence: 0.85, ai_reasoning: "Grocery store purchase - likely personal expense" },
    { id: "txn-208", transaction_date: dateStr(7), description: "SPOTIFY PREMIUM", merchant_name: "Spotify", amount_cents: 1299, direction: "debit", status: "uncoded", account_id: null, account: null, bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: null, matched_money_event_id: null, match_type: null, ai_suggested_account_id: "acc-106", ai_suggested_account: MOCK_ACCOUNTS["acc-106"], ai_confidence: 0.72, ai_reasoning: "Spotify could be business (gym music) or personal" },
    { id: "txn-209", transaction_date: dateStr(8), description: "ATM WITHDRAWAL MELBOURNE CBD", merchant_name: null, amount_cents: 20000, direction: "debit", status: "uncoded", account_id: null, account: null, bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: null, matched_money_event_id: null, match_type: null, ai_suggested_account_id: "acc-201", ai_suggested_account: MOCK_ACCOUNTS["acc-201"], ai_confidence: 0.90, ai_reasoning: "Cash withdrawal - typically owner drawings" },
    { id: "txn-210", transaction_date: dateStr(9), description: "ZOOM VIDEO COMMUNICATIONS", merchant_name: "Zoom", amount_cents: 2199, direction: "debit", status: "uncoded", account_id: null, account: null, bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: null, matched_money_event_id: null, match_type: null, ai_suggested_account_id: "acc-106", ai_suggested_account: MOCK_ACCOUNTS["acc-106"], ai_confidence: 0.91, ai_reasoning: "Zoom subscription - software for online coaching" },
  );

  // Excluded transactions
  transactions.push(
    { id: "txn-301", transaction_date: dateStr(11), description: "NETFLIX SUBSCRIPTION", merchant_name: "Netflix", amount_cents: 2299, direction: "debit", status: "excluded", account_id: "acc-203", account: MOCK_ACCOUNTS["acc-203"], bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: "bas_excluded", matched_money_event_id: null, match_type: null, ai_suggested_account_id: null, ai_suggested_account: null, ai_confidence: null, ai_reasoning: null },
    { id: "txn-302", transaction_date: dateStr(14), description: "TRANSFER TO SAVINGS", merchant_name: null, amount_cents: 100000, direction: "debit", status: "excluded", account_id: "acc-203", account: MOCK_ACCOUNTS["acc-203"], bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: "bas_excluded", matched_money_event_id: null, match_type: null, ai_suggested_account_id: null, ai_suggested_account: null, ai_confidence: null, ai_reasoning: null },
  );

  // More income for variety
  transactions.push(
    { id: "txn-401", transaction_date: dateStr(16), description: "STRIPE TRANSFER", merchant_name: "Stripe", amount_cents: 425000, direction: "credit", status: "coded", account_id: "acc-002", account: MOCK_ACCOUNTS["acc-002"], bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: "gst", matched_money_event_id: "me-004", match_type: "exact", ai_suggested_account_id: null, ai_suggested_account: null, ai_confidence: null, ai_reasoning: null },
    { id: "txn-402", transaction_date: dateStr(18), description: "DIRECT CREDIT - Emma W 10 pack", merchant_name: null, amount_cents: 75000, direction: "credit", status: "coded", account_id: "acc-002", account: MOCK_ACCOUNTS["acc-002"], bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: "gst", matched_money_event_id: null, match_type: null, ai_suggested_account_id: null, ai_suggested_account: null, ai_confidence: null, ai_reasoning: null },
    { id: "txn-403", transaction_date: dateStr(20), description: "CASH DEPOSIT", merchant_name: null, amount_cents: 34000, direction: "credit", status: "coded", account_id: "acc-003", account: MOCK_ACCOUNTS["acc-003"], bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: "gst", matched_money_event_id: null, match_type: null, ai_suggested_account_id: null, ai_suggested_account: null, ai_confidence: null, ai_reasoning: null },
  );

  // More expenses
  transactions.push(
    { id: "txn-501", transaction_date: dateStr(17), description: "COLES EXPRESS FUEL", merchant_name: "Coles", amount_cents: 9850, direction: "debit", status: "coded", account_id: "acc-108", account: MOCK_ACCOUNTS["acc-108"], bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: "gst", matched_money_event_id: null, match_type: null, ai_suggested_account_id: null, ai_suggested_account: null, ai_confidence: null, ai_reasoning: null },
    { id: "txn-502", transaction_date: dateStr(19), description: "BIZCOVER INSURANCE", merchant_name: "BizCover", amount_cents: 89500, direction: "debit", status: "coded", account_id: "acc-103", account: MOCK_ACCOUNTS["acc-103"], bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: "gst_free", matched_money_event_id: null, match_type: null, ai_suggested_account_id: null, ai_suggested_account: null, ai_confidence: null, ai_reasoning: null },
    { id: "txn-503", transaction_date: dateStr(21), description: "AMAZON MARKETPLACE", merchant_name: "Amazon", amount_cents: 4599, direction: "debit", status: "coded", account_id: "acc-101", account: MOCK_ACCOUNTS["acc-101"], bank_account_id: "ba-001", bank_account: MOCK_BANK_ACCOUNTS[0], tax_treatment: "gst", matched_money_event_id: null, match_type: null, ai_suggested_account_id: null, ai_suggested_account: null, ai_confidence: null, ai_reasoning: null, notes: "Resistance bands" },
  );

  return transactions.sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
}

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

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId(supabase);

    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const bankAccountId = url.searchParams.get("bank_account_id");
    const startDate = url.searchParams.get("start_date");
    const endDate = url.searchParams.get("end_date");
    const limit = parseInt(url.searchParams.get("limit") || "200");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    let query = supabase
      .from("bank_transactions")
      .select(`
        *,
        bank_account:bank_accounts(id, account_name, institution_name),
        account:chart_of_accounts!bank_transactions_account_id_fkey(id, code, name, category, tax_treatment),
        ai_suggested_account:chart_of_accounts!bank_transactions_ai_suggested_account_id_fkey(id, code, name, category, tax_treatment),
        matched_money_event:money_events(id, type, amount_cents, event_date, notes)
      `)
      .eq("org_id", orgId)
      .order("transaction_date", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (bankAccountId && bankAccountId !== "all") {
      query = query.eq("bank_account_id", bankAccountId);
    }
    if (startDate) {
      query = query.gte("transaction_date", startDate);
    }
    if (endDate) {
      query = query.lte("transaction_date", endDate);
    }

    const { data: transactions, error } = await query;

    if (error) {
      console.error("Transactions fetch error:", error);
      // Return mock data for UI testing when DB tables don't exist
      let mockTransactions = generateMockTransactions();

      // Apply filters to mock data
      if (status && status !== "all") {
        mockTransactions = mockTransactions.filter(t => t.status === status);
      }
      if (bankAccountId && bankAccountId !== "all") {
        mockTransactions = mockTransactions.filter(t => t.bank_account_id === bankAccountId);
      }
      if (startDate) {
        mockTransactions = mockTransactions.filter(t => t.transaction_date >= startDate);
      }
      if (endDate) {
        mockTransactions = mockTransactions.filter(t => t.transaction_date <= endDate);
      }

      return NextResponse.json({
        transactions: mockTransactions.slice(offset, offset + limit),
        _mock: true,
      });
    }

    return NextResponse.json({
      transactions: transactions || [],
    });
  } catch (error) {
    console.error("Transactions fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}
