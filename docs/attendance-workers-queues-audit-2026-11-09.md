# Attendance Async Workers, Queues & Scheduled Aggregations — Audit + Hardening

**Date:** 2026-11-09 · **Scope:** every asynchronous attendance path — BullMQ jobs, the scheduled
absence sweep, notification delivery, retries/DLQ, and the (absent) rollup aggregations.

**Method:** enumerated the queues, their processors and defaults; traced each attendance enqueue call
to a registered runner; read the sweep's scheduling and locking; and followed the notification path
from the scan to the stored row.

**Headline:** three paths were broken or unsafe. The attendance **CSV export and import enqueued jobs
with no runner at all** — every one answered 202, failed three attempts later and dead-lettered. The
hourly absence sweep was a bare `setTimeout` holding a session advisory lock for the whole sweep, so
one hung workspace could wedge it globally. And the scan **notified before stamping its marker**, so a
crash duplicated notifications while a failed insert silenced them forever.

## Findings

### 1. Absence dispatch on roster submission

| # | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| W1 | **High** | Roster submission never notifies anyone. `submitAttendanceDay` locks and audits; the settings that imply otherwise — `notifyParents`, `attendanceAlerts` — are **dead**: normalised, audited and displayed, but nothing reads them to send a message. | `attendanceLeaveUseCases.ts:40-77`, `attendanceSetupWriteHandlers.ts:35` | **Documented + copy corrected** — the toggle now states it is in-app only (4 locales) |
| W2 | **High** | The only attendance notification producer was the hourly streak sweep — a `setTimeout` loop, **not a job**: no retry, no DLQ, no job record, invisible on failure. | `attendanceAbsenceScheduler.ts` | **Fixed** — the manual trigger is now a BullMQ job (`attendance:absence-scan`) |
| W3 | **Medium** | No SMS/email/push transport exists for attendance. | `notificationsUseCases.ts` | **Accepted** — in-app only, consistent with the earlier escalation decision |

### 2. Daily rollups

| # | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| W4 | Info | **No rollup jobs, materialised views or cron precompute exist** for attendance percentages, streaks or health metrics. Percentages are computed per request from the countable SQL; the command metrics are Redis-cached for 60 s; streaks are computed by the sweep; reports aggregate per request. Nothing to audit for staleness — and no double-truth. | `crudQueryRoutes.ts:21,79`, `attendanceReportAggregates.ts` | **Documented decision** — see "Rollup rule" below |

### 3. Idempotency, retries, DLQ

| # | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| W5 | **Critical** | **Attendance CSV export and import enqueued `attendance:export` / `attendance:import` with no registered runner.** `registerDefaultBackgroundJobRunners` covered contacts, students, sessions, enrollments, users, messaging, tasks, faculty and finance — not attendance. Every job failed 3× and dead-lettered *after* the API returned 202. | `attendanceExportRoutes.ts:19-38`, `backgroundJobRunnerService.ts:79-240`, `backgroundJobWorkerService.ts:126-134` | **Fixed** — export runner + builder registered; any module without a runner now refuses at enqueue time (503) |
| W6 | **High** | The manual scan ran the full tenant sweep **inline inside the HTTP request**: no retry, no DLQ, no deadline, no job record. | `attendanceEscalationHandlers.ts:57-78` | **Fixed** — returns 202 with a queued job |
| W7 | **High** | A hung workspace wedged the sweep: the leader lease is a **session advisory lock** on a checked-out pool connection held for the entire sweep, and the timer rescheduled only in `.finally`. One never-returning query → lock held forever, no further tick. | `attendanceAbsenceScheduler.ts`, `leaderElection.ts:29-58` | **Fixed** — per-workspace `statement_timeout` (30 s), wall-clock deadline (60 s), sweep budget, lease always released |
| W8 | **High** | **Duplicate / lost notifications**: the scan notified *then* stamped `notified_at`, and `notify()` swallowed its own failure. Crash between the two → duplicate; failed insert → permanently silent; concurrent manual + scheduled scan → both notified. | `attendanceEscalationUseCases.ts:150-200`, `notificationsUseCases.ts:28-35` | **Fixed** — atomic claim → notify with `dedupe_key` → release on failure |
| W9 | **Medium** | **Notification flooding**: one row per streak per scan, unbounded. A 300-student mass absence wrote 300 notifications at once. | `attendanceEscalationUseCases.ts:177-190` | **Fixed** — cap 100 per-student rows per scan + one dedupe-keyed summary |
| W10 | **Medium** | Per-workspace failures were swallowed with a log line; the sweep looked clean. | `attendanceAbsenceScheduler.ts:45-52` | **Fixed** — failures counted, reported in the sweep summary, logged at error level |
| W11 | **Low** | DLQ is DB-recorded and log-only; no re-drive endpoint. | `routes/common/backgroundJobs.ts:30-132` | **Accepted** — dead-lettered work is re-requested by a user; a re-drive API is a follow-up |

