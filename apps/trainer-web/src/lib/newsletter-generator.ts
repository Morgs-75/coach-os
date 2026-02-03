// Newsletter Generation System
// Creates personalized content for different PT experience levels

export type AudienceLevel = "beginner" | "intermediate" | "advanced" | "all";
export type NewsletterFrequency = "daily" | "weekly";
export type ContentTheme =
  | "client_acquisition"
  | "retention_mastery"
  | "pricing_psychology"
  | "marketing_tactics"
  | "mindset_growth"
  | "operational_excellence"
  | "sales_conversion"
  | "scaling_strategies"
  | "industry_trends"
  | "success_stories";

export interface NewsletterSection {
  type: "headline" | "insight" | "tip" | "quote" | "action" | "story" | "stat";
  title?: string;
  content: string;
  audienceLevel: AudienceLevel;
}

export interface GeneratedNewsletter {
  id?: string;
  subject: string;
  preheader: string;
  theme: ContentTheme;
  audienceLevel: AudienceLevel;
  sections: NewsletterSection[];
  callToAction: {
    text: string;
    subtext: string;
  };
  generatedAt: string;
  status: "draft" | "approved" | "sent";
}

// Theme configurations with rotating angles
export const CONTENT_THEMES: Record<ContentTheme, {
  name: string;
  description: string;
  angles: string[];
  beginnerFocus: string;
  advancedFocus: string;
}> = {
  client_acquisition: {
    name: "Getting Clients",
    description: "Strategies for attracting new clients",
    angles: [
      "The power of referrals",
      "Social media that converts",
      "Local partnerships",
      "Content that attracts",
      "Free sessions strategy",
      "Networking effectively",
      "Online presence optimization",
      "Word of mouth amplification",
    ],
    beginnerFocus: "Getting your first 10 clients through personal connections and basic marketing",
    advancedFocus: "Systematic acquisition funnels and scalable lead generation",
  },
  retention_mastery: {
    name: "Keeping Clients",
    description: "Building long-term client relationships",
    angles: [
      "The first 90 days",
      "Creating accountability",
      "Progress tracking systems",
      "Building community",
      "Preventing burnout",
      "Re-engaging dormant clients",
      "The personal touch",
      "Value beyond sessions",
    ],
    beginnerFocus: "Building genuine relationships and delivering consistent results",
    advancedFocus: "Systematic retention programs and client lifecycle management",
  },
  pricing_psychology: {
    name: "Pricing & Packages",
    description: "Maximizing revenue through smart pricing",
    angles: [
      "Value-based pricing",
      "Package psychology",
      "Raising prices confidently",
      "Premium positioning",
      "Discount strategy",
      "Payment plans",
      "Upselling ethically",
      "Price anchoring",
    ],
    beginnerFocus: "Setting your first prices and understanding your worth",
    advancedFocus: "Sophisticated pricing strategies and revenue optimization",
  },
  marketing_tactics: {
    name: "Marketing That Works",
    description: "Practical marketing for busy trainers",
    angles: [
      "Content that resonates",
      "Instagram mastery",
      "TikTok for trainers",
      "Email that converts",
      "Testimonial leverage",
      "Before/after ethics",
      "Personal branding",
      "Local SEO basics",
    ],
    beginnerFocus: "Simple, consistent marketing you can do in 30 minutes a day",
    advancedFocus: "Multi-channel marketing systems and automation",
  },
  mindset_growth: {
    name: "Trainer Mindset",
    description: "Mental game for business success",
    angles: [
      "Imposter syndrome",
      "Confidence building",
      "Handling rejection",
      "Work-life balance",
      "Avoiding burnout",
      "Growth mindset",
      "Dealing with difficult clients",
      "Long-term vision",
    ],
    beginnerFocus: "Building confidence and overcoming early doubts",
    advancedFocus: "Leadership mindset and sustainable success psychology",
  },
  operational_excellence: {
    name: "Running Your Business",
    description: "Systems and efficiency",
    angles: [
      "Time management",
      "Scheduling optimization",
      "Admin automation",
      "Client management systems",
      "Financial tracking",
      "Legal essentials",
      "Cancellation policies",
      "Professional boundaries",
    ],
    beginnerFocus: "Setting up basic systems that save time",
    advancedFocus: "Optimizing operations for scale and efficiency",
  },
  sales_conversion: {
    name: "Converting Leads",
    description: "Turning interest into clients",
    angles: [
      "The consultation framework",
      "Handling objections",
      "Follow-up mastery",
      "Closing without pressure",
      "Building urgency ethically",
      "Discovery questions",
      "Presenting packages",
      "The trial session",
    ],
    beginnerFocus: "Having confident conversations about your services",
    advancedFocus: "Systematic sales processes with high conversion rates",
  },
  scaling_strategies: {
    name: "Growing Beyond 1-on-1",
    description: "Scaling your PT business",
    angles: [
      "Group training models",
      "Online coaching setup",
      "Hiring your first trainer",
      "Passive income streams",
      "Building a brand",
      "Multiple revenue streams",
      "Studio ownership",
      "Franchise thinking",
    ],
    beginnerFocus: "When and how to think about growth",
    advancedFocus: "Building scalable systems and team leadership",
  },
  industry_trends: {
    name: "Industry Pulse",
    description: "What's happening in fitness",
    angles: [
      "Technology adoption",
      "Client expectations",
      "Competition landscape",
      "Certification trends",
      "Pricing benchmarks",
      "Marketing shifts",
      "Post-pandemic changes",
      "Future predictions",
    ],
    beginnerFocus: "Understanding the landscape you're entering",
    advancedFocus: "Staying ahead of trends and positioning for the future",
  },
  success_stories: {
    name: "Real Success Stories",
    description: "Learning from those who've done it",
    angles: [
      "From zero to full book",
      "Career transitions",
      "Overcoming setbacks",
      "Niche success",
      "Online transformation",
      "Studio builders",
      "Work-life wins",
      "Financial freedom",
    ],
    beginnerFocus: "Inspiration from trainers who started where you are",
    advancedFocus: "Advanced strategies from top performers",
  },
};

