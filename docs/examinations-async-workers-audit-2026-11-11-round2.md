# Examinations Async Workers & Queue Pipelines — Round 2 (2026-11-11)

**Scope.** BullMQ processors, idempotency/retry safety, graceful shutdown/locking and DLQ behaviour
for the Examinations module, plus the four pipelines the brief names (bulk result compilation, term
GPA/rank aggregation, batch report-card PDFs, publication notifications).

**Method.** Read the runner registry, all four examination runners, the queue configuration/dispatch,
the worker daemon and both sandboxed processors, the job store/patch/orphan-cleanup/replay tooling, the
enqueue routes and the BullMQ child-pool/worker lifecycle in the installed version. Re-ran the queue,
runner, DLQ, shutdown and integration suites.

## What exists vs the brief

| Brief pipeline | Reality |
|---|---|
| BullMQ processors | **Four** examinations runners: `export` (exam CSV), `import` (exam CSV), `marks-import`, `results-export` (broadsheet CSV). A single-student `students:render-report-card` PDF runner exists for the document engine. |
| Bulk result compilation | **Absent** — finalisation is a synchronous CAS; grades/ranks are read-time. |
| Term GPA / rank aggregation | **Absent** — no persisted aggregate table or job. |
| Batch report-card PDFs | **Absent** — cards print client-side; no batch job. |
| Publication notifications | **Absent** — `notifyOnResult` has no consumer; `publishExamResults` enqueues nothing. |

## Verified sound

- Deterministic job ids/keys (`tenant:user:key`, canonical payload SHA-256), deterministic exam ids
  and mark ids, OCC tokens on every mark write → replays upsert instead of duplicating; the marks
  audit skips unchanged marks (`buildMarksAuditDelta`), so retries do not duplicate audit evidence.
- Per-kind budgets (10 min CSV, 5 min marks/broadsheet), deadline + shutdown signals, 5 s settle,
  60 s BullMQ lock, 60 s heartbeat, boot-time orphan sweep, 1 MB payload ceiling, tenant fair-share.
- Every runner aborts per page/chunk; each chunk is one short transaction (no lock held across the
  job; an in-flight chunk rolls back if the process is killed).
- Final-attempt failures dead-letter (`deadLetteredAt`), the exams module writes a
  `job_dead_letter` audit row, and the ops replay tool re-enqueues with `replaceExisting`.

## Findings