## What changed

**Queue correctness**
- `registerModuleCsvExportRoutes` / `registerModuleCsvImportRoutes`: **runner-presence guard** —
  `hasBackgroundJobRunner(`${moduleId}:export|import`)` is required before enqueueing; otherwise
  **503**. This fixes the whole class of "202 then DLQ", not just attendance.
- `services/attendanceExportService.ts` (new): paged export via `createModuleExportService` with a
  fixed column catalog (`attendanceExportUtils.ts`, shared), CSV streaming, JSON/XLSX cells.
- `services/backgroundJobAttendanceRunners.ts` (new): registers `attendance:export` and
  `attendance:absence-scan` from `registerDefaultBackgroundJobRunners`.
- `worker/queues/queueConfig.ts`: 10-minute budgets for both attendance kinds.
- Attendance **import** remains unsupported: the row contract is still the legacy name-based shape
  (`personName`, `className`), which cannot address ids inside a job. The route now says so with 503
  instead of enqueueing a doomed job; the redesign is the follow-up.

**Absence sweep**
- `worker/attendanceAbsenceScheduler.ts`: per-workspace `SET LOCAL statement_timeout = 30s`, a 60 s
  worker-level deadline (`withTimeout`), a 45-minute sweep budget with deferred workspaces, a counted
  failure list, and a structured summary log. The lease is always released.
- The per-workspace loop is split into `runWorkspaceSweeps(workspaces, scanOne, options)` so stall
  behaviour is testable without waiting a minute.
- `POST /api/attendance/absence-alerts/scan` queues `attendance:absence-scan` (per-workspace job,
  idempotency key bucketed per hour so double-submits collapse) and returns **202 `{job}`**; the
  contract's response changes from the inline result to the job envelope.

**Notification idempotency**
- Migration **0223**: `tenant_notifications.dedupe_key` + partial unique index
  `(workspace_subdomain, dedupe_key) WHERE dedupe_key IS NOT NULL` (keyless producers unchanged).
- `insertTenantNotification` returns whether the row is stored (dedupe-aware); `notify()` returns
  `boolean` and only broadcasts on an actual insert.
- `claimAbsenceAlertNotification` (atomic `UPDATE … WHERE notified_at IS NULL RETURNING`) →
  notify with `dedupeKey: absence-alert:<id>` → `releaseAbsenceAlertNotification` when the insert
  failed. The scan caps at 100 per-student notifications and emits one dedupe-keyed summary.

**Copy**
- `attendance.settings.notifyParentsDesc` (4 locales) now states that alerts are in-app only.

## Rollup rule (documented, not enforced by code)

Any future pre-computed attendance aggregate must state its **refresh point and staleness bound**,
because otherwise it becomes a second truth against the live countable-attendance rate. Today:
percentages live, command metrics cached 60 s, streaks from the hourly sweep, reports aggregated per
request. No rollup is added by this change.

## Verification

- `pnpm typecheck` — 6/6.
- Backend: **3,078 tests / 449 files**, including the new:
  - `attendanceJobRunners` (export + scan runners registered, no import runner),
  - `attendanceJobEnqueueGuard` (503 without a runner; 202 with one),
  - `attendanceAbsenceSweep` (timeout, failure isolation, budget deferral, capped count),
  - `attendanceAbsenceNotifications` (claim→notify→release, already-claimed, mass-absence cap),
  - `attendanceNotificationDedupeDb` (CI: one row per key, per-workspace scoping, keyless repeatable).
- Migration/journal/snapshot and index/hygiene ratchets held; docs index updated; i18n parity green.
- `local-ci` — see the run recorded with this change.

## Accepted trade-offs

- The scheduled hourly sweep stays in-process (one leader, no per-hour queue overhead); only the
  manual trigger is a BullMQ job. Converting the tick to a per-workspace job is a follow-up if
  per-workspace isolation or per-tenant retries become necessary.
- Attendance import stays unsupported until its row contract is redesigned (id-based, atomic
  chunked upsert, idempotent by natural key).
- No SMS/email/push for attendance; the UI no longer implies it.
- `markAbsenceAlertNotified` remains exported for compatibility but is no longer on the scan path —
  `claimAbsenceAlertNotification` replaced it.
- DLQ re-drive is manual (re-request); no retry endpoint yet.
