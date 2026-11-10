# Attendance Test Suite & Quality Ratchets Audit

**Date:** 2026-11-10 · **Scope:** attendance integration/service tests, concurrency stress, boundary and
flakiness risks, and the CI ratchets that keep the suite honest.

**Headline:** the suite was strong on unit-level policy and repository invariants and weak exactly where
the new code was riskiest — the `x-expected-version` header had **no test at all**, batch atomicity and
OCC under concurrency were never exercised, 14 of 25 contract routes had no Fastify-injection test, and
attendance sat outside the DB-test honesty gates (a skipped or deleted attendance DB case passed CI).

## Findings

| # | Sev | Finding | Evidence |
|---|---|---|---|
| T1 | **High** | **Route-level OCC untested**: nothing sent `x-expected-version`; the parsing, the 400 for a malformed token and the 409 `stale_write` envelope were unproven (the repository-level OCC test existed). | `attendance.integration.test.ts`, `attendanceRecordHandlers.ts:158-165` |
| T2 | **High** | **Mixed-token batch atomicity untested**: `planAttendanceUpsert` splits token/no-token rows and `bulkSaveAttendanceRecords` has `assertEveryRowWritten` inside a transaction, but no DB test that one stale row aborts the whole batch and writes nothing. | `attendanceUpsert.test.ts:68`, `attendanceRepository.ts:86-100` |
| T3 | **High** | **Concurrency proved deadlock-freedom, not OCC**: the suite saved marks **without** `version`, so two writers holding the same token, rapid sequential toggles and the excuse-vs-marking lock were never exercised. | `attendanceConcurrencyDb.integration.test.ts` |
| T4 | **Medium** | **Route-injection coverage**: 14/25 attendance contract paths had no `buildApp()` + `app.inject` test (`PUT /:id`, check-ins, roster, marked-dates, lookups, day submission, matrix export, leaves, alerts, preferences, field-config, widget-aggregates). | two attendance files used `buildApp` |
| T5 | **Medium** | **No service-tier tests**: `attendanceConfigService` and `attendancePreferencesService` had none (the preferences default `trackHalfDay: true` and the broadcast key were only exercised through the UI). | `services/attendance*` vs `__tests__` |
| T6 | **Medium** | **Attendance outside the DB-test honesty gates**: hygiene + manifest scripts globbed only enrollment/registration, so `it.skip` or a deleted attendance case passed CI. | `scripts/ci/check-db-test-hygiene.mjs:14-17`, `check-db-test-manifest.mjs:12-22` |
| T7 | **Medium** | No attendance DB **coverage ratchet** (sessions and enrollments each have one) and attendance DB files were not shuffled (only enrollment/registration). | `package.json`, `ci.yml` DB job |
| T8 | **Medium** | No `TZ` pinning in the backend vitest configs; date-sensitive code defaults to `new Date()` in several use cases, so a runner in another zone could change "today" mid-suite. | `vitest.config.ts`, `attendanceDayEditGuard.ts:57` |
| T9 | **Low** | `parseCheckInTime` tested a day mismatch but not the accepted midnight rollover, nor a DST transition. | `attendanceCheckInTime.test.ts` |

**Preserved strengths:** fail-loud `requireDatabaseConnection` (no conditional skips), per-file tenant
fixtures with hard-purge cleanup, the 5× concurrency repeat (which already included attendance),
strict contract-schema tests, the batch-envelope tests, and the real-Postgres excuse lifecycle.

## What changed

**Route injection (new suites, 25/25 contract paths covered)**
- `attendanceOccRoutes.integration.test.ts` — `PUT /:id` with a matching token (forwarded as `1`, 200),
  malformed token (400, no write), stale token (409 `stale_write`), viewer (403); bulk passes mixed
  token/no-token rows through untouched; create rejects a strict-body violation before any write.
- `attendanceSetupAndDays.integration.test.ts` — check-in ingestion (200 + per-row report, 400 for an
  invalid row), roster requires class/date, marked-dates, widget aggregates, day submission
  GET/submit/reopen (200/403), preferences GET, and the lookups `422 attendance_half_day_disabled`.
- `attendanceAdminRoutes.integration.test.ts` — leaves list/review/cancel (+403), absence alerts
  list/resolve, bulk restore, lookups + field config reads, chronic-absence scan queued (202) and
  matrix export queued (202) with an inverted range rejected **before** enqueue.

