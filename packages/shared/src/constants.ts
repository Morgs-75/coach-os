export const PLATFORM_FEE_PERCENT = 5;

export const RISK_TIERS = {
  green: { label: "Healthy", color: "#22c55e" },
  amber: { label: "At Risk", color: "#f59e0b" },
  red: { label: "High Risk", color: "#ef4444" },
} as const;

export const INQUIRY_STATUSES = {
  NEW: { label: "New", color: "#3b82f6" },
  CONTACTED: { label: "Contacted", color: "#8b5cf6" },
  BOOKED: { label: "Booked", color: "#f59e0b" },
  WON: { label: "Won", color: "#22c55e" },
  LOST: { label: "Lost", color: "#6b7280" },
} as const;

export const SUBSCRIPTION_STATUSES = {
  active: { label: "Active", color: "#22c55e" },
  past_due: { label: "Past Due", color: "#ef4444" },
  canceled: { label: "Canceled", color: "#6b7280" },
  none: { label: "None", color: "#9ca3af" },
} as const;

export const MONEY_EVENT_TYPES = {
  INCOME: { label: "Income", sign: 1 },
  REFUND: { label: "Refund", sign: -1 },
  FEE: { label: "Fee", sign: -1 },
  PLATFORM_FEE: { label: "Platform Fee", sign: -1 },
  PAYOUT: { label: "Payout", sign: -1 },
  EXPENSE: { label: "Expense", sign: -1 },
  ADJUSTMENT: { label: "Adjustment", sign: 0 },
} as const;
