// Database types matching Supabase schema

export type OrgRole = "owner" | "staff" | "accountant_readonly";
export type InquiryStatus = "NEW" | "CONTACTED" | "BOOKED" | "WON" | "LOST";
export type MoneyEventType = "INCOME" | "REFUND" | "FEE" | "PLATFORM_FEE" | "PAYOUT" | "EXPENSE" | "ADJUSTMENT";
export type TaxCategory = "GST" | "GST_FREE" | "NONE";
export type RiskTier = "green" | "amber" | "red";
export type SenderType = "trainer" | "client" | "system";
export type ActivityType = "weight" | "habit" | "workout" | "checkin";
export type SubscriptionStatus = "active" | "past_due" | "canceled" | "none";

export interface Org {
  id: string;
  created_at: string;
  name: string;
  slug: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
}

export interface Branding {
  org_id: string;
  display_name: string;
  primary_color: string;
  logo_path: string | null;
  updated_at: string;
}

export interface Client {
  id: string;
  org_id: string;
  created_at: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: string;
}

export interface ClientWithRisk extends Client {
  risk_tier?: RiskTier | null;
  risk_score?: number | null;
  subscription_status?: SubscriptionStatus | null;
}

export interface ClientInvite {
  id: string;
  org_id: string;
  client_id: string;
  invite_code: string;
  expires_at: string;
  redeemed_at: string | null;
  created_at: string;
}

export interface MessageThread {
  id: string;
  org_id: string;
  client_id: string;
  created_at: string;
}

export interface Message {
  id: string;
  org_id: string;
  thread_id: string;
  created_at: string;
  sender_type: SenderType;
  sender_user_id: string | null;
  body: string;
}

