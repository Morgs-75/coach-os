// Deep Insight Scanner for PT Business Intelligence
// Scans Reddit, forums, and industry sources for actionable insights

export interface ScannedInsight {
  id?: string;
  source: string;
  source_url: string;
  raw_content: string;
  extracted_insight: string;
  deep_analysis: string;
  category: "acquisition" | "retention" | "pricing" | "marketing" | "operations" | "mindset" | "sales" | "scaling" | "market_gaps";
  sub_category: string;
  actionable_takeaway: string;
  confidence_score: number; // 0-100 how confident we are this is valuable
  novelty_score: number; // 0-100 how unique/novel this insight is
  evidence_type: "anecdotal" | "data_backed" | "expert_opinion" | "case_study" | "market_demand";
  key_quotes?: string[]; // Important quotes from the source
  related_concepts?: string[]; // Connected business concepts
  potential_pitfalls?: string[]; // What could go wrong
  market_opportunity?: {
    demand_signal: string; // What people are asking for
    current_gap: string; // What's missing or inadequate
    potential_solution: string; // Business opportunity
    demand_strength: "low" | "medium" | "high"; // How many people want this
  };
  upvotes?: number;
  comments?: number;
  scanned_at: string;
  approved: boolean;
}

export interface RedditPost {
  title: string;
  selftext: string;
  url: string;
  score: number;
  num_comments: number;
  created_utc: number;
  subreddit: string;
  permalink: string;
}

// Subreddits to scan for PT business insights
export const SUBREDDITS = [
  "personaltraining",
  "fitnessindustry",
  "EntrepreneurFitness",
  "personaltrainers",
  "fitness", // filter for business-related
  "Entrepreneur", // filter for fitness-related
  "smallbusiness", // filter for fitness/PT
  "marketing", // filter for fitness/service business
];

// Keywords that indicate business insights vs just fitness content
export const INSIGHT_KEYWORDS = [
  // Acquisition
  "got my first client", "landed", "signed", "new client", "how I got",
  "marketing worked", "referral", "lead", "converted", "inquiry",

  // Retention
  "kept", "retained", "loyalty", "long-term client", "years with me",
  "stopped losing", "churn", "cancelled", "quit",

  // Pricing
  "raised prices", "charge", "pricing", "rates", "packages", "worth",
  "too cheap", "premium", "value", "increased revenue",

  // Marketing
  "instagram", "tiktok", "content", "viral", "followers", "dm",
  "posted", "social media", "ads", "advertising", "brand",

  // Sales
  "consultation", "closed", "objection", "sold", "pitch", "free session",
  "trial", "conversion rate",

  // Operations
  "scheduling", "cancelled", "no-show", "policy", "systems", "automated",
  "streamlined", "efficient",

  // Scaling
  "hired", "employee", "contractor", "online coaching", "group training",
  "passive income", "scaled", "grew to", "six figures", "full time",

  // Mindset
  "burnout", "imposter", "confidence", "boundaries", "work-life",
  "quit my job", "went full time",
];

// Questions that indicate someone sharing valuable experience
export const EXPERIENCE_INDICATORS = [
  "here's what worked",
  "learned the hard way",
  "game changer",
  "wish I knew",
  "mistake I made",
  "turned it around",
  "finally figured out",
  "breakthrough",
  "what actually works",
  "stopped doing",
  "started doing",
  "changed everything",
];

// Keywords indicating market gaps / unmet needs (high value for business opportunities)
export const MARKET_GAP_INDICATORS = [
  // Direct requests
  "wish there was", "does anyone know of", "looking for a", "can't find",
  "doesn't exist", "need a", "anyone have", "recommendations for",
  "is there a", "where can I find", "frustrated with", "hate that",

  // Pain points
  "no good option", "nothing works", "tried everything", "struggling to find",
  "why isn't there", "someone should build", "would pay for", "take my money",
  "biggest pain point", "most frustrating", "waste of time",

  // Unmet needs
  "what do you use for", "how do you handle", "best way to", "any solutions for",
  "better alternative", "cheaper option", "easier way", "automate",

  // Service gaps
  "clients keep asking", "clients want", "demand for", "no one offers",
  "underserved", "untapped", "niche", "opportunity",
];

