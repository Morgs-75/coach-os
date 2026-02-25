# Requirements: Coach OS

**Defined:** 2026-02-25
**Core Value:** A coach can run their entire client-facing business from one place — bookings, payments, communications, and client management.

## v1.0 Requirements — Stabilisation

### DATA — Session counter integrity

- [x] **DATA-01**: Session deductions always reflect accurate counts — no over- or under-counting from concurrent writes
- [x] **DATA-02**: Bookings completed without the calendar open (via cron) correctly deduct from the package session count
- [x] **DATA-03**: The existing atomic `use_session()` DB function is used for all session deductions

### SMS — Notification correctness

- [x] **SMS-01**: Booking confirmation SMS uses the org's configured timezone, not the trainer's browser timezone
- [x] **SMS-02**: Session reminder and follow-up SMS formats times in the org's configured timezone consistently
- [x] **SMS-03**: Quiet hours enforcement suppresses messages based on org local time, not UTC
- [x] **SMS-04**: Quiet hours logic correctly handles non-wraparound time ranges (e.g. 9 AM–9 PM)
- [x] **SMS-05**: Client "Y" reply confirmation works reliably — one active handler with correct booking query

### CRON — Background job correctness

- [x] **CRON-01**: Scheduled automations fire only when their configured schedule is due, not on every cron run
- [x] **CRON-02**: A failed automation action is recorded as failed, not as a successful run

### STRIPE — Financial data integrity

- [x] **STRIPE-01**: Duplicate Stripe webhook deliveries do not create duplicate entries in money_events

### UI — Client detail and calendar reliability

- [x] **UI-01**: Client detail page handles database load failures gracefully — partial-load states are visible, not silently empty
- [x] **UI-02**: Calendar booking confirmation poll queries the correct date range for the active view mode (day/month/week)

### INFRA — Production hygiene

- [x] **INFRA-01**: PII (user IDs, session data) is not written to production logs on every request
- [ ] **INFRA-02**: Org timezone is sourced from a single consistent location — not two divergent tables that can desync

## Future Requirements

(None identified — stabilisation milestone only)

## Out of Scope

| Feature | Reason |
|---------|--------|
| New features of any kind | Stabilisation milestone — adding scope introduces new instability |
| Architectural redesigns | Fix in place; restructuring increases risk during stabilisation |
| Performance optimisations | Not a stability issue unless causing crashes or data corruption |
| UI redesigns or restyling | Fix broken behaviour only — do not restyle |
| `clients/[id]/page.tsx` full refactor | The god component is a long-term risk but breaking it up is out of scope here |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1 | Complete |
| DATA-02 | Phase 1 | Complete |
| DATA-03 | Phase 1 | Complete |
| SMS-01 | Phase 2 | Complete |
| SMS-02 | Phase 2 | Complete |
| SMS-03 | Phase 2 | Complete |
| SMS-04 | Phase 2 | Complete |
| SMS-05 | Phase 2 | Complete |
| CRON-01 | Phase 3 | Complete |
| CRON-02 | Phase 3 | Complete |
| STRIPE-01 | Phase 3 | Complete |
| UI-01 | Phase 4 | Complete |
| UI-02 | Phase 4 | Complete |
| INFRA-01 | Phase 5 | Complete |
| INFRA-02 | Phase 5 | Pending |

**Coverage:**
- v1.0 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-25 — DATA-01, DATA-02, DATA-03 completed (Phase 1 done)*
