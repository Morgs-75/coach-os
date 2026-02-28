---
phase: 10-async-ai-generation
plan: "02"
subsystem: nutrition-api
tags: [api, async, generation, ai, nutrition]
dependency_graph:
  requires: [10-01]
  provides: [generate-start-endpoint, generate-run-endpoint, generate-status-endpoint]
  affects: [nutrition-plan-builder-ui, generate-route]
tech_stack:
  added: []
  patterns: [fire-and-forget, idempotency-guard, polling]
key_files:
  created:
    - apps/trainer-web/src/app/api/nutrition/plans/[planId]/generate/start/route.ts
    - apps/trainer-web/src/app/api/nutrition/plans/[planId]/generate/run/route.ts
    - apps/trainer-web/src/app/api/nutrition/plans/[planId]/generate/status/route.ts
  modified:
    - apps/trainer-web/src/app/api/nutrition/plans/[planId]/generate/route.ts
key_decisions:
  - "planId resolved before try block in /run — accessible in outer catch without re-awaiting params"
  - "generation_status='complete' merged into final updatePayload — single DB round trip for completion + intake_data update"
  - "Old route.ts kept as 410 stub — avoids 404 on stale client calls, documents the migration"
  - "Three error update sites in /run: ANTHROPIC_API_KEY missing, first-pass callClaude catch, outer catch"
metrics:
  duration_minutes: 6
  completed_date: "2026-02-28"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 1
---

# Phase 10 Plan 02: Split Generate API into start/run/status Sub-Routes Summary

**One-liner:** Monolithic /generate route split into fire-and-forget /start + /run (AI work, idempotent) + /status (polling) to work within Netlify's 26s function timeout.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create /generate/start — fast status setter | 7040d99 | generate/start/route.ts |
| 2 | Create /generate/status — polling endpoint | 153b31e | generate/status/route.ts |
| 3 | Create /generate/run + stub old route | c36d858 | generate/run/route.ts, generate/route.ts |

## What Was Built

### /generate/start (POST)
- Sets `generation_status='generating'` and clears `generation_error` in `meal_plans`
- Verifies plan ownership (org_id check) before updating
- Returns `{ status: 'generating' }` in ~100ms — no AI work, well within default timeout

### /generate/status (GET)
- Returns `{ generation_status, generation_error }` for the specified planId
- Verifies plan ownership before SELECT
- Designed for polling every 3s from the frontend

### /generate/run (POST)
- Preserved verbatim: `buildRichPrompt`, `buildSimplePrompt`, `extractRootJson`, `callClaude`, two-pass logic, calorie scaler, food dedup, group-based food queries
- `export const maxDuration = 60` kept for Netlify long-running function support
- Idempotency guard at top: returns immediately if `generation_status !== 'generating'` — prevents double-generation from concurrent calls
- Error handling at three sites: missing ANTHROPIC_API_KEY, first-pass Claude failure, outer catch
- On success: `generation_status='complete'` merged into the final `updatePayload` (single DB round trip)
- On any error: sets `generation_status='error'` and `generation_error` to the error string

### Old /generate/route.ts
- Replaced with 410 stub — returns HTTP 410 Gone with a message pointing to the sub-routes
- Prevents 404 on stale client calls while the frontend is updated in Plan 03

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] planId scoping in outer catch block**
- **Found during:** Task 3 — writing /run route
- **Issue:** The plan specified `const { planId } = await params` inside the try block, but the outer catch block also needs planId to update generation_status on unhandled errors. Accessing `params` again in catch after the try block already resolved it would cause a TypeScript error.
- **Fix:** Moved `const { planId } = await params` to before the try block, making it accessible in both try and catch scopes.
- **Files modified:** generate/run/route.ts
- **Commit:** c36d858

## Verification

- `npx tsc --noEmit` exits 0 — no TypeScript errors
- All 4 route files exist at correct paths
- `extractRootJson` present in run/route.ts (2 occurrences: function definition + call)
- `FIRST_PASS_MAX` present in run/route.ts
- Idempotency guard: `planRow.generation_status !== "generating"` confirmed
- Three `generation_status="error"` update sites confirmed
- `generation_status="complete"` in updatePayload confirmed
- status route returns both `generation_status` and `generation_error`

## Self-Check: PASSED

All files exist and commits verified in git log.
