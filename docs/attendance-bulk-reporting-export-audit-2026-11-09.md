# Attendance Bulk Processing, Reporting & Export Audit

**Date:** 2026-11-09 · **Scope:** register/matrix exports, device check-in ingestion, and the analytics
queries behind the dashboard widgets and reports.

**Method:** traced every export from route → job → serializer; searched the codebase for any
device/RFID/biometric ingestion path; and read the widget/report SQL against the `attendance` index
set, counting scans per dashboard load.

**Headline:** attendance had **no register, matrix, PDF or XLSX export** and **no device ingestion
path at all** — the only export was the generic record-list CSV. The dashboard, meanwhile, scanned
the whole tenant once per widget (up to ~64 scans per load) with predicates that made every index
unusable, and the report overview ran four full scans plus a per-student temp table with no date
bound.

## Findings

### 1. Register exports

| # | Sev | Finding | Evidence |
|---|---|---|---|
| E1 | **High** | **No register, monthly matrix, or summary export.** Only the generic record-list CSV exists; there is no PDF or XLSX surface for attendance, and the Reports tab is read-only. | `attendanceExportRoutes.ts`, `AttendanceReportsTier.tsx` |
| E2 | Info | The CSV that did exist is stream-safe: paged generator → `PassThrough` with `drain` backpressure → storage; JSON/XLSX materialisation capped at 50k rows. | `registerModuleCsvExportJobRunner.ts:52-100`, `createModuleExportService.ts:23` |
| E3 | Info | CSV formula injection is neutralised centrally (`= + - @ TAB CR`, whitespace-then-formula) with negative numerics preserved. | `core/csvUtils.ts:5-45` |
| E4 | **Medium** | Nothing tested E3 for attendance and nothing tested chunk-boundary header emission. | no attendance export tests |
| E5 | **Medium** | No row ceiling on a record export: five years × every student × every day can stream tens of millions of rows. | `createModuleExportService.ts` |

### 2. Device / biometric ingestion

| # | Sev | Finding | Evidence |
|---|---|---|---|
| D1 | **High** | **No ingestion surface exists** — no RFID/biometric/webhook/check-in endpoint anywhere. | repo-wide search |
| D2 | **High** | CSV import cannot stand in: the attendance import row schema is legacy **name-based**, and the route answers 503 (no runner). Duplicate filtering, timestamp validation and row-level errors had no implementation. | `opsModuleImport.dto.ts:4-16` |
| D3 | **Medium** | A device row written through the normal mark path would be refused by the marking cut-off after a queued/offline batch, and could overwrite an approved excuse. | `attendancePolicyGuard.ts` |

### 3. Analytics & widgets

| # | Sev | Finding | Evidence |
|---|---|---|---|
| A1 | **High** | Widget aggregates scanned **all** live attendance per widget (`count(*)` + grouped chart over all history); up to 32 widgets ran concurrently → ~64 scans per dashboard load. | `attendanceRepositoryWidgets.ts` (before), `common.dto.ts:49-53` |
| A2 | **High** | Filters/grouping used `lower(trim(col::text))` and `::text` casts on `status`, `class_id`, `student_id`, `date_on` — every relevant index unusable. | same |
| A3 | **High** | Report overview ran four full scans + a temp table of every student, each row evaluating the countable predicate's correlated subqueries, with **no date bound**. | `attendanceReportOverview.ts:43-160` |
| A4 | **Medium** | Monthly grouping used `to_char(date_on,'YYYY-MM')`, preventing any range index use. | `attendanceReportOverview.ts:88-105` |
| A5 | **Medium** | No covering index for these scans; approved-leave lookups lacked a `(workspace, student, from, to)` index. | `attendance.ts` index set, `0220:101` |
| A6 | **Medium** | Report aggregates and widgets were not cached, though metrics already had a 60 s Redis cache. | `crudQueryRoutes.ts:21` |

## What changed

**A. Register/matrix export (streaming, injection-safe)**
- `packages/shared/src/attendance/attendanceMatrix.ts`: grid builder (status codes, per-student
  totals, percentage, daily totals), range validation (`ATTENDANCE_MATRIX_MAX_DAYS = 92`),
  `ATTENDANCE_MATRIX_MAX_CELLS = 200_000` for materialised formats.
- `services/attendanceMatrixExportService.ts`: roster read **100 students at a time**, marks fetched
  for that chunk only, chunk serialised and released → peak memory `chunk × days`, never
  `students × days`. CSV goes through `buildCsvContent` (formula-safe) and the footer through the
  same escaper. No preamble rows: the class/range live in the **filename**, so a hostile class name
  cannot break the CSV structure.
- Route `POST /api/attendance/export/matrix` (contract) validates range/cell budget **before**
  enqueueing, then queues `attendance:matrix-export` → 202 `{job}`; the runner streams CSV to
  storage with drain backpressure, or builds a capped XLSX via `buildXlsxBuffer`.
