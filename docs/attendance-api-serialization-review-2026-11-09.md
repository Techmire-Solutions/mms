# Attendance API, Controllers & Serialization Review

**Date:** 2026-11-09 · **Scope:** attendance route schemas, contract/controller behaviour, batch
payloads and the list/matrix query paths.

**Method:** read every route in the attendance contract against its handler and the SQL it triggers,
then traced the marking grid from React Query down to the repository. Findings below are ordered by
severity; each carries the evidence that produced it and its resolution in this change.

**Headline:** the most dangerous defect was not a schema gap — **the marking grid was fed by a
workspace-wide collection capped at 100 rows**. Beyond that cap the grid rendered unmarked defaults
and saved them back over recorded absences. That is fixed by a purpose-built roster endpoint; the
schema, batch-envelope and N+1 items follow.

## Findings

| # | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| A1 | **Critical** | The grip's data source was `GET /api/attendance?page=1&limit=100` — unfiltered, workspace-wide — filtered client-side by class/day. Past 100 rows the day's marks fell out of the window, the grid defaulted every student to `present 07:00–08:30`, and saving overwrote real absences (the grid sent no OCC token). | `useAttendance.ts:89-96`, `useAttendancePageController.ts:49-50`, `markAttendanceRowUtils.ts:113-127` | **Fixed** — `GET /api/attendance/roster` (class+day+section, one query, cap 1000) feeds the grid |
| A2 | **High** | Nine routes carried `:id` / `:classId/:date` / `:kind` with **no `pathParams`**: `update`, `delete`, `restore`, `getLookupKind`, `days/…/submit`, `days/…/reopen`, `leaves/:id/review`, `leaves/:id/cancel`, `absence-alerts/:id/resolve`. | `attendance.contract.ts`, `attendance.contractLeaves.ts`, `attendance.contractEscalation.ts` | **Fixed** — bounded id / ISO-day / enum params on every route |
| A3 | **High** | Response schemas missing or unconstrained: `getLookupKind` → `z.unknown()`; the metrics route registered **no** response schema; the list envelope omitted `nextCursor`, which the repository returns. | `attendance.contract.ts:220`, `routes/tenant/attendance.ts:31-43`, `attendanceRepositoryList.ts:104-108` | **Fixed** — typed lookups item, `attendanceCommandMetricsResponseSchema`, `nextCursor` |
| A4 | **High** | Undeclared error statuses: `create`/`update`/`delete`/`restore` never declared **409** though the policy emits `attendance_cutoff_passed` / `attendance_day_locked` / `stale_write`; `create`/`update`/`bulk` never declared **422** (`attendance_not_enrolled`); `bulk` declared only 200/403/500. | contract vs `attendancePolicyGuard.ts`, `attendanceMarkUseCases.ts` | **Fixed** — statuses declared, including the batch/413 envelopes |
| B1 | **High** | No per-row batch envelope. The guard threw on the **first** invalid row, so a 120-row roster with three bad rows reported one and wrote nothing, with no indication of the rest. | `attendancePolicyGuard.ts` loop | **Fixed** — `AttendanceBatchRejectedError` (422) lists every failed row incl. its submitted index |
| B2 | **Medium** | No byte bound on `PUT /api/attendance/bulk`; only the process-wide body limit applied and the failure surfaced as a generic error after parsing. | `app.ts:23` | **Fixed** — `onRequest` guard on declared `content-length` → 413 before parsing |
| C1 | **High** | No server-side `sectionId` filter in the list contract or `AttendanceListQuery`, although the grid and the marked-dates endpoint both have a section notion. | `attendance.contract.ts:53-64`, `attendanceListQuery.ts:5-19` | **Fixed** — `sectionId` on the list query, the roster query and the Records page |
| C2 | — | *Corrected finding:* the list applies `sessionId`/`facultyId` as both an `EXISTS` and a join predicate — **not** redundant. The `total` count query runs without the join, so it needs the `EXISTS`; the join supplies the returned session/faculty columns. No change made; left documented to prevent a future "cleanup". | `attendanceRepositoryList.ts:32-52` | **Verified, no change** |
| C3 | **Medium** | `stampAttendanceSections` issued **one placements query per distinct attendance date** on every roster save/backfill. | `attendanceSectionStamp.ts:44-55` | **Fixed** — one `DISTINCT ON (date, student, class)` range query |
| C4 | **Medium** | `search` is `ILIKE '%x%'` on name/roll with no supporting index; `sortField` was an unbounded `z.string()` that the SQL builder silently ignored when unknown. | `attendanceListQueryBuilders.ts:41-47`, `apiSchemas.ts:12` | **Fixed for validation** (enum in the wire schema, shared with the SQL whitelist). Index deferred — see below |
| C5 | **Low** | Contract capped `limit` at 100 while the repository accepted 500 — the larger page was unreachable. | `apiSchemas.ts:6`, `attendanceRepositoryList.ts:20` | **Resolved by design** — roster is its own resource with its own cap |
| D1 | **Medium** | **No excuse-attachment path for attendance.** The shared uploader was authorised by `contacts.write` only, so a teacher could not attach a certificate, and attachments had **no MIME allowlist**. `document_ref` was free text. | `routes/common/uploads.ts:33-35`, `:131-205` | **Fixed** — `?purpose=attendance_excuse` (attendance.write, PDF/JPEG/PNG/WebP, 10 MB), `documentRef` schema + tenant check |
| D2 | **Low** | `customFields` was accepted on write, never persisted or returned — silent data loss. | `attendanceModuleManifest.ts`, mappers | **Fixed** — removed from the wire schema (strict now rejects it), grid stops sending it |

