import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

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

interface TransactionInput {
  transaction_id: string;
  description: string;
  merchant_name: string | null;
  amount_cents: number;
  direction: "credit" | "debit";
}

interface CategorizationResult {
  transaction_id: string;
  account_code: string;
  confidence: number;
  reasoning: string;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId(supabase);

    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { transactions } = body as { transactions: TransactionInput[] };

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ error: "No transactions provided" }, { status: 400 });
    }

    // Get chart of accounts
    const { data: accounts } = await supabase
      .from("chart_of_accounts")
      .select("*")
      .or(`org_id.eq.${orgId},org_id.is.null`)
      .eq("is_active", true)
      .order("display_order");

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ error: "No accounts found" }, { status: 500 });
    }

    // Build prompt for AI
    const accountList = accounts.map((a) => ({
      code: a.code,
      name: a.name,
      category: a.category,
      tax: a.tax_treatment,
    }));

    const transactionList = transactions.map((t) => ({
      id: t.transaction_id,
      description: t.description,
      merchant: t.merchant_name,
      amount: (t.amount_cents / 100).toFixed(2),
      type: t.direction === "credit" ? "money in" : "money out",
    }));

    const anthropic = new Anthropic();

    const message = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are a bookkeeper for a personal training business in Australia. Categorize these bank transactions.

Available accounts:
${JSON.stringify(accountList, null, 2)}

Transactions to categorize:
${JSON.stringify(transactionList, null, 2)}

PT-specific hints:
- Stripe deposits = PT Sessions income (INC-002)
- Gym names like "Anytime", "F45", "Fitness" = Gym Rent (EXP-002)
- Facebook/Meta/Google Ads = Marketing (EXP-004)
- Bank fees = Bank Fees (EXP-007) - GST free
- ATM withdrawals, personal purchases = Personal/Exclude (OTH-003)
- Equipment stores = Equipment (EXP-001)
- Insurance payments = Insurance (EXP-003) - GST free

Return ONLY a JSON array with this format (no other text):
[
  {
    "transaction_id": "id",
    "account_code": "code from list",
    "confidence": 0.0-1.0,
    "reasoning": "brief explanation"
  }
]`,
        },
      ],
    });

    // Parse AI response
    const responseText = message.content[0].type === "text" ? message.content[0].text : "";
    let results: CategorizationResult[] = [];

    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        results = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    // Update transactions with AI suggestions
    for (const result of results) {
      const account = accounts.find((a) => a.code === result.account_code);
      if (!account) continue;

      await supabase
        .from("bank_transactions")
        .update({
          ai_suggested_account_id: account.id,
          ai_confidence: Math.max(0, Math.min(1, result.confidence)),
          ai_reasoning: result.reasoning,
          status: "ai_suggested",
          updated_at: new Date().toISOString(),
        })
        .eq("id", result.transaction_id)
        .eq("org_id", orgId)
        .in("status", ["uncoded", "ai_suggested"]);
    }

    return NextResponse.json({
      success: true,
      categorized: results.length,
      results,
    });
  } catch (error) {
    console.error("AI categorization error:", error);
    return NextResponse.json(
      { error: "Failed to categorize transactions" },
      { status: 500 }
    );
  }
}
