# Requirements: Coach OS

**Defined:** 2026-02-25
**Core Value:** A coach can run their entire client-facing business from one place — bookings, payments, communications, and client management.

## v1.0 Requirements — Stabilisation

### DATA — Session counter integrity

- [ ] **DATA-01**: Session deductions always reflect accurate counts — no over- or under-counting from concurrent writes
- [ ] **DATA-02**: Bookings completed without the calendar open (via cron) correctly deduct from the package session count
- [ ] **DATA-03**: The existing atomic `use_session()` DB function is used for all session deductions

### SMS — Notification correctness

- [ ] **SMS-01**: Booking confirmation SMS uses the org's configured timezone, not the trainer's browser timezone
- [ ] **SMS-02**: Session reminder and follow-up SMS formats times in the org's configured timezone consistently
- [ ] **SMS-03**: Quiet hours enforcement suppresses messages based on org local time, not UTC
- [ ] **SMS-04**: Quiet hours logic correctly handles non-wraparound time ranges (e.g. 9 AM–9 PM)
- [ ] **SMS-05**: Client "Y" reply confirmation works reliably — one active handler with correct booking query

### CRON — Background job correctness

- [ ] **CRON-01**: Scheduled automations fire only when their configured schedule is due, not on every cron run
- [ ] **CRON-02**: A failed automation action is recorded as failed, not as a successful run

### STRIPE — Financial data integrity

- [ ] **STRIPE-01**: Duplicate Stripe webhook deliveries do not create duplicate entries in money_events

### UI — Client detail and calendar reliability

- [ ] **UI-01**: Client detail page handles database load failures gracefully — partial-load states are visible, not silently empty
- [ ] **UI-02**: Calendar booking confirmation poll queries the correct date range for the active view mode (day/month/week)

### INFRA — Production hygiene

- [ ] **INFRA-01**: PII (user IDs, session data) is not written to production logs on every request
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
| DATA-01 | — | Pending |
| DATA-02 | — | Pending |
| DATA-03 | — | Pending |
| SMS-01 | — | Pending |
| SMS-02 | — | Pending |
| SMS-03 | — | Pending |
| SMS-04 | — | Pending |
| SMS-05 | — | Pending |
| CRON-01 | — | Pending |
| CRON-02 | — | Pending |
| STRIPE-01 | — | Pending |
| UI-01 | — | Pending |
| UI-02 | — | Pending |
| INFRA-01 | — | Pending |
| INFRA-02 | — | Pending |

**Coverage:**
- v1.0 requirements: 15 total
- Mapped to phases: 0 (roadmap not yet created)
- Unmapped: 15 ⚠️

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-25 — initial definition, v1.0 Stabilisation*