## What changed

**Shared (`packages/shared`)**
- `attendance/attendanceApiSchemas.ts`: bounded id/class/date/kind params, the strict list query
  (enum `sortField` shared with the SQL whitelist, `sectionId`, ISO days, `dateFrom <= dateTo`),
  the roster query, the batch rejection envelope and the tenant-attachment URL pattern.
- `attendance/attendanceCommandMetrics.ts`: the metrics response schema the route never had.
- Contract: `pathParams` on all nine routes, strict list query, `nextCursor`, typed lookup/roster/
  metrics responses, and declared 409/422/413 statuses.
- `documentRef` constrained; `customFields` removed from the record schemas.

**Backend**
- `HttpDomainError.details` (+ `AttendanceBatchRejectedError` with `violations`), forwarded by
  `handleContractError` — the batch envelope reaches the client intact.
- `listAttendanceRoster` + `GET /api/attendance/roster` handler/router wiring.
- Bulk `content-length` guard (413) in the contract router.
- `onRequest`-level purpose authorisation + MIME allowlist on the shared attachment uploader;
  `submitExcuse` verifies the attachment belongs to the requesting tenant.
- `listEnrollmentPlacementsForDates` replaces the per-date stamping loop.
- Metrics route now validated; leave list gains a bounded `limit` (1–200).

**Frontend**
- `useAttendanceRoster` feeds the grid; the controller no longer reads the capped collection, and
  saves echo `version` (the OCC path the API already supported).
- Records page sends `sectionId`; the bulk payload no longer sends `customFields`.
- Excuse request form with a certificate upload (purpose-scoped, type-filtered).

## Verification

- `pnpm typecheck` — 6/6.
- Backend: **3,024 tests / 439 files** (156 attendance across 15 files, including the new contract,
  batch-envelope/errors, payload-guard, upload and stamping suites).
- Frontend: **1,171 files / 4,388 tests**.
- New coverage: route param/response/status table test; strict-query rejection; batch envelope
  (multi-row, single-row, valid, no-write); 413 before parsing; purpose authorisation + MIME;
  cross-tenant `documentRef` rejection; one-query stamping; roster DB tests (CI).
- Ratchets and `local-ci` — see the run recorded with this change.

## Accepted trade-offs & follow-ups

- **Strict queries are a breaking change** for callers sending undeclared keys: they now get a 400.
  This is the point of the change; every in-repo caller was updated.
- **`customFields` is now rejected rather than dropped.** Attendance custom fields were never
  stored (no column). Restoring the feature needs a `custom_fields` jsonb column and a migration;
  until then the strict schema refuses the key instead of silently losing the values.
- **`search` index deferred.** `ILIKE '%…%'` cannot use a btree; a trigram index needs the `pg_trgm`
  extension, which is a database-level dependency decision. The interactive path is already bounded
  by class/day filters.
- **Roster cap is 1,000**, not the interactive 100: a roster is a different resource with a
  different bound, documented in the schema.
- **`C2` was a false positive** and is recorded as such rather than "fixed" into a broken count.
- **Possible optimisations deliberately not adopted:** returning 204/no body from bulk (clients need
  the persisted rows for OCC tokens), and moving eligibility into the roster projection (the gate
  costs one extra query per exam, not per student).
