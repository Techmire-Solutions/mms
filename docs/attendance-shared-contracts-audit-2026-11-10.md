# Attendance Shared Contracts, Schemas & Types Audit

**Date:** 2026-11-10 · **Scope:** `packages/shared` attendance DTOs, the status/excuse enums, and the
runtime-validation ↔ TypeScript-type boundary.

**Method:** compared every hand-written attendance type with the zod schema it is supposed to mirror,
grepped the status domain across packages, the SQL and the DB constraints, and traced the module
import graph of the shared attendance files.

**Headline:** the status domain was **not single-sourced**: the brief's `HalfDay` did not exist
anywhere (while `trackHalfDay` defaulted to *true*), the frontend carried a second copy of the status
display model, the list query/response interfaces had drifted from their wire schemas, and the
attempt to bind lookup ids to the enum exposed a **runtime import cycle** that made the status enum
`undefined` at module init.

## Findings

| # | Sev | Finding | Evidence |
|---|---|---|---|
| T1 | **High** | **`half_day` was missing** from the shared enum, the DB CHECK, the policy, the matrix and the UI, while `trackHalfDay` was stored, defaulted `true`, and round-tripped by the settings save — a preference with no domain. | `attendanceModuleManifest.ts:6`, `0218_attendance_integrity.sql:50`, `attendanceModuleSettings.ts:47` |
| T2 | **High** | **Duplicate status display model**: shared `DEFAULT_ATTENDANCE_STATUSES`/`AttendanceStatus` and an identical frontend array/type plus a positional `STATUS_MAP` built with `as AttendanceStatus` casts (order-dependent, silently wrong if reordered). | `attendanceLookupTypes.ts:5-53`, `apps/frontend/src/lib/data/attendanceData.ts:11-96` |
| T3 | **High** | **Hand-written list DTOs drifted from the wire schemas**: `AttendanceListQuery` lacked `sectionId`, `afterId`, `skipCount` and accepted any `sortField` string; `AttendanceListPageResult` lacked `nextCursor` (the repository returned it as an intersection type instead). | `attendanceListQuery.ts:5-29`, `attendanceApiSchemas.ts:44-75`, `attendance.contractSchemas.ts:33-41` |
| T4 | **Medium** | **Ambiguous status mapping**: `AttendanceStatus` (display) vs `AttendanceRecordStatus` (value), and `attendanceStatusSchema.id` was a free string — a tenant lookup could store a status id the DB CHECK would reject on first use. | `attendanceLookupTypes.ts:82-95` |
| T5 | **Medium** | The status list was re-declared in at least five places (matrix union, export `VALID_STATUSES`, transitions, SQL `IN ('present','late')` in metrics/report/completion/eligibility) and nothing asserted the shared enum still equalled the DB constraint. | `attendanceMatrix.ts:17`, `attendanceMatrixExportService.ts:41`, `attendanceTransitions.ts:18-21`, `attendanceRepositoryMetrics.ts:41-56`, `attendanceReportOverview.ts:14` |
| T6 | **Medium** | **Runtime import cycle** (found while binding lookup ids to the enum): `attendanceLookupTypes → attendanceModuleManifest → attendanceApiSchemas → attendanceLookupTypes`. In one entry order the enum resolved `undefined`, so `attendanceStatusSchema` failed with "Invalid element at key 'id': expected a Zod schema". | reproduced by `attendanceStatusParity.test.ts` |
| T7 | **Low** | `attendanceImportRowSchema` is a second, legacy (name-based) attendance DTO while its route answers 503; dead i18n copy existed for leave types (`religious`, `travel`) that are not in `ATTENDANCE_LEAVE_TYPES`. | `opsModuleImport.dto.ts:4-16`, `appTranslations*.ts` |
| T8 | Info (good) | Response DTOs were already zod-inferred, contracts carried typed responses, and shared attendance had **no `any`** — the pattern this change extends to the list and status DTOs. | `attendanceModuleManifest`, `attendanceReportAggregates.ts:69-75` |

## What changed