**Concurrency + atomicity (real Postgres, `attendanceOccConcurrencyDb.integration.test.ts`)**
- Two saves carrying the same version: exactly one wins, the other 409s, final version 2, one row.
- Mixed-token batch with one stale row: whole batch rejects and **nothing** is written (row A keeps
  `present`/version 1) — the rollback proof for `assertEveryRowWritten`.
- Rapid sequential toggles (`present → absent → late → half_day → present`): versions 1..5 monotonic,
  one row per student/day, final status present.
- Concurrent toggles of two students keep one row each.

**Service tier (`attendanceSetupServices.test.ts`)**
- Preferences: normalisation keeps the `trackHalfDay` default, unknown keys never reach the
  repository, save broadcasts `attendance`, missing tenant throws.
- Field config: composes stored config with preferences, returns null when unsaved.

**Excuse attachments (route level)**
- `uploadsHardening.test.ts` gained a multipart `POST /api/uploads/attachment?purpose=attendance_excuse`:
  a PDF certificate is accepted under the tenant attachment directory; an executable is rejected 400.

**Boundaries / flakiness**
- `TZ=UTC` pinned in `vitest.config.ts` and `vitest.db.config.ts`.
- `attendanceCheckInTime.test.ts` gained the accepted midnight rollover (22:30Z → next day at
  UTC+5), a just-after-midnight same-day case, future/too-old bounds, and an `America/New_York`
  DST-transition pair.

**Ratchets**
- `check-db-test-hygiene.mjs` and `check-db-test-manifest.mjs` now cover `attendance*` (8 baseline
  files, 48 cases) — a skipped or deleted attendance DB case fails CI.
- New `test:db:coverage:attendance` script + `scripts/ci/check-attendance-coverage.mjs` (scoped
  statements/functions/branches floors with `--update` to raise them after a measured run), wired
  into the DB job and `local-ci --with-db`.
- The DB job now shuffles `attendance*` files (same seed) and the repeat step is labelled
  "enrollments + attendance".
- New `scripts/ci/check-attendance-route-injection.mjs` (strict) runs in the pre-PR gates: every
  attendance contract path must appear in an `app.inject` test.

## Verification

- Backend attendance suites: **39 files / 311 tests** pass (includes the new inject and service
  suites); full backend suite **463 files / 3,181 tests**; `tsc --noEmit` clean.
- `node scripts/ci/check-attendance-route-injection.mjs --strict` → 25/25 covered.
- `check-db-test-hygiene` (17 files) and `check-db-test-manifest` (96 cases) pass with attendance
  included.
- `bash scripts/ci/local-ci.sh` — **passed** (gates incl. the new route-injection ratchet, prettier,
  frontend/shared/backend vitest).
- DB suites (`attendanceOccConcurrencyDb`, shuffled attendance DB files, coverage ratchet) are
  **CI-verified**: this machine has no PostgreSQL.

## Gap analysis — what is still missing

- **No local DB run in this environment**: the new concurrency/coverage paths are validated in CI.
  Until the first green DB job, the attendance coverage floors are intentionally low (10/10/5) and
  only catch a collapse; run `--update` and raise them.
- **Leave approval vs concurrent marking (advisory lock)** is covered by the existing use-case
  lost-race test and the DB excuse lifecycle, but not as a two-transaction race; add it if the
  approval path grows a second writer.
- **Frontend→API contract drift** (e.g. the grid now sending `version`) is covered by the shared DTO
  parity tests and the new header route tests, not by an end-to-end browser test.
- **Matrix export content** is proven at the service level; the route test proves queueing, not the
  streamed file bytes.
- **Coverage floors are module-wide**, not per-file; a per-file ratchet (like sessions) would catch a
  single route file losing all its tests.

## Recommended follow-ups (CI tightening)

1. Raise the attendance coverage floors from the first measured run and consider per-file floors for
   the route/service hotspots (`attendanceMarkUseCases`, `attendanceRecordHandlers`).
2. Add a two-transaction excuse-approval-vs-marking race to the concurrency suite once the approval
   path can run concurrently with marking.
3. Keep the route-injection ratchet strict as new attendance routes land — it is now the cheapest
   guard against an endpoint shipping with only unit-tested handlers.
