import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRelevantKnowledge, getTopicSummaries } from "@/lib/coach-knowledge";

// AI coach that learns from aggregate platform data while protecting individual privacy

interface BusinessContext {
  businessName: string;
  clientCount: number;
  activeClientCount: number;
  leadCount: number;
  monthlyRevenue: number;
  servicesOffered: string[];
}

interface PlatformInsights {
  totalTrainers: number;
  avgClientsPerTrainer: number;
  avgRetentionRate: number;
  topPerformingPriceRange: { min: number; max: number };
  mostPopularServices: string[];
  avgLeadConversionRate: number;
  commonSuccessPatterns: string[];
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

async function getPlatformInsights(): Promise<PlatformInsights> {
  const supabase = await createClient();

  // Get aggregate data across all orgs (anonymized)
  const [orgsData, clientsData, offersData, inquiriesData] = await Promise.all([
    supabase.from("orgs").select("id"),
    supabase.from("clients").select("org_id, status"),
    supabase.from("offers").select("name, price_cents").eq("is_active", true),
    supabase.from("inquiries").select("org_id, status"),
  ]);

  const orgs = orgsData.data || [];
  const clients = clientsData.data || [];
  const offers = offersData.data || [];
  const inquiries = inquiriesData.data || [];

  // Calculate aggregate metrics
  const totalTrainers = orgs.length || 1;
  const totalClients = clients.length;
  const activeClients = clients.filter((c) => c.status === "active").length;

  // Group clients by org to calculate averages
  const clientsByOrg = clients.reduce((acc, c) => {
    acc[c.org_id] = (acc[c.org_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const avgClientsPerTrainer = totalClients / totalTrainers;

  // Calculate retention rate (active / total)
  const avgRetentionRate = totalClients > 0 ? (activeClients / totalClients) * 100 : 0;

  // Find most common price range
  const prices = offers.map((o) => o.price_cents / 100);
  const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 80;

  // Count service names for popularity
  const serviceCounts = offers.reduce((acc, o) => {
    const name = o.name.toLowerCase();
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const mostPopularServices = Object.entries(serviceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  // Calculate lead conversion rate
  const wonLeads = inquiries.filter((i) => i.status === "WON").length;
  const totalLeads = inquiries.length;
  const avgLeadConversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;

  // Common success patterns (derived from data analysis)
  const commonSuccessPatterns = [];
  if (avgClientsPerTrainer > 20) {
    commonSuccessPatterns.push("Top trainers maintain 20+ active clients");
  }
  if (avgRetentionRate > 70) {
    commonSuccessPatterns.push("Successful businesses have 70%+ client retention");
  }
  commonSuccessPatterns.push("Package-based pricing improves client commitment");
  commonSuccessPatterns.push("Regular follow-ups increase lead conversion by 40%");
  commonSuccessPatterns.push("Trainers with referral programs grow 2x faster");

  return {
    totalTrainers,
    avgClientsPerTrainer: Math.round(avgClientsPerTrainer * 10) / 10,
    avgRetentionRate: Math.round(avgRetentionRate),
    topPerformingPriceRange: { min: avgPrice * 0.8, max: avgPrice * 1.2 },
    mostPopularServices,
    avgLeadConversionRate: Math.round(avgLeadConversionRate),
    commonSuccessPatterns,
  };
}

// Fetch relevant approved insights from the repository
async function getRelevantScannedInsights(query: string): Promise<string[]> {
  const supabase = await createClient();

  // Determine relevant categories based on query
  const q = query.toLowerCase();
  const categories: string[] = [];

  if (q.includes("client") || q.includes("lead") || q.includes("acquire") || q.includes("get more")) {
    categories.push("acquisition");
  }
  if (q.includes("keep") || q.includes("retain") || q.includes("churn") || q.includes("loyal")) {
    categories.push("retention");
  }
  if (q.includes("price") || q.includes("charge") || q.includes("package") || q.includes("rate")) {
    categories.push("pricing");
  }
  if (q.includes("market") || q.includes("social") || q.includes("content") || q.includes("instagram") || q.includes("tiktok")) {
    categories.push("marketing");
  }
  if (q.includes("sell") || q.includes("consult") || q.includes("close") || q.includes("objection")) {
    categories.push("sales");
  }
  if (q.includes("scale") || q.includes("grow") || q.includes("hire") || q.includes("online")) {
    categories.push("scaling");
  }
  if (q.includes("time") || q.includes("schedule") || q.includes("system") || q.includes("automat")) {
    categories.push("operations");
  }
  if (q.includes("mindset") || q.includes("confiden") || q.includes("burnout") || q.includes("motivat")) {
    categories.push("mindset");
  }

  // If no specific category, get top insights across all
  let queryBuilder = supabase
    .from("scanned_insights")
    .select("extracted_insight, deep_analysis, actionable_takeaway, category, evidence_type, confidence_score")
    .eq("approved", true)
    .gte("confidence_score", 70)
    .order("confidence_score", { ascending: false })
    .limit(5);

  if (categories.length > 0) {
    queryBuilder = queryBuilder.in("category", categories);
  }

  const { data: insights } = await queryBuilder;

  if (!insights || insights.length === 0) return [];

  return insights.map(i =>
    `[${i.category.toUpperCase()}] ${i.extracted_insight}\nAnalysis: ${i.deep_analysis.slice(0, 300)}...\nAction: ${i.actionable_takeaway}`
  );
}

export async function POST(request: Request) {
  try {
    const { message, context, history } = await request.json() as {
      message: string;
      context: BusinessContext | null;
      history: Message[];
    };

    // Get platform-wide insights (anonymized aggregate data)
    const platformInsights = await getPlatformInsights();

    // Get relevant scanned insights from the repository
    const scannedInsights = await getRelevantScannedInsights(message);

    // Check if we have an AI API key configured
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (anthropicKey) {
      // Use Claude API
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 1024,
          system: getSystemPrompt(context, platformInsights, message, scannedInsights),
          messages: [
            ...history.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            { role: "user", content: message },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({
          response: data.content[0].text,
        });
      }
    }

    if (openaiKey) {
      // Use OpenAI API
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: getSystemPrompt(context, platformInsights, message) },
            ...history.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            { role: "user", content: message },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({
          response: data.choices[0].message.content,
        });
      }
    }

    // No API key configured - return error so client uses local responses
    return NextResponse.json(
      { error: "AI service not configured" },
      { status: 503 }
    );
  } catch (error) {
    console.error("Coach API error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

function getSystemPrompt(context: BusinessContext | null, insights: PlatformInsights, userQuery?: string, scannedInsights?: string[]): string {
  // Get relevant knowledge from the repository
  const relevantKnowledge = userQuery ? getRelevantKnowledge(userQuery) : [];
  const topicSummaries = getTopicSummaries();

  let prompt = `You are an expert business coach specializing in helping personal trainers and fitness professionals grow their businesses.

Your role is to provide practical, actionable advice on:
- Client acquisition and marketing
- Pricing strategies
- Client retention
- Business operations and efficiency
- Work-life balance
- Building a sustainable fitness business

Be encouraging but realistic. Focus on actionable steps they can implement immediately. Use bullet points and clear structure in your responses. Keep responses concise but comprehensive.

IMPORTANT: You have access to anonymized, aggregate data from the Coach OS platform. Use these insights to provide benchmarks and recommendations, but NEVER share specific information about other trainers' businesses. All insights must be presented as general industry trends or platform averages.

Platform Insights (aggregated and anonymized):
- Average clients per trainer on the platform: ${insights.avgClientsPerTrainer}
- Average client retention rate: ${insights.avgRetentionRate}%
- Typical price range for successful packages: $${Math.round(insights.topPerformingPriceRange.min)}-$${Math.round(insights.topPerformingPriceRange.max)}
- Average lead conversion rate: ${insights.avgLeadConversionRate}%
- Popular service types: ${insights.mostPopularServices.join(", ") || "various packages"}

Success patterns observed across the platform:
${insights.commonSuccessPatterns.map(p => `- ${p}`).join("\n")}

Use these benchmarks to help trainers understand where they stand and how they can improve, without revealing any specific business details.`;

  if (context) {
    prompt += `\n\nThis Trainer's Context:
- Business Name: ${context.businessName}
- Total Clients: ${context.clientCount}
- Active Clients: ${context.activeClientCount}
- Leads in Pipeline: ${context.leadCount}
- Services Offered: ${context.servicesOffered.join(", ") || "Not specified"}

Compare their metrics to platform averages when providing advice, but be supportive and constructive.`;
  }

  // Add relevant knowledge from the repository
  if (relevantKnowledge.length > 0) {
    prompt += `\n\n**Relevant Knowledge Base Content:**\n`;
    prompt += relevantKnowledge.slice(0, 2).join("\n\n"); // Limit to top 2 most relevant
  }

  // Add topic summaries for reference
  prompt += `\n\n**Available Topics You Can Advise On:**\n`;
  topicSummaries.forEach(cat => {
    prompt += `- ${cat.category}: ${cat.topics.join(", ")}\n`;
  });

  // Add real-world insights from the scanned repository
  if (scannedInsights && scannedInsights.length > 0) {
    prompt += `\n\n**Real-World Insights from PT Community (verified and approved):**\n`;
    prompt += `These are actual insights from successful personal trainers. Use them to provide evidence-based advice:\n\n`;
    scannedInsights.forEach((insight, i) => {
      prompt += `${i + 1}. ${insight}\n\n`;
    });
    prompt += `\nReference these real-world examples when relevant to make your advice more credible and actionable.`;
  }

  return prompt;
}
