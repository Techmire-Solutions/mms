# Question Bank Background Jobs & Queue Pipelines Audit (2026-11-12)

**Scope.** BullMQ job processors, idempotency/retry safety and graceful shutdown for the Question
Bank module: bulk question import/export, the orphaned-media attachment sweep, and the (requested)
post-exam item-analysis rollup.

**Method.** Read the worker bootstrap and shutdown path, queue settings and mappings, the runner
registry, the enqueue/retry/dead-letter code, the retention scheduler, the attachment sweep and the
Question Bank routes that call `hasBackgroundJobRunner`; then exercised the routes and helpers with
targeted tests.

## 1. Job processors

| # | Sev | Finding | Resolution |
|---|---|---|---|
| Q1 | **P1** | **No Question Bank processors existed.** Nothing registered `questionBank:import`/`:export`, so both routes answered **503** and the shipped `QuestionBankCsvImportDialog` posted to a dead endpoint. | Registered sandboxed export/import runners (`backgroundJobQuestionBankRunners.ts`); both routes now enqueue and return 202. |
| Q2 | **P1** | **Item-analysis rollups do not exist.** No `question_statistics` table, no job, no trigger. `usageCount` is a per-request correlated count; pass rate is per-request; empirical difficulty is never computed. | Deferred with a decision-complete design (§4) — there is no consumer for a persisted table yet. |
| Q3 | **P1** | **The media sweep is not a job.** It runs inline in the daily retention timer, so it has no job record, no retry, no DLQ and no abort. It is naturally idempotent (references loaded before any unlink, 24 h age floor, `ENOENT` tolerated). | Kept the timer (a cross-tenant sweep does not fit the tenant-scoped job model) but made it abort-aware and drained on shutdown (§3). |
| Q4 | **P1** | A Question Bank job would have landed on the shared `bulk-export` queue (concurrency 2) with the **60 s** default budget and been killed mid-import. | New `question-bank` queue (concurrency 2, sandboxed child), `resolveQueueNameForJob` mapping, and 10-minute budgets for import/export/analysis. |
| Q5 | **P2** | **DLQ gap:** `handleDeadLetterJob` covered hasanat, examinations, messaging and sessions-promote but had no `questionBank` branch, so a permanently failed import left no audit row. | Added the branch (`questionBank.job.dead_letter` audit row on `questions`). |
| Q6 | **P2** | The transfer row carries `status`; honoring it would let an author with `questionBank.write` CSV-import **approved** questions, bypassing the approver gate. | The mapper ignores `status`; every imported row is forced to `draft` (tested). |
| Q7 | **P2** | The transfer schema (`title/category/points/explanation`, `intermediate`, `open-ended`) does not match storage (`text/marks/answer`, `medium`, `short`); a naive runner would fail every file. | One pure mapper (`transferRowToQuestionInput` / `questionToTransferEntity`) normalises aliases, rejects choice types and round-trips export → import. |

## 2. Idempotency & retry safety

| # | Verdict |
|---|---|
| I1 | **PASS** — route-level idempotency is content-addressed: `buildDeterministicJobKey` (SHA-256 over sorted JSON) → `buildBackgroundJobId(tenant,user,key)` → `background_jobs.id` **and** the BullMQ `jobId`; `onConflictDoNothing` returns the existing job; the same key with different rows is a 409; a finished job whose payload was discarded is a 409. A double submit cannot enqueue twice. |
| I2 | **PASS** — 3 attempts with exponential backoff; `maxStalledCount` 2 (in-process) / 3 (sandboxed); 60 s lock renewed by the parent; `replaceExisting` clears the retained job before an ops replay (otherwise the id would dedupe the re-enqueue). |
| I3 | **PASS** — the DB row is the durable record (`deadLetteredAt` indexed), Redis keeps 500 failed jobs for 24 h, `scripts/replay_dead_letter_job.ts` refuses non-dead-lettered rows, and `cleanupOrphanedJobs` fails stale `running` (>15 min without heartbeat) and stale `pending` (>10 min) rows at startup. |
| I4 | **FIXED for the module** — import rows now get deterministic ids `q-imp-<sha256(tenant:jobId:index)>`, so a retry, a stall recovery or an ops replay upserts the same rows. Verified by a DB test: two runs of the same job leave exactly one question and one `CREATE` audit row. |