// Filter out low-value content
export const EXCLUDE_PATTERNS = [
  "certification", // Usually asking about certs, not business
  "what exercises", // Training content, not business
  "form check",
  "program review",
  "hiring", // Looking for a trainer, not business advice
  "looking for",
  "recommend a",
];

export function scorePostRelevance(post: RedditPost): number {
  const text = `${post.title} ${post.selftext}`.toLowerCase();
  let score = 0;

  // Base score from engagement
  score += Math.min(post.score / 10, 20); // Max 20 points from upvotes
  score += Math.min(post.num_comments / 5, 15); // Max 15 points from comments

  // Keyword matches
  INSIGHT_KEYWORDS.forEach(keyword => {
    if (text.includes(keyword.toLowerCase())) score += 3;
  });

  // Experience indicators (high value)
  EXPERIENCE_INDICATORS.forEach(indicator => {
    if (text.includes(indicator.toLowerCase())) score += 10;
  });

  // Market gap indicators (high value - business opportunities)
  MARKET_GAP_INDICATORS.forEach(indicator => {
    if (text.includes(indicator.toLowerCase())) score += 12;
  });

  // Length bonus (longer posts often have more substance)
  if (post.selftext.length > 500) score += 5;
  if (post.selftext.length > 1000) score += 5;
  if (post.selftext.length > 2000) score += 5;

  // Penalty for exclusion patterns
  EXCLUDE_PATTERNS.forEach(pattern => {
    if (text.includes(pattern.toLowerCase())) score -= 15;
  });

  // Bonus for personal experience language
  if (text.includes(" i ") || text.includes("my ")) score += 5;
  if (text.includes("clients") || text.includes("client")) score += 5;

  return Math.max(0, score);
}

// Prompt for AI to extract deep insights
export function getInsightExtractionPrompt(post: RedditPost): string {
  return `You are a business intelligence analyst specializing in the fitness industry. Analyze this Reddit post from r/${post.subreddit} for DEEP, NON-OBVIOUS business insights relevant to personal trainers.

POST TITLE: ${post.title}

POST CONTENT:
${post.selftext}

ENGAGEMENT: ${post.score} upvotes, ${post.num_comments} comments

## Your Analysis Framework

**Level 1 - Surface Reading:** What is the poster explicitly saying?
**Level 2 - Implied Lessons:** What worked/failed that they may not have explicitly stated?
**Level 3 - Underlying Principles:** What psychological, economic, or behavioral principle explains WHY this worked?
**Level 4 - Transfer Potential:** How can this principle be applied in different contexts by other PTs?

## What Makes a VALUABLE Insight:
- It reveals a non-obvious truth (not "post on social media")
- It has specificity (numbers, timeframes, exact tactics)
- It shows causation, not just correlation
- It can be replicated by others
- It challenges conventional wisdom OR validates it with real evidence

## Red Flags (mark as not valuable):
- Generic advice everyone already knows
- Just asking a question with no answer
- Pure fitness/exercise content, not business
- Complaints without solutions
- Theory without real-world application

## Deep Analysis Questions to Answer:
1. **The Hidden Why:** What's the deeper reason this worked that the poster may not even realize?
2. **The Edge Case:** When would this NOT work? What conditions are required?
3. **The Compound Effect:** How does this insight connect to other business principles?
4. **The Contrarian View:** What's the opposite approach, and why might someone choose it?
5. **The Implementation Gap:** What's the hardest part of actually doing this?

## IMPORTANT - Market Gap Detection:
Always scan for UNMET NEEDS and MARKET OPPORTUNITIES. Look for:
- People asking for tools, services, or solutions that don't exist or are inadequate
- Frustrations with current options (too expensive, too complex, missing features)
- Repeated requests across multiple people (signals real demand)
- "I wish there was..." or "Does anyone know of..." language
- Pain points that could become business opportunities
- Services clients are asking for that PTs don't offer

If you detect a market gap, set category to "market_gaps" and fill in the market_opportunity object. These are GOLD for business development.

Respond in this JSON format:
{
  "has_valuable_insight": true/false,
  "category": "acquisition|retention|pricing|marketing|operations|mindset|sales|scaling|market_gaps",
  "sub_category": "specific area within category",
  "extracted_insight": "The core insight in 1-2 powerful sentences that a PT could remember and apply",
  "deep_analysis": "3-4 paragraphs covering: (1) WHY this works at a fundamental level, (2) The psychology or business principle behind it, (3) Important nuances and conditions for success, (4) How this connects to broader business strategy",
  "actionable_takeaway": "A specific, step-by-step action plan (3-5 steps) that a PT can implement this week. Be concrete - include scripts, templates, or exact approaches where possible.",
  "evidence_type": "anecdotal|data_backed|expert_opinion|case_study|market_demand",
  "confidence_score": 0-100,
  "novelty_score": 0-100,
  "key_quotes": ["Most impactful quotes from the post"],
  "related_concepts": ["Other business concepts this connects to"],
  "potential_pitfalls": ["What could go wrong if implemented poorly"],
  "market_opportunity": {
    "detected": true/false,
    "demand_signal": "What are people explicitly asking for or complaining about?",
    "current_gap": "What solution is missing, inadequate, or overpriced?",
    "potential_solution": "What product/service/feature could address this gap?",
    "demand_strength": "low|medium|high (based on engagement, repetition across posts, urgency of language)"
  }
}

**Scoring Guide:**
- confidence_score: How reliable is this insight? (consider: sample size, specificity, logical coherence, source credibility)
- novelty_score: How unique/non-obvious is this? (0 = everyone knows this, 100 = genuinely new perspective)

Only return has_valuable_insight: true if this genuinely teaches something valuable. Better to reject 10 mediocre posts than include 1 low-quality insight.`;
}

