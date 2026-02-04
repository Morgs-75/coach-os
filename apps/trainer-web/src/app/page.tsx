import Link from "next/link";

// Force static generation at edge for fastest possible response
export const dynamic = "force-static";
export const revalidate = false;
export const runtime = "edge";

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

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
            Your PT Business
          </h1>
          <p className="text-lg md:text-xl text-gray-400 mb-4">
            Have your PT or online coaching business set up in 15 mins
          </p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
            <span className="bg-gradient-to-r from-brand-400 to-cyan-400 bg-clip-text text-transparent">
              Supercharged
            </span>
          </h2>

          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            The all-in-one platform for personal trainers. Manage clients, track finances,
            automate bookings, and grow your business with AI.
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
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Everything You Need</h2>
            <p className="text-xl text-gray-400">One platform to run your entire PT business</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: "👥",
                title: "Client Management",
                description: "Track progress, manage programs, and keep all client data in one place."
              },
              {
                icon: "💰",
                title: "myAccounts",
                description: "Bank feeds, auto-categorization, P&L reports. Finance done for you."
              },
              {
                icon: "🧠",
                title: "AI Coach",
                description: "Get insights, generate content, and make smarter business decisions."
              },
              {
                icon: "📅",
                title: "Smart Scheduling",
                description: "Automated bookings, reminders, and calendar sync across all devices."
              },
              {
                icon: "📧",
                title: "Email & SMS",
                description: "Automated campaigns, follow-ups, and client communication."
              },
              {
                icon: "📊",
                title: "Analytics",
                description: "Real-time insights into revenue, retention, and business health."
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="group p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-brand-500/50 transition-all hover:-translate-y-1"
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
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
            Ready to Transform Your Business?
          </h2>
          <p className="text-xl text-gray-400 mb-10">
            Join hundreds of trainers who&apos;ve streamlined their operations with Coach OS.
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
            © 2024 Coach OS. All rights reserved.
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
