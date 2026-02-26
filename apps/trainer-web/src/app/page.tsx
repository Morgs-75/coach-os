import Link from "next/link";

// Force static generation for fastest possible response
export const dynamic = "force-static";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white">

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="text-2xl font-bold tracking-tight">
            Coach<span className="text-brand-500">OS</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#how-it-works" className="text-sm text-gray-400 hover:text-white transition-colors hidden md:block">How it works</a>
            <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors hidden md:block">Features</a>
            <a href="#pricing" className="text-sm text-gray-400 hover:text-white transition-colors hidden md:block">Pricing</a>
            <a href="#faq" className="text-sm text-gray-400 hover:text-white transition-colors hidden md:block">FAQ</a>
            <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">Sign In</Link>
            <Link href="/signup" className="px-4 py-2 text-sm font-medium bg-white text-black rounded-full hover:bg-gray-200 transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-500/20 via-transparent to-transparent" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-gray-400">Now with AI-powered insights</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight" style={{ textShadow: '0 0 7px rgba(14,165,233,0.9), 0 0 30px rgba(14,165,233,0.7), 0 0 70px rgba(14,165,233,0.55), 0 0 130px rgba(14,165,233,0.45), 0 0 200px rgba(14,165,233,0.3), 0 0 300px rgba(14,165,233,0.2)' }}>
            The Operating System That Turns Personal Trainers
          </h1>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
            <span className="bg-gradient-to-r from-brand-400 to-cyan-400 bg-clip-text text-transparent" style={{ filter: 'drop-shadow(0 0 7px rgba(14,165,233,0.9)) drop-shadow(0 0 30px rgba(14,165,233,0.8)) drop-shadow(0 0 70px rgba(14,165,233,0.6)) drop-shadow(0 0 140px rgba(6,182,212,0.45)) drop-shadow(0 0 220px rgba(6,182,212,0.3))' }}>
              Into Business Owners.
            </span>
          </h2>

          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Manage your clients, their nutrition, and your business finances — all in one place.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup" className="px-8 py-4 text-lg font-medium bg-white text-black rounded-full hover:bg-gray-200 transition-all hover:scale-105">
              Start Free Trial
            </Link>
            <a href="#how-it-works" className="px-8 py-4 text-lg font-medium text-white border border-white/20 rounded-full hover:bg-white/5 transition-all">
              See How It Works
            </a>
          </div>

          <div className="mt-20 grid grid-cols-3 gap-8 max-w-xl mx-auto">
            <div>
              <div className="text-3xl font-bold">500+</div>
              <div className="text-sm text-gray-500">Active Trainers</div>
            </div>
            <div>
              <div className="text-3xl font-bold">$2M+</div>
              <div className="text-sm text-gray-500">Processed</div>
            </div>
            <div>
              <div className="text-3xl font-bold">99.9%</div>
              <div className="text-sm text-gray-500">Uptime</div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
          <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-32 bg-gradient-to-b from-black to-gray-950">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-sm font-medium text-brand-400 uppercase tracking-widest mb-4">Sound familiar?</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-6">You became a PT to change lives.<br />Not to fight with spreadsheets.</h2>
          <p className="text-lg text-gray-400 mb-16">Most personal trainers are running their business across 5 different tools — and none of them talk to each other.</p>

          <div className="grid md:grid-cols-3 gap-6 text-left">
            {[
              {
                icon: "😤",
                problem: "Chasing invoices manually",
                detail: "Sending payment reminders by hand, losing track of who owes what, spending hours on admin that should take minutes."
              },
              {
                icon: "📊",
                problem: "No idea what your business is actually making",
                detail: "Xero is expensive and confusing. Your bank statements are a mess. GST time is a nightmare every quarter."
              },
              {
                icon: "👻",
                problem: "Clients ghosting without warning",
                detail: "You only find out a client is disengaged when they cancel. By then it's too late to save them."
              },
              {
                icon: "🗓️",
                problem: "Booking chaos",
                detail: "Back-and-forth messages to schedule sessions. Last-minute cancellations with no penalty. No-shows that cost you money."
              },
              {
                icon: "🔧",
                problem: "Too many tools, too many bills",
                detail: "Booking tool + Xero + CRM + SMS platform + email marketing. You're paying $300+/mo for a patchwork that barely works."
              },
              {
                icon: "📉",
                problem: "No system for growing",
                detail: "Word of mouth only goes so far. No lead pipeline, no follow-up automation, no referral system. Growth feels random."
              },
            ].map((item, i) => (
              <div key={i} className="p-6 rounded-xl bg-white/3 border border-white/8">
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="font-semibold text-white mb-2">{item.problem}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 p-8 rounded-2xl bg-brand-500/10 border border-brand-500/20">
            <p className="text-xl font-medium text-white">Coach OS replaces all of it. One platform. One subscription. One less thing to worry about.</p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-32 bg-gray-950">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-20">
            <p className="text-sm font-medium text-brand-400 uppercase tracking-widest mb-4">How it works</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Up and running in 15 minutes</h2>
            <p className="text-xl text-gray-400">No tech skills needed. No complicated setup. Just connect and go.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                step: "01",
                title: "Set up your business",
                detail: "Add your session types, set your availability, connect Stripe for payments, and customise your booking page. Done in minutes."
              },
              {
                step: "02",
                title: "Invite your clients",
                detail: "Send clients a magic link portal. They can book sessions, view their packages, and manage their own schedule — no app download needed."
              },
              {
                step: "03",
                title: "Let Coach OS run the rest",
                detail: "Automated reminders, payment collection, churn alerts, accounting reconciliation, and business insights — all running in the background."
              },
            ].map((item, i) => (
              <div key={i} className="relative">
                <div className="text-7xl font-bold text-white/5 mb-4 select-none">{item.step}</div>
                <h3 className="text-xl font-semibold mb-3 -mt-8">{item.title}</h3>
                <p className="text-gray-400 leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-32 bg-gradient-to-b from-gray-950 to-gray-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-brand-400 uppercase tracking-widest mb-4">Features</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Built different from every competitor</h2>
            <p className="text-xl text-gray-400">Every other platform delivers workouts. Coach OS runs your business.</p>
          </div>

          {/* Only Coach OS strip */}
          <div className="grid md:grid-cols-3 gap-4 mb-20">
            {[
              { label: "The only PT platform with built-in accounting" },
              { label: "The only PT platform with AI business insights" },
              { label: "Flat pricing — we never charge per client" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-6 py-4 rounded-xl bg-brand-500/10 border border-brand-500/30">
                <svg className="w-5 h-5 text-brand-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium text-brand-300">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: "💰",
                title: "Replaces Xero",
                badge: true,
                description: "Bank sync, auto-categorisation, P&L reports, and GST tracking. Cancel your accounting software.",
                bullets: ["Basiq bank feed sync", "AI transaction categorisation", "GST & BAS-ready reports", "Double-entry ledger", "Audit trail"]
              },
              {
                icon: "🧠",
                title: "AI Business Insights",
                badge: true,
                description: "Market intelligence, churn prediction, and revenue analytics. Know your business before problems hit.",
                bullets: ["Daily churn risk scoring", "Market trend alerts", "Revenue segmentation", "At-risk client alerts", "Weekly priority actions"]
              },
              {
                icon: "⚡",
                title: "Automation Engine",
                badge: true,
                description: "Set-and-forget workflows for SMS, email, and push. Re-engage clients automatically while you sleep.",
                bullets: ["Trigger-based workflows", "Quiet hours enforcement", "SMS, email & push actions", "AI-generated templates", "Dedup & rate limiting"]
              },
              {
                icon: "👥",
                title: "Full Client OS",
                badge: false,
                description: "Bookings, client portal, CRM pipeline, waivers, referrals, and risk scoring — all in one place.",
                bullets: ["Magic link client portal", "Self-booking & scheduling", "CRM lead pipeline", "Digital waivers", "Referral program"]
              },
              {
                icon: "🥗",
                title: "Nutrition + Training",
                badge: false,
                description: "Manage food, training, and finances in a single platform. The complete picture, not just workouts.",
                bullets: ["Meal plan builder", "Macro & nutrition tracking", "Food + session history", "Progress photos & metrics", "Habit tracking"]
              },
              {
                icon: "📧",
                title: "Smart Comms",
                badge: false,
                description: "AI-generated SMS templates, broadcast campaigns, and newsletters. Built for PTs, not marketers.",
                bullets: ["SMS broadcast campaigns", "AI SMS template generator", "Newsletter generation", "Push notifications", "Inbound SMS handling"]
              },
            ].map((feature, i) => (
              <div key={i} className="group p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-brand-500/50 transition-all hover:-translate-y-1">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                  {feature.badge && (
                    <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-brand-500/20 text-brand-400 rounded-full border border-brand-500/30">
                      Unique
                    </span>
                  )}
                </div>
                <p className="text-gray-400 mb-4 text-sm">{feature.description}</p>
                <ul className="space-y-1.5">
                  {feature.bullets.map((b, j) => (
                    <li key={j} className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="w-1 h-1 rounded-full bg-brand-500 flex-shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Replace Xero Section */}
      <section className="py-24 bg-gray-900">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-sm font-medium text-brand-400 uppercase tracking-widest mb-4">Built for Australia</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Cancel Xero. Cancel your booking tool.<br />One subscription does it all.</h2>
          <p className="text-lg text-gray-400 mb-10">
            Coach OS is the only PT platform built for Australian trainers — with GST tracking, AUD bank feeds,
            and BAS-ready reports built in. Stop paying for three tools when one does everything.
          </p>
          <div className="grid md:grid-cols-3 gap-6 text-left mb-10">
            {[
              { tool: "Xero / MYOB", cost: "~$80/mo", replace: "Accounting" },
              { tool: "Booking tool", cost: "~$50/mo", replace: "Scheduling & portal" },
              { tool: "SMS platform", cost: "~$40/mo", replace: "Comms & automations" },
            ].map((item, i) => (
              <div key={i} className="p-5 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-300">{item.tool}</span>
                  <span className="text-sm text-red-400 line-through">{item.cost}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-brand-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Replaced by Coach OS {item.replace}
                </div>
              </div>
            ))}
          </div>
          <div className="inline-flex items-center gap-3 px-6 py-4 rounded-xl bg-brand-500/10 border border-brand-500/30">
            <span className="text-brand-300 font-medium">You were paying ~$170/mo across 3 tools.</span>
            <span className="text-white font-bold">Coach OS Pro is $99/mo.</span>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-32 bg-gradient-to-b from-gray-900 to-gray-950">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-brand-400 uppercase tracking-widest mb-4">Comparison</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">How we stack up</h2>
            <p className="text-xl text-gray-400">See what you get that no other PT platform offers.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-4 pr-6 text-gray-400 font-medium w-1/3">Feature</th>
                  <th className="text-center py-4 px-4 text-gray-400 font-medium">Trainerize</th>
                  <th className="text-center py-4 px-4 text-gray-400 font-medium">PT Distinction</th>
                  <th className="text-center py-4 px-4 text-gray-400 font-medium">TrueCoach</th>
                  <th className="text-center py-4 px-4 font-bold text-white bg-brand-500/10 rounded-t-lg">Coach OS</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: "Client self-booking",         trainerize: true,  ptd: true,  truecoach: false, us: true },
                  { feature: "Stripe payments",             trainerize: true,  ptd: true,  truecoach: true,  us: true },
                  { feature: "Flat pricing (not per-client)", trainerize: false, ptd: false, truecoach: false, us: true },
                  { feature: "Nutrition coaching",          trainerize: true,  ptd: true,  truecoach: false, us: true },
                  { feature: "Automation engine",           trainerize: false, ptd: true,  truecoach: false, us: true },
                  { feature: "CRM / lead pipeline",         trainerize: false, ptd: false, truecoach: false, us: true },
                  { feature: "Built-in accounting",         trainerize: false, ptd: false, truecoach: false, us: true },
                  { feature: "Bank feed sync",              trainerize: false, ptd: false, truecoach: false, us: true },
                  { feature: "GST tracking",                trainerize: false, ptd: false, truecoach: false, us: true },
                  { feature: "P&L reports",                 trainerize: false, ptd: false, truecoach: false, us: true },
                  { feature: "AI churn / risk scoring",     trainerize: false, ptd: false, truecoach: false, us: true },
                  { feature: "AI market intelligence",      trainerize: false, ptd: false, truecoach: false, us: true },
                  { feature: "AI executive assistant",      trainerize: false, ptd: false, truecoach: false, us: true },
                ].map((row, i) => (
                  <tr key={i} className={`border-b border-white/5 ${i % 2 === 0 ? "bg-white/2" : ""}`}>
                    <td className="py-3 pr-6 text-gray-300">{row.feature}</td>
                    {[row.trainerize, row.ptd, row.truecoach].map((val, j) => (
                      <td key={j} className="text-center py-3 px-4">
                        {val
                          ? <span className="text-green-500">✓</span>
                          : <span className="text-gray-700">—</span>}
                      </td>
                    ))}
                    <td className="text-center py-3 px-4 bg-brand-500/10">
                      {row.us
                        ? <span className="text-brand-400 font-bold">✓</span>
                        : <span className="text-gray-700">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-32 bg-gray-950">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-brand-400 uppercase tracking-widest mb-4">Testimonials</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">PTs who made the switch</h2>
            <p className="text-xl text-gray-400">Real trainers. Real results.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                quote: "Honestly I was sceptical. I'd tried Trainerize and a couple of others and they all felt like they were built for gyms, not solo PTs. Coach OS is the first one where I feel like someone actually thought about how I run my day. The booking portal alone saved me probably 3 hours a week of back-and-forth messages.",
                name: "Ash R.",
                role: "Personal Trainer, Sydney",
                stat: "~3hrs/week saved on scheduling"
              },
              {
                quote: "I had a client who dropped from 3 sessions a week to 1 and I didn't really clock it. Coach OS flagged him as at risk and I reached out. Turns out he'd had a rough month financially — we sorted out a reduced pack and he's still with me 8 months later. Without that alert I probably would've lost him.",
                name: "Matt K.",
                role: "Strength Coach, Melbourne",
                stat: "Saved a client he would have lost"
              },
              {
                quote: "BAS time used to stress me out every quarter. I'd spend a whole weekend going through bank statements trying to figure out what was coaching income vs personal stuff. Now it's all just... there. Categorised. My accountant actually commented on how clean my books were.",
                name: "Jess W.",
                role: "Online PT & Nutrition Coach, Brisbane",
                stat: "First clean BAS in 3 years"
              },
            ].map((t, i) => (
              <div key={i} className="p-8 rounded-2xl bg-white/5 border border-white/10 flex flex-col">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <svg key={j} className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-gray-300 leading-relaxed mb-6 flex-1">&ldquo;{t.quote}&rdquo;</p>
                <div className="border-t border-white/10 pt-4">
                  <p className="font-semibold text-white">{t.name}</p>
                  <p className="text-sm text-gray-500">{t.role}</p>
                  <p className="text-sm text-brand-400 mt-1">{t.stat}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 bg-gradient-to-b from-gray-950 to-black">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-brand-400 uppercase tracking-widest mb-4">Pricing</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Flat rate. No per-client tax.</h2>
            <p className="text-xl text-gray-400">Grow your client base — your subscription never changes.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter */}
            <div className="rounded-2xl bg-white/5 border border-white/10 p-8 flex flex-col">
              <div className="mb-6">
                <p className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-2">Starter</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-5xl font-bold">$49</span>
                  <span className="text-gray-400 mb-2">/mo</span>
                </div>
                <p className="text-sm text-gray-500">Everything to get started</p>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  "Unlimited clients",
                  "Client portal (magic link)",
                  "Self-booking & scheduling",
                  "Stripe payments",
                  "Session packs & subscriptions",
                  "Waivers & onboarding",
                  "CRM / lead pipeline",
                  "SMS & email",
                  "Coach SMS on cancellation",
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="block text-center px-6 py-3 rounded-full border border-white/20 text-white font-medium hover:bg-white/5 transition-colors">
                Start Free Trial
              </Link>
            </div>

            {/* Pro */}
            <div className="relative rounded-2xl bg-gradient-to-b from-brand-600/20 to-brand-900/20 border border-brand-500/50 p-8 flex flex-col">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="px-4 py-1.5 bg-brand-500 text-white text-xs font-bold uppercase tracking-widest rounded-full">
                  Most Popular
                </span>
              </div>
              <div className="mb-6">
                <p className="text-sm font-medium text-brand-400 uppercase tracking-widest mb-2">Pro</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-5xl font-bold">$99</span>
                  <span className="text-gray-400 mb-2">/mo</span>
                </div>
                <p className="text-sm text-gray-500">For PTs running a real business</p>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  "Everything in Starter",
                  "Built-in accounting (replaces Xero)",
                  "Bank feed sync & GST tracking",
                  "P&L reports & audit trail",
                  "Nutrition coaching",
                  "Automation engine",
                  "AI SMS templates",
                  "Risk scoring & churn alerts",
                  "Referral program",
                  "Newsletter generation",
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                    <svg className="w-4 h-4 text-brand-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="block text-center px-6 py-3 rounded-full bg-brand-500 hover:bg-brand-400 text-white font-medium transition-colors">
                Start Free Trial
              </Link>
            </div>

            {/* Business */}
            <div className="rounded-2xl bg-white/5 border border-white/10 p-8 flex flex-col">
              <div className="mb-6">
                <p className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-2">Business</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-5xl font-bold">$149</span>
                  <span className="text-gray-400 mb-2">/mo</span>
                </div>
                <p className="text-sm text-gray-500">Your full business OS</p>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  "Everything in Pro",
                  "AI market intelligence feed",
                  "Revenue segmentation & KPI dashboard",
                  "My EA — AI executive assistant",
                  "My MBA — business education",
                  "Priority support",
                  "Early access to new features",
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="block text-center px-6 py-3 rounded-full border border-white/20 text-white font-medium hover:bg-white/5 transition-colors">
                Start Free Trial
              </Link>
            </div>
          </div>

          <p className="text-center text-sm text-gray-500 mt-10">
            All plans include a 14-day free trial. No credit card required. Cancel anytime.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-32 bg-black">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-brand-400 uppercase tracking-widest mb-4">FAQ</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Common questions</h2>
          </div>

          <div className="space-y-6">
            {[
              {
                q: "Do I need to download an app?",
                a: "No. Coach OS is entirely web-based. Your clients access their portal via a magic link — no app download, no account creation. You manage everything from your browser."
              },
              {
                q: "Does it really replace Xero?",
                a: "For most sole-trader PTs, yes. Coach OS connects to your bank via Basiq, categorises transactions with AI, tracks GST, and produces P&L reports. If you have a complex business structure or large team, you may still need an accountant — but you won't need Xero."
              },
              {
                q: "What happens if I grow past 30 clients?",
                a: "Nothing. Your price stays the same. We never charge per client — that's the whole point of flat pricing. Grow as much as you want."
              },
              {
                q: "Can I migrate from another platform?",
                a: "Yes. We can help you import your client list and set up your offering. Most coaches are fully transitioned within a day."
              },
              {
                q: "Is my clients' data secure?",
                a: "Yes. All data is stored in Australia on Supabase (Postgres), encrypted at rest and in transit. We never sell or share client data."
              },
              {
                q: "What if I want to cancel?",
                a: "Cancel anytime — no contracts, no cancellation fees. Your data is exportable at any time."
              },
            ].map((item, i) => (
              <div key={i} className="p-6 rounded-xl bg-white/5 border border-white/10">
                <h3 className="font-semibold text-white mb-3">{item.q}</h3>
                <p className="text-gray-400 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-brand-600 to-cyan-600 opacity-10" />
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Stop juggling tools.<br />Start running a business.
          </h2>
          <p className="text-xl text-gray-400 mb-10">
            Join Australian personal trainers who&apos;ve replaced Xero, their booking tool, and their CRM with one flat-rate subscription.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup" className="inline-flex px-8 py-4 text-lg font-medium bg-white text-black rounded-full hover:bg-gray-200 transition-all hover:scale-105">
              Start Your Free Trial
            </Link>
            <a href="#pricing" className="inline-flex px-8 py-4 text-lg font-medium text-white border border-white/20 rounded-full hover:bg-white/5 transition-all">
              View Pricing
            </a>
          </div>
          <p className="text-sm text-gray-500 mt-6">14-day free trial · No credit card required · Cancel anytime</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-500">
            © 2026 Coach OS. All rights reserved.
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-white transition-colors">Terms</Link>
            <Link href="#" className="hover:text-white transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
