# Workshops Specialized Subsystems Audit — 2026-11-12

**API layer:** routes, serialization contracts and error mapping are audited in
[workshops-api-layer-audit-2026-11-12.md](workshops-api-layer-audit-2026-11-12.md).

**Security:** tenant isolation, RBAC and audit coverage are audited in
[workshops-security-audit-2026-11-12.md](workshops-security-audit-2026-11-12.md).

**Async pipelines:** queue workers, idempotency and DLQ coverage are audited in
[workshops-async-queues-audit-2026-11-12.md](workshops-async-queues-audit-2026-11-12.md).

**Printables/analytics:** templates, exports and reporting queries are audited in
[workshops-printables-analytics-audit-2026-11-12.md](workshops-printables-analytics-audit-2026-11-12.md).

**Shared contracts:** DTOs, enums and Zod/static alignment are audited in
[workshops-shared-contracts-audit-2026-11-12.md](workshops-shared-contracts-audit-2026-11-12.md).

**Frontend/state:** page hierarchy, query invalidation and form UX are audited in
[workshops-frontend-state-audit-2026-11-12.md](workshops-frontend-state-audit-2026-11-12.md).

**Tests/CI:** coverage, concurrency and ratchets are audited in
[workshops-test-audit-2026-11-12.md](workshops-test-audit-2026-11-12.md).

**Scope:** the three specialized subsystems named in the brief — completion engine / certificate
eligibility, capacity and waitlist, and facilitator/venue conflict detection — against the actual
code (`workshopsCompletionDb`, `workshopsDb`, the shared completion rule, the registration write
path and the academic timetable). Third in the series; companions:
[workshops-schema-persistence-audit-2026-11-12.md](workshops-schema-persistence-audit-2026-11-12.md)
and [workshops-domain-lifecycle-audit-2026-11-12.md](workshops-domain-lifecycle-audit-2026-11-12.md).

**Method:** read the completion rule and every caller, the registration/withdrawal/capacity write
paths, the academic timetable collision code, the lifecycle transition service, and the existing DB
suites; then verified each finding against PostgreSQL 16 with new suites (waitlist concurrency,
completion eligibility) and the existing ones. 54 workshop DB tests now run, plus the two
concurrency files repeated five times in CI.

## Premise corrections

| Brief assumption | Reality |
|---|---|
| Workshops transition to Completed through the completion engine | The `open → completed` lifecycle action only checks dates. Participant completion is a separate Evaluate action. Since this change set, completing a workshop also **finalizes** participant standings in the same transaction |
| Statuses are Completed / Incomplete / NoShow | Persisted values are `completed` / `attended` / `registered`. `attended` = present but short of a criterion (**incomplete**), `registered` = never present (**no-show**). This mapping is now explicit in the shared rule's docblock and the audit |
| A waitlist exists and cancellations promote waitlisted participants | There was **no waitlist** at all. Implemented in this change set behind `waitlist_enabled` (default off) |
| Batch registration exists | There was **no batch endpoint**. `POST /api/workshops/:id/participants/bulk` was added (API-only, atomic) |
| Facilitators/rooms are validated across workshop slots and academic sections | Workshops have no facilitator, room or time-of-day. Rooms exist only as free text on `session_class_sections`; academic faculty conflicts are checked only inside one session's submitted payload. **Design only** (D1/D2) — see §3 |

## 1. Completion engine (workshopsCompletionDb)

### Rule

`facts = { countableDays, presentDays, scoreTotal, scoreMax }`; `countableDays` is the inclusive
number of workshop days up to the workspace business day, `presentDays` the `present`/`late` marks
inside the current window, and the score percentage the summed score over the summed maximum.
Every configured minimum must hold, and at least one attended day is always required.

| Outcome | Persisted status | Meaning |
|---|---|---|
| Completed | `completed` | every criterion met; eligible for a certificate |
| Incomplete | `attended` | attended at least once, short of a criterion (`shortfalls` explains) |
| No-show | `registered` | never present (`attendance_none`) |

### Findings and fixes

