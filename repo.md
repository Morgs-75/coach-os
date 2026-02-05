coach-os/
  apps/
    trainer-web/                # Next.js
    client-mobile/              # Expo RN
  packages/
    shared/                     # types, zod schemas, utils
    ui/                         # shared UI primitives (optional)
  supabase/
    migrations/
      0001_init.sql
      0002_rls.sql
      0003_indexes.sql
    functions/
      stripe-webhook/
      cron-risk-score/
      cron-automations/
      push-dispatch/
  docs/
    product-one-pager.md
    api-contracts.md
    onboarding-flow.md
  README.md
  .env.example