// Newsletter templates by frequency
export const NEWSLETTER_TEMPLATES = {
  daily: {
    name: "Daily Dose",
    structure: [
      { type: "headline", description: "Attention-grabbing opener" },
      { type: "insight", description: "One key insight from the repository" },
      { type: "action", description: "One thing to do today" },
      { type: "quote", description: "Motivational closer" },
    ],
    targetLength: 300, // words
  },
  weekly: {
    name: "Weekly Wins",
    structure: [
      { type: "headline", description: "Theme introduction" },
      { type: "insight", description: "Deep dive insight #1" },
      { type: "tip", description: "Quick practical tip" },
      { type: "insight", description: "Deep dive insight #2" },
      { type: "story", description: "Real-world example or case study" },
      { type: "action", description: "This week's challenge" },
      { type: "stat", description: "Interesting industry stat" },
    ],
    targetLength: 800, // words
  },
};

// Tone variations for different audiences
export const AUDIENCE_TONES = {
  beginner: {
    name: "New Trainer",
    characteristics: [
      "Encouraging and supportive",
      "Explains concepts simply",
      "Acknowledges challenges",
      "Focuses on fundamentals",
      "Celebrates small wins",
    ],
    vocabulary: "accessible, non-jargon",
    examples: "relatable beginner scenarios",
  },
  intermediate: {
    name: "Growing Trainer",
    characteristics: [
      "Assumes basic knowledge",
      "Focuses on optimization",
      "Addresses plateaus",
      "Introduces advanced concepts gradually",
      "Balances tactics and strategy",
    ],
    vocabulary: "industry-standard terms",
    examples: "scaling challenges and solutions",
  },
  advanced: {
    name: "Established Trainer",
    characteristics: [
      "Sophisticated insights",
      "Systems thinking",
      "Leadership perspective",
      "Strategic focus",
      "Challenges assumptions",
    ],
    vocabulary: "advanced business terminology",
    examples: "high-level case studies",
  },
  all: {
    name: "Universal",
    characteristics: [
      "Layered content (basics to advanced)",
      "Something for everyone",
      "Clear section headers by level",
      "Inclusive language",
    ],
    vocabulary: "mixed with explanations",
    examples: "varied complexity",
  },
};

