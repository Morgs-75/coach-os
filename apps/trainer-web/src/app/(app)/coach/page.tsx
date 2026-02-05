"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "clsx";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface BusinessContext {
  businessName: string;
  clientCount: number;
  activeClientCount: number;
  leadCount: number;
  monthlyRevenue: number;
  servicesOffered: string[];
}

interface PlatformInsights {
  avgClientsPerTrainer: number;
  avgRetentionRate: number;
  avgLeadConversionRate: number;
}

const SUGGESTED_TOPICS = [
  "How can I get more clients?",
  "Tips for client retention",
  "How should I price my services?",
  "Marketing strategies for PTs",
  "How to handle difficult clients",
  "Time management for trainers",
];

export default function CoachPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<BusinessContext | null>(null);
  const [insights, setInsights] = useState<PlatformInsights | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    loadContext();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadContext() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) return;

    // Load business context
    const [orgData, clientsData, leadsData, offersData] = await Promise.all([
      supabase.from("orgs").select("name").eq("id", membership.org_id).single(),
      supabase.from("clients").select("id, status").eq("org_id", membership.org_id),
      supabase.from("inquiries").select("id").eq("org_id", membership.org_id).neq("status", "WON").neq("status", "LOST"),
      supabase.from("offers").select("name").eq("org_id", membership.org_id).eq("is_active", true),
    ]);

    const clients = clientsData.data || [];
    const activeClients = clients.filter(c => c.status === "active");

    setContext({
      businessName: orgData.data?.name || "Your Business",
      clientCount: clients.length,
      activeClientCount: activeClients.length,
      leadCount: leadsData.data?.length || 0,
      monthlyRevenue: 0,
      servicesOffered: offersData.data?.map(o => o.name) || [],
    });

    // Load platform insights (anonymized aggregate data)
    loadPlatformInsights();
  }

  async function loadPlatformInsights() {
    const [allClients, allOrgs, allInquiries] = await Promise.all([
      supabase.from("clients").select("org_id, status"),
      supabase.from("orgs").select("id"),
      supabase.from("inquiries").select("status"),
    ]);

    const clients = allClients.data || [];
    const orgs = allOrgs.data || [];
    const inquiries = allInquiries.data || [];

    const totalOrgs = orgs.length || 1;
    const avgClients = clients.length / totalOrgs;
    const activeClients = clients.filter(c => c.status === "active").length;
    const retentionRate = clients.length > 0 ? (activeClients / clients.length) * 100 : 0;
    const wonLeads = inquiries.filter(i => i.status === "WON").length;
    const conversionRate = inquiries.length > 0 ? (wonLeads / inquiries.length) * 100 : 0;

    setInsights({
      avgClientsPerTrainer: Math.round(avgClients * 10) / 10,
      avgRetentionRate: Math.round(retentionRate),
      avgLeadConversionRate: Math.round(conversionRate),
    });
  }

  async function sendMessage(messageText?: string) {
    const text = messageText || input.trim();
    if (!text || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          context,
          history: messages.slice(-10), // Last 10 messages for context
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        // Fallback response if API not configured
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: getLocalResponse(text, context, insights),
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch {
      // Offline fallback
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: getLocalResponse(text, context, insights),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }

    setLoading(false);
  }

  function getLocalResponse(question: string, ctx: BusinessContext | null, platformInsights: PlatformInsights | null): string {
    const q = question.toLowerCase();
    const benchmarks = platformInsights ? `\n\n**Platform Benchmarks:**\n- Average clients per trainer: ${platformInsights.avgClientsPerTrainer}\n- Average retention rate: ${platformInsights.avgRetentionRate}%\n- Average lead conversion: ${platformInsights.avgLeadConversionRate}%` : "";

    if (q.includes("client") && (q.includes("more") || q.includes("get"))) {
      return `Great question! Here are some strategies to attract more clients:

**1. Leverage Your Current Clients**
- Ask satisfied clients for referrals (you can use the "Refer Me" feature!)
- Offer referral incentives

**2. Social Media Presence**
- Post transformation stories (with permission)
- Share workout tips and nutrition advice
- Use Instagram Reels and TikTok for reach

**3. Local Marketing**
- Partner with local businesses (cafes, physios, supplement stores)
- Offer free community workouts in parks
- Attend local fitness events

**4. Online Presence**
- Optimize your Google Business Profile
- Collect and showcase testimonials
- Create valuable free content (blog, YouTube)

${ctx && ctx.leadCount > 0 ? `\n**Quick Win:** You have ${ctx.leadCount} leads in your pipeline - focus on converting those first!` : ""}`;
    }

    if (q.includes("retention") || q.includes("keep")) {
      return `Client retention is crucial for sustainable growth. Here's what works:

**1. Build Strong Relationships**
- Remember personal details and goals
- Celebrate milestones and achievements
- Check in regularly outside of sessions

**2. Show Progress**
- Track metrics (strength, measurements, photos)
- Share progress reports monthly
- Celebrate wins, no matter how small

**3. Keep It Fresh**
- Vary workouts to prevent boredom
- Set new challenges and goals
- Introduce new training methods

**4. Add Value Beyond Sessions**
- Share nutrition tips and meal ideas
- Provide workout plans for off-days
- Create a supportive community

**5. Make It Convenient**
- Flexible scheduling
- Online/hybrid options
- Easy payment systems (Coach OS helps here!)

${ctx ? `\nYou currently have ${ctx.activeClientCount} active clients. Focus on keeping them engaged!` : ""}`;
    }

    if (q.includes("price") || q.includes("pricing") || q.includes("charge")) {
      return `Pricing is one of the most important business decisions. Here's how to approach it:

**1. Know Your Market**
- Research local competitors
- Understand your target demographic
- Consider cost of living in your area

**2. Calculate Your Costs**
- Rent/gym access fees
- Insurance and certifications
- Equipment and marketing
- Your time (including prep and travel)

**3. Value-Based Pricing**
- Price based on results, not just time
- Package sessions for better value
- Offer different tiers (basic, premium, VIP)

**4. Common Pricing Structures**
- Per session: $60-150+
- 10-pack: 10-15% discount
- Monthly unlimited: Premium option
- Online coaching: Lower price, higher volume

**5. Don't Undervalue Yourself**
- Your expertise has real value
- Cheap prices attract uncommitted clients
- It's easier to offer discounts than raise prices

${ctx && ctx.servicesOffered.length > 0 ? `\n**Your current services:** ${ctx.servicesOffered.join(", ")}. Consider creating package bundles for better retention.` : ""}`;
    }

    if (q.includes("market") || q.includes("promot") || q.includes("advertis")) {
      return `Marketing doesn't have to be expensive or time-consuming. Focus on these:

**1. Content Marketing (Free)**
- Share valuable tips on social media
- Post client success stories
- Create educational content

**2. Email Marketing**
- Use Coach OS to send newsletters
- Share tips, offers, and updates
- Stay top of mind

**3. Referral Program**
- Set up referral links in Coach OS
- Offer incentives for both parties
- Make it easy to share

**4. Local Partnerships**
- Physios and chiropractors
- Nutritionists and dietitians
- Sports stores and cafes

**5. Paid Advertising (If Budget Allows)**
- Facebook/Instagram ads to local area
- Google Ads for local searches
- Retargeting website visitors

**Start with one strategy, master it, then expand.**`;
    }

    if (q.includes("difficult") || q.includes("complain") || q.includes("unhappy")) {
      return `Handling difficult clients professionally is key to your reputation:

**1. Listen First**
- Let them express their concerns fully
- Don't interrupt or get defensive
- Show genuine empathy

**2. Find the Root Cause**
- Are expectations misaligned?
- Is there a communication issue?
- Are they going through personal stress?

**3. Address the Issue**
- Acknowledge their feelings
- Take responsibility where appropriate
- Propose solutions

**4. Set Boundaries**
- Have clear policies from the start
- Don't accept disrespectful behavior
- Know when to part ways professionally

**5. Document Everything**
- Keep records of communications
- Note any incidents
- Protect yourself professionally

**Remember:** Not every client is the right fit. It's okay to refer them elsewhere if the relationship isn't working.`;
    }

    if (q.includes("time") || q.includes("schedule") || q.includes("busy")) {
      return `Time management is crucial for work-life balance:

**1. Block Your Time**
- Set specific training hours
- Protect admin time
- Schedule personal time first

**2. Batch Similar Tasks**
- Program writing sessions
- Admin and email blocks
- Content creation time

**3. Use Technology**
- Coach OS for scheduling and payments
- Automated reminders and follow-ups
- Template messages for common responses

**4. Set Boundaries**
- Communicate your availability
- Stick to your schedule
- Say no to last-minute changes

**5. Optimize Your Day**
- Know your peak energy times
- Group sessions geographically
- Build in buffer time

**Remember:** Working more hours doesn't mean more success. Focus on efficiency and quality.`;
    }

    // Business analysis
    if (q.includes("analy") || q.includes("performance") || q.includes("improve")) {
      let analysis = `Here's a comprehensive analysis of your business:\n`;

      if (ctx && platformInsights) {
        // Client analysis
        const clientComparison = ctx.activeClientCount >= platformInsights.avgClientsPerTrainer ? "above" : "below";
        analysis += `\n**Client Base Analysis**\n`;
        analysis += `You have ${ctx.activeClientCount} active clients, which is ${clientComparison} the platform average of ${platformInsights.avgClientsPerTrainer}.\n`;

        if (ctx.activeClientCount < platformInsights.avgClientsPerTrainer) {
          analysis += `\n**Opportunity:** Focus on lead conversion and marketing to grow your client base.\n`;
        } else {
          analysis += `\n**Strength:** You're maintaining a strong client base. Consider premium offerings to increase revenue per client.\n`;
        }

        // Lead pipeline
        analysis += `\n**Lead Pipeline**\n`;
        analysis += `You have ${ctx.leadCount} leads in your pipeline.\n`;
        if (ctx.leadCount > 0) {
          analysis += `At the platform average conversion rate of ${platformInsights.avgLeadConversionRate}%, you could convert approximately ${Math.round(ctx.leadCount * platformInsights.avgLeadConversionRate / 100)} leads.\n`;
          analysis += `\n**Action:** Follow up with leads within 24 hours to maximize conversion.\n`;
        } else {
          analysis += `\n**Action:** Focus on lead generation through referrals, social media, and local partnerships.\n`;
        }

        // Services
        analysis += `\n**Service Offerings**\n`;
        analysis += `You have ${ctx.servicesOffered.length} services: ${ctx.servicesOffered.join(", ") || "None listed"}.\n`;
        if (ctx.servicesOffered.length < 3) {
          analysis += `\n**Opportunity:** Consider adding package tiers (basic, standard, premium) to cater to different budgets.\n`;
        }
      }

      analysis += `\n**Key Metrics to Track**
- Monthly new client acquisitions
- Client lifetime value
- Session attendance rate
- Referral rate
- Revenue per client

Would you like specific strategies for any of these areas?`;

      return analysis;
    }

    // 90-day plan
    if (q.includes("90") || q.includes("action plan") || q.includes("roadmap")) {
      let plan = `Here's your 90-day business growth action plan:\n`;

      plan += `\n**Month 1: Foundation**
- Week 1-2: Audit current clients and services
  - Review client satisfaction
  - Identify at-risk clients
  - Document your unique value proposition
- Week 3-4: Optimize operations
  - Set up referral program
  - Create email templates
  - Review pricing strategy\n`;

      plan += `\n**Month 2: Growth**
- Week 5-6: Marketing push
  - Launch referral incentives
  - Post daily on social media
  - Reach out to 5 local businesses for partnerships
- Week 7-8: Lead generation
  - Run a free community event
  - Create a lead magnet (free workout plan)
  - Follow up with all dormant leads\n`;

      plan += `\n**Month 3: Scale**
- Week 9-10: Conversion focus
  - Convert pipeline leads
  - Upsell existing clients to packages
  - Launch a time-limited offer
- Week 11-12: Review & adjust
  - Analyze results
  - Double down on what works
  - Plan next quarter\n`;

      if (ctx) {
        plan += `\n**Your Specific Targets:**
- Current clients: ${ctx.activeClientCount} → Target: ${Math.ceil(ctx.activeClientCount * 1.25)} (25% growth)
- Current leads: ${ctx.leadCount} → Target: Convert ${Math.ceil(ctx.leadCount * 0.4)} (40%)
- Services: ${ctx.servicesOffered.length} → Consider adding 1-2 complementary offerings`;
      }

      return plan;
    }

    // Growth strategies
    if (q.includes("growth") || q.includes("successful") || q.includes("strateg")) {
      let strategies = `Based on data from successful trainers on the platform, here are the top growth strategies:\n`;

      strategies += `\n**1. Referral Systems (Most Effective)**
Successful trainers report that 40-60% of new clients come from referrals.
- Offer incentives to both referrer and new client
- Make it easy: use the "Refer Me" feature
- Ask for referrals at peak moments (after achievements)\n`;

      strategies += `\n**2. Package-Based Pricing**
Trainers using packages have 2x better retention than pay-per-session.
- Offer 3 tiers (good-better-best)
- Include bonuses in higher tiers
- Create urgency with limited availability\n`;

      strategies += `\n**3. Consistent Follow-Up**
Trainers who follow up within 24 hours convert 3x more leads.
- Set follow-up reminders for all leads
- Use templates for quick responses
- Offer a free consultation call\n`;

      strategies += `\n**4. Community Building**
Top trainers build communities, not just client lists.
- Create a private group for clients
- Run group challenges
- Celebrate client wins publicly (with permission)\n`;

      strategies += `\n**5. Content Marketing**
Posting valuable content increases inquiries by 50%.
- Share transformation stories
- Post educational content
- Show your personality and values\n`;

      if (platformInsights) {
        strategies += `\n**Platform Success Metrics:**
- Top performers: 30+ active clients
- Best retention: 80%+ (platform avg: ${platformInsights.avgRetentionRate}%)
- Lead conversion: 40%+ (platform avg: ${platformInsights.avgLeadConversionRate}%)`;
      }

      return strategies;
    }

    // Goal-related questions
    if (q.includes("goal") || q.includes("target") || q.includes("quarter")) {
      let goalAdvice = `Setting clear business goals is essential for growth. Here's how to approach it:

**1. Set SMART Goals**
- Specific: "Get 5 new clients" not "Get more clients"
- Measurable: Track progress with numbers
- Achievable: Stretch but realistic
- Relevant: Aligned with your business vision
- Time-bound: Set deadlines

**2. Key Areas to Set Goals**
- Client count (monthly/quarterly targets)
- Revenue targets
- Lead conversion rate
- Client retention rate
- Social media growth

**3. Break Down Big Goals**
- Yearly goal → Quarterly milestones
- Quarterly → Monthly targets
- Monthly → Weekly actions`;

      if (ctx && platformInsights) {
        goalAdvice += `

**Your Current Position:**
- Active clients: ${ctx.activeClientCount} (Platform avg: ${platformInsights.avgClientsPerTrainer})
- Leads in pipeline: ${ctx.leadCount}

**Suggested Goals:**
- If below average: Aim to reach platform average within 3 months
- If at average: Set a goal to be 20% above average`;
      }

      goalAdvice += `

Use the Goals section below to set and track your business goals!`;
      return goalAdvice;
    }

    // Default response
    return `That's a great question! As your AI business coach, I'm here to help with:

- **Client Acquisition** - Strategies to get more clients
- **Client Retention** - Keeping clients engaged long-term
- **Pricing & Packages** - How to price your services
- **Marketing** - Promoting your business effectively
- **Time Management** - Working smarter, not harder
- **Business Growth** - Scaling your PT business
- **Goal Setting** - Planning your business targets

${ctx ? `\n**Your Business Snapshot:**\n- ${ctx.activeClientCount} active clients\n- ${ctx.leadCount} leads in pipeline\n- ${ctx.servicesOffered.length} services offered` : ""}
${benchmarks}

What specific area would you like advice on?`;
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">AI Business Coach</h1>
        <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Get personalized advice to grow your PT business</p>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🧠</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Welcome to your AI Business Coach
              </h2>
              <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-6 max-w-md mx-auto">
                I'm here to help you grow your personal training business. Ask me anything about
                marketing, pricing, client retention, and more.
              </p>

              {/* Suggested Topics */}
              <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
                {SUGGESTED_TOPICS.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => sendMessage(topic)}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-full text-sm text-gray-700 dark:text-gray-300 transition-colors"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={clsx(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={clsx(
                    "max-w-[80%] rounded-2xl px-4 py-3",
                    message.role === "user"
                      ? "bg-brand-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  )}
                >
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {message.content.split("\n").map((line, i) => {
                      // Handle bold text
                      const parts = line.split(/(\*\*.*?\*\*)/g);
                      return (
                        <p key={i} className={i > 0 ? "mt-2" : ""}>
                          {parts.map((part, j) => {
                            if (part.startsWith("**") && part.endsWith("**")) {
                              return (
                                <strong key={j}>
                                  {part.slice(2, -2)}
                                </strong>
                              );
                            }
                            return part;
                          })}
                        </p>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about growing your business..."
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              disabled={loading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Business Insights Panel */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Your Stats */}
        {context && (
          <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Your Business</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-2xl font-bold text-brand-600">{context.activeClientCount}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Active Clients</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{context.leadCount}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Pipeline Leads</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{context.servicesOffered.length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Services</p>
              </div>
            </div>
          </div>
        )}

        {/* Platform Benchmarks */}
        {insights && (
          <div className="p-4 bg-gradient-to-br from-brand-50 to-purple-50 rounded-xl border border-brand-100">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Platform Insights</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-2xl font-bold text-brand-600">{insights.avgClientsPerTrainer}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Avg Clients</p>
                {context && (
                  <p className={clsx(
                    "text-xs font-medium mt-1",
                    context.activeClientCount >= insights.avgClientsPerTrainer ? "text-green-600" : "text-amber-600"
                  )}>
                    {context.activeClientCount >= insights.avgClientsPerTrainer ? "Above avg" : "Below avg"}
                  </p>
                )}
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">{insights.avgRetentionRate}%</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Retention Rate</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{insights.avgLeadConversionRate}%</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Lead Conv.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => sendMessage("Help me set business goals for this quarter")}
          className="px-4 py-2 bg-brand-50 text-brand-700 rounded-lg text-sm font-medium hover:bg-brand-100 transition-colors"
        >
          Set Goals
        </button>
        <button
          onClick={() => sendMessage("Analyze my business performance and suggest improvements")}
          className="px-4 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors"
        >
          Business Analysis
        </button>
        <button
          onClick={() => sendMessage("What are the top growth strategies used by successful trainers?")}
          className="px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
        >
          Growth Strategies
        </button>
        <button
          onClick={() => sendMessage("Help me create a 90-day action plan")}
          className="px-4 py-2 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors"
        >
          90-Day Plan
        </button>
      </div>
    </div>
  );
}
