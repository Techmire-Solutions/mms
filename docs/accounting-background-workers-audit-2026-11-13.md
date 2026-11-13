# Accounting background workers & queue pipelines audit

Scope: how the Accounting module's heavy batch work is executed, how retries are made
idempotent, and whether long-running accounting work honours shutdown/deadline signals and
releases its locks. Covers period-end FX revaluation, IAS 29 hyperinflation restatement,
fiscal-year closing rollups and bulk journal/COA transfers.

Method: traced each job to its runner, queue options and transaction boundary, then proved the
behaviour with tests (unit + PostgreSQL). Findings are labelled by severity and every fix points
at evidence.

## 1. Execution map (what actually runs where)

| Operation | Path | Guardrails |
|---|---|---|
| Period-end FX revaluation | **Leader-only worker sweep** — `financeAutomationScheduler` (hourly, tenant-local) → `revalueMonthEnd` → `postFxRevaluation` | `createJobDeadline("finance","automation-revalue")` (5 min) + `runWithJobDeadline` (aborts on SIGTERM), per-workspace `withTimeout`, one run per date (unique index + advisory lock) |
| IAS 29 restatement | Same sweep → `restateMonthEnd` → `postIas29Restatement`, only when hyperinflation is enabled | Same deadline; one restatement per date |
| Fiscal-year close | **HTTP only** — `POST /fiscal-years/:id/close`, `accounting.manage` | One tenant transaction, one closing entry per year (`findEntryIdBySource`), year-end preconditions as 422s |
| Journal write (bulk) | `PUT /entries/bulk` — one HTTP transaction, draft/post gate | OCC token, unique ref/source indexes |
| Bulk journal import | **Does not exist by design**: a flat CSV cannot represent a balanced voucher. `POST /accounting/import` is a **Chart-of-Accounts** CSV import | Now queued (§4) |
| Generic BullMQ infra | Deterministic job ids (`buildBackgroundJobId`/`buildDeterministicJobKey`), attempts 3 + exponential backoff, stalled retries, DLQ (`handleDeadLetterJob`), operator replay, heartbeat, module re-check at execution | `executeJob` rethrows so BullMQ retries and a missing runner cannot look "completed" |

The month-end sweep is deliberately **not** a BullMQ job: `background_jobs.user_id` is FK-constrained
to `tenant_users`, so a scheduled accounting run has no honest actor row. The trade-off is that the
sweep has no attempts/backoff/DLQ — §3 closes that gap with catch-up + durable failure records.

Verified idempotency backstops (retry cannot duplicate a posting): `accounting_fx_revaluation_runs
(workspace, date)` unique, `accounting_ias29_runs (workspace, date)` unique, deterministic entry ids
(`je-<source>-<date>`) + `accounting_entries_workspace_source_uidx` + `findEntryIdBySource`, one
closing entry per fiscal year, COA active-code unique index, invoice period unique index.

## 2. Findings

- **W1 (P0) — the sweep posted revaluation/IAS 29 outside a transaction.** `fxRevaluationDeps`
  documents "callers run inside one tenant transaction"; the HTTP routes honour that, but
  `financeAutomationRuns` called the use cases under `runWithTenant` only. The `fx_reval:` / `ias29:`
  advisory lock lives in `lockLedgerEvent`'s own transaction, so it **released before the work**, and
  entry → reversal → run row → audit committed in four separate transactions. A crash between the
  two entries could leave a posted revaluation without its reversal (and an unlogged posting).
- **W2 (P1) — one-shot schedule window.** Steps ran only at local hour 1. A deferred/aborted/failed
  tick meant no revaluation, restatement (or billing) until the next month.
- **W3 (P1) — automated accounting failures were invisible.** Only `summary.failed` + a log line: no
  audit row, no notification, no job row, no DLQ entry. Operators learned about a failed month-end
  when the year-end close refused months later.
- **W4 (P1) — declared budgets were unreachable.** Steps declare 5 minutes but every tenant
  transaction runs under `statement_timeout = 30 s`; a large revaluation/close aggregation is
  cancelled at 30 s with `57014`, which surfaced as a generic 500.
- **W5 (P2) — no abort checks inside the use cases / no cancellation in `withTimeout`.** Shutdown
  could not stop a running posting, and a timed-out workspace kept writing while the sweep moved on.
- **W6 (P1) — the registered COA import route always answered 503** (`accounting:import` runner was
  never registered). Accounting CSV **export** is still a documented 503 (F8, out of scope: exports do
  not post journals).
- **W7 (P2) — no detection of historical partial runs** created by W1.
- **W8 (P2) — lock waits were unmapped.** Advisory/row lock contention waited out `statement_timeout`
  and surfaced as a generic 500; there was no `lock_timeout`.
- **W9 (P1, pre-existing, found while fixing W3) — the notification CHECK rejected a kind the code
  already writes.** `tenant_notifications_kind_check` was last set by 0220 to three kinds, but the
  finance sweep already inserts `finance_invoices_overdue`; `notify` swallows the insert failure, so
  overdue alerts were silently dropped.

## 3. Fixes

1. **Atomic sweep postings (W1, W5).** `revalueMonthEnd`/`restateMonthEnd` now run the whole post in
   **one** `withTenant(tenant, …, { statementTimeoutMs: budget − 30 s, lockTimeoutMs: 10 s })`, and the
   use cases take an optional `AbortSignal` (`throwIfBackgroundJobAborted` before the lock, after the
   preview and before the first write/run insert). A throw inside that transaction rolls back entries,
   reversal, run and audit together and releases the lock — matching the HTTP route path.
2. **Same-day catch-up (W2).** Boundary steps run from `localHour >= 1` and overdue from
   `localHour >= 6` on the same tenant-local date; the steps' own calendar guards keep them
   month-end/day-1 specific, and idempotency makes the retries free.
