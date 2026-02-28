---
phase: 10-async-ai-generation
plan: 03
subsystem: ui
tags: [react, nextjs, polling, async, nutrition, generation]

# Dependency graph
requires:
  - phase: 10-async-ai-generation/10-02
    provides: "/generate/start, /generate/run, /generate/status API endpoints"
provides:
  - "IntakeWizard async generation flow: start+run+poll pattern"
  - "genPhase state machine (idle/starting/polling/complete/error)"
  - "Spinner + status messages during polling"
  - "Error display with Retry button"
  - "Auto-reload plan on completion via onGenerated callback"
affects: [nutrition, plan-builder]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget /run fetch with setInterval polling for long-running AI operations"
    - "genPhase state machine replacing boolean generating flag"
    - "pollIntervalRef cleanup on close/unmount prevents stale intervals"

key-files:
  created: []
  modified:
    - "apps/trainer-web/src/app/(app)/nutrition/[planId]/IntakeWizard.tsx"
    - "apps/trainer-web/src/app/(app)/nutrition/[planId]/PlanBuilderClient.tsx"

key-decisions:
  - "[10-03] IntakeWizard is the actual generation entrypoint — not GenerateModal (which was dead code); changes applied to IntakeWizard.tsx"
  - "[10-03] Dead GenerateModal function removed from PlanBuilderClient.tsx — it still called old /generate 410 stub"
  - "[10-03] runBody built from buildFinalData() inside startGeneration() — same intake_data shape forwarded to /run"
  - "[10-03] onGenerated callback in PlanBuilderClient already handles plan reload — no additional reload logic needed in IntakeWizard"

requirements-completed: [ASYNC-03]

# Metrics
duration: partial (awaiting human-verify checkpoint)
completed: 2026-02-28
---

# Phase 10 Plan 03: Async AI Generation Frontend Summary

**IntakeWizard rewritten with async start+run+poll flow — Generate button fires fast, spinner polls every 3s, plan auto-reloads on completion, Retry button on error**

## Status: AWAITING HUMAN VERIFICATION

Plan paused at `checkpoint:human-verify` after completing Task 1.

## Performance

- **Duration:** ~15 min (Task 1 only)
- **Started:** 2026-02-28
- **Completed:** Partial — checkpoint reached
- **Tasks:** 1/2 (checkpoint is Task 2)
- **Files modified:** 2

## Accomplishments
- Replaced blocking single-fetch generation with three-step async pattern
- `genPhase` state machine drives all UI states (idle/starting/polling/complete/error)
- Fire-and-forget POST /run, polling GET /status every 3s
- Spinner with descriptive message during polling phase
- Error display + Retry button on failure
- clearInterval on cancel, completion, error, and component unmount
- Removed dead `GenerateModal` function from PlanBuilderClient.tsx (was calling the 410 stub)
- TypeScript compiles cleanly (no errors)
- Changes pushed to GitHub (commit 17b6064) — ready for Netlify deploy

## Task Commits

1. **Task 1: Rewrite GenerateModal/IntakeWizard with async start+run+poll pattern** - `17b6064` (feat)

## Files Created/Modified
- `apps/trainer-web/src/app/(app)/nutrition/[planId]/IntakeWizard.tsx` - Added useRef import, replaced generating/error state with genPhase/genError/pollIntervalRef, replaced handleGenerate with startGeneration+handleGenerate, added unmount cleanup useEffect, updated JSX error display and button with polling-aware UI, updated Cancel button to clearInterval on close
- `apps/trainer-web/src/app/(app)/nutrition/[planId]/PlanBuilderClient.tsx` - Removed dead GenerateModal function (~200 lines) that was calling the old /generate 410 stub

## Decisions Made
- Applied changes to `IntakeWizard.tsx` (not `GenerateModal` in PlanBuilderClient.tsx as the plan stated) — IntakeWizard IS the generate entrypoint, GenerateModal was dead code since a prior phase replaced it with IntakeWizard. This is the correct implementation.
- `runBody` is built from `buildFinalData()` inside `startGeneration()` — the intake_data shape is computed fresh on each generation attempt, including on Retry.
- The `onGenerated` callback already reloads the plan in the parent — no extra reload logic needed in IntakeWizard.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Applied changes to IntakeWizard.tsx instead of GenerateModal**
- **Found during:** Task 1 (code inspection before implementation)
- **Issue:** Plan said to update `GenerateModal` in `PlanBuilderClient.tsx`, but `showGenerateModal` state controls `<IntakeWizard>` (not `<GenerateModal>`). `GenerateModal` was dead code — never rendered. The actual blocking /generate call was in `IntakeWizard.tsx handleGenerate()`.
- **Fix:** Applied async pattern to `IntakeWizard.tsx`. Also removed the dead `GenerateModal` function from `PlanBuilderClient.tsx` to eliminate the stale /generate call.
- **Files modified:** IntakeWizard.tsx, PlanBuilderClient.tsx
- **Verification:** TypeScript compiles cleanly; grep confirms genPhase/startGeneration/setInterval/clearInterval all present in IntakeWizard.tsx
- **Committed in:** 17b6064

---

**Total deviations:** 1 auto-fixed (Rule 1 - applied to correct file)
**Impact on plan:** Essential correction — without this fix, the async pattern would never have been exercised. The plan's stated target file was incorrect due to an intermediate refactor in a prior session.

## Issues Encountered
None beyond the file target deviation documented above.

## User Setup Required
None — no new environment variables or external services required.

## Checkpoint: Human Verify Required

**Deploy command (already pushed to GitHub):**
```
cd apps/trainer-web && netlify deploy --prod --trigger
```

**Verification steps:**
1. Open a meal plan in the coach UI at /nutrition/[planId]
2. Click "Generate with AI" — fill in any goal + calorie target
3. Click "Generate plan": confirm the modal shows spinner immediately (no 26s hang)
4. Wait 30-60s: plan should reload with generated days
5. Check Netlify function logs — /start and /run should appear as separate invocations

**Resume signal:** Type "approved" if generation works end-to-end, or describe any issues.

## Next Phase Readiness
- Once checkpoint approved, Phase 10 complete
- Async generation pattern established — portable to Railway (just remove the 60s limit on /run)

---
*Phase: 10-async-ai-generation*
*Completed: 2026-02-28 (partial — checkpoint pending)*

## Self-Check: PASSED
- IntakeWizard.tsx modified: confirmed (genPhase, startGeneration, setInterval, generate/start, generate/run, generate/status all present)
- PlanBuilderClient.tsx modified: confirmed (GenerateModal removed)
- Commit 17b6064 exists: confirmed (git log shows feat(10-03))
- TypeScript: no errors
