# Async Workers, Queues & Scheduling Audit: Obligations Module

Review of the asynchronous surface behind the Obligations module — BullMQ processors, schedulers, idempotency, deadlines and dead-letter handling.

**Status: reviewed; one HIGH timezone defect fixed, one long-standing 503 closed.** The module itself has **no** asynchronous workers — the brief's pipelines do not exist for it. The audit therefore covers the real machinery an obligation worker would use *and* the Finance automation pipeline that already implements the overdue-sweep and reminder behaviour the brief describes.

---

## 0. Premise correction

| Briefed | Reality (verified) |
|---|---|
| Batch session/term **obligation assessments** | **No assessment concept, no job kind.** `grep -r obligation apps/backend/src/worker` → **0 hits**; no scheduler, processor or queue name references the module. |
| Daily **Pending → Overdue** sweep | **No obligation status and no `due_date` column exist.** The real sweep is `financeAutomationScheduler` over **finance invoices** — audited here because it is exactly the pipeline the brief describes. |
| Automated upcoming/overdue **reminder dispatches** | Obligations have none. Reminders are `remindOpenInvoices` (Finance, staff-triggered) over the `reminderDaysBefore` window. |
| `backgroundJobShutdownAbort`, `backgroundJobDeadline` | Both exist — as `backgroundJobShutdownSignal` / `abortBackgroundJobsOnShutdown` and `services/backgroundJobDeadline.ts` — and are wired correctly. |
| DLQ gaps | A real DLQ exists: `worker/queues/deadLetter.ts`, `handleDeadLetterJob` on the worker's `failed` event, an orphan-cleanup dead-letter path, and a replay tool. |

The module's **only** asynchronous surface is the CSV export/import pair, which answered **503** because no `obligations:export` runner existed — a deferred item carried by four previous audits.

---

## Findings

### W — Workers, idempotency, shutdown