| # | Sev | Finding | Fix |
|---|---|---|---|
| C1 | **P0** | **Certificate eligibility was stale/bypassable.** `issueCertificates` certified whoever had stored `status='completed'` without re-evaluating. Attendance/scores stay editable on completed workshops, a mid-workshop evaluation could store `completed`, and date edits change the denominator — none invalidated the stored status, so a participant who no longer met the thresholds still got a certificate | Issuance now re-reads facts, rebuilds standings, persists them (certified rows pinned) and certifies only those freshly `completed` |
| C2 | P1 | **Numerator ignored the workshop window.** Every `present/late` mark with `day_on ≤ today` counted, even after a date edit put it outside `[start, end]`, while the denominator followed the new dates → >100% and false completion | `loadCompletionInputs` bounds the count by `start … coalesce(end, start)` and `≤ today`; the report counts the same way |
| C3 | P1 | **Denominator capped at 62 days, numerator uncapped.** A 70-day workshop with 65 present days read 104.8%, and nothing rejected a >62-day span | `countWorkshopDays` is arithmetic and uncapped; a new `span_too_long` date rule rejects runs over `WORKSHOP_MAX_DAYS` on create and update (the write transaction re-checks, not just Zod) |
| C4 | P1 | **A dateless workshop could mark someone `completed`.** Zero countable days, one orphan check-in, no criteria → no shortfalls | `countableDays === 0` always adds `attendance_unknown`; dateless workshops can never complete or be certified |
| C5 | P2 | **Rounding before comparison.** 59.96% rounded to 60.0 and passed a 60% minimum | Thresholds compare the unrounded ratio; display values round to one decimal |
| C6 | P2 | **Completing a workshop did not finalize standings**, so Reports showed `completed: 0` until someone clicked Evaluate | `open → completed` now builds and persists standings in the same locked transaction |
| C7 | P3 | `minAttendancePct = 0` / `minScorePct = 0` silently meant "unused" (`> 0` check); a 0% score minimum also reported `score_missing` with no score lines | Non-null minimums are criteria; 0 always passes (0/0 satisfies 0%); positive score minimums still require score lines |

**Positive:** evaluation and issuance already ran in one locked transaction since the lifecycle work;
the pure rule is still the single source of truth, now consumed by evaluation, issuance and the
completion transition through `buildCompletionRows` (one code path, no drift).

## 2. Capacity and waitlist

### Single registration

