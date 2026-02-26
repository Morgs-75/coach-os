# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-26)

**Core value:** A coach can run their entire client-facing business from one place.
**Current focus:** v1.2 — Nutrition Engine

## Current Position

Phase: Phase 6 — Nutrition Foundation (not started)
Plan: 4 phases scoped (6–9), roadmap updated 2026-02-26
Status: Ready to plan. v1.1 complete and deployed.
Last activity: 2026-02-26 — v1.2 Nutrition Engine scoped, phases 6-9 added to roadmap

Progress: [██████████] 100%

## Phase Summary

| Phase | Description | Status | Commit |
|-------|-------------|--------|--------|
| 1 | Portal token + page shell (magic link) | ✅ Done | Phase 1 |
| 2 | Client dashboard + cancellation | ✅ Done | Phase 2 |
| 3 | Self-booking flow | ✅ Done | dee44c2 |
| 4 | Stripe checkout for session packs | ✅ Done | 4bd7667 |

## Accumulated Context

### Decisions

- Magic-link portal: `portal_token` UUID on `clients`, no auth required
- Stripe Connect: each org's `stripe_accounts.stripe_account_id` used for checkout
- Webhook discriminant: `session.metadata.offer_id` present → portal purchase, else subscription
- No DB migration needed for Phase 4 (client_purchases schema was already complete in 0010)

### Pending Todos

- Add `STRIPE_SECRET_KEY` to Netlify env vars (for POST /api/portal/checkout)
- Add `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` to Supabase Edge Function secrets (for stripe-webhook)
- Register Stripe webhook endpoint in Stripe dashboard pointing to Supabase Edge Function URL
- Test end-to-end: buy a package → check client_purchases + money_events created

### Blockers/Concerns

None — code is complete, Stripe key setup is operator config.

## Session Continuity

Last session: 2026-02-26
Stopped at: v1.1 live on Netlify. Portal link visible in Profile tab. WebSocket %0A bug outstanding (Netlify build cache not rebuilding Supabase client bundle).
Resume file: None
