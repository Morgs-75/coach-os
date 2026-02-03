import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ClientRiskData {
  client_id: string;
  org_id: string;
  subscription_status: string | null;
  last_activity_at: string | null;
  last_checkin_at: string | null;
  activity_count_7d: number;
  activity_count_30d: number;
}

interface RiskResult {
  org_id: string;
  client_id: string;
  as_of_date: string;
  score: number;
  tier: "green" | "amber" | "red";
  reasons: string[];
}

serve(async (req) => {
  // Verify cron secret for security
  const authHeader = req.headers.get("Authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const today = new Date().toISOString().split("T")[0];

  try {
    // Get all active clients with their subscription and activity data
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id, org_id, status")
      .eq("status", "active");

    if (clientsError) throw clientsError;
    if (!clients || clients.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const riskResults: RiskResult[] = [];

    for (const client of clients) {
      const riskData = await gatherClientRiskData(supabase, client.id, client.org_id);
      const result = calculateRisk(riskData, today);
      riskResults.push(result);
    }

    // Upsert all risk scores
    if (riskResults.length > 0) {
      const { error: upsertError } = await supabase
        .from("client_risk")
        .upsert(riskResults, { onConflict: "org_id,client_id,as_of_date" });

      if (upsertError) throw upsertError;
    }

    return new Response(
      JSON.stringify({ processed: riskResults.length, date: today }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Risk scoring failed:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

async function gatherClientRiskData(
  supabase: ReturnType<typeof createClient>,
  clientId: string,
  orgId: string
): Promise<ClientRiskData> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Get subscription status
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("org_id", orgId)
    .eq("client_id", clientId)
    .single();

  // Get last activity
  const { data: lastActivity } = await supabase
    .from("activity_events")
    .select("created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Get last check-in
  const { data: lastCheckin } = await supabase
    .from("activity_events")
    .select("created_at")
    .eq("client_id", clientId)
    .eq("type", "checkin")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Count activities in last 7 days
  const { count: count7d } = await supabase
    .from("activity_events")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .gte("created_at", sevenDaysAgo);

  // Count activities in last 30 days
  const { count: count30d } = await supabase
    .from("activity_events")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .gte("created_at", thirtyDaysAgo);

  return {
    client_id: clientId,
    org_id: orgId,
    subscription_status: subscription?.status ?? null,
    last_activity_at: lastActivity?.created_at ?? null,
    last_checkin_at: lastCheckin?.created_at ?? null,
    activity_count_7d: count7d ?? 0,
    activity_count_30d: count30d ?? 0,
  };
}

function calculateRisk(data: ClientRiskData, today: string): RiskResult {
  let score = 0; // 0 = best, 100 = worst
  const reasons: string[] = [];
  const now = new Date();

  // Payment risk (highest weight)
  if (data.subscription_status === "past_due") {
    score += 40;
    reasons.push("Payment past due");
  } else if (data.subscription_status === "canceled") {
    score += 50;
    reasons.push("Subscription canceled");
  } else if (data.subscription_status === "none" || !data.subscription_status) {
    score += 10;
    reasons.push("No active subscription");
  }

  // Engagement risk - last activity
  if (data.last_activity_at) {
    const daysSinceActivity = Math.floor(
      (now.getTime() - new Date(data.last_activity_at).getTime()) / (24 * 60 * 60 * 1000)
    );

    if (daysSinceActivity > 14) {
      score += 25;
      reasons.push(`No activity in ${daysSinceActivity} days`);
    } else if (daysSinceActivity > 7) {
      score += 15;
      reasons.push(`Low activity (${daysSinceActivity} days since last)`);
    } else if (daysSinceActivity > 3) {
      score += 5;
      reasons.push("Activity declining");
    }
  } else {
    score += 20;
    reasons.push("No activity recorded");
  }

  // Check-in risk
  if (data.last_checkin_at) {
    const daysSinceCheckin = Math.floor(
      (now.getTime() - new Date(data.last_checkin_at).getTime()) / (24 * 60 * 60 * 1000)
    );

    if (daysSinceCheckin > 14) {
      score += 15;
      reasons.push(`No check-in in ${daysSinceCheckin} days`);
    } else if (daysSinceCheckin > 7) {
      score += 10;
      reasons.push("Missed weekly check-in");
    }
  }

  // Activity volume risk
  if (data.activity_count_7d === 0) {
    score += 10;
    reasons.push("Zero activities this week");
  } else if (data.activity_count_7d < 3) {
    score += 5;
    reasons.push("Low weekly activity count");
  }

  // Trend risk: compare 7d to 30d average
  const avgWeeklyIn30d = data.activity_count_30d / 4;
  if (avgWeeklyIn30d > 0 && data.activity_count_7d < avgWeeklyIn30d * 0.5) {
    score += 10;
    reasons.push("Activity trending down vs prior weeks");
  }

  // Clamp score
  score = Math.min(100, Math.max(0, score));

  // Determine tier
  let tier: "green" | "amber" | "red";
  if (score >= 50) {
    tier = "red";
  } else if (score >= 25) {
    tier = "amber";
  } else {
    tier = "green";
  }

  // If no issues found, add positive reason
  if (reasons.length === 0) {
    reasons.push("Client is healthy");
  }

  return {
    org_id: data.org_id,
    client_id: data.client_id,
    as_of_date: today,
    score,
    tier,
    reasons,
  };
}
