import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  SUBREDDITS,
  scorePostRelevance,
  getInsightExtractionPrompt,
  type RedditPost,
  type ScannedInsight,
} from "@/lib/insight-scanner";

// Fetch posts from Reddit
async function fetchRedditPosts(subreddit: string, limit = 25): Promise<RedditPost[]> {
  try {
    // Reddit's public JSON API (no auth required for public posts)
    const response = await fetch(
      `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`,
      {
        headers: {
          "User-Agent": "CoachOS/1.0 (Business Intelligence Scanner)",
        },
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch r/${subreddit}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.data.children.map((child: any) => ({
      title: child.data.title,
      selftext: child.data.selftext || "",
      url: child.data.url,
      score: child.data.score,
      num_comments: child.data.num_comments,
      created_utc: child.data.created_utc,
      subreddit: child.data.subreddit,
      permalink: `https://reddit.com${child.data.permalink}`,
    }));
  } catch (error) {
    console.error(`Error fetching r/${subreddit}:`, error);
    return [];
  }
}

// Process post with AI to extract insight
async function extractInsight(post: RedditPost): Promise<ScannedInsight | null> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const prompt = getInsightExtractionPrompt(post);

  try {
    let responseText = "";

    if (anthropicKey) {
      // Using Claude Sonnet for deeper, more nuanced insight extraction
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        responseText = data.content[0].text;
      } else {
        const errorData = await response.text();
        console.error("Anthropic API error:", response.status, errorData);
      }
    } else if (openaiKey) {
      // Using GPT-4o for deeper analysis if no Anthropic key
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        responseText = data.choices[0].message.content;
      } else {
        const errorData = await response.text();
        console.error("OpenAI API error:", response.status, errorData);
      }
    } else {
      // No AI key - skip extraction
      return null;
    }

    // Parse the JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.has_valuable_insight) return null;

    return {
      source: `reddit/r/${post.subreddit}`,
      source_url: post.permalink,
      raw_content: `${post.title}\n\n${post.selftext}`.slice(0, 5000),
      extracted_insight: parsed.extracted_insight,
      deep_analysis: parsed.deep_analysis,
      category: parsed.category,
      sub_category: parsed.sub_category,
      actionable_takeaway: parsed.actionable_takeaway,
      confidence_score: parsed.confidence_score,
      novelty_score: parsed.novelty_score,
      evidence_type: parsed.evidence_type,
      key_quotes: parsed.key_quotes || [],
      related_concepts: parsed.related_concepts || [],
      potential_pitfalls: parsed.potential_pitfalls || [],
      upvotes: post.score,
      comments: post.num_comments,
      scanned_at: new Date().toISOString(),
      approved: false, // Requires admin approval
    };
  } catch (error) {
    console.error("Error extracting insight:", error);
    return null;
  }
}

// Check if we've already scanned this URL
async function isAlreadyScanned(supabase: any, url: string): Promise<boolean> {
  const { data } = await supabase
    .from("scanned_insights")
    .select("id")
    .eq("source_url", url)
    .single();

  return !!data;
}

export async function POST(request: Request) {
  try {
    // Verify this is an authorized request (could be cron job or admin)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Allow if it's a cron job with secret or if it's from an admin
    const isCronJob = cronSecret && authHeader === `Bearer ${cronSecret}`;

    const supabase = await createClient();

    // If not cron, check if user is platform admin
    if (!isCronJob) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { data: adminCheck } = await supabase
        .from("platform_admins")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!adminCheck) {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    }

    // Check for AI keys
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

    if (!hasAnthropicKey && !hasOpenAIKey) {
      return NextResponse.json({
        error: "No AI API key configured",
        message: "Add ANTHROPIC_API_KEY or OPENAI_API_KEY to your environment variables",
        debug: { hasAnthropicKey, hasOpenAIKey }
      }, { status: 500 });
    }

    const results = {
      scanned: 0,
      extracted: 0,
      skipped: 0,
      skipped_low_relevance: 0,
      skipped_already_scanned: 0,
      skipped_low_confidence: 0,
      errors: 0,
      insights: [] as ScannedInsight[],
      debug: {
        hasAnthropicKey,
        hasOpenAIKey,
        subreddits_checked: [] as string[],
        sample_scores: [] as { title: string; score: number }[],
      },
    };

    // Scan each subreddit (limit to 3 for faster testing)
    const subredditsToScan = SUBREDDITS.slice(0, 3);

    for (const subreddit of subredditsToScan) {
      console.log(`Scanning r/${subreddit}...`);
      results.debug.subreddits_checked.push(subreddit);

      const posts = await fetchRedditPosts(subreddit, 15);
      console.log(`Got ${posts.length} posts from r/${subreddit}`);

      for (const post of posts) {
        results.scanned++;

        // Score relevance first (for debug)
        const relevanceScore = scorePostRelevance(post);

        // Track sample scores for debugging
        if (results.debug.sample_scores.length < 10) {
          results.debug.sample_scores.push({
            title: post.title.slice(0, 60),
            score: relevanceScore,
          });
        }

        // Skip if already scanned
        if (await isAlreadyScanned(supabase, post.permalink)) {
          results.skipped_already_scanned++;
          results.skipped++;
          continue;
        }

        // Only process high-relevance posts (lowered threshold for testing)
        if (relevanceScore < 20) {
          results.skipped_low_relevance++;
          results.skipped++;
          continue;
        }

        console.log(`Processing: "${post.title.slice(0, 50)}..." (score: ${relevanceScore})`);

        // Extract insight with AI
        const insight = await extractInsight(post);

        if (!insight) {
          console.log(`No insight extracted (AI returned null or no valuable insight)`);
          results.skipped++;
          continue;
        }

        if (insight.confidence_score < 50) {
          console.log(`Low confidence: ${insight.confidence_score}`);
          results.skipped_low_confidence++;
          results.skipped++;
          continue;
        }

        // Store in database
        const { error } = await supabase.from("scanned_insights").insert(insight);

        if (error) {
          console.error("Error storing insight:", error);
          results.errors++;
        } else {
          results.extracted++;
          results.insights.push(insight);
        }

        // Rate limiting - don't hammer Reddit or AI APIs
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(`Scan complete: ${results.extracted} insights extracted from ${results.scanned} posts`);

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("Scan error:", error);
    return NextResponse.json(
      { error: "Scan failed", details: String(error) },
      { status: 500 }
    );
  }
}

// GET endpoint to check scan status and recent insights
export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get insight stats
    const { data: stats } = await supabase
      .from("scanned_insights")
      .select("category, approved, confidence_score")
      .order("scanned_at", { ascending: false });

    const totalInsights = stats?.length || 0;
    const approvedInsights = stats?.filter((s) => s.approved).length || 0;
    const pendingInsights = totalInsights - approvedInsights;

    const byCategory = stats?.reduce((acc, s) => {
      acc[s.category] = (acc[s.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    const avgConfidence = stats?.length
      ? Math.round(stats.reduce((sum, s) => sum + s.confidence_score, 0) / stats.length)
      : 0;

    // Get recent insights
    const { data: recentInsights } = await supabase
      .from("scanned_insights")
      .select("*")
      .order("scanned_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
      stats: {
        total: totalInsights,
        approved: approvedInsights,
        pending: pendingInsights,
        avgConfidence,
        byCategory,
      },
      recentInsights,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to get stats" },
      { status: 500 }
    );
  }
}