One `withTenant`, workshop row locked `FOR UPDATE`, then: contact alive → no active row for the
contact → `resolveWorkshopRegistration` → insert. Full + waitlist disabled returns the same typed
`409 capacity_full` as before; full + enabled inserts the row with `waitlisted_at` set and returns
it (the API response's `waitlistedAt` tells the caller). Capacity counts only seated rows
(`waitlisted_at IS NULL`), so waitlisted people never occupy seats.

### Batch registration

`POST /api/workshops/:id/participants/bulk` (`contactIds`, 1–100) runs one transaction and one event
lock. Any unknown/archived contact, repeated contact, already-registered contact or blocked
lifecycle aborts the whole batch **before a single insert**; otherwise seats fill in input order and
the overflow is queued when the waitlist is enabled. Waitlist disabled + overflow → 409 and zero
rows written. There is no partial-success mode (deliberate: an import must not half-apply).

### Promotion (race-free by construction)

Promotion only runs inside a transaction that already holds the `workshop_events` row lock — the
single mutex shared by registration, withdrawal, capacity edits, transitions and trash/restore:

1. `DELETE …/participants/:id` (or the internal withdrawal) soft-deletes the row.
2. If the withdrawn row held a seat and `isWorkshopWaitlistPromotable(workshop, today)` (status
   `open`, last day not passed), `promoteOldestWaitlistTx` takes the oldest queued row whose contact
   is still live (order `waitlisted_at, created_at, id`), clears `waitlisted_at`, and returns it.
3. The withdrawal response carries the promoted participant so the UI can announce it; a second
   concurrent withdrawal promotes the *next* row because the first is no longer waitlisted.
4. A capacity increase (or removing the cap) promotes up to the freed seats in the same transaction.
5. Cancelling archives seated **and** queued rows; a queued row withdrawn by staff promotes nobody.

| # | Sev | Finding | Fix |
|---|---|---|---|
| W1 | **P0** | No waitlist: no queue, no position, no promotion, no way to express "full but still interested" | `waitlist_enabled` + `waitlisted_at`, promotion on withdrawal/capacity increase |
| W2 | P1 | No batch registration, so `max_capacity` had no all-or-nothing contract | Atomic bulk endpoint with input-order seating and queueing |
| W3 | P2 | Every count (`participantCount`, report, metrics, check-in validation) counted all active rows; a queue would have occupied seats and appeared in completion | Seated filter (`waitlisted_at IS NULL`) on counts, roster, completion, attendance validation, report and metrics |
| W4 | P2 | Capacity is application-enforced only (no DB invariant possible) | Documented; API paths are serialized by the row lock and covered by the repeated concurrency suite |
| — | positive | Registration/withdrawal/capacity/transition already shared the event-row lock; the seat race was proven before and stays covered | — |

## 3. Facilitator & venue conflicts (design only, deferred)

| # | Sev | Finding |
|---|---|---|
| F1 | **P0 — missing subsystem** | Workshops have no facilitator, no room and no time-of-day; scheduling is date-granular. Double-booking cannot exist as data, so nothing validates it |
| F2 | P1 | Academic side: `findTimetableCollisions` receives **only the classes of the session being saved**. Teacher double-booking across sessions is never queried, and `session_class_sections.room` (free text) is excluded from every collision type. Rooms are not conflict-checked anywhere in the repo |
| F3 | P2 | The repo has one resource-exclusion precedent (`sessions_no_overlap_excl`, a btree_gist exclusion on `session_period`) but nothing equivalent for rooms/faculty, and PostgreSQL cannot express an exclusion across two tables |

### Target design (decision-ready, not implemented)

1. **Model.** `rooms` (workspace-scoped, unique normalized name); `workshop_slots (workshop_id,
date, start_time, end_time, room_id)`; `workshop_facilitators (workshop_id, faculty_id, role)` with
the soft-delete sextuple and a partial unique index per role.
2. **Intra-table guarantees.** Exclusion constraints using `btree_gist`:
   `EXCLUDE USING gist (workspace_subdomain WITH =, room_id WITH =, slot_period WITH &&)` and the
   same on `(workspace_subdomain, faculty_id)`, both `WHERE deleted_at IS NULL AND status <> 'cancelled'`.
   `slot_period` is a generated `tsrange(date + start_time, date + end_time)`.
3. **Cross-table conflicts.** A workshop slot can clash with an academic timetable period
   (`session_class_timetables.date` + `session_class_timetable_periods.start/end_time`, faculty on
   the period, room on the section) — not expressible as a constraint. The write transaction must
   query both sides with one overlap predicate and serialize with
   `pg_advisory_xact_lock(hashtext('room|'||room_id||'|'||date))` /
   `hashtext('faculty|'||faculty_id||'|'||date)` so two concurrent writers on the same resource/day
   cannot both pass. Return typed `409 room_double_booked` / `409 facilitator_double_booked` with
   the conflicting slot.
4. **Academic-side fix (F2).** Widen `findTimetableCollisions` with a `room` collision kind and feed
   it the other sessions' periods (one batched query inside the save transaction), so the existing
   academic scheduler benefits even before workshops gain slots.
5. **Identity decision.** Facilitators are `faculty` (employment rows), not contacts; the workshop
   participant roster stays contact-based.

## 4. Change set

- **Schema/migration:** `workshop_events.waitlist_enabled` (default false),
  `workshop_participants.waitlisted_at`, `workshop_participants_waitlist_check` (`waitlisted_at is
  null or status='registered'`), partial promotion index; migration `0246_workshop_waitlist.sql` +
  journal + snapshot.
- **Shared:** `countWorkshopDays` (uncapped), `span_too_long` date rule, unrounded completion
  thresholds, zero-day rule, 0% minimum semantics, `resolveWorkshopRegistration`,
  `isWorkshopWaitlistPromotable`, waitlist fields on the record/detail schemas, bulk body schema.
- **Backend:** `workshopCompletionRules.buildCompletionRows` (single computation for evaluation,
  issuance and the completion transition); `issueCertificates` re-evaluates and certifies fresh
  eligible rows; completed transition finalizes standings; window-bounded attendance numerator and
  report; seated filters everywhere; new `workshopRegistrationRepository` (single/batch/withdrawal +
  promotion) and `workshopWaitlistRepository`; detail returns `waitlisted` + `waitlistCount`;
  capacity changes promote.
- **API:** `POST /api/workshops/:id/participants/bulk`; withdrawal response gains `promoted`;
  records gain `waitlistEnabled` / `waitlistedAt`; detail gains `waitlisted` / `waitlistCount`.
- **Frontend:** waitlist toggle in the form (requires a capacity), queue section with positions and
  count, “Join waitlist” CTA when full, promoted toast; ten new i18n keys ×4 locales.
- **Tests:** 54 workshop DB tests (13 new waitlist, 6 new completion-eligibility, existing lifecycle,
  capacity, completion, schema suites), two concurrency files repeated 5×, route tests for batch and
  promotion, FE waitlist-section test, static 0246 schema/snapshot assertions.

## 5. Verification

```bash
pnpm --filter @mms/shared typecheck && pnpm --filter mms-backend typecheck && pnpm --filter mms-frontend typecheck
pnpm --filter @mms/shared test          # 280 files / 2268 tests
pnpm --filter mms-backend test          # 514 files / 3653 tests
pnpm --filter mms-frontend test         # 1205 files / 4534 passed
# workshop DB suites (54) and the capacity + waitlist concurrency files repeated 5×: green
pnpm run check:code-norms check:backend-structure check:backend-boundaries check:i18n check:migration-indexes
bash .agent/skills/mms-soft-delete/scripts/verify-soft-delete-schema.sh
```

## 6. Deferred

- **D1 — facilitator/room/time model and conflict detection** (§3). Needs the product decision on
  rooms and per-slot times, plus the `btree_gist` exclusion constraints and advisory-lock guard.
- **D2 — academic cross-session/room conflicts** (F2). Independent change to the sessions scheduler;
  the design in §3.4 is ready.
- **D3 — waitlist notifications.** Promotion is surfaced in the withdrawal response and the UI
  toast; SMS/in-app notification to the promoted participant is not wired.
- **D4 — queued contacts that are archived.** Promotion skips them (their row stays queued); a
  cleanup/notification job is a follow-up.
- **D5 — manual promotion endpoint.** Promotion is automatic on seat release/capacity increase;
  staff cannot reorder or force-promote a row today.
