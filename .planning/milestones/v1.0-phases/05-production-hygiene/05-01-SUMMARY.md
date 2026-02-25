---
phase: 05-production-hygiene
plan: 01
subsystem: auth
tags: [nextjs, middleware, logging, pii, supabase]

# Dependency graph
requires: []
provides:
  - "Auth middleware with no PII in logs — user.id never written to Netlify function logs"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["No PII in server logs — strip user identifiers from console.log before merge"]

key-files:
  created: []
  modified:
    - apps/trainer-web/src/lib/supabase/middleware.ts

key-decisions:
  - "Remove both console.log calls entirely — neither provides debugging value that outweighs the PII risk"
  - "No replacement structured logging added — auth state is implicit in redirect/header behaviour"

patterns-established:
  - "Middleware pattern: auth check result inferred from redirect or x-user-id header presence, not logged"

requirements-completed: [INFRA-01]

# Metrics
duration: 2min
completed: 2026-02-25
---

# Phase 5 Plan 01: Remove PII-leaking console.log from Auth Middleware Summary

**Removed two console.log calls from Next.js auth middleware that leaked user UUIDs and session error state to Netlify function logs on every authenticated page request**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-25T13:52:49Z
- **Completed:** 2026-02-25T13:54:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Removed `console.log("Middleware auth check:", { user: user?.id, error: error?.message, path: ... })` — eliminated UUID logging on every authenticated request
- Removed `console.log("Redirecting to login - no user found")` — eliminated noise log with no debug value
- Auth behaviour confirmed intact: `getUser()`, unauthenticated redirect, `x-user-id` header forwarding all unchanged
- TypeScript passes cleanly with no errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove PII console.log from auth middleware** - `9ac9e76` (fix)

## Files Created/Modified
- `apps/trainer-web/src/lib/supabase/middleware.ts` - Removed two console.log calls; all auth logic unchanged

## Decisions Made
- Removed both console.log calls entirely with no replacement logging — auth state is already implicit in the redirect behaviour and x-user-id header, so structured logging adds no value here

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Netlify function logs no longer contain user UUIDs on authenticated requests
- Ready to continue with remaining 05-production-hygiene plans

---
*Phase: 05-production-hygiene*
*Completed: 2026-02-25*
