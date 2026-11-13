# Examinations Async Workers & Queue Pipelines Audit — 2026-11-11

> **Round 2 (same day):** re-audited after the import/export and later rounds. Examination jobs now
> have a dedicated sandboxed queue; sandboxed children abort on SIGTERM and the worker force-closes
> them on shutdown; failed jobs auto-retry from every examination enqueue path; idempotency keys are
> bound to the payload and broadsheet keys include a marks fingerprint; a same-exam import guard,
> background-job quota and owner-scoped reads were added. See
> [examinations-async-workers-audit-2026-11-11-round2.md](./examinations-async-workers-audit-2026-11-11-round2.md).


**Scope:** BullMQ processors, idempotency/retry safety, DLQ behaviour, graceful shutdown, and the
examination-specific pipelines the brief named.

> **Status update (later same day):** the missing `examinations:export` / `examinations:import` runners were added, together with a marks importer (`examinations:marks-import`) and a broadsheet exporter (`examinations:results-export`). See [examinations-import-export-analytics-audit-2026-11-11.md](./examinations-import-export-analytics-audit-2026-11-11.md).

**Headline:** three of the four named pipelines **do not exist** — results are computed synchronously
at read time, so there is no compilation job, no persisted GPA/rank aggregate, no batch report-card
PDF job and no publication-notification job. What *does* exist is the shared CSV export/import
pipeline, and for Examinations it was **permanently broken**: both routes gate on
`hasBackgroundJobRunner("examinations:<kind>")` and no runner was ever registered, so every request
answered **503** while the UI kept offering the import dialog.

## Findings

| # | Sev | Finding | Fix |
|---|---|---|---|
| W1 | — | No bulk result compilation, GPA/rank aggregation, batch report-card PDF, or publication notifications. `notifyOnResult` has zero consumers; exam cards print client-side (typst). | Documented with designs; not built (approved scope) |
| W2 | **P1** | `examinations:export` / `:import` had no runner → 503 for every export/import. | Registered both runners (`backgroundJobExaminationsRunners.ts`) |
| W3 | P1 | No timeout budget for `examinations:*` → the sandbox's 60 s ceiling would kill a large export/import. | 10-minute, env-overridable budgets (`EXAMINATIONS_EXPORT_TIMEOUT_MS` / `…_IMPORT_…`) |
| W4 | P1 | **DLQ replay could silently no-op**: the replay script re-added the same BullMQ job id while the failed job was still retained (24 h), so BullMQ deduped it and the DB row was reset to `pending` for nothing. | `dispatchJobToQueue({ replaceExisting })` removes the retained job first; the replay script uses it |
| W5 | P2 | Orphan-recovered jobs (`workerOrphanCleanup`, heartbeat lost) were marked failed but **not dead-lettered**, so the replay tool refused them. | They now set `dead_lettered_at` and are replayable |
| W6 | P2 | No examinations parity in DLQ handling (a failed import would mutate grades with only a row marker). | An `exams` audit event (`tag: examinations.job.dead_letter`) is written on permanent failure |
| W7 | P2 | Duplicate clicks create separate jobs (job id = DB row id). | Import mapping uses a **deterministic exam id** (`name|subject|date` hash) through the guarded upsert, so replays/duplicates upsert instead of duplicating |
| W8 | — | Queue starvation: all non-PDF/messaging jobs share `bulk-export` (concurrency 2). | Exams exports are bounded; a future compilation job needs its own queue (documented) |
| W9 | ✅ | Shutdown/abort: per-kind deadline (`AbortSignal.any`), 5 s settle, force-exit budget, `lockDuration` 60 s, `maxStalledCount` 2, 60 s DB heartbeat, 15 min orphan reclaim. | unchanged |
| W10 | note | Exams are never retention-purged (`retentionDays: null`); the purge worker covers message logs/attendance only. | documented |

## Implemented

- `packages/shared/src/examinations/examinationsExportUtils.ts` — column catalogue + row builder
  (exam metadata only; **marks never leave through the exam CSV**).
- `services/examinationsExportService.ts` — paged reads (500/page, 10k cap), same catalogue as the route.
- `services/examinationsImportService.ts` — deterministic ids, chunked apply with per-row error
  attribution, abort-aware progress.
- `services/backgroundJobExaminationsRunners.ts` + registration in `registerDefaultBackgroundJobRunners`.
- `worker/queues/replaceRetainedJob.ts` + `dispatchJobToQueue({ replaceExisting })` + replay script.
- `worker/queues/deadLetter.ts` examinations audit; `workerOrphanCleanup` dead-letter flag.
- Queue budgets in `queueConfig.ts`.

## Tests

`examinationsJobRunners.test.ts` (registration, budgets, paged CSV, no marks in the export,
deterministic id, row validation, idempotent upsert), `examinationsDeadLetter.test.ts`,
`replaceRetainedJob.test.ts`.

## Designs for the absent pipelines (deferred)

1. **Result compilation** — dedicated queue; per-exam `pg_advisory_xact_lock`; versioned aggregate row
   so two compilations cannot diverge; idempotent by `(exam_id, compilation_version)`.
2. **GPA / rank aggregate** — persisted table + recompute job triggered on publish/unpublish; ranks
   from the shared `rankResults` engine (competition ranking), never re-derived per request.
3. **Batch report cards** — reuse `QUEUE_PDF_RENDERING` (kind contains `report-card`), one job per
   student chunk, artifacts via the existing export-artifact store.
4. **Publication notifications** — enqueue on publish; per-recipient claim via the messaging log
   (idempotent), retried through the existing `messaging-broadcast` queue.
