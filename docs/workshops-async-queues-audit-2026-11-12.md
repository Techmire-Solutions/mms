# Workshops Async Workers & Queue Pipeline Audit — 2026-11-12

**Printables/analytics:** templates, exports and reporting queries are audited in
[workshops-printables-analytics-audit-2026-11-12.md](workshops-printables-analytics-audit-2026-11-12.md).

**Shared contracts:** DTOs, enums and Zod/static alignment are audited in
[workshops-shared-contracts-audit-2026-11-12.md](workshops-shared-contracts-audit-2026-11-12.md).

**Frontend/state:** page hierarchy, query invalidation and form UX are audited in
[workshops-frontend-state-audit-2026-11-12.md](workshops-frontend-state-audit-2026-11-12.md).

**Tests/CI:** coverage, concurrency and ratchets are audited in
[workshops-test-audit-2026-11-12.md](workshops-test-audit-2026-11-12.md).

**Scope:** BullMQ processors/queues/schedulers touching Workshops — reminder notifications, waitlist
promotion alerts, certificate/feedback dispatch, bulk participant imports — plus the generic job
seams they would use: id determinism, retry/backoff, dead letters, orphan recovery and graceful
shutdown. Sixth in the series; companions:
[schema](workshops-schema-persistence-audit-2026-11-12.md),
[lifecycle](workshops-domain-lifecycle-audit-2026-11-12.md),
[subsystems](workshops-subsystems-audit-2026-11-12.md),
[API](workshops-api-layer-audit-2026-11-12.md),
[security](workshops-security-audit-2026-11-12.md).

**Method:** repository-wide search of `apps/backend/src/worker/**`, the background-job registry,
queue config/resolution, DLQ/replay/orphan code, the messaging claim pattern and the workshop write
paths; then targeted unit, route and real-Postgres tests for the new `workshops:import` job.

## 1. The headline finding

**The Workshops module had no asynchronous processing at all.** No BullMQ worker, scheduler or
runner referenced `workshop`; `registerDefaultBackgroundJobRunners` registered every other module
but not workshops. Therefore:

| Requested pipeline | State before this change |
|---|---|
| Pre-workshop reminders | **Absent** — no scheduler, job kind, template or settings |
| Waitlist promotion alerts | **Absent** — promotion is synchronous in the seat transaction and surfaced only in the API/toast |
| Post-workshop feedback dispatch | **Absent** — no feedback table/endpoint exists |
| Certificate dispatch | **Absent as a job** — issuance only stamps `certificate_issued_at`; certificates print client-side |
| Bulk participant imports | **Synchronous** — one request transaction for 1–100 contacts, no progress/retry/DLQ |

So there were no workshop retries to duplicate — and no idempotency, abort or DLQ protection for the
first workshop job added. This audit closes the generic gaps and gives the module its first real
queued flow (`workshops:import`), then documents the notification pipelines as product-gated designs.

## 2. Findings and remediation

### Queue seams (generic)

| # | Sev | Finding | Status |
|---|---|---|---|
| Q1 | P1 | Unknown module kinds fell into the shared **`bulk-export` sandboxed queue** with the 60 s default budget — a large workshop import would be killed, and a reminder would be sandboxed needlessly | **Fixed** — dedicated in-process `workshops` queue; `workshops:import` gets a 10-minute budget |
| Q2 | P1 | `backgroundJobModuleAction` mapped only export/import/collect/promote/dispatch; `reminder`, `waitlist-alert`, `certificate-dispatch`, `feedback-dispatch` would be re-authorized as **read** at execution | **Fixed** — all mutating workshop kinds map to `write` (tested) |
| Q3 | P1 | **No workshops DLQ audit branch** — a permanently failed workshop job would leave only a row marker | **Fixed** — `handleDeadLetterJob` writes a `workshops.job.dead_letter` audit row (`workshop_events`) |
| Q4 | P1 | **Stale-pending jobs were unreplayable**: orphan cleanup marked them failed without `deadLetteredAt`, and the replay tool refuses such rows | **Fixed** — pending cleanup sets `deadLetteredAt`; unit-tested |
| Q5 | P2 | Global retry budget is `attempts: 3, 1 s exponential` (~7 s) — too short for a DB blip on an import | **Fixed for imports** — `dispatchJobToQueue` gives `workshops:import` 30 s exponential backoff, like rollover |
| Q6 | P2 | No dedicated queue → export starvation / shared concurrency | **Fixed** — `QUEUE_WORKSHOPS` (concurrency 2), auto-instantiated from `QUEUE_SETTINGS` |
| Q7 | P2 | No DLQ depth/health surface (logs + owner tray + CLI only) | **Deferred D3** |
| Q8 | — | Positive: deterministic ids (`buildDeterministicJobKey`/`buildBackgroundJobId` + `onConflictDoNothing` + BullMQ `jobId`), per-recipient send-once (`buildMessageLogClaimId` + atomic claim), heartbeat/orphan cleanup, signal + deadline + settle, append-only audit | — |

### The new `workshops:import` job

