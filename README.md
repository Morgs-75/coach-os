# Coach OS

A SaaS platform for online fitness coaches. Trainers pay, clients use a branded mobile app.

**Primary outcomes:** Reduce churn, protect revenue, show cash clarity.

## Stack

| Component | Technology |
|-----------|------------|
| Trainer Web | Next.js 14 (App Router), TypeScript, Tailwind |
| Client Mobile | Expo React Native, TypeScript |
| Backend | Supabase (Postgres, Auth, RLS, Edge Functions, Cron) |
| Payments | Stripe + Stripe Connect (5% platform fee) |
| Push | Expo Push Notifications |
| Hosting | Vercel (web), EAS (mobile) |

## Project Structure

```
coach-os/
├── apps/
│   ├── trainer-web/       # Next.js trainer dashboard
│   └── client-mobile/     # Expo client app
├── packages/
│   └── shared/            # Shared types and constants
├── supabase/
│   ├── migrations/        # SQL schema and RLS
│   └── functions/         # Edge functions
└── package.json           # Monorepo root
```

## Prerequisites

- Node.js 18+
- npm 9+
- Supabase CLI (`npm install -g supabase`)
- Expo CLI (`npm install -g expo-cli`)
- Stripe account with Connect enabled

## Local Development Setup

### 1. Clone and Install

```bash
git clone <repo-url>
cd coach-os
npm install
```

### 2. Supabase Setup

```bash
# Start local Supabase
supabase start

# Run migrations
supabase db reset

# Get local credentials
supabase status
```

### 3. Environment Variables

**apps/trainer-web/.env.local:**
```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-from-supabase-status>
```

**apps/client-mobile/.env:**
```
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key-from-supabase-status>
```

**supabase/.env (for Edge Functions):**
```
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
CRON_SECRET=your-cron-secret
```

### 4. Stripe Setup

1. Create a Stripe account at stripe.com
2. Enable Connect in Stripe Dashboard
3. Get API keys from Developers > API Keys
4. Set up webhook endpoint pointing to `/functions/v1/stripe-webhook`
5. Subscribe to events:
   - `account.updated`
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `charge.refunded`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `payout.paid`

### 5. Run Development Servers

```bash
# Terminal 1: Trainer web
npm run dev:web

# Terminal 2: Client mobile
npm run dev:mobile

# Terminal 3: Supabase functions
supabase functions serve
```

**Access:**
- Trainer Web: http://localhost:3000
- Supabase Studio: http://localhost:54323
- Client Mobile: Expo Go app on your device

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `orgs` | Organizations (multi-tenancy root) |
| `org_members` | Team membership with roles |
| `branding` | Org customization (logo, colors) |
| `clients` | End users/customers |
| `client_invites` | Invite-based client signup |

### Activity & Engagement

| Table | Purpose |
|-------|---------|
| `habits` | Reusable habit templates |
| `client_habits` | Habits assigned to clients |
| `activity_events` | Append-only activity log (weight, habits, workouts, check-ins) |
| `message_threads` | Chat conversations |
| `messages` | Individual messages |

### Payments & Finance

| Table | Purpose |
|-------|---------|
| `stripe_accounts` | Stripe Connect accounts per org |
| `subscriptions` | Client subscription tracking |
| `money_events` | Append-only cash ledger |

### Risk & Automation

| Table | Purpose |
|-------|---------|
| `client_risk` | Daily risk scores per client |
| `automations` | Automation rules (trigger, conditions, actions) |
| `automation_runs` | Audit trail of automation executions |

### CRM

| Table | Purpose |
|-------|---------|
| `inquiries` | Lead pipeline (NEW → CONTACTED → BOOKED → WON/LOST) |

## Edge Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `stripe-webhook` | Stripe events | Process payments, update subscriptions, create MoneyEvents |
| `cron-risk-score` | Daily cron | Calculate client risk scores |
| `cron-automations` | Scheduled | Execute automation rules |
| `push-dispatch` | Internal call | Send Expo push notifications |
| `inquiry-capture` | Public POST | Accept lead form submissions |

## Key Features

### Trainer Dashboard
- **Dashboard:** MRR, churn, revenue at risk, at-risk clients, failed payments
- **Clients:** List with risk tier, profile with logs and messaging
- **Leads:** Kanban pipeline (NEW → CONTACTED → BOOKED → WON/LOST)
- **Automations:** Rule builder with guardrails (rate limits, quiet hours)
- **Finance:** MoneyEvents ledger, monthly summary, GST calculation

### Client App
- **Today:** Habits checklist, workout completion, weight entry, check-in
- **Progress:** Streaks, adherence %, weight chart
- **Messages:** Real-time chat with trainer
- **Account:** Subscription status, billing management

### Differentiators
- Daily risk scoring with reason codes
- Automation guardrails (rate limits, dedupe, quiet hours)
- Revenue at risk surfaced first-class
- Cash clarity with GST breakdown

## Deployment

### Trainer Web (Vercel)

```bash
cd apps/trainer-web
vercel
```

Set environment variables in Vercel dashboard.

### Client Mobile (EAS)

```bash
cd apps/client-mobile
eas build --platform all
eas submit
```

### Supabase

```bash
# Link to production project
supabase link --project-ref <project-id>

# Push migrations
supabase db push

# Deploy functions
supabase functions deploy
```

### Cron Jobs

Set up pg_cron or external scheduler to call:
- `cron-risk-score`: Daily at 2am
- `cron-automations`: Every 15 minutes

## Multi-Tenancy

Every table includes `org_id`. RLS policies enforce:
- Users can only see data for orgs they're members of
- Write access based on role (owner, staff, accountant_readonly)
- Service role bypasses RLS for backend operations

## Security Notes

- All tables have RLS enabled
- Client invites are code-based with expiration
- Stripe webhooks verified with signature
- Edge functions use service role for admin operations
- Push tokens stored securely

## License

Proprietary - All rights reserved
