/**
 * Transaction Matcher
 *
 * Matches bank transactions to money_events (platform payments)
 * using exact, fuzzy, and aggregated matching strategies.
 */

interface BankTransactionInput {
  description: string;
  amount_cents: number;
  date: string;
  direction: "credit" | "debit";
}

interface MoneyEvent {
  id: string;
  type: string;
  amount_cents: number;
  event_date: string;
  reference_id: string | null;
  notes: string | null;
  source: string;
}

interface MatchResult {
  money_event_id: string;
  match_type: "exact" | "fuzzy" | "aggregated";
  confidence: number;
}

/**
 * Attempts to match a bank transaction to platform money events
 */
export function matchTransactionToMoneyEvents(
  transaction: BankTransactionInput,
  moneyEvents: MoneyEvent[]
): MatchResult | null {
  // Only match credits (income) to platform payments
  if (transaction.direction !== "credit") {
    return null;
  }

  // Try exact match first
  const exactMatch = findExactMatch(transaction, moneyEvents);
  if (exactMatch) {
    return exactMatch;
  }

  // Try fuzzy match
  const fuzzyMatch = findFuzzyMatch(transaction, moneyEvents);
  if (fuzzyMatch) {
    return fuzzyMatch;
  }

  // Try aggregated match (for Stripe payouts that contain multiple payments)
  const aggregatedMatch = findAggregatedMatch(transaction, moneyEvents);
  if (aggregatedMatch) {
    return aggregatedMatch;
  }

  return null;
}

/**
 * Exact match: Stripe reference ID found in bank description
 */
function findExactMatch(
  transaction: BankTransactionInput,
  moneyEvents: MoneyEvent[]
): MatchResult | null {
  const description = transaction.description.toUpperCase();

  // Look for Stripe payout references (format: po_xxx or pi_xxx)
  const stripeRefMatch = description.match(/(?:PO_|PI_|CH_)([A-Z0-9]+)/i);
  if (!stripeRefMatch) {
    return null;
  }

  const stripeRef = stripeRefMatch[0].toUpperCase();

  // Find matching money event
  const matchingEvent = moneyEvents.find((event) => {
    if (!event.reference_id) return false;
    return event.reference_id.toUpperCase().includes(stripeRef);
  });

  if (matchingEvent) {
    return {
      money_event_id: matchingEvent.id,
      match_type: "exact",
      confidence: 1.0,
    };
  }

  return null;
}

/**
 * Fuzzy match: Amount within $1 and date within 3 days
 */
