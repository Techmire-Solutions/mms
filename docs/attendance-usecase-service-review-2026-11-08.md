# Attendance Use-Case & Service Layer Review — 2026-11-08

**Scope:** the attendance domain layer — `attendance/use-cases/**`, the retired
`services/attendanceService.ts`, the route handlers that call them, the repository seam, and the
configurable business rules (cut-off, late grace, note requirement, manual override, lock-after-submit).

**Method:** read every use-case and handler in the module, then traced each of the 16 module
preferences to its enforcement site (`grep` over `apps/backend/src`), the transaction boundaries of
every write path, and the authorization model (`ATTENDANCE_MODULE_MANIFEST.permissions`).
Verified against the sibling modules (enrollments own their own transaction inside the use case;
sessions use `x-expected-version`), and against the reference test suites.

**Overall finding:** the persistence layer was sound after the schema audit, but the *domain* layer
was thin to the point of being decorative. Marking, corrections, deletions and restores were
validated only for referential integrity; 7 of 16 preferences were never read server-side; the
business rules that existed lived in the transport layer, so any non-HTTP writer bypassed them.
Worse, the previous fix to the upsert (natural-key arbitration) silently broke moving a mark to
another day. All of it is addressed below.

## Verified before changing anything

| Question | Finding |
|---|---|
| Does the domain import HTTP concerns? | **Yes** — `attendanceUseCases.ts` imported `FastifyRequest` and parsed `request.query.date` (the only use-case file in the repo to import Fastify) |
| Are domain invariants in the domain? | **No** — `assertTeacherClassScope` + `assertInstructionalDays` were called from the route handlers only |
| Is the roster save atomic? | **Yes** — one `withTenant` write, all-or-nothing, with a `RETURNING`-count guard that refuses a partial batch |
| Are guards and the write in the same transaction? | **No on create and bulk** (guards ran in their own transactions first); yes on update |
| Can `lockAfterSubmit` be enforced? | **No** — no persisted submission state existed anywhere |
| Do delete/restore honour the cut-off? | **No** — neither path consulted preferences |
| Is every mutation audited? | **No** — only the holiday-override path wrote an audit row |

## Findings

### A. Clean Architecture separation

| # | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| A1 | **High** | **Fastify type inside the domain**, which also caused a live cache bug: the metrics cache keys on tenant+collection+role and ignored `?date=`, so switching days served the previous day's KPIs for the 60 s TTL. | `attendanceUseCases.ts:1,205-216`; `lib/crudQueryRoutes.ts:54-56` | **Fixed** — the use case takes `selectedDate?: string`; the route parses the query and declares it as the cache variant |
| A2 | **High** | **Domain rules lived in the transport layer.** Any non-HTTP writer (the queued CSV import, a worker, a script) recorded attendance with no enrolment, teacher-scope or calendar check. | `attendanceRecordHandlers.ts:99-107`; `attendanceBulkContractHandlers.ts:36-45` | **Fixed** — both guards now run inside each write use case, in the write transaction |
| A3 | **Medium** | The domain validation module **dynamically imported Drizzle repositories** for its defaults; the DI seam existed but defaulted to the ORM. | `attendanceForeignKeyValidation.ts:33,44,59,72` | **Fixed** — the composition root binds the lookups; no `db/` import remains in the validation module |
| A4 | **Low** | `services/attendanceService.ts` was a pure re-export whose only consumer was its own test. | — | **Removed**; the test moved to `attendanceUseCases.test.ts` |
| A5 | **Medium** | The 295-line record handler mixed authorization (correct) with domain rules and OCC parsing (not correct). | `attendanceRecordHandlers.ts` | **Fixed** — handlers now authorize, parse the header and delegate; the record handler shrank ~60 lines |

`getRequestTenant()` inside use cases is **not** counted as a violation: 48 use-case files do it. It
is recorded as the reason the module cannot be driven by a scheduler without a request context.

### B. Invariant validation