**A. One status domain, `half_day` end-to-end**
- New leaf module `attendance/attendanceStatusDomain.ts` (imports nothing) owns
  `ATTENDANCE_RECORD_STATUSES = [present, absent, late, half_day, excused]`,
  `ATTENDANCE_ATTENDED_STATUSES = [present, late, half_day]`, the zod enums and `isAttendedStatus`.
  `attendanceModuleManifest` re-exports it (compat), the lookups/matrix/policy import it directly —
  which removes the import cycle (T6).
- Transitions derive from the list instead of a hand-written `Record` (the previous shape is what
  caught the missing status, and it now cannot).
- Policy: `half_day` requires a valid `timeIn` and is refused on an approved leave like any attended
  status; it is not subject to late-grace conversion.
- Matrix: `half_day → "H"`, a `Half day` totals column, and the percentage credits it as attended.
- Rates: `isPresentOrLateSql` is now `isAttendedSql`, built from `ATTENDANCE_ATTENDED_STATUSES`, and
  is used by the report overview, comparison mode, session completion and exam eligibility; command
  metrics join the same placeholder list.
- DB: `attendance_status_check` widened via migration **0224** (`DROP` + `ADD … NOT VALID` +
  `VALIDATE`, `lock_timeout 2s`) plus the Drizzle model.
- Lookups: `AttendanceStatus.id` is enum-bounded; stored rows with an unknown id are dropped on read
  with a warning; `half_day` is offered only when `trackHalfDay` is on, and saving a `half_day`
  lookup while it is off returns **422 `attendance_half_day_disabled`**.
- i18n: `attendance.status.half_day` + `.short` in en/ar/ur/fa; dead leave-type copy removed.

**B. One DTO per concept**
- `AttendanceListQuery = z.infer<attendanceListQuerySchema>`,
  `AttendanceListPageResult = z.infer<attendanceListPageResponseSchema>` — the hand-written
  interfaces are gone, and the contract schemas are now exported through the package barrel.
- The frontend `attendanceData.ts` re-exports the shared status model and deletes its own array,
  type and positional `STATUS_MAP`; `getAttendanceStatusInfo` keeps its unknown-id fallback and
  `calcClassStats` credits `half_day`.
- `attendanceImportRowSchema` is marked `@deprecated` (removal follows when the 503 route goes).

**C. Parity guardrails**
- `attendanceStatusParity.test.ts` (static): the five statuses, zod enum options, lookup defaults,
  transitions, matrix codes, the attended subset, the DB check **parsed out of the Drizzle model**,
  and the four-locale copy must all agree.
- `attendanceStatusParityDb.integration.test.ts` (CI): every status inserts, a bogus one is rejected
  by name, `pg_get_constraintdef` lists exactly the shared values, and a `half_day` row counts as
  attended in the report overview.
- `attendanceLookupGating.test.ts`: half-day offered/stripped by preference, unknown stored ids
  dropped, save rejected when disabled.
- `attendanceDtos.test.ts`: the list query exposes every repository filter, the page result accepts
  `nextCursor`, and every contract route has a typed (non-`unknown`) success response.

## Verification

- `pnpm typecheck` — 6/6.
- Backend: **3,137 tests / 458 files** (attendance: 268+ across 33).
- Frontend: attendance + data suites **179**.
- Ratchets: code-norms, backend-structure, migration hygiene/indexes, shared SSOT purity, docs, i18n
  and prettier — all green.
- `local-ci` — see the run recorded with this change.

## Accepted trade-offs

- **`half_day` credits the day once** (present-credit 1, not 0.5) so completion, eligibility and
  reports keep integer counts; the distinction is informational, like `late`. Documented in the shared
  enum. Fractional credit would be a separate, cross-module change.
- `trackHalfDay` stays **on by default**, so `half_day` appears in lookups for every tenant after this
  change — that is the feature enablement, not a silent default flip.
- Lookup ids are enum-bounded: a tenant with a legacy custom status id has that row filtered out on
  read (logged) and must re-save its statuses.
- The import row schema is deprecated, not deleted, while the 503 route still references it.
- `workshop_attendance` keeps its own four-value CHECK and shared enum — a separate module, unchanged.
