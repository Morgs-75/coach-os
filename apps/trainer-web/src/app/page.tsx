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
            <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 text-sm font-medium bg-white text-black rounded-full hover:bg-gray-200 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-500/20 via-transparent to-transparent" />

        {/* Grid Pattern */}
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
            <Link
              href="/signup"
              className="px-8 py-4 text-lg font-medium bg-white text-black rounded-full hover:bg-gray-200 transition-all hover:scale-105"
            >
              Start Free Trial
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 text-lg font-medium text-white border border-white/20 rounded-full hover:bg-white/5 transition-all"
            >
              Watch Demo
            </Link>
          </div>

          {/* Stats */}
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

        {/* Scroll Indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
          <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 bg-gradient-to-b from-black to-gray-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
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
                badge: "No competitor has this",
                description: "Bank sync, auto-categorisation, P&L reports, and GST tracking. Cancel your accounting software."
              },
              {
                icon: "🧠",
                title: "AI Business Insights",
                badge: "No competitor has this",
                description: "Market intelligence, churn prediction, and revenue analytics. Know your business before problems hit."
              },
              {
                icon: "⚡",
                title: "Automation Engine",
                badge: "No competitor has this",
                description: "Set-and-forget workflows for SMS, email, and push. Re-engage clients automatically while you sleep."
              },
              {
                icon: "👥",
                title: "Full Client OS",
                badge: "",
                description: "Bookings, client portal, CRM pipeline, waivers, referrals, and risk scoring — all in one place."
              },
              {
                icon: "🥗",
                title: "Nutrition + Training",
                badge: "",
                description: "Manage food, training, and finances in a single platform. The complete picture, not just workouts."
              },
              {
                icon: "📧",
                title: "Smart Comms",
                badge: "",
                description: "AI-generated SMS templates, broadcast campaigns, and newsletters. Built for PTs, not marketers."
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="group p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-brand-500/50 transition-all hover:-translate-y-1"
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                  {feature.badge && (
                    <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-brand-500/20 text-brand-400 rounded-full border border-brand-500/30">
                      Unique
                    </span>
                  )}
                </div>
                <p className="text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Replace Xero Section */}
      <section className="py-24 bg-gray-900">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-sm font-medium text-brand-400 uppercase tracking-widest mb-4">Only in Australia</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Cancel Xero. Cancel your booking tool.<br />One subscription does it all.</h2>
          <p className="text-lg text-gray-400 mb-10">
            Coach OS is the only PT platform built for Australian trainers — with GST tracking, AUD bank feeds,
            and BAS-ready reports built in. Stop paying for three tools when one does everything.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-400">
            {["✅ Bank feed sync", "✅ GST tracking", "✅ P&L reports", "✅ AI transaction coding", "✅ Audit trail"].map((item, i) => (
              <span key={i} className="px-4 py-2 rounded-full bg-white/5 border border-white/10">{item}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-32 bg-gradient-to-b from-gray-900 to-black">
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

            {/* Pro — Most Popular */}
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
          <Link
            href="/signup"
            className="inline-flex px-8 py-4 text-lg font-medium bg-white text-black rounded-full hover:bg-gray-200 transition-all hover:scale-105"
          >
            Get Started Free
          </Link>
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