## 3. Graceful shutdown

| # | Verdict |
|---|---|
| S1 | **PASS** — BullMQ jobs receive `AbortSignal.any([timeout, shutdown, external])`; `runWithJobDeadline` races the runner and waits 5 s for it to unwind; `worker.pause(true)` stops intake; sandboxed children are force-closed (SIGTERM to the child); the 75 s force-exit sits under PM2's 90 s `kill_timeout`. |
| S2 | **FIXED** — the retention cycle was not tracked. It now has a controller and an in-flight promise; shutdown calls `abortAndDrainRetentionCycle()` (≤5 s) before closing the queue/DB/Redis pools. `runAttachmentSweep` checks the signal before loading references, before each tenant and every 25 unlinks; a failed/aborted reference load never deletes. |
| S3 | **FIXED** — the manual `purge:orphaned-attachments` script now takes the same `LEADER_LOCK_RETENTION_PURGE` lease as the nightly cycle, so two full sweeps cannot race. |

## 4. Stall / starvation

| # | Verdict |
|---|---|
| X1 | **PASS** — fair-share inflight counters carry a 1 h Redis TTL (leaks self-heal); `stalled` events are logged; `maxStalledCount > 1` deliberately retries after a deploy force-close. |
| X2 | **FIXED** — Question Bank now has its own sandboxed queue, so an import cannot be starved by, or starve, another module's export. |

## 5. What shipped

- `QUEUE_QUESTION_BANK` (`question-bank`), sandboxed, concurrency 2, plus 10-minute
  `questionBank:import`/`:export` (and reserved `:item-analysis`) budgets and the queue mapping.
- `questionBankTransferMapping.ts` — the pure, symmetric CSV mapper.
- `questionBankExportService.ts` — paged, tenant-scoped CSV export using the transfer schema.
- `questionBankImportJobService.ts` — chunked (50), abort-aware import with deterministic ids, draft
  status, per-row error reporting and progress.
- `backgroundJobQuestionBankRunners.ts` — registered in `registerDefaultBackgroundJobRunners()`.
- `questionBank.job.dead_letter` audit branch.
- Abort-aware sweep + retention drain + leased manual script.

## 6. Deferred — item-analysis rollup

No consumer exists yet (usage/pass rate are computed on demand). Target design:

```sql
CREATE TABLE question_statistics (
  workspace_subdomain text NOT NULL REFERENCES workspaces(subdomain) ON DELETE CASCADE,
  question_id text NOT NULL,
  usage_count integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  correct_count integer NOT NULL DEFAULT 0,
  pass_rate numeric(5,2) NOT NULL DEFAULT 0,
  difficulty_index numeric(5,4) NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_subdomain, question_id),
  FOREIGN KEY (workspace_subdomain, question_id)
    REFERENCES questions (workspace_subdomain, id) ON DELETE CASCADE
);
ALTER TABLE question_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_statistics FORCE ROW LEVEL SECURITY;
```

Runner `questionBank:item-analysis` recomputes per question from `test_questions` (usage) and
`assessment_answers ⋈ assessment_results` (attempts, average `score`/`marks`), chunked and
abort-aware; a full recompute is idempotent, so retries cannot corrupt counters. Enqueue after
`scoreResultsForTenant` and after `setTestPublished`, keyed to the paper.

## 7. Verification

```bash
pnpm typecheck
pnpm --filter @mms/shared test
pnpm --filter mms-backend test
pnpm --filter mms-backend exec vitest run --config vitest.db.config.ts \
  src/__tests__/db-integration/questionBankPersistenceDb.integration.test.ts
pnpm --filter mms-frontend test
bash scripts/ci/local-ci.sh
```

New suites: mapper round-trip/aliases/rejections, import determinism + abort + progress, export
columns/escaping/paging/abort, queue mapping and budgets, dead-letter audit, sweep abort, retention
drain, and the DB import-idempotency proof (one CREATE row after two runs).

## 8. Assumptions

- CSV import supports the non-choice types only; choice questions keep the authoring form.
- The category column is the module's free-text category id (no subject model).
- Imported questions are always drafts; approval stays permissioned.
- Export remains approver-gated because it contains the answer key.