- **Endpoint:** `POST /api/workshops/:id/participants/import` (`202 {job}`), write permission,
  1–5,000 unique contacts. The synchronous `/:id/participants/bulk` (1–100, all-or-nothing) is
  unchanged for small interactive batches.
- **Idempotency (two layers):**
  1. `buildBackgroundJobId(tenant, user, buildDeterministicJobKey({moduleId:"workshops",
     kind:"import", payload:{workshopId, contactIds}}))` — double submit/HTTP retry returns the
     existing job (tested); the `background_jobs` PK is the backstop.
  2. Row-level skip: each chunk reports already-registered contacts as `skipped` and never inserts
     twice, so a BullMQ retry after a partial run continues instead of duplicating.
- **Shutdown/abort:** `ctx.signal` is checked before every chunk **and every row**; each chunk (100
  contacts) is its own transaction under the workshop row lock, so an abort rolls back only the
  in-flight chunk and releases locks immediately. Committed chunks stay; progress is monotonic.
- **Stall/failure:** dedicated queue, 10-minute deadline, 30 s exponential retries, orphan cleanup,
  dead-letter audit and the existing replay tool. Per-row failures (archived contact, full workshop)
  are reported as bounded `errors` on the job rather than retried forever.
- **Correctness fix found while testing:** a bulk import previously gave every waitlisted row the
  same `waitlisted_at`, so queue order tie-broke on random participant ids. Import chunks (and the
  synchronous bulk path) now offset the timestamp per row, preserving input order as queue order —
  covered by the DB test.
- **Audit:** every inserted participant writes the same `CREATE` audit row as interactive
  registration (`operation: "bulk_import"`), inside the chunk transaction.

## 3. Queue stall / duplicate / DLQ assessment

- **Stall:** workshop imports no longer compete with exports; concurrency 2, 60 s lock, 30 s
  stall check, chunked short transactions. The dedicated queue is DB-bound (no child process), so a
  slow import cannot exhaust the sandboxed export pool.
- **Duplicate hazard:** job identity is content-based, and the runner is row-idempotent. For the
  (deferred) notification jobs, the design reuses the messaging claim key
  `buildMessageLogClaimId(jobId, contactId, channel)` — claim-before-send, so retries and worker
  restarts cannot send twice.
- **DLQ:** workshop failures now mark `dead_lettered_at`, write an audit row, log with tenant/job
  context, and are replayable via `replay_dead_letter_job` (including the previously stranded
  stale-pending case). DLQ *visibility/alerting* remains deferred (D3).

## 4. Deferred notification pipelines (decision-ready, product-gated)

Implementing these requires copy/templates, channel consent and (for feedback) a new domain model;
guessing them would be a compliance risk.

- **Reminders (D1):** leader-only hourly `workshopReminderScheduler` using the
  `attendanceAbsenceScheduler` pattern (leader lease + per-workspace `statement_timeout` + sweep
  budget); select `open` workshops starting tomorrow in the workspace timezone; enqueue
  `workshops:notify` keyed `workshop-reminder:{workshopId}:{startDate}`; runner dispatches through
  the existing messaging runner whose per-recipient claim guarantees send-once. Copy from a Setup
  field with locale fallbacks.
- **Waitlist alert (D1):** after the promotion transaction commits (`runAfterCommit`), enqueue
  `workshops:notify-waitlist` keyed `workshopId:participantId:promotedAt`; never do I/O under the
  event lock.
- **Certificate dispatch (D2):** needs a server-side certificate template/PDF (today only FE HTML)
  and a channel decision; per-participant key `workshopId:participantId`.
- **Feedback (D4):** requires a `workshop_feedback_requests` model + post-end-date scheduler + survey
  responses; no existing object to reuse.

All of them would follow the same abort/claim pattern: check `ctx.signal` per recipient, claim before
send, flush outcomes before the abort guard, `throwIfAborted` at the end, and rely on the job-level
deadline/retry/DLQ.

## 5. Verification

```bash
pnpm --filter @mms/shared typecheck && pnpm --filter mms-backend typecheck && pnpm --filter mms-frontend typecheck
pnpm --filter @mms/shared test     # 280 files / 2269 tests
pnpm --filter mms-backend test     # 520 files / 3681 tests
pnpm --filter mms-frontend test    # 1206 files / 4535 passed (2 skipped)
# workshop DB suites: 71 tests (9 files), including the new queued-import chunk test
# capacity + waitlist concurrency files remain green (5×)
pnpm run check:code-norms check:backend-structure check:backend-boundaries check:i18n check:migration-indexes
```

New tests: import runner (chunk/progress/errors/abort/idempotent retry/invalid payload), import route
(202, double-submit dedupe, 400/403/404/503), chunk repository (seat/waitlist order, retry skip,
per-row failures, audit), queue seams (action/queue/timeout), workshops DLQ audit, orphan pending
replayability. No schema/migration change.

## 6. Deferred

- **D1** reminder + waitlist-alert notification jobs (design above; templates/Setup/consent).
- **D2** certificate dispatch (server-side certificate PDF/template).
- **D3** DLQ depth/queue-health admin surface and alerting.
- **D4** feedback requests/survey model.
- **D5** converting the synchronous 1–100 bulk endpoint to the queued flow (kept for compatibility).