// Prompt for synthesizing multiple insights into wisdom
export function getSynthesisPrompt(insights: ScannedInsight[]): string {
  const insightSummaries = insights.map(i =>
    `- ${i.category}/${i.sub_category}: ${i.extracted_insight}`
  ).join("\n");

  return `Review these recently extracted insights from the PT community:

${insightSummaries}

Synthesize these into HIGHER-ORDER PATTERNS and PRINCIPLES. Look for:
1. Recurring themes across multiple sources
2. Contradictions that reveal context-dependent truths
3. Emerging trends not yet mainstream
4. Timeless principles being rediscovered
5. Counter-intuitive findings that challenge conventional wisdom

Create 2-3 "meta-insights" that combine multiple data points into actionable wisdom.

Format as JSON:
{
  "meta_insights": [
    {
      "title": "Pattern name",
      "synthesis": "Combined insight from multiple sources",
      "supporting_evidence": ["insight 1", "insight 2"],
      "application": "How to apply this pattern"
    }
  ]
}`;
}

// Categories for organizing insights
export const INSIGHT_CATEGORIES = {
  acquisition: {
    label: "Client Acquisition",
    description: "Getting new clients",
    sub_categories: ["referrals", "social_media", "local_marketing", "partnerships", "content", "paid_ads", "networking"]
  },
  retention: {
    label: "Client Retention",
    description: "Keeping clients long-term",
    sub_categories: ["engagement", "results_tracking", "relationship", "programming", "community", "value_adds"]
  },
  pricing: {
    label: "Pricing Strategy",
    description: "How to price services",
    sub_categories: ["packages", "raising_prices", "value_pricing", "discounts", "premium_positioning"]
  },
  marketing: {
    label: "Marketing",
    description: "Promoting your business",
    sub_categories: ["instagram", "tiktok", "youtube", "email", "content_strategy", "branding", "testimonials"]
  },
  operations: {
    label: "Operations",
    description: "Running the business efficiently",
    sub_categories: ["scheduling", "policies", "systems", "tools", "time_management", "admin"]
  },
  mindset: {
    label: "Mindset & Growth",
    description: "Psychology of success",
    sub_categories: ["confidence", "boundaries", "burnout", "imposter_syndrome", "motivation", "vision"]
  },
  sales: {
    label: "Sales",
    description: "Converting leads to clients",
    sub_categories: ["consultations", "objections", "closing", "follow_up", "proposals"]
  },
  scaling: {
    label: "Scaling",
    description: "Growing beyond 1-on-1",
    sub_categories: ["online_coaching", "group_training", "hiring", "passive_income", "studio"]
  },
  market_gaps: {
    label: "Market Gaps & Opportunities",
    description: "Unmet needs and business opportunities",
    sub_categories: ["tools_software", "services_missing", "underserved_niches", "pricing_gaps", "feature_requests", "client_demands", "workflow_pain_points"]
  }
};
