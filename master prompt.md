You are a senior full-stack engineer. Build an MVP SaaS called “Coach OS” for online fitness coaches (trainers). The trainer pays. Their clients use a branded mobile app.

Primary outcome: reduce churn + protect revenue + show cash clarity. Avoid feature bloat. Do NOT build a full accounting system or full CRM. Build only the scoped modules below.

STACK:
- Trainer web: Next.js (App Router), TypeScript, Tailwind
- Client app: Expo React Native, TypeScript
- Backend: Supabase (Postgres, Auth, Storage, Realtime, Edge Functions, Cron)
- Payments: Stripe + Stripe Connect
- Push: Expo push notifications initially
- Hosting: Vercel (web), EAS (mobile)

MULTI-TENANCY:
- Every row must include org_id. Clients belong to one org in MVP.

MODULES (MVP):
A) Auth + Org/Branding
- Trainer sign up creates org.
- Roles: owner, staff, accountant_readonly.
- Client login is invite-based to join org.
- Branding: logo, primary_color, display_name.

B) Client App (simple)
- Today: habits checklist, workout completion checkbox, weight entry, quick check-in.
- Progress: weight chart, streaks, adherence %
- Messages: chat trainer <-> client
- Notifications: push + in-app feed
- Account: subscription status (view) + manage billing via web link

C) Trainer Web (core)
- Dashboard: MRR, churn, revenue at risk, top risk clients, failed payments.
- Clients: list with risk tier; profile with logs, subscription status, messaging.
- Programs: lightweight (habits + simple workout checklist + weekly check-in template).
- Automations: rule builder (trigger/schedule + conditions + actions), templates, run audit.
- Offers: create offer linked to Stripe product/price; send via automation.
- Leads (micro-CRM): inquiry capture link + pipeline NEW/CONTACTED/BOOKED/WON/LOST + convert to client.
- Finance (cash micro-ledger): Stripe-driven MoneyEvents, cash in/out, fees/platform fees/refunds, quarterly GST summary, CSV export.

D) Differentiators
- Risk scoring job (daily) + reason codes.
- Automation ladders with guardrails (rate limits, dedupe, quiet hours).
- Revenue at risk and churn flags surfaced first-class.

PAYMENTS:
- Stripe Connect onboarding for trainer.
- Platform takes 5% application fee.
- Use web checkout links (do not do native IAP in MVP).

DATA:
- Implement schema in Supabase with RLS. Provide SQL migrations.
- Provide Edge Functions for Stripe webhooks, risk scoring cron, automation cron, and push notification dispatch.

DELIVERABLES:
1) Repo scaffold with /apps/trainer-web, /apps/client-mobile, /supabase (migrations/functions).
2) SQL schema + RLS policies.
3) Implement key screens and flows for web and mobile.
4) Implement Stripe Connect + webhooks -> MoneyEvents ledger.
5) Implement inquiries pipeline + convert to client.
6) Implement automations engine with AutomationRun audit trail.
7) Implement risk scoring.
8) Provide README with local dev instructions and environment variables.

CONSTRAINTS:
- Ship-focused. Avoid “nice to haves” (meal plan builder, deep exercise library, complex booking, general ledger, marketing email).
- Keep UI clean and numeric. Numbers over charts.
- Everything must have acceptance criteria and minimal tests.

Now:
Step 1: propose a detailed file/folder structure and database schema.
Step 2: generate the SQL migrations and RLS.
Step 3: implement backend functions (webhooks, cron jobs).
Step 4: implement web UI pages and mobile screens.
Step 5: provide a README and runbook.
Proceed in that order. Make safe assumptions. If uncertain, pick the simplest option that satisfies the product.