| # | Sev | Finding | Status |
|---|---|---|---|
| B1 | **High** | **No status-transition model.** `absent → excused` was accepted with no reason and no audit; a `PATCH` could rewrite another teacher's mark with nothing recorded. | **Fixed** — `attendanceTransitions.ts` states the transition set explicitly (no forbidden edges for an authorised editor; the constraints are preconditions) plus `attendancePolicy.ts` for the gate, and every status change is audited with from/to |
| B2 | **High** | **7 of 16 preferences were never read server-side**: `cutoffTime`, `lateThresholdMins`, `autoAbsentAfterMins`, `lockAfterSubmit`, `allowManualOverride`, `requireNoteForAbsent`, `trackHalfDay`. Two of them had no UI control at all. | **Fixed** for 5 (`cutoffTime`, `lateThresholdMins`, `lockAfterSubmit`, `allowManualOverride`, `requireNoteForAbsent`); the other two are registered below |
| B3 | **High** | **`lockAfterSubmit` was unenforceable by design** — the "submitted" flag lived in React state. | **Fixed** — migration 0219 adds `attendance_day_submissions` (submit/reopen endpoints); the policy locks a submitted day |
| B4 | **Medium** | No time-field sanity: `timeOut < timeIn`, arrival times on an `absent` mark, and a `late` mark with no time were all accepted. | **Fixed** — P5 in the policy; a `present` mark deliberately needs no time (the insert schema defaults it empty and one-tap marking is a real workflow) |
| B5 | **Medium** | Approved leave and attendance could contradict each other: a `present` mark on an approved-leave day was accepted even though that day is excluded from rates. | **Fixed** — P4 refuses `present`/`late` on an approved-leave day unless overridden (audited) |
| B6 | **Medium** | Preference values were unvalidated (`cutoffTime` any string; minute fields any number), so an unparseable cut-off made the rule silently inert and `0` made every student late. | **Fixed** — `HH:mm` regex, bounded minutes, `lateThresholdMins ≤ autoAbsentAfterMins`, and `normalize` now sanitises **stored** values too |
| B7 | **Low** | `trackHalfDay` still has no domain representation (no `half_day` status; rates/exports do not understand it). | **Recorded, not implemented** — see accepted work |
| B8 | **Low** | `autoAbsentAfterMins` ("mark absent if they have not arrived") needs a scheduler. | **Recorded, not implemented** — see accepted work |

### C. Transactional integrity

| # | Sev | Finding | Status |
|---|---|---|---|
| C1 | **Critical** | **`PATCH /api/attendance/:id` with a changed `date`/`classId` no longer worked.** The natural-key upsert took its INSERT branch with the same surrogate id → primary-key collision → 409. The route deliberately supports moving a mark (it re-checks scope and instructional days), so this was a live regression with no test. | **Fixed** — `saveAttendanceRecordById` updates by id; `updateAttendanceRecordById` uses it; covered by a unit test and a real-Postgres suite |
| C2 | **High** | Guards + audit ran **outside** the write transaction on create and bulk, so `assertInstructionalDays` could commit an "extra class on a holiday" audit row for attendance that was never written. | **Fixed** — the use case owns the transaction and runs guards → policy → write → audit inside it |
| C3 | **High** | **No audit trail for attendance mutations** (evidence table; 0207 even freezes it on certification). | **Fixed** — `attendance.marked` / `corrected` / `deleted` / `restored` (and `moved`) inside the same transaction; bulk emits per row only when the status actually changed |
| C4 | **Medium** | `recordApprovedLeave` was check-then-write with no serialization: two concurrent suspensions both passed the overlap probe and inserted (no DB exclusion constraint). | **Fixed** — one transaction + per-student advisory lock around check-and-insert |
| C5 | **Medium** | A workspace-wide hard-delete replace was exposed on the use-case API with no cap and no audit. | **Fixed** — removed from the surface; the restore mirror still calls the repository function directly |
| C6 | **Medium** | CSV import/export enqueue `attendance:import` / `attendance:export` and **no runner is registered for either**; the import row schema is a legacy generic shape (`personName`, `personType`) that cannot address a student or class. | **Recorded** — see accepted work (feature build, not a domain repair) |
| C7 | **Medium** | Bulk marking had **no batch cap**. | **Fixed** — `ATTENDANCE_BULK_MAX_RECORDS = 500` |

## What changed (by subsystem)

**Shared contracts** (`packages/shared/src/attendance/`)
- New `attendanceTransitions.ts` — the transition set, `attendanceStatusChanged`, `attendanceWriteAction`.
- New `attendancePolicy.ts` — pure `evaluateAttendanceWrite` (P1 cut-off, P2 late grace, P3 note, P4 approved leave, P5 time sanity, P6 submitted day), clock helpers, `isPastAttendanceCutoff`.
- `attendanceSetupPreferences.ts` — `HH:mm` + bounded-minute validation on the PUT body, cross-field refine, and `normalize` now sanitises stored values (unknown clock → school default; out-of-range minutes → clamped).
- `attendanceModuleManifest.ts` — `ATTENDANCE_BULK_MAX_RECORDS = 500`.
- `contracts/attendance.contract.ts` — `submitDay` / `reopenDay` routes; response schemas extracted to `attendance.contractSchemas.ts` to stay inside the 300-line band.