| # | Sev | Finding | Status |
|---|---|---|---|
| **W0** | — *(premise)* | Zero BullMQ jobs, schedulers or processors for the module; no assessment/status/due-date domain to sweep. Structural double-assessment risk: none. | Documented |
| **W1** | **HIGH** | **Timezone boundary bug in the overdue sweep.** `collectOverdueInvoices` resolved the transition day with `todayISO()` — **server-local** — while `financeAutomationScheduler` had already computed `localDate` in the **workspace's** IANA zone and used *that* for the alert `dedupeKey`. A workspace outside the server's zone flipped a day off its own business day (UTC+14 a day early, UTC−11 a day late), and the alert could name a date the transition never used. `remindOpenInvoices` measured its `reminderDaysBefore` window the same way, so a reminder could fire a day outside the workspace's window. | **Fixed** |
| **W2** | MEDIUM | **The obligations export route could not work.** `registerModuleCsvExportRoutes` answers 503 unless `hasBackgroundJobRunner("obligations:export")`, and the module registered no runner — it advertised an Export action it could never satisfy (the exact bug hasanat's registry comment records). | **Fixed** |
| **W3** | LOW | `hourInTimeZone` used `hour12: false`, which some ICU builds render midnight as `"24"`. Harmless today (every gate is `>=`) but a future `localHour === 0` check would silently never fire. | **Fixed** |
| **W4** | — *(verified good)* | **Idempotency and duplicate prevention are sound where they exist:** the overdue transition is a conditional `UPDATE … WHERE status IN ('pending','partial') AND due_date < today` (a retry marks 0 rows); invoice generation is protected by the `(enrollment, billing_period)` unique index; the reminder claim is a real CAS (`last_reminded_at IS NULL OR < now() - 24h`); alert dedupe is enforced by the **partial unique index** `(workspace_subdomain, dedupe_key)` whose insert returns `false` on conflict. | Verified |
| **W5** | — *(verified good)* | **Deadlines and graceful shutdown are real:** `createJobDeadline(module, kind, signal)` + `runWithJobDeadline` with a 5 s settle window, a 60 s heartbeat distinguishing a live job from a dead worker, `backgroundJobShutdownSignal` threaded through `executeJob`, `abortBackgroundJobsOnShutdown` on SIGTERM, `clear*Scheduler` teardown, and a 4xx-vs-5xx split in step handling. A runner failure re-throws so BullMQ retries and dead-letters instead of recording "completed". The scheduler-driven sweep is deliberately not a BullMQ job (no DLQ row) and records failures in `finance_automation_runs`. | Verified |
| **W6** | LOW | `deleteObligationsByWorkspace` is exported through two repository barrels but has **no production caller** — the restore/wipe path owns the tables through `relationalReplaceMapping` (all six mapped). Dead code that invites a second, untested purge in a wipe. | Documented in place |

---

## 1. What was applied

### 1.1 The sweep day is the workspace's day (W1)

- `collectOverdueInvoices(input, options)` and `remindOpenInvoices(input, options)` accept `{ today }`; absent, they resolve `workspaceTodayIso(tenant)` instead of `todayISO()`. The HTTP DTOs are unchanged (a second parameter, not a widened body).
- `financeAutomationScheduler` passes the `localDate` it already computed, so the transition, the audit row and the alert `dedupeKey` can no longer disagree.
- Idempotency is untouched: `markOverdueInvoices` keeps its conditional `UPDATE`, so a re-run inside the same workspace day marks 0 rows and writes no second audit row.

### 1.2 The obligations export is real (W2)

- `services/obligationsExportService.ts` — `buildObligationsCsvExport` with one column catalogue, ids resolved to **names** (sender/type/representative), paged reads (`1 000`/page), a `20 000`-row ceiling that returns **413** instead of exhausting worker heap, abort-signal support, and formula-injection-safe cells through `buildCsvContent`.
  The archive is governed by **two separate flags**, which the first cut conflated: `allowDeleted` is the caller's *permission* (the route strips `includeDeleted` from the payload when the role lacks it) and `query.includeDeleted` is the *request*. Archived rows are read with `deleted: "all"` — never `"deleted"` — so an archive export still contains the live receipts, and the three archived columns appear only when both flags hold. A crafted job payload cannot export archived receipts to a reader.
- `services/backgroundJobObligationsRunners.ts` registers `obligations:export` via `registerModuleCsvExportJobRunner`, called from `registerDefaultBackgroundJobRunners()` — which runs in **both** the API and the worker, so the enqueue and the execution agree.

### 1.3 Midnight pin and the dead purge (W3, W6)

- `hourInTimeZone` uses `hourCycle: "h23"`, with a test asserting `0` at local midnight and `23` late evening.
- `deleteObligationsByWorkspace` carries an in-place note that the restore/wipe path is the mapping's job, so a future reader does not wire a second purge into a wipe.

---

## 2. Verification

| Command | Result |
| --- | --- |
| `pnpm typecheck` | 6/6 packages |
| backend finance + obligations + background-job suites | **345 tests / 50 files** |
| `financeCollectTimeZone.test.ts` (new, 4) | explicit workspace day wins over a different server day; helper fallback; one date shared by transition + audit; retry marks 0 |
| `obligationsExportJob.test.ts` (new, 7) | runner visible after registration; IDs resolved to names; the archive needs permission **and** request (`"all"`, never `"deleted"`); an unauthorised `includeDeleted` is ignored; paged read past 1 000 rows; 413 above the ceiling; abort signal honoured |
| `obligations.integration.test.ts` (extend, 18) | export no longer answers the "not available for this module" 503 |
| `financeAutomationScheduler.test.ts` (extend, 14) | `hourInTimeZone` returns `0` at midnight, never `24` |
| `check-code-norms` · `check-backend-structure` · `check-docs` · `check:i18n` | held (two files kept under the 300-line ceiling) |

## 3. Deferred

| ID | Item |
|---|---|
| **D1** | The `obligations:import` runner — name→id resolution, wakala guard per row, a per-row rejection report. The module's last 503. |
| **D2** | A real pledge/assessment domain (due dates, installments, statuses) — a product decision that would make the brief's sweeps meaningful for this module. |
| **D3** | A DLQ replay surface in the UI; `handleDeadLetterJob` and the CLI replay tool exist, but operators cannot see dead jobs without a shell. |
| **D4** | Deterministic "run at local 06:00 exactly once per local day" — the hourly `>=` catch-up already tolerates a skipped local hour, but an exact-hour rule needs a `last_run_local_date` marker. |
| **D5** | Delete or give a single tested caller to the dead `deleteObligationsByWorkspace`. |

## 4. Assumptions

1. The brief's intent is the overdue/reminder pipeline it describes, so fixing it in Finance is the useful outcome — inventing obligation assessments would fabricate a domain the product does not have.
2. Resolving "today" in the workspace zone changes behaviour only for workspaces outside the server's zone; that is the bug, and the manual routes benefit equally.
3. Registering the export runner in the shared registry (not the route plugin) is required — the runner must exist in the worker, which is where the hasanat precedent says the bug lived.
4. Buffered CSV with a paged read and a 413 ceiling is proportionate for a receipt ledger; streaming can follow if a tenant ever approaches the ceiling.