// Subject line templates that can be customized
export const SUBJECT_LINE_TEMPLATES = [
  "The {adjective} truth about {topic}",
  "{Number} {topic} mistakes you're probably making",
  "Why {counterintuitive_statement}",
  "How {persona} {achieved_result}",
  "The {topic} strategy nobody talks about",
  "What I learned from {experience}",
  "{Question_about_topic}?",
  "Stop doing {common_mistake}",
  "The {timeframe} guide to {outcome}",
  "{Surprising_stat} and what it means for you",
];

// Get the prompt for generating a newsletter
export function getNewsletterGenerationPrompt(
  theme: ContentTheme,
  angle: string,
  audienceLevel: AudienceLevel,
  frequency: NewsletterFrequency,
  insights: string[],
): string {
  const themeConfig = CONTENT_THEMES[theme];
  const template = NEWSLETTER_TEMPLATES[frequency];
  const audienceTone = AUDIENCE_TONES[audienceLevel];

  const focusArea = audienceLevel === "beginner" || audienceLevel === "all"
    ? themeConfig.beginnerFocus
    : themeConfig.advancedFocus;

  return `You are an expert fitness business copywriter creating a ${frequency} newsletter for personal trainers.

## Newsletter Brief
- **Theme:** ${themeConfig.name} - ${themeConfig.description}
- **Specific Angle:** ${angle}
- **Audience:** ${audienceTone.name} level trainers
- **Focus:** ${focusArea}
- **Target Length:** ~${template.targetLength} words

## Audience Characteristics
${audienceTone.characteristics.map(c => `- ${c}`).join("\n")}
- Vocabulary: ${audienceTone.vocabulary}
- Examples should be: ${audienceTone.examples}

## Real Insights to Incorporate
Use these verified insights from successful trainers (weave them naturally, don't just list them):
${insights.map((i, idx) => `${idx + 1}. ${i}`).join("\n")}

## Required Sections
${template.structure.map((s, idx) => `${idx + 1}. **${s.type.toUpperCase()}**: ${s.description}`).join("\n")}

## Writing Guidelines
1. **Hook immediately** - First line must grab attention
2. **Be specific** - Use numbers, examples, exact tactics
3. **Be actionable** - Every insight should have a "do this" attached
4. **Be human** - Write like a mentor, not a textbook
5. **Create value** - Reader should feel smarter after reading
6. **Vary sentence length** - Mix short punchy lines with longer explanations
7. **Use "you" language** - Make it personal

## Tone Guidelines
- Confident but not arrogant
- Practical, not theoretical
- Encouraging, not preachy
- Professional but warm
- Evidence-based but accessible

## Output Format
Return a JSON object:
{
  "subject": "Compelling subject line (under 50 chars)",
  "preheader": "Preview text that complements subject (under 100 chars)",
  "sections": [
    {
      "type": "headline|insight|tip|quote|action|story|stat",
      "title": "Section title if applicable",
      "content": "The actual content"
    }
  ],
  "callToAction": {
    "text": "What you want them to do",
    "subtext": "Why they should do it"
  }
}

Make it genuinely valuable. A trainer should forward this to a colleague.`;
}

// Get a rotation of themes to ensure variety
export function getNextTheme(previousThemes: ContentTheme[], count = 1): ContentTheme[] {
  const allThemes = Object.keys(CONTENT_THEMES) as ContentTheme[];
  const availableThemes = allThemes.filter(t => !previousThemes.slice(-3).includes(t));

  // Shuffle and pick
  const shuffled = availableThemes.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Get a random angle for a theme
export function getRandomAngle(theme: ContentTheme, usedAngles: string[] = []): string {
  const angles = CONTENT_THEMES[theme].angles;
  const available = angles.filter(a => !usedAngles.includes(a));

  if (available.length === 0) {
    // All angles used, start fresh
    return angles[Math.floor(Math.random() * angles.length)];
  }

  return available[Math.floor(Math.random() * available.length)];
}