export interface Habit {
  id: string;
  org_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface ClientHabit {
  id: string;
  org_id: string;
  client_id: string;
  habit_id: string;
  created_at: string;
}

export interface ActivityEvent {
  id: string;
  org_id: string;
  client_id: string;
  created_at: string;
  type: ActivityType;
  payload: Record<string, unknown>;
}

export interface Inquiry {
  id: string;
  org_id: string;
  created_at: string;
  source: string;
  name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  status: InquiryStatus;
  assigned_to: string | null;
  expected_value: number | null;
  converted_client_id: string | null;
}

export interface StripeAccount {
  org_id: string;
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  updated_at: string;
}

export interface Subscription {
  id: string;
  org_id: string;
  client_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: SubscriptionStatus;
  manage_url: string | null;
  updated_at: string;
}

export interface MoneyEvent {
  id: string;
  org_id: string;
  created_at: string;
  event_date: string;
  type: MoneyEventType;
  amount_cents: number;
  currency: string;
  tax_cat: TaxCategory;
  tax_cents: number;
  source: "stripe" | "manual";
  reference_id: string | null;
  client_id: string | null;
  notes: string | null;
}

export interface ClientRisk {
  org_id: string;
  client_id: string;
  as_of_date: string;
  score: number;
  tier: RiskTier;
  reasons: string[];
}

export interface Automation {
  id: string;
  org_id: string;
  name: string;
  enabled: boolean;
  trigger: TriggerConfig;
  conditions: ConditionConfig[];
  actions: ActionConfig[];
  guardrails: GuardrailConfig;
  created_at: string;
  updated_at: string;
}

export interface TriggerConfig {
  type: "schedule" | "event";
  schedule?: string;
  event?: string;
}

export interface ConditionConfig {
  field: string;
  operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "contains";
  value: unknown;
}

export interface ActionConfig {
  type: "send_message" | "send_push" | "create_offer" | "tag_client" | "notify_trainer";
  params: Record<string, unknown>;
}

export interface GuardrailConfig {
  max_per_client_per_day?: number;
  max_per_client_per_week?: number;
  quiet_hours_start?: number;
  quiet_hours_end?: number;
  dedupe_hours?: number;
}

export interface AutomationRun {
  id: string;
  org_id: string;
  automation_id: string;
  client_id: string;
  fired_at: string;
  status: "ok" | "skipped" | "failed";
  reason: string | null;
  actions_fired: ActionConfig[];
}

// Dashboard aggregates
export interface DashboardMetrics {
  mrr_cents: number;
  active_clients: number;
  at_risk_clients: number;
  churned_this_month: number;
  failed_payments: number;
  revenue_at_risk_cents: number;
}

export interface FinanceMonthly {
  org_id: string;
  period: string;
  cash_in_cents: number;
  cash_out_cents: number;
  net_cents: number;
  fees_cents: number;
  platform_fees_cents: number;
  refunds_cents: number;
  payouts_cents: number;
}

// =====================
// myAccounts / Cashbook Types
// =====================

export type AccountCategory = "income" | "expense" | "other";
export type TaxTreatment = "gst" | "gst_free" | "bas_excluded";
export type TransactionStatus = "uncoded" | "ai_suggested" | "coded" | "excluded";
export type TransactionDirection = "credit" | "debit";
export type BasiqConsentStatus = "pending" | "active" | "expired" | "revoked";

export interface BasiqConnection {
  id: string;
  org_id: string;
  basiq_user_id: string;
  consent_id: string | null;
  consent_status: BasiqConsentStatus;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BankAccount {
  id: string;
  org_id: string;
  basiq_account_id: string;
  institution_name: string;
  account_name: string;
  account_number_masked: string | null;
  bsb: string | null;
  account_type: string | null;
  currency: string;
  current_balance_cents: number | null;
  available_balance_cents: number | null;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChartOfAccount {
  id: string;
  org_id: string | null;
  code: string;
  name: string;
  category: AccountCategory;
  tax_treatment: TaxTreatment;
  is_system: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export interface BankTransaction {
  id: string;
  org_id: string;
  bank_account_id: string;
  basiq_transaction_id: string;
  transaction_date: string;
  post_date: string | null;
  amount_cents: number;
  direction: TransactionDirection;
  description: string;
  merchant_name: string | null;
  merchant_category: string | null;
  reference: string | null;
  status: TransactionStatus;
  account_id: string | null;
  is_split: boolean;
  ai_suggested_account_id: string | null;
  ai_confidence: number | null;
  ai_reasoning: string | null;
  matched_money_event_id: string | null;
  match_type: string | null;
  tax_treatment: TaxTreatment | null;
  gst_cents: number;
  notes: string | null;
  coded_by: string | null;
  coded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BankTransactionWithRelations extends BankTransaction {
  bank_account?: BankAccount;
  account?: ChartOfAccount;
  ai_suggested_account?: ChartOfAccount;
  matched_money_event?: MoneyEvent;
  splits?: BankTransactionSplit[];
}

export interface BankTransactionSplit {
  id: string;
  org_id: string;
  transaction_id: string;
  account_id: string;
  amount_cents: number;
  tax_treatment: TaxTreatment;
  gst_cents: number;
  description: string | null;
  created_at: string;
  account?: ChartOfAccount;
}

export interface CodingRule {
  id: string;
  org_id: string;
  name: string;
  is_active: boolean;
  priority: number;
  match_description: string | null;
  match_merchant: string | null;
  match_amount_min_cents: number | null;
  match_amount_max_cents: number | null;
  match_direction: TransactionDirection | null;
  account_id: string;
  tax_treatment: TaxTreatment | null;
  auto_apply: boolean;
  times_applied: number;
  last_applied_at: string | null;
  created_at: string;
  updated_at: string;
  account?: ChartOfAccount;
}

export interface CashbookPnL {
  org_id: string;
  period: string;
  category: AccountCategory;
  account_id: string;
  account_code: string;
  account_name: string;
  net_cents: number;
  gst_cents: number;
  transaction_count: number;
}

export interface CashbookLedger {
  id: string;
  org_id: string;
  transaction_date: string;
  bank_account_name: string;
  description: string;
  merchant_name: string | null;
  direction: TransactionDirection;
  amount_cents: number;
  gst_cents: number;
  account_code: string;
  account_name: string;
  account_category: AccountCategory;
  status: TransactionStatus;
  notes: string | null;
  matched_money_event_id: string | null;
  match_type: string | null;
}

export interface CashbookUncodedSummary {
  org_id: string;
  uncoded_count: number;
  ai_suggested_count: number;
  uncoded_amount_cents: number;
  ai_suggested_amount_cents: number;
  oldest_uncoded_date: string | null;
}

export interface AICategorizationResult {
  account_id: string;
  account_code: string;
  account_name: string;
  confidence: number;
  reasoning: string;
}

export interface AICategorizationRequest {
  transaction_id: string;
  description: string;
  merchant_name: string | null;
  amount_cents: number;
  direction: TransactionDirection;
}

export interface TransactionMatchResult {
  money_event_id: string;
  match_type: "exact" | "fuzzy" | "aggregated";
  confidence: number;
}