3. **Durable failure records + step isolation (W3).** A failing revaluation no longer skips the IAS 29
   step: each accounting step is isolated, a real failure appends
   `{ tag: "accounting.automation.failed" }` to the run table's audit stream (actor `system`) and
   raises one deduped notification (`accounting.read`, key
   `accounting-automation:<tenant>:<date>:<kind>`). Aborts are rethrown and count as `deferred`.
4. **Reachable budgets + retryable lock/timeout errors (W4, W8).** `withTenant` gained `lockTimeoutMs`
   (applied as `set_config('lock_timeout', …)`); the close route uses the request budget (120 s) and a
   15 s lock wait. SQLSTATE `55P03` now maps to **409 `lock_timeout`** and `57014` to **503
   `query_cancelled`**, both with retry guidance.
5. **COA import runner (W6).** `accounting:import` registered through the shared CSV import contract:
   chunked (100 rows), abort-checked, per-row error reporting, and idempotent by resolving each row's
   stored account **by code** and reusing its id — a replayed job updates instead of duplicating; the
   active-code unique index is the backstop. `balance` is ignored (opening balances go through the
   balanced opening journal).
6. **Partial-run detector (W7).** `audit:accounting-batch-runs` (read-only) reports runs with a
   missing entry/reversal or a run without its lines, exits non-zero for deploy gating.
7. **Notification kinds (W9).** Migration `0257` extends the CHECK to `finance_invoices_overdue` and
   the new `accounting_automation_failed`, with the UI sentence in all four locales.

## 4. Files changed

| Area | Files |
|---|---|
| Sweep | `worker/financeAutomationRuns.ts`, `worker/financeAutomationScheduler.ts`, `worker/sweepSupport.ts` |
| Posting use cases | `accounting/use-cases/fxRevaluationUseCases.ts`, `accounting/use-cases/ias29UseCases.ts` |
| Transaction/lock | `db/tenant-context.ts`, `db/dbTransactions.ts`, `db/tenantTransactionGuards.ts`, `lib/httpErrors.ts`, `lib/dbErrorMapping.ts`, `routes/tenant/accounting/accountingLedgerOpsRoutes.ts` |
| Import runner | `services/backgroundJobAccountingRunners.ts` (new), `services/backgroundJobRunnerService.ts` |
| Notifications | `packages/shared/src/dashboard/tenantNotifications.ts`, `apps/frontend/src/tenant/hooks/notifications/useStoredNotifications.ts`, i18n ×4, migration `0257_notification_kinds_finance_accounting.sql` + snapshot/journal |
| Ops | `scripts/audit-accounting-batch-runs.ts` (new), `apps/backend/package.json`; `.gitignore`/`.prettierignore` now exclude in-checkout `.worktrees/` (VCS internals that broke the formatting gate) |
| Tests | `financeAutomationScheduler.test.ts` (catch-up, isolation, failure record, abort), `financeAutomationRuns.test.ts` (new), `accountingBatchJobGuards.test.ts` (new), `accountingImportRunner.test.ts` (new), `db-integration/accountingCsvImportDb.integration.test.ts` (new), `db-integration/accountingFxRevaluationDb.integration.test.ts` (rollback probe) |

## 5. Documented decisions & residual risk

1. The leader-only sweep stays (no BullMQ migration for scheduled work — no honest `tenant_users` row);
   the audit row + notification are the durable DLQ substitute for scheduled accounting work.
2. Abort/deadline = deferral, not failure; the hourly catch-up retries on the same local date.
3. A notification kind change needs a migration; the plan's "no migration" assumption was wrong for
   W9 and `0257` was added. The audit script also predates it — both are forward-only.
4. IAS 29's transaction atomicity is proven by the shared wrapper + unit test; the DB rollback probe
   was added for FX only (same code path, avoiding a second heavy seeding fixture).
5. A proxy-level timeout on the interactive close can still leave the server-side transaction to
   finish; retrying is safe (one closing entry per year), and `query_cancelled` now says so.
6. Import of archived accounts recreates them as active (the unique index covers active rows only);
   the importer reports a duplicate code inside one file instead of silently taking the last row.
7. Accounting CSV export remains 503 (no runner); out of scope because it posts nothing.

## 6. Verification

```bash
pnpm typecheck
pnpm --filter mms-backend test          # 545 files / 3912 tests
pnpm --filter @mms/shared test          # 288 / 2354
pnpm --filter mms-frontend test         # 1218 / 4569
# throwaway PG16 + db:migrate (includes 0257), then:
DATABASE_URL=… pnpm --filter mms-backend test:db -- accounting finance auditAtomicityDb
#   → 39 suites / 235 tests, including the new accountingCsvImportDb + the FX rollback probe
DATABASE_URL=… pnpm --filter mms-backend exec tsx src/scripts/audit-accounting-batch-runs.ts
pnpm run check:code-norms && pnpm run check:db-projections && pnpm run check:backend-boundaries \
  && pnpm run check:docs && pnpm run check:i18n && pnpm run check:migration-hygiene \
  && pnpm run check:tdd-pairing
DATABASE_URL=… bash scripts/ci/local-ci.sh --with-db
```

## 7. Reproduction notes

- The rollback proof: a probe trigger on `accounting_fx_revaluation_runs` makes the run insert fail
  after both entries were written; the suite asserts **zero** entries and no run survive.
- Replay proof: the COA importer is run twice over the same codes; the second run updates the same
  rows (count unchanged, name updated).
- Abort proof: an aborted signal before the lock means `lockLedgerEvent`, `postEntry` and `saveRun`
  are never called; `withTimeout` invokes its abort callback before rejecting.
