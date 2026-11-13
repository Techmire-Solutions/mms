# Finance background workers & queue pipelines — audit and hardening

Scope: the asynchronous pipeline behind batch term-fee invoice generation, scheduled FX revaluation, IAS 29 restatements and overdue-invoice notifications — plus everything the shared BullMQ worker gives them (retries, DLQ, deadlines, shutdown).

Method: read the queue configuration (`queueConfig`, `queues/index`, `jobProcessor`, `deadLetter`, orphan cleanup), the runner registry and every finance runner, the enqueue call sites, the deadline/shutdown helpers (`backgroundJobDeadline`, `backgroundJobAbort`), and the finance batch use cases and their DB guards; then exercised the reachable paths against PostgreSQL (two concurrent collectors, concurrent reminder runs) and unit-tested the new scheduler.

Status: **Fixed** findings landed with this change; **Verified** items were exercised with no change; **Documented** items are deliberate decisions or follow-ups.

---

## 1. Verified baseline

| Guarantee | Evidence |
|---|---|
| **Queue retry/backoff/DLQ** | `DEFAULT_JOB_OPTIONS` = attempts 3 + exponential backoff; `worker.on("failed")` dead-letters at the final attempt (`handleDeadLetterJob` → `markJobPermanentlyFailed` + `deadLetteredAt`); orphan cleanup fails stale `running` (>15 min heartbeat) and stale `pending` (>10 min) jobs and marks them replayable. |
| **Deterministic job ids** | `buildBackgroundJobId(tenant, user, idempotencyKey)` + `createDatabaseBackgroundJob` `onConflictDoNothing` → a duplicate submit returns the existing job; a mismatched payload under the same export key is a 409. |
| **Deadline + shutdown contract** | `createJobDeadline` combines a per-kind budget, the process shutdown signal and a 5 s settle; `runWithJobDeadline` races and aborts; `SIGTERM` aborts in-flight runners, pauses workers, force-exits at 75 s; the lease/transaction releases on connection close. |
| **Double-billing guards** | generated invoices: partial unique `(workspace, enrollment_id, billing_period)` + billing-period marks; revaluation/IAS 29: unique `(workspace, date)` + per-event advisory lock + deterministic journal source keys; journal posting dedupes on `(source_type, source_id)`; late-fee journal key `latefee:<invoiceId>`. |
| **Export routes fail fast** | `registerModuleCsvExportRoutes` returns **503** when `'<module>:export'` has no runner — it never enqueues an unserviceable job. Finance/accounting CSV export/import are therefore *unavailable*, not broken queue jobs. |

## 2. Findings

### P1 — fixed

**F1 — none of the four finance pipelines ran as a worker.** The worker daemon scheduled retention, sessions, attendance absence, the FX *rate feed*, contact tags and waitlist only. Batch term-fee generation, FX revaluation, IAS 29 restatements and overdue collection existed only as user-triggered routes, so `autoGenerateInvoice`, `overdueReminder`, `feeReminders` and `reminderDaysBefore` were dead configuration: period-end revaluation never happened automatically (a year-end close could be blocked by unrevalued balances) and no overdue alert was ever raised. *Fixed:* a leader-only `financeAutomationScheduler` now runs the four steps (see §3).

**F2 — the overdue/late-fee and reminder paths were not concurrency-safe and were unaudited.** `collectOverdueInvoices` read candidates (no lock) and wrote `late_fee_amt` unconditionally: two concurrent runs both computed a fee, `lateFeesApplied` reported candidates rather than applied rows, and a payment could settle an invoice between read and write while the fee journal still posted. No audit row was written for the overdue flip or the applied fees. `remindOpenInvoices` built the recipient list before `markInvoicesReminded`, so two concurrent runs could both notify the same invoice. *Fixed:*
- `applyLateFeeAmounts` is now a conditional `UPDATE … WHERE late_fee_amt <= 0 AND status IN (pending, partial, overdue) RETURNING id, late_fee_amt`; it returns only the rows it set.
- `collectOverdueInvoices` locks candidates (`SELECT … FOR UPDATE`), posts journals and writes per-fee `late_fee_applied` audit rows only for the returned rows, records one `overdue_marked` run summary, and reports the true applied count.
- `markInvoicesReminded` became `claimInvoicesForReminder` (`… AND (last_reminded_at IS NULL OR last_reminded_at < now() - interval '24 hours') RETURNING id`); `remindOpenInvoices` claims first and builds recipients only from the winning ids, plus a reminder-summary audit row.
- Proven by `financeCollectConcurrencyDb` (two concurrent collectors → one fee, one journal, one audit row; two concurrent reminder runs → one claim).