**Domain** (`apps/backend/src/attendance/use-cases/`)
- `attendancePolicyGuard.ts` (new) — resolves preferences, timezone, approved leave and submitted days **once per operation**, then evaluates each row; a dedicated lighter gate for delete/restore. Its store is injectable so it is unit-tested without a database.
- `attendanceMarkUseCases.ts` (new) — create / correct (including moving a mark) / bulk upsert; each owns its transaction and runs guards → policy → write → audit.
- `attendanceTrashUseCases.ts` (new) — delete / restore / bulk variants through the day gate.
- `attendanceAudit.ts` (new) — hash-chained audit emission inside the caller's transaction.
- `attendanceUseCaseSupport.ts` (new) — shared deps/`requireTenant`/`notEnrolled`.
- `attendanceMutationUseCases.ts` — now a 19-line composer.
- `attendanceUseCases.ts` — no Fastify type, no ambient guards, `replaceAttendanceRecords` gone, `loadAttendanceCommandMetrics(day?)`.
- `attendanceForeignKeyValidation.ts` — no `db/` dynamic imports.
- `attendanceLeaveUseCases.ts` — serialized approved leave + `submitAttendanceDay` / `reopenSubmittedAttendanceDay`.

**Persistence**
- `attendanceRowReads.ts` (new) — projection, lookups, and `saveAttendanceRecordById`.
- `attendanceRepository.ts` — natural-key upserts only, re-exporting the row surface.
- `attendanceDaySubmissionRepository.ts` (new) + `attendance_leaves`/day-submission lookups.
- Migration `0219_attendance_day_submissions.sql` + snapshot + journal entry: `(workspace, class, date)` submission state, class FK, FORCE RLS, tenant policy.

**Transport**
- Handlers authorize, parse `x-expected-version`, and delegate; the guards and the transaction are gone from the handlers.
- `crudQueryRoutes.ts` gained `cacheVary`; the attendance route passes `?date=` so metrics are cached per day.
- New `attendanceDaySubmissionHandlers.ts` (`submit` = writer, `reopen` = admin).

**UI**
- Setup → Timing now exposes the cut-off time and the manual-override toggle (both were enforced-or-invisible mismatches) and the minute inputs are real number inputs bounded 0–240.

## Verification

- `pnpm typecheck` — 6/6 tasks.
- `pnpm --filter mms-backend test` — 433 files / 2,960 tests (92 attendance-related across 9 files, including the new policy matrix, guard suite and write-orchestration suite).
- `pnpm --filter mms-frontend test src/tenant/features/attendance` — 54 files / 90 tests.
- `node scripts/check-code-norms.mjs` — 300-line ceiling held (the layer split produced 19 / 237 / 136 / 43-line modules; the contract file was trimmed to 293).
- `node scripts/check-backend-structure.mjs` — ports-and-adapters ratchet **improved** (46 vs baseline 47 storage imports; 52 vs 53 unpaired use-cases).
- `node scripts/check-migration-hygiene.mjs`, `check-migration-indexes.mjs`, `check-migrations-forward-only.mjs` — held (0219 uses `lock_timeout`, `timestamp with time zone`, and carries a snapshot).
- `pnpm run check:i18n` — all four locales complete.
- `pnpm --filter mms-backend test:db` (CI) — new `attendanceUpdateMoveDb` and `attendanceDaySubmissionDb` suites.

## Accepted / deferred

| Item | Why |
|---|---|
| **CSV import/export (C6)** | Registering `attendance:export` and a real `attendance:import` runner (rows → `upsertAttendanceRecords`, so every new invariant applies) is a feature build with its own resolution and error-reporting rules. The import row schema must be replaced (`date`, `classId`, `studentId`, `status`, `notes`). |
| **`autoAbsentAfterMins`** | Needs a scheduler-driven job (`attendance:auto-absent`) that calls the same policy. The hook point is `attendanceMarkUseCases` + the existing BullMQ runner registry. |
| **`trackHalfDay`** | Requires a `half_day` status plus rate/report/export handling; inventing the status alone would corrupt the present-rate math. |
| **Teacher row-scope on the marking grid** | The grid still documents `allowManualOverride` semantics in the UI only; the server now enforces them, so the next frontend pass should surface the 409 codes inline. |

## Design notes worth keeping

- **One policy, every path.** `assertAttendanceWriteAllowed` is the only place the rules live; the
  route, the future import job and any script all call it.
- **The transaction owns the guards.** A rejected policy rolls back the guards' own audit rows, so
  the audit trail never claims a holiday override for a mark that was not written.
- **Overrides are explicit and attributed.** `canOverride = users.manage (admin) || allowManualOverride`;
  admins always can, teachers only when the school allows it, and the audit row records which.
- **`present` does not require a time.** `attendanceRecordInsertSchema` defaults `timeIn` to `""` and
  one-tap present marking is a real workflow; requiring a time would have rejected the module's own
  documented minimal create. `late` does require one — a late mark without a time is meaningless.
