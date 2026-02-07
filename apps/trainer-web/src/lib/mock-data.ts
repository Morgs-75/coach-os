// Shared mock data store for consistent data across API routes
// This ensures audit issues reference real transaction IDs

// Mock bank accounts
export const MOCK_BANK_ACCOUNTS = [
  { id: "ba-001", account_name: "Business Everyday", institution_name: "Commonwealth Bank" },
  { id: "ba-002", account_name: "Business Savings", institution_name: "Commonwealth Bank" },
];

// Mock chart of accounts for transaction references
export const MOCK_ACCOUNTS: Record<string, any> = {
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

// Seeded random number generator for deterministic mock data
function seededRandom(seed: number) {
  return function() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

// Generate deterministic mock transactions
function generateMockTransactionsInternal() {
  const random = seededRandom(42); // Fixed seed for consistent data
  const now = new Date("2024-02-01"); // Fixed date for consistency
  const transactions: any[] = [];

  const dateStr = (daysAgo: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split("T")[0];
  };

  const randAmount = (min: number, max: number) => Math.floor(random() * (max - min + 1) + min) * 100;
  const randChoice = <T>(arr: T[]): T => arr[Math.floor(random() * arr.length)];

  const clientNames = ["Sarah M", "John D", "Emma W", "Michael B", "Lisa K", "David R", "Sophie T", "James H", "Amy L", "Chris P"];
  const locations = ["MOORABBIN", "MELBOURNE CBD", "CHADSTONE", "SOUTH YARRA", "ST KILDA", "RICHMOND"];

  // Predefined transactions to ensure specific ones exist for audit
  const predefinedTransactions = [
    // txn-0001 through txn-0004: normal transactions
    { id: "txn-0001", date: 1, desc: "STRIPE TRANSFER", merchant: "Stripe", accountId: "acc-002", amount: 245000, direction: "credit", status: "coded" },
    { id: "txn-0002", date: 2, desc: "DIRECT CREDIT - Sarah M PT Session", merchant: null, accountId: "acc-002", amount: 12000, direction: "credit", status: "coded" },
    { id: "txn-0003", date: 3, desc: "META ADS 8374621", merchant: "Meta", accountId: "acc-104", amount: 15000, direction: "debit", status: "coded" },
    { id: "txn-0004", date: 4, desc: "TRUECOACH SUBSCRIPTION", merchant: "TrueCoach", accountId: "acc-106", amount: 5900, direction: "debit", status: "coded" },

    // txn-0005: Woolworths coded as Equipment (audit: personal_as_business)
    { id: "txn-0005", date: 5, desc: "WOOLWORTHS CHADSTONE", merchant: "Woolworths", accountId: "acc-101", amount: 8750, direction: "debit", status: "coded", taxTreatment: "gst" },

    // txn-0006 through txn-0009: normal transactions
    { id: "txn-0006", date: 6, desc: "DIRECT CREDIT - John D 10 pack", merchant: null, accountId: "acc-002", amount: 95000, direction: "credit", status: "coded" },
    { id: "txn-0007", date: 7, desc: "CANVA PRO", merchant: "Canva", accountId: "acc-106", amount: 1799, direction: "debit", status: "coded" },
    { id: "txn-0008", date: 8, desc: "BP PETROL MOORABBIN", merchant: "BP", accountId: "acc-108", amount: 8500, direction: "debit", status: "coded" },
    { id: "txn-0009", date: 9, desc: "TELSTRA MOBILE", merchant: "Telstra", accountId: "acc-109", amount: 8900, direction: "debit", status: "coded" },

    // txn-0010: Insurance with GST (audit: wrong_tax_treatment - should be gst_free)
    { id: "txn-0010", date: 10, desc: "BIZCOVER INSURANCE", merchant: "BizCover", accountId: "acc-103", amount: 89500, direction: "debit", status: "coded", taxTreatment: "gst" },

    // txn-0011 through txn-0014: normal transactions
    { id: "txn-0011", date: 11, desc: "STRIPE TRANSFER", merchant: "Stripe", accountId: "acc-002", amount: 185000, direction: "credit", status: "coded" },
    { id: "txn-0012", date: 12, desc: "ANYTIME FITNESS MEMBERSHIP", merchant: "Anytime Fitness", accountId: "acc-102", amount: 45000, direction: "debit", status: "coded" },
    { id: "txn-0013", date: 13, desc: "GOOGLE ADS 9283746", merchant: "Google", accountId: "acc-104", amount: 12500, direction: "debit", status: "coded" },
    { id: "txn-0014", date: 14, desc: "ZOOM VIDEO COMMUNICATIONS", merchant: "Zoom", accountId: "acc-106", amount: 2499, direction: "debit", status: "coded" },

    // txn-0015: Netflix coded as Software (audit: personal_as_business)
    { id: "txn-0015", date: 15, desc: "NETFLIX SUBSCRIPTION", merchant: "Netflix", accountId: "acc-106", amount: 2299, direction: "debit", status: "coded", taxTreatment: "gst" },

    // txn-0016 through txn-0019: normal transactions
    { id: "txn-0016", date: 16, desc: "DIRECT CREDIT - Emma W PT Session", merchant: null, accountId: "acc-002", amount: 8500, direction: "credit", status: "coded" },
    { id: "txn-0017", date: 17, desc: "MONTHLY ACCOUNT FEE", merchant: "Commonwealth Bank", accountId: "acc-107", amount: 1000, direction: "debit", status: "coded" },
    { id: "txn-0018", date: 18, desc: "REBEL SPORT", merchant: "Rebel Sport", accountId: "acc-101", amount: 24500, direction: "debit", status: "coded" },
    { id: "txn-0019", date: 19, desc: "SHELL COLES EXPRESS", merchant: "Shell", accountId: "acc-108", amount: 7500, direction: "debit", status: "coded" },

    // txn-0020: Unusually high fuel (audit: unusual_amount)
    { id: "txn-0020", date: 20, desc: "BP PETROL MOORABBIN", merchant: "BP", accountId: "acc-108", amount: 18745, direction: "debit", status: "coded", taxTreatment: "gst" },

    // txn-0021 through txn-0024: normal transactions
    { id: "txn-0021", date: 21, desc: "DIRECT CREDIT - Michael B PT Session", merchant: null, accountId: "acc-002", amount: 9000, direction: "credit", status: "coded" },
    { id: "txn-0022", date: 22, desc: "OPTUS INTERNET", merchant: "Optus", accountId: "acc-109", amount: 7900, direction: "debit", status: "coded" },
    { id: "txn-0023", date: 23, desc: "MINDBODY SUBSCRIPTION", merchant: "Mindbody", accountId: "acc-106", amount: 15900, direction: "debit", status: "coded" },
    { id: "txn-0024", date: 24, desc: "F45 FRANCHISE FEE", merchant: "F45", accountId: "acc-102", amount: 95000, direction: "debit", status: "coded" },

    // txn-0025: Large Stripe deposit (audit: split_recommended)
    { id: "txn-0025", date: 25, desc: "STRIPE TRANSFER", merchant: "Stripe", accountId: "acc-002", amount: 425000, direction: "credit", status: "coded", taxTreatment: "gst" },

    // txn-0026 through txn-0029: normal transactions
    { id: "txn-0026", date: 26, desc: "DIRECT CREDIT - Lisa K 10 pack", merchant: null, accountId: "acc-002", amount: 85000, direction: "credit", status: "coded" },
    { id: "txn-0027", date: 27, desc: "7-ELEVEN RICHMOND", merchant: "7-Eleven", accountId: "acc-108", amount: 4500, direction: "debit", status: "coded" },
    { id: "txn-0028", date: 28, desc: "AMAZON MARKETPLACE", merchant: "Amazon", accountId: "acc-101", amount: 12900, direction: "debit", status: "coded" },
    { id: "txn-0029", date: 29, desc: "ANYTIME FITNESS MEMBERSHIP", merchant: "Anytime Fitness", accountId: "acc-102", amount: 45000, direction: "debit", status: "coded" },

    // txn-0030: Duplicate suspected (another Anytime Fitness on consecutive day)
    { id: "txn-0030", date: 30, desc: "ANYTIME FITNESS MEMBERSHIP", merchant: "Anytime Fitness", accountId: "acc-102", amount: 45000, direction: "debit", status: "coded", taxTreatment: "gst" },

    // txn-0031 through txn-0034: normal transactions
    { id: "txn-0031", date: 31, desc: "STRIPE TRANSFER", merchant: "Stripe", accountId: "acc-002", amount: 156000, direction: "credit", status: "coded" },
    { id: "txn-0032", date: 32, desc: "MERCHANT SERVICE FEE", merchant: "Commonwealth Bank", accountId: "acc-107", amount: 3500, direction: "debit", status: "coded" },
    { id: "txn-0033", date: 33, desc: "META ADS 9182736", merchant: "Meta", accountId: "acc-104", amount: 20000, direction: "debit", status: "coded" },
    { id: "txn-0034", date: 34, desc: "ROGUE FITNESS", merchant: "Rogue Fitness", accountId: "acc-101", amount: 45000, direction: "debit", status: "coded" },

    // txn-0035: Amazon coded as Software (audit: inconsistent_coding)
    { id: "txn-0035", date: 35, desc: "AMAZON MARKETPLACE", merchant: "Amazon", accountId: "acc-106", amount: 4599, direction: "debit", status: "coded", taxTreatment: "gst" },
  ];

  // Add predefined transactions
  for (const pt of predefinedTransactions) {
    const account = MOCK_ACCOUNTS[pt.accountId];
    transactions.push({
      id: pt.id,
      org_id: "org-001",
      transaction_date: dateStr(pt.date),
      description: pt.desc,
      merchant_name: pt.merchant,
      amount_cents: pt.amount,
      direction: pt.direction,
      status: pt.status,
      account_id: pt.accountId,
      account: account,
      bank_account_id: "ba-001",
      bank_account: MOCK_BANK_ACCOUNTS[0],
      tax_treatment: pt.taxTreatment || account?.tax_treatment || "gst",
      matched_money_event_id: pt.merchant === "Stripe" ? `me-${pt.id.slice(-3)}` : null,
      match_type: pt.merchant === "Stripe" ? "exact" : null,
      gst_cents: (pt.taxTreatment || account?.tax_treatment) === "gst" ? Math.round(pt.amount / 11) : 0,
      coded_at: new Date().toISOString(),
    });
  }

  // Generate remaining transactions to reach 200
  let txnId = 36;
  const incomeTemplates = [
    { desc: "STRIPE TRANSFER", merchant: "Stripe", accountId: "acc-002", minAmt: 1500, maxAmt: 5000 },
    { desc: "DIRECT CREDIT - {client} PT Session", merchant: null, accountId: "acc-002", minAmt: 80, maxAmt: 150 },
    { desc: "PAYPAL TRANSFER", merchant: "PayPal", accountId: "acc-002", minAmt: 500, maxAmt: 2000 },
  ];

  const expenseTemplates = [
    { desc: "META ADS {ref}", merchant: "Meta", accountId: "acc-104", minAmt: 50, maxAmt: 300, taxTreatment: "gst" },
    { desc: "BP PETROL {location}", merchant: "BP", accountId: "acc-108", minAmt: 60, maxAmt: 150, taxTreatment: "gst" },
    { desc: "CANVA PRO", merchant: "Canva", accountId: "acc-106", minAmt: 15, maxAmt: 20, taxTreatment: "gst" },
    { desc: "TELSTRA MOBILE", merchant: "Telstra", accountId: "acc-109", minAmt: 60, maxAmt: 120, taxTreatment: "gst" },
  ];

  const personalTemplates = [
    { desc: "SPOTIFY PREMIUM", merchant: "Spotify", minAmt: 12, maxAmt: 15 },
    { desc: "COLES SUPERMARKET", merchant: "Coles", minAmt: 40, maxAmt: 180 },
    { desc: "UBER EATS", merchant: "Uber Eats", minAmt: 20, maxAmt: 60 },
  ];

  for (let day = 36; day < 365 && transactions.length < 200; day++) {
    const txnsToday = Math.floor(random() * 3);

    for (let t = 0; t < txnsToday && transactions.length < 200; t++) {
      const rand = random();
      let txn: any;

      if (rand < 0.35) {
        const template = randChoice(incomeTemplates);
        const client = randChoice(clientNames);
        const desc = template.desc.replace("{client}", client);
        const amount = randAmount(template.minAmt, template.maxAmt);
        const status = random() < 0.7 ? "coded" : "uncoded";

        txn = {
          id: `txn-${String(txnId++).padStart(4, "0")}`,
          org_id: "org-001",
          transaction_date: dateStr(day),
          description: desc,
          merchant_name: template.merchant,
          amount_cents: amount,
          direction: "credit",
          status,
          account_id: status === "coded" ? template.accountId : null,
          account: status === "coded" ? MOCK_ACCOUNTS[template.accountId] : null,
          bank_account_id: random() < 0.8 ? "ba-001" : "ba-002",
          bank_account: random() < 0.8 ? MOCK_BANK_ACCOUNTS[0] : MOCK_BANK_ACCOUNTS[1],
          tax_treatment: status === "coded" ? "gst" : null,
          gst_cents: status === "coded" ? Math.round(amount / 11) : 0,
          ai_suggested_account_id: status === "uncoded" ? template.accountId : null,
          ai_suggested_account: status === "uncoded" ? MOCK_ACCOUNTS[template.accountId] : null,
          ai_confidence: status === "uncoded" ? 0.75 + random() * 0.2 : null,
        };
      } else if (rand < 0.75) {
        const template = randChoice(expenseTemplates);
        const ref = String(Math.floor(random() * 9000000) + 1000000);
        const location = randChoice(locations);
        const desc = template.desc.replace("{ref}", ref).replace("{location}", location);
        const amount = randAmount(template.minAmt, template.maxAmt);
        const status = random() < 0.65 ? "coded" : "uncoded";

        txn = {
          id: `txn-${String(txnId++).padStart(4, "0")}`,
          org_id: "org-001",
          transaction_date: dateStr(day),
          description: desc,
          merchant_name: template.merchant,
          amount_cents: amount,
          direction: "debit",
          status,
          account_id: status === "coded" ? template.accountId : null,
          account: status === "coded" ? MOCK_ACCOUNTS[template.accountId] : null,
          bank_account_id: random() < 0.9 ? "ba-001" : "ba-002",
          bank_account: random() < 0.9 ? MOCK_BANK_ACCOUNTS[0] : MOCK_BANK_ACCOUNTS[1],
          tax_treatment: status === "coded" ? template.taxTreatment : null,
          gst_cents: status === "coded" && template.taxTreatment === "gst" ? Math.round(amount / 11) : 0,
          ai_suggested_account_id: status === "uncoded" ? template.accountId : null,
          ai_suggested_account: status === "uncoded" ? MOCK_ACCOUNTS[template.accountId] : null,
          ai_confidence: status === "uncoded" ? 0.70 + random() * 0.25 : null,
        };
      } else {
        const template = randChoice(personalTemplates);
        const desc = template.desc;
        const amount = randAmount(template.minAmt, template.maxAmt);
        const statusRand = random();
        const status = statusRand < 0.4 ? "excluded" : statusRand < 0.7 ? "uncoded" : "coded";

        txn = {
          id: `txn-${String(txnId++).padStart(4, "0")}`,
          org_id: "org-001",
          transaction_date: dateStr(day),
          description: desc,
          merchant_name: template.merchant,
          amount_cents: amount,
          direction: "debit",
          status,
          account_id: status !== "uncoded" ? "acc-203" : null,
          account: status !== "uncoded" ? MOCK_ACCOUNTS["acc-203"] : null,
          bank_account_id: "ba-001",
          bank_account: MOCK_BANK_ACCOUNTS[0],
          tax_treatment: status !== "uncoded" ? "bas_excluded" : null,
          gst_cents: 0,
          ai_suggested_account_id: status === "uncoded" ? "acc-203" : null,
          ai_suggested_account: status === "uncoded" ? MOCK_ACCOUNTS["acc-203"] : null,
          ai_confidence: status === "uncoded" ? 0.80 + random() * 0.15 : null,
        };
      }

      transactions.push(txn);
    }
  }

  return transactions.sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
}

// Cached mock transactions (singleton pattern)
let cachedTransactions: any[] | null = null;

export function getMockTransactions() {
  if (!cachedTransactions) {
    cachedTransactions = generateMockTransactionsInternal();
  }
  return cachedTransactions;
}

// Reset cache (useful for testing)
export function resetMockTransactions() {
  cachedTransactions = null;
}
