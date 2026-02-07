import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMockTransactions } from "@/lib/mock-data";

// Types of issues the AI Accountant can detect
type IssueType =
  | "wrong_category"
  | "wrong_tax_treatment"
  | "duplicate_suspected"
  | "unusual_amount"
  | "inconsistent_coding"
  | "personal_as_business"
  | "missing_gst"
  | "split_recommended";

type IssueSeverity = "high" | "medium" | "low";

interface AuditIssue {
  id: string;
  transaction_id: string;
  transaction_date: string;
  description: string;
  amount_cents: number;
  current_account: string;
  current_tax_treatment: string;
  issue_type: IssueType;
  severity: IssueSeverity;
  message: string;
  suggestion: string;
  suggested_account_id?: string;
  suggested_account_name?: string;
  suggested_tax_treatment?: string;
  confidence: number;
}

// Generate mock audit issues from actual mock transactions
function generateMockAuditIssues(): AuditIssue[] {
  const transactions = getMockTransactions();
  const issues: AuditIssue[] = [];

  // Find specific transactions that have audit issues
  // txn-0005: Woolworths coded as Equipment (personal_as_business)
  const woolworthsTxn = transactions.find(t => t.id === "txn-0005");
  if (woolworthsTxn) {
    issues.push({
      id: "audit-001",
      transaction_id: woolworthsTxn.id,
      transaction_date: woolworthsTxn.transaction_date,
      description: woolworthsTxn.description,
      amount_cents: woolworthsTxn.amount_cents,
      current_account: `${woolworthsTxn.account?.code} - ${woolworthsTxn.account?.name}`,
      current_tax_treatment: woolworthsTxn.tax_treatment || "gst",
      issue_type: "personal_as_business",
      severity: "high",
      message: "Grocery purchase coded as business expense",
      suggestion: "This appears to be a personal grocery purchase. Consider recoding to Personal/Exclude to avoid incorrect tax deductions.",
      suggested_account_id: "acc-203",
      suggested_account_name: "Personal / Exclude",
      suggested_tax_treatment: "bas_excluded",
      confidence: 0.92,
    });
  }

  // txn-0010: Insurance with GST (wrong_tax_treatment)
  const insuranceTxn = transactions.find(t => t.id === "txn-0010");
  if (insuranceTxn) {
    issues.push({
      id: "audit-002",
      transaction_id: insuranceTxn.id,
      transaction_date: insuranceTxn.transaction_date,
      description: insuranceTxn.description,
      amount_cents: insuranceTxn.amount_cents,
      current_account: `${insuranceTxn.account?.code} - ${insuranceTxn.account?.name}`,
      current_tax_treatment: insuranceTxn.tax_treatment || "gst",
      issue_type: "wrong_tax_treatment",
      severity: "high",
      message: "Insurance incorrectly coded with GST",
      suggestion: "Insurance premiums are typically GST-free. This should be recoded as GST-free to ensure accurate BAS reporting.",
      suggested_tax_treatment: "gst_free",
      confidence: 0.95,
    });
  }

  // txn-0015: Netflix as Software (personal_as_business)
  const netflixTxn = transactions.find(t => t.id === "txn-0015");
  if (netflixTxn) {
    issues.push({
      id: "audit-003",
      transaction_id: netflixTxn.id,
      transaction_date: netflixTxn.transaction_date,
      description: netflixTxn.description,
      amount_cents: netflixTxn.amount_cents,
      current_account: `${netflixTxn.account?.code} - ${netflixTxn.account?.name}`,
      current_tax_treatment: netflixTxn.tax_treatment || "gst",
      issue_type: "personal_as_business",
      severity: "medium",
      message: "Streaming service coded as business software",
      suggestion: "Netflix is typically a personal entertainment expense unless used specifically for business content creation.",
      suggested_account_id: "acc-203",
      suggested_account_name: "Personal / Exclude",
      suggested_tax_treatment: "bas_excluded",
      confidence: 0.88,
    });
  }

  // txn-0020: High fuel amount (unusual_amount)
  const fuelTxn = transactions.find(t => t.id === "txn-0020");
  if (fuelTxn) {
    issues.push({
      id: "audit-004",
      transaction_id: fuelTxn.id,
      transaction_date: fuelTxn.transaction_date,
      description: fuelTxn.description,
      amount_cents: fuelTxn.amount_cents,
      current_account: `${fuelTxn.account?.code} - ${fuelTxn.account?.name}`,
      current_tax_treatment: fuelTxn.tax_treatment || "gst",
      issue_type: "unusual_amount",
      severity: "low",
      message: "Fuel purchase unusually high",
      suggestion: `This fuel amount ($${(fuelTxn.amount_cents / 100).toFixed(2)}) is significantly higher than your average. Verify this is a single business-related purchase and not multiple transactions or personal use.`,
      confidence: 0.72,
    });
  }

  // txn-0025: Large Stripe deposit (split_recommended)
  const stripeTxn = transactions.find(t => t.id === "txn-0025");
  if (stripeTxn) {
    issues.push({
      id: "audit-005",
      transaction_id: stripeTxn.id,
      transaction_date: stripeTxn.transaction_date,
      description: stripeTxn.description,
      amount_cents: stripeTxn.amount_cents,
      current_account: `${stripeTxn.account?.code} - ${stripeTxn.account?.name}`,
      current_tax_treatment: stripeTxn.tax_treatment || "gst",
      issue_type: "split_recommended",
      severity: "low",
      message: "Large Stripe deposit may contain multiple income types",
      suggestion: `This $${(stripeTxn.amount_cents / 100).toLocaleString()} deposit is larger than typical. Consider splitting if it includes both PT sessions and merchandise sales for accurate category reporting.`,
      confidence: 0.65,
    });
  }

  // txn-0030: Duplicate Anytime Fitness (duplicate_suspected)
  const gymTxn = transactions.find(t => t.id === "txn-0030");
  if (gymTxn) {
    issues.push({
      id: "audit-006",
      transaction_id: gymTxn.id,
      transaction_date: gymTxn.transaction_date,
      description: gymTxn.description,
      amount_cents: gymTxn.amount_cents,
      current_account: `${gymTxn.account?.code} - ${gymTxn.account?.name}`,
      current_tax_treatment: gymTxn.tax_treatment || "gst",
      issue_type: "duplicate_suspected",
      severity: "medium",
      message: "Possible duplicate transaction detected",
      suggestion: "A similar Anytime Fitness charge appears on the previous day for the same amount. Verify this isn't a duplicate entry.",
      confidence: 0.78,
    });
  }

  // txn-0035: Amazon inconsistent (inconsistent_coding)
  const amazonTxn = transactions.find(t => t.id === "txn-0035");
  if (amazonTxn) {
    issues.push({
      id: "audit-007",
      transaction_id: amazonTxn.id,
      transaction_date: amazonTxn.transaction_date,
      description: amazonTxn.description,
      amount_cents: amazonTxn.amount_cents,
      current_account: `${amazonTxn.account?.code} - ${amazonTxn.account?.name}`,
      current_tax_treatment: amazonTxn.tax_treatment || "gst",
      issue_type: "inconsistent_coding",
      severity: "medium",
      message: "Amazon coded inconsistently",
      suggestion: "Previous Amazon purchases were coded to Equipment & Supplies. Consider reviewing if this should be equipment or if a coding rule should be updated.",
      suggested_account_id: "acc-101",
      suggested_account_name: "Equipment & Supplies",
      confidence: 0.82,
    });
  }

  return issues;
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

    // In production, this would:
    // 1. Fetch all coded transactions
    // 2. Run AI analysis to detect issues
    // 3. Return findings

    // For now, return mock data
    const issues = generateMockAuditIssues();

    const summary = {
      total_issues: issues.length,
      high_severity: issues.filter(i => i.severity === "high").length,
      medium_severity: issues.filter(i => i.severity === "medium").length,
      low_severity: issues.filter(i => i.severity === "low").length,
      potential_tax_impact: issues
        .filter(i => i.issue_type === "wrong_tax_treatment" || i.issue_type === "personal_as_business")
        .reduce((sum, i) => sum + Math.round(i.amount_cents / 11), 0), // Rough GST estimate
    };

    return NextResponse.json({
      issues,
      summary,
      last_audit: new Date().toISOString(),
      _mock: true,
    });
  } catch (error) {
    console.error("Audit fetch error:", error);
    return NextResponse.json(
      { error: "Failed to run audit" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId(supabase);

    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, issue_id, transaction_id } = body;

    // Handle actions: accept_suggestion, dismiss, mark_reviewed
    if (action === "accept_suggestion") {
      // In production: Apply the suggested changes to the transaction
      return NextResponse.json({
        success: true,
        message: "Suggestion applied",
        _mock: true,
      });
    }

    if (action === "dismiss") {
      // In production: Mark this issue as dismissed/false positive
      return NextResponse.json({
        success: true,
        message: "Issue dismissed",
        _mock: true,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Audit action error:", error);
    return NextResponse.json(
      { error: "Failed to process action" },
      { status: 500 }
    );
  }
}