**F3 — finance job runners were dead code.** `finance:collect`, `finance:render-receipt`, `finance:render-ledger`, `finance:export-excel` (and `students:render-report-card`) were registered but had **no enqueue call site** anywhere. *Fixed:* the finance registrations were removed (the report-card runner stays, it belongs to the documents pipeline); a hygiene test pins that no finance/accounting job runner exists without an enqueue path, and that `finance:export|import`/`accounting:export|import` stay unregistered (the routes fail fast with 503).

**F4 (latent) — no finance/accounting branch in the DLQ audit.** `handleDeadLetterJob` wrote chain rows for hasanat, examinations, messaging, workshops and questionbank; a finance/accounting dead letter would only have a job-tray row. *Fixed:* a `finance.job.dead_letter` (`finance_invoices`) / `accounting.job.dead_letter` (`accounting_entries`) audit row with the kind and reason, tested for both modules and asserted absent for other modules.

### P2 — documented

- **Scheduled automation runs as a leader-only sweep, not a BullMQ job.** Scheduled work has no tenant user to attribute and `background_jobs.user_id` is FK-constrained to `tenant_users`, so system jobs would either fabricate a user row or misattribute the audit actor. The steps call idempotent use cases (unique period/date keys, advisory locks, source-key dedupe), so the next hourly tick is the retry; they still run under `createJobDeadline`/`runWithJobDeadline`, so the process shutdown signal aborts them exactly like a queue runner.
- **Customer-facing reminder dispatch remains a human action.** There is no configured reminder template/consent policy, so the sweep only marks overdue and raises an in-app finance alert (`finance_invoices_overdue` notification, dedupe-keyed per day). The corrected claim path guarantees a staff-triggered send is never duplicated within 24 h.
- **Finance/accounting CSV export/import stay unavailable (503).** Implementing server-side builders is a separate feature; the routes are fail-fast rather than dead-lettering.
- **Late fees stay manual.** The sweep marks overdue only; applying late fees (`applyLateFee: true`) remains a deliberate operator action, now concurrency-safe.

## 3. Idempotency / double-posting matrix

| Financial step | Retry/concurrency guard | Re-runnable? |
|---|---|---|
| Generated fee invoices | partial unique `(workspace, enrollment_id, billing_period)` + billing-period marks; batch conflict rolls back and the next run skips | yes |
| FX revaluation | unique `(workspace, revaluation_date)` + `lockLedgerEvent` + journal `source_id = date` | yes (returns existing run) |
| IAS 29 restatement | unique `(workspace, restatement_date)` + `lockLedgerEvent` + journal `source_id = date` | yes |
| Overdue marking | idempotent `UPDATE … WHERE status IN (pending, partial)` | yes |
| Late fee | `FOR UPDATE` candidate lock + conditional `late_fee_amt <= 0` UPDATE + one `latefee:<invoiceId>` journal | yes (second run applies nothing) |
| Reminder | claim-before-send (`last_reminded_at < now() - 24h` in the UPDATE) | yes (single winner) |
| Journal posting | `persistGeneratedEntry` dedupes `(source_type, source_id)` | yes |
| Background jobs (generic) | deterministic job id + `onConflictDoNothing`; retry reuses the job row | yes |

## 4. Scheduler design

`apps/backend/src/worker/financeAutomationScheduler.ts` + `financeAutomationRuns.ts`:

- **Leader-only** (`LEADER_LOCK_FINANCE_AUTOMATION`), hourly self-rescheduling tick, cleared on SIGTERM.
- **Gated**: `FINANCE_AUTOMATION_ENABLED=true` (default **off** — shipping must not silently start billing every tenant), tenant preferences (`autoGenerateInvoice`, reminder flags), and the tenant-local calendar (`getWorkspaceTimezone` + `todayInTimeZone`).
- **Steps**: overdue marking + in-app finance alert at 06:00 local; on the first local day of a month, invoice generation for the previous billing period; on the last local day, FX revaluation and (when enabled) IAS 29.
- **Isolation/deadlines**: per-tenant 5 min timeout + 45 min sweep budget + `SET LOCAL statement_timeout`; per-step `createJobDeadline("finance", kind)` (budgets added to `resolveJobExecutionTimeoutMs`) and the shared shutdown signal; one tenant's failure is counted in the summary and does not stop the sweep. Unset configuration (missing rate, no unrealized-FX account, missing price index, IAS 29 disabled) is a logged/audited skip, never a crash.
- **Audit**: revaluation/IAS 29 runs and generated invoices already audit themselves; the sweep adds `overdue_marked` and `late_fee_applied` rows and the notification dedupe key; actor is the documented `"system"` fallback.

## 5. Landed changes

| File | Change |
|---|---|
| `worker/financeAutomationScheduler.ts`, `worker/financeAutomationRuns.ts` (new) | leader-only scheduled automation for the four pipelines |
| `worker/sweepSupport.ts` (new) | shared `listEnabledWorkspaces`/`withTimeout`, reused by the attendance sweep |
| `worker/index.ts` | start/stop the finance scheduler |
| `lib/leaderElection.ts` | `LEADER_LOCK_FINANCE_AUTOMATION` |
| `worker/queues/queueConfig.ts` | finance automation per-kind budgets |
| `worker/queues/deadLetter.ts` | finance/accounting dead-letter audit rows |
| `services/backgroundJobDocumentFinanceRunners.ts` | removed unreachable finance runners (+ `MAX_EXCEL_PAYLOAD_ENTRIES`) |
| `db/repositories/financeCollectRepository.ts` | conditional late-fee UPDATE, candidate locking, reminder claim |
| `finance/use-cases/financeCollectUseCases.ts`, `financeAuditEvents.ts` | applied-only posting/audit, summary audits, `lateFeeAmt` in the audit projection |
| `packages/shared/src/dashboard/tenantNotifications.ts`, FE `useStoredNotifications`, 4 locale files | `finance_invoices_overdue` notification kind |

## 6. Evidence

- `financeAutomationScheduler.test.ts` (9): calendar helpers (previous period, month-end, local hour), global switch off → no runs, overdue-hour-only, first/last-day steps, tenant isolation on failure, shutdown between workspaces, preference gating.
- `financeCollectConcurrencyDb.integration.test.ts` (3): two concurrent collectors → one 50.00 fee, one `latefee:` journal, one audit row; a later run applies nothing; concurrent reminder runs → one claim.
- `financeJobDeadLetter.test.ts` (3): finance/accounting dead letters write the chain row; other modules do not.
- `financeJobRunnerHygiene.test.ts` (1): no finance/accounting runner exists without an enqueue path.
- Whole-suite: backend unit **533 files / 3772 tests**, shared **284 / 2297**, frontend finance/accounting/notifications **79 / 394**, finance/accounting + new DB suites **24 files / 125 tests**, typecheck clean, all ratchets green.

## 7. Rollout and follow-ups

1. **Enable automation deliberately**: set `FINANCE_AUTOMATION_ENABLED=true` per deployment (default off). The audit report lists the prefs that become effective; the report also notes that `autoGenerateInvoice`/`overdueReminder` default to `true`, so enabling the flag starts billing/alerts for tenants that never turned them off.
2. Build server-side finance/accounting CSV export/import (currently 503) — separate feature.
3. Customer-facing reminder dispatch needs a template/consent decision; the claim path is ready for it.
4. If finance work ever becomes BullMQ-enqueued jobs (e.g., an async CSV export), give them a dedicated queue and system-actor support before relying on the DLQ path.