- Reports tab gains a register-export control (CSV / Excel) for the selected class's month.
- Export jobs keep the existing per-run row cap discussion: the record export remains stream-only;
  the matrix has an explicit day + cell budget.

**B. Device check-in ingestion**
- Contract `POST /api/attendance/check-ins` (≤ 2,000 rows, `attendance.write` + section scope) →
  `{ accepted, duplicates, rejected[], records[] }`.
- `packages/shared/src/attendance/checkInTime.ts`: `HH:mm`, ISO-8601, epoch → workspace day + wall
  clock; rejects malformed values, future dates, and anything older than
  `ATTENDANCE_CHECKIN_LATE_WINDOW_DAYS = 7`.
- `attendanceCheckInUseCases.ts`: validate-all-then-write, atomic upsert of accepted rows;
  - **duplicates**: identical `(class, student, date, timeIn)` → `duplicate`, no write, no audit
    (a replayed device batch is idempotent by construction);
  - **excuse protection**: an `excused` row is never overwritten (`attendance_excused_conflict`);
    `absent` → `present` is an audited correction;
  - **roster lock** still applies (row error), while the **cut-off is waived** for device evidence
    (`AttendancePolicyInput.source: "device"`, `deviceEvidence` in the pure evaluator) because a
    reader may have queued offline;
  - one audit row per accepted write with `source: "device"`, `deviceId`, `externalId`,
    `receivedAt`, `lateUpload`, previous status.

**C. Analytics**
- Widgets: always range-bounded (default last 30 days, clamp 366), raw-column equality comparisons
  (status lowercased on the *value*, not the column), raw-column grouping, **bounded concurrency 4**,
  and a 60 s Redis cache keyed by tenant + query hash.
- Report overview: optional `dateFrom`/`dateTo` threaded through all four statements and the temp
  table, `date_trunc('month', date_on)` grouping, and a 60 s cache keyed by class + ranges.
- `db/migrations/attendanceAnalyticsIndexes.ts`: boot-time **CONCURRENTLY** provisioning of
  `attendance_workspace_date_status_covering_idx` (workspace, date) INCLUDE (status, class, student),
  `attendance_workspace_student_date_active_idx`, and
  `attendance_leaves_workspace_student_approved_idx`. **Not migration 0224** as the plan said: a
  plain `CREATE INDEX` on populated `attendance` is a write outage and `CONCURRENTLY` cannot run
  inside Drizzle's migration transaction — the repo's established pattern
  (`enrollmentIntegrityIndexes.ts`) is boot-time provisioning, and the migration-index ratchet
  enforces exactly that distinction.

## Tests

- `attendanceMatrix` (8): grid shape/codes/totals/footer, header once, `=HYPERLINK` neutralised,
  negative numerics preserved, range cap.
- `attendanceMatrixExportService` (5): chunked pages + cursor, header once across chunks, footer
  totals, over-long range rejected before any read, cell budget 413.
- `attendanceCheckInTime` (7): wall clock, ISO offset → workspace zone, epoch, ambiguity, invalid
  values, future/over-age.
- `attendanceCheckInUseCases` (6): accept + device provenance audit, replay → duplicate/no writes,
  excused conflict, absent→present correction, per-row invalid timestamp, non-enrolled row error.
- `attendanceWidgetsAnalytics` (5): default/clamped range, concurrency ceiling and order, range
  predicate applied, no-filter reuse of the range total.
- `attendanceAnalyticsIndexes` (4): fresh create, skip valid, rebuild invalid, never fatal.

## Verification

- `pnpm typecheck` — 6/6.
- Backend: **3,116 tests / 455 files** (attendance: **248 across 31**).
- Frontend: attendance + tenant hooks **151**.
- Ratchets: code-norms (300-line ceiling), backend-structure (services/use-cases storage boundary),
  migration hygiene/indexes, DB projections, docs, i18n, prettier — all green.
- `local-ci` — see the run recorded with this change.

## Accepted trade-offs

- **No PDF** for attendance: the repo's PDF path is the Typst document-template pipeline, which has
  no attendance template. Matrix ships CSV + capped XLSX.
- **No hardware integration or device tokens**: devices post an authenticated JSON batch as a user;
  machine credentials and per-device rate limits are the follow-up.
- Widget defaults are **last 30 days** (a visible number change on the dashboard), while report
  aggregates keep **all-time** defaults so existing figures do not move until a range is requested.
- Rewriting the countable predicate into joins is out of scope; the covering index + range bound is
  the bounded improvement, with the rewrite recorded as follow-up.
- Matrix ordering is by `student_id` (stable keyset paging) rather than roll number; roll numbers are
  still exported as a column.