| # | Sev | Finding | Status |
|---|---|---|---|
| Q1 | **P2** | All examination jobs shared `bulk-export` (concurrency 2) with every module's CSV work; two long examination jobs could starve all exports and vice versa, and a marks import (writes) queued behind unrelated exports. | **Fixed** — dedicated sandboxed `QUEUE_EXAMINATIONS` (concurrency 2, priority 2); queue boot already derives from `QUEUE_SETTINGS`. |
| Q2 | **P2** | The sandboxed queues were created without `maxStalledCount` (BullMQ default 1), so a restart-induced stall could permanently fail a job despite its 3-attempt budget. | **Fixed** — shared sandbox options: `maxStalledCount: 3`, `stalledInterval: 30s`, `lockDuration: 60s`. |
| Q3 | P3 | A killed worker leaves the tenant in-flight counter (Redis, 1 h TTL) inflated, deprioritising the tenant until expiry. | **Documented** (TTL-bounded, no correctness impact). |
| Q4 | **P1** | **Sandboxed children ignored shutdown.** The daemon aborted the parent's controller; the child has its own module instance and never saw it. Long jobs ran until the force-exit (75 s) killed the parent, leaving the DB row `running` (15-min orphan sweep) and allowing a stalled retry to overlap. | **Fixed** — a sandbox shutdown installer aborts the child's controller on SIGTERM/SIGINT (the pool's SIGTERM on force-close), and the daemon force-closes sandboxed workers (`close(true)`) after abort so children are signalled immediately. Runners observe the abort at the next page/chunk; the in-flight chunk rolls back; the row is failed/retryable. |
| Q5 | P2 | The exam CSV export had no abort check inside its page loop, and the per-row fallback loops (exam import, marks import) did not abort-check either. | **Fixed** — the export builder takes the signal and checks per page; both fallback loops check abort per row. |
| Q6 | P3 | The shutdown budget (75 s) is shorter than the 5–10 min job budgets. | **Documented** — interrupt + retry is the intended behaviour, not draining 10-min jobs. |
| Q7 | **P1** | **A failed examination job was unrecoverable from the product.** Idempotent routes returned the existing `failed` job (`202`) forever; the tray only dismisses; the replay script needs `deadLetteredAt`. | **Fixed** — `retryFailedBackgroundJob` resets a failed/dead-lettered row and re-dispatches with `replaceExisting`; the four examination enqueue paths auto-retry a failed job with the same key (runners are replay-safe). |
| Q8 | **P2** | A same-key/different-body marks import was silently dropped: the route did not compare the stored payload for a caller-supplied idempotency key. | **Fixed** — compares stored `examId`+`rows` → `409 exam_marks_import_conflict`; a finished job whose payload was discarded (PII minimisation) is also a 409 for a custom key. |
| Q9 | **P2** | Stale broadsheet artifacts: the export key was `examId` only, so a re-export after corrections returned the old artifact until dismissed. | **Fixed** — the key includes a marks fingerprint (`count`, `max(updated_at)`); a double click dedupes, a changed exam creates a fresh export. A fingerprint read failure falls back to a unique nonce (never blocks). |
| Q10 | **P2** | Double-submit race: both requests saw no row, both inserted the same id → unique violation → 500. | **Fixed** — `createDatabaseBackgroundJob` inserts `ON CONFLICT DO NOTHING` and the enqueue returns the winner's job. |
| Q11 | **P2** | Concurrent marks imports for the same exam churned OCC `stale_write` errors and duplicated work. | **Fixed** — enqueue guard: a fresh `pending|running` marks-import for the exam (tenant-wide) → `409 exam_marks_import_in_progress`. |
| Q12 | P3 | The CSV-export idempotency check compared only `query`; a reused key with different columns returned the wrong artifact. | **Fixed** — compares query/columns/filename/allowDeleted/viewerRole and includes viewerRole in the key. |
| Q13 | **P2 (security)** | `GET /api/background-jobs/:id` and `/:id/download` used a getter that ignored `userId`; `PUT /:id` could overwrite another user's job row. | **Fixed** — the getter is owner-scoped (caller or effective identity); the PUT requires ownership (404 otherwise). |
| Q14 | P3 | `BACKGROUND_JOBS_MAX_PER_USER` was only a list limit; no creation cap. | **Fixed** — enqueue enforces the retained-job cap → `429 background_job_limit`. |
| Q15 | P2 | DLQ handling works, but stalled jobs bypassed retries and killed sandbox children left `running` rows until the 15-min sweep. | **Fixed by Q2/Q4/Q7** (restart-tolerant stalls, prompt abort, product retry). |
| Q16 | P3 | A permanently failed marks import leaves the DLQ audit (job id) but no per-exam summary. | **Documented** (DLQ audit is the evidence; the retry produces the summary). |

## Implemented in this change set

- Queue topology: `QUEUE_EXAMINATIONS`, `SANDBOXED_*` sets, `sandboxedWorkerOptions()`, mapping, worker
  branch, force-close on shutdown.
- Shutdown/abort: sandbox SIGTERM/SIGINT installer; export-builder signal; abort checks in both
  row-by-row fallbacks and the exam CSV export pager.
- Recovery/idempotency: `retryFailedBackgroundJob`; conflict-safe `createDatabaseBackgroundJob`;
  marks-import payload binding + live-import guard; marks fingerprint export key; full CSV-export
  payload binding; quota error (429).
- API integrity: owner-scoped job reads and PUT ownership.
- New tests: queue mapping/stall policy; sandbox SIGTERM abort; failed-job retry helper; route
  idempotency/recovery (retry, conflict, unverifiable finished key, live-import 409, fingerprint key
  change, 429); export abort; background-job ownership.

## Deferred designs (absent pipelines)

- **Result compilation** — dedicated queue, `pg_advisory_xact_lock(exam)` + versioned aggregate row,
  idempotent by `(exam, version)`; enqueue on publish/unpublish.
- **GPA/rank aggregate** — persisted table recomputed on publication transitions, ranks from the
  shared `rankResults` engine.
- **Batch report cards** — `QUEUE_PDF_RENDERING`, one job per student chunk, idempotent by
  `(exam, student, template-version)`, artifacts via the existing store.
- **Publication notifications** — enqueue on publish; per-recipient claim in the message log;
  retries through `messaging-broadcast`; `notifyOnResult` gains its first consumer.
- **Export snapshot isolation** — a repeatable-read read transaction (or a documented
  point-in-time stamp) so a concurrent correction cannot produce a mixed CSV.
- **Per-exam import advisory lock** — a cross-worker lock in addition to the enqueue guard.
- **Inflight-counter reconciliation** on stalled/orphaned jobs (beyond the 1 h TTL).

## Verification

```bash
pnpm typecheck
pnpm --filter mms-backend test          # 497 files / 3549 tests
pnpm --filter @mms/shared test          # 269 files / 2141 tests
pnpm --filter mms-frontend test         # 1192 files / 4489 passed (2 skipped)
pnpm --filter mms-backend test:db       # 83 files / 434 passed (1 skipped)
node scripts/check-examinations-test-matrix.mjs
node scripts/ci/check-examinations-route-injection.mjs
pnpm check:docs && pnpm check:i18n
```
