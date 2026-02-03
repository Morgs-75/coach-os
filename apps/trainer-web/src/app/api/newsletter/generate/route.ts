import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getNewsletterGenerationPrompt,
  getNextTheme,
  getRandomAngle,
  CONTENT_THEMES,
  type ContentTheme,
  type AudienceLevel,
  type NewsletterFrequency,
  type GeneratedNewsletter,
} from "@/lib/newsletter-generator";

// Generate a newsletter using AI and insights from the repository
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Verify admin access
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

    // Get generation parameters
    const body = await request.json();
    const {
      theme: requestedTheme,
      audienceLevel = "all",
      frequency = "weekly",
    } = body as {
      theme?: ContentTheme;
      audienceLevel?: AudienceLevel;
      frequency?: NewsletterFrequency;
    };

    // Get previous themes to ensure variety
    const { data: recentNewsletters } = await supabase
      .from("generated_newsletters")
      .select("theme")
      .order("generated_at", { ascending: false })
      .limit(5);

    const previousThemes = recentNewsletters?.map(n => n.theme as ContentTheme) || [];

    // Select theme
    const theme = requestedTheme || getNextTheme(previousThemes, 1)[0];
    const angle = getRandomAngle(theme);

    // Get relevant insights from the repository
    const { data: insights } = await supabase
      .from("scanned_insights")
      .select("extracted_insight, actionable_takeaway, category")
      .eq("approved", true)
      .gte("confidence_score", 70)
      .order("novelty_score", { ascending: false })
      .limit(5);

    const insightTexts = insights?.map(i =>
      `[${i.category}] ${i.extracted_insight} → Action: ${i.actionable_takeaway?.slice(0, 150)}...`
    ) || [];

    // If no insights, use the static knowledge base
    if (insightTexts.length < 3) {
      insightTexts.push(
        "Trainers who follow up with leads within 5 minutes convert 21x more than those who wait",
        "Package-based pricing increases client retention by 2x compared to pay-per-session",
        "Posting short-form video content 3-5x per week increases inquiries by 60%",
        "The first 90 days are critical - clients are most likely to churn between day 90-120",
        "Referral programs drive 40-60% of new clients for top performers"
      );
    }

    // Generate the newsletter with AI
    const prompt = getNewsletterGenerationPrompt(
      theme,
      angle,
      audienceLevel,
      frequency,
      insightTexts
    );

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    let generatedContent: any = null;

    if (anthropicKey) {
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
        const responseText = data.content[0].text;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          generatedContent = JSON.parse(jsonMatch[0]);
        }
      }
    } else if (openaiKey) {
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
        const responseText = data.choices[0].message.content;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          generatedContent = JSON.parse(jsonMatch[0]);
        }
      }
    } else {
      return NextResponse.json({
        error: "No AI API key configured",
      }, { status: 500 });
    }

    if (!generatedContent) {
      return NextResponse.json({
        error: "Failed to generate newsletter content",
      }, { status: 500 });
    }

    // Create the newsletter object
    const newsletter: GeneratedNewsletter = {
      subject: generatedContent.subject,
      preheader: generatedContent.preheader,
      theme,
      audienceLevel,
      sections: generatedContent.sections.map((s: any) => ({
        ...s,
        audienceLevel,
      })),
      callToAction: generatedContent.callToAction,
      generatedAt: new Date().toISOString(),
      status: "draft",
    };

    // Store in database
    const { data: saved, error: saveError } = await supabase
      .from("generated_newsletters")
      .insert({
        subject: newsletter.subject,
        preheader: newsletter.preheader,
        theme: newsletter.theme,
        audience_level: newsletter.audienceLevel,
        sections: newsletter.sections,
        call_to_action: newsletter.callToAction,
        generated_at: newsletter.generatedAt,
        status: newsletter.status,
        frequency,
        angle_used: angle,
      })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving newsletter:", saveError);
      // Still return the content even if save fails
    }

    return NextResponse.json({
      success: true,
      newsletter: saved || newsletter,
      meta: {
        theme: CONTENT_THEMES[theme].name,
        angle,
        audienceLevel,
        frequency,
        insightsUsed: insightTexts.length,
      },
    });
  } catch (error) {
    console.error("Newsletter generation error:", error);
    return NextResponse.json(
      { error: "Generation failed", details: String(error) },
      { status: 500 }
    );
  }
}

// GET - List generated newsletters
export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20");

    let query = supabase
      .from("generated_newsletters")
      .select("*")
      .order("generated_at", { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: newsletters, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ newsletters });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch newsletters" },
      { status: 500 }
    );
  }
}