function findFuzzyMatch(
  transaction: BankTransactionInput,
  moneyEvents: MoneyEvent[]
): MatchResult | null {
  const txDate = new Date(transaction.date);
  const amountThreshold = 100; // $1.00 in cents
  const dateThreshold = 3; // days

  // Only match income events
  const incomeEvents = moneyEvents.filter(
    (e) => e.type === "INCOME" || e.type === "PAYOUT"
  );

  // Find events within amount and date threshold
  const candidates = incomeEvents.filter((event) => {
    const amountDiff = Math.abs(event.amount_cents - transaction.amount_cents);
    if (amountDiff > amountThreshold) return false;

    const eventDate = new Date(event.event_date);
    const daysDiff = Math.abs(
      (txDate.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysDiff > dateThreshold) return false;

    return true;
  });

  if (candidates.length === 0) {
    return null;
  }

  // Sort by closest match (amount first, then date)
  candidates.sort((a, b) => {
    const aAmountDiff = Math.abs(a.amount_cents - transaction.amount_cents);
    const bAmountDiff = Math.abs(b.amount_cents - transaction.amount_cents);

    if (aAmountDiff !== bAmountDiff) {
      return aAmountDiff - bAmountDiff;
    }

    const aDateDiff = Math.abs(
      new Date(a.event_date).getTime() - txDate.getTime()
    );
    const bDateDiff = Math.abs(
      new Date(b.event_date).getTime() - txDate.getTime()
    );
    return aDateDiff - bDateDiff;
  });

  const bestMatch = candidates[0];

  // Calculate confidence based on how close the match is
  const amountDiff = Math.abs(bestMatch.amount_cents - transaction.amount_cents);
  const dateDiff = Math.abs(
    (new Date(bestMatch.event_date).getTime() - txDate.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  // Perfect amount match = 0.5, perfect date match = 0.5
  const amountScore = 0.5 * (1 - amountDiff / amountThreshold);
  const dateScore = 0.5 * (1 - dateDiff / dateThreshold);
  const confidence = Math.max(0.5, amountScore + dateScore);

  return {
    money_event_id: bestMatch.id,
    match_type: "fuzzy",
    confidence,
  };
}

/**
 * Aggregated match: Bank deposit equals sum of multiple platform payments
 * (for Stripe payouts that aggregate multiple charges)
 */
function findAggregatedMatch(
  transaction: BankTransactionInput,
  moneyEvents: MoneyEvent[]
): MatchResult | null {
  const txDate = new Date(transaction.date);
  const dateThreshold = 5; // days lookback

  // Get payout events from Stripe
  const payoutEvents = moneyEvents.filter((e) => e.type === "PAYOUT");

  // Find payout that matches the transaction amount
  const matchingPayout = payoutEvents.find((payout) => {
    const amountDiff = Math.abs(payout.amount_cents - transaction.amount_cents);
    if (amountDiff > 100) return false; // within $1

    const payoutDate = new Date(payout.event_date);
    const daysDiff = Math.abs(
      (txDate.getTime() - payoutDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysDiff <= dateThreshold;
  });

  if (matchingPayout) {
    return {
      money_event_id: matchingPayout.id,
      match_type: "aggregated",
      confidence: 0.8,
    };
  }

  // Alternative: Sum of income events in period matches transaction
  // This is useful when Stripe batches multiple payments into one deposit
  const startDate = new Date(txDate);
  startDate.setDate(startDate.getDate() - dateThreshold);

  const incomeInPeriod = moneyEvents.filter((e) => {
    if (e.type !== "INCOME") return false;
    const eventDate = new Date(e.event_date);
    return eventDate >= startDate && eventDate <= txDate;
  });

  // Check if sum of income (minus fees) matches deposit
  const totalIncome = incomeInPeriod.reduce(
    (sum, e) => sum + e.amount_cents,
    0
  );

  // Stripe typically takes ~2.9% + $0.30 per transaction
  // Allow for some variance in fee calculations
  const estimatedNetIncome = totalIncome * 0.95; // rough estimate after fees
  const amountDiff = Math.abs(estimatedNetIncome - transaction.amount_cents);
  const tolerance = transaction.amount_cents * 0.05; // 5% tolerance

  if (amountDiff <= tolerance && incomeInPeriod.length > 0) {
    // Return the most recent income event as the representative match
    const sortedIncome = [...incomeInPeriod].sort(
      (a, b) =>
        new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
    );

    return {
      money_event_id: sortedIncome[0].id,
      match_type: "aggregated",
      confidence: 0.7,
    };
  }

  return null;
}

/**
 * Common Stripe-related patterns in bank descriptions
 */
export function isLikelyStripeDeposit(description: string): boolean {
  const stripePatterns = [
    /STRIPE/i,
    /PO_[A-Z0-9]+/i,
    /PI_[A-Z0-9]+/i,
    /CH_[A-Z0-9]+/i,
    /STRIPE PAYMENTS/i,
    /STRIPE TRANSFER/i,
  ];

  return stripePatterns.some((pattern) => pattern.test(description));
}

/**
 * Common PT business patterns for auto-categorization hints
 */
export const PT_TRANSACTION_PATTERNS = {
  income: [
    { pattern: /STRIPE/i, account: "INC-002", reason: "Stripe payment (likely PT session)" },
    { pattern: /SQUARE/i, account: "INC-002", reason: "Square payment" },
    { pattern: /PAYPAL/i, account: "INC-002", reason: "PayPal payment" },
  ],
  gym_rent: [
    { pattern: /ANYTIME/i, account: "EXP-002", reason: "Anytime Fitness" },
    { pattern: /F45/i, account: "EXP-002", reason: "F45 gym" },
    { pattern: /FITNESS FIRST/i, account: "EXP-002", reason: "Fitness First" },
    { pattern: /GOODLIFE/i, account: "EXP-002", reason: "Goodlife gym" },
    { pattern: /VIRGIN ACTIVE/i, account: "EXP-002", reason: "Virgin Active" },
  ],
  marketing: [
    { pattern: /FACEBOOK/i, account: "EXP-004", reason: "Facebook Ads" },
    { pattern: /META/i, account: "EXP-004", reason: "Meta Ads" },
    { pattern: /GOOGLE ADS/i, account: "EXP-004", reason: "Google Ads" },
    { pattern: /INSTAGRAM/i, account: "EXP-004", reason: "Instagram promotion" },
  ],
  software: [
    { pattern: /TRAINERIZE/i, account: "EXP-006", reason: "Trainerize subscription" },
    { pattern: /MINDBODY/i, account: "EXP-006", reason: "MindBody subscription" },
    { pattern: /CANVA/i, account: "EXP-006", reason: "Canva subscription" },
    { pattern: /ZOOM/i, account: "EXP-006", reason: "Zoom subscription" },
  ],
  bank_fees: [
    { pattern: /BANK FEE/i, account: "EXP-007", reason: "Bank fee" },
    { pattern: /MONTHLY FEE/i, account: "EXP-007", reason: "Monthly account fee" },
    { pattern: /ATM FEE/i, account: "EXP-007", reason: "ATM fee" },
  ],
  personal: [
    { pattern: /ATM WITHDRAWAL/i, account: "OTH-003", reason: "ATM withdrawal" },
    { pattern: /WOOLWORTHS/i, account: "OTH-003", reason: "Likely personal grocery" },
    { pattern: /COLES/i, account: "OTH-003", reason: "Likely personal grocery" },
    { pattern: /UBER EATS/i, account: "OTH-003", reason: "Likely personal food delivery" },
  ],
};
