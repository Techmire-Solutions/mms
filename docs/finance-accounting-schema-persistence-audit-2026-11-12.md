# Finance & Accounting — schema and persistence audit

Scope: the Drizzle model (`apps/backend/src/db/schema/{accounting,accountingFx,accountingFxColumns,accountingLedgerOps,accountingVoucherNumbering,finance,financeBilling,financeCollect,softDeleteSchema}.ts`), the SQL migrations that actually define the live constraints (`0092`, `0093`, `0104`, `0108`, `0127`, `0128`, `0184`, `0248`), the persistence layer that writes them (`apps/backend/src/db/repositories/accounting*`, `finance*`), and the five DB-integration suites named in the review request. All line numbers are from the working tree at audit time.

Method: every claim below was read from code or measured against the running PostgreSQL — `pg_indexes`, `pg_constraint`, `pg_trigger`, `information_schema.columns` — and `EXPLAIN` was used for the two hot queries. Nothing is inferred from a type annotation, a docstring, or a skill description. The reproducibility queries are in the appendix.

Status: every finding marked **Fixed** landed with this change (migration `0248_finance_accounting_integrity.sql` + the named files). **Documented** findings are deliberate decisions recorded here, not code changes.

---

## 1. What is already correct

| Area | Evidence |
|---|---|
| **No floating-point money anywhere** | `information_schema.columns` for `accounting_*`/`finance_*` returns **zero** `double precision`, `real` or `money` columns. Documents are `numeric(12,2)`, functional ledger amounts `numeric(14,2)`, IAS 21 `txn_*`/`func_*` `numeric(19,4)`, exchange rates `numeric(20,10)` with `CHECK (rate > 0)`. |
| **Timezone-safe calendar columns** | `0184_finance_date_columns.sql` converted `finance_invoices.due_date/paid_date`, `finance_payments.date`, `accounting_entries.date`, fiscal-year/posting-period and bank-statement dates to real `date`; every timestamp is `timestamptz`. `financeDateColumnsDb` proves empty→NULL, datetime→calendar day, impossible-day rejection and calendar-month bucketing. |
| **Referential integrity core** | Composite `(workspace_subdomain, id)` FKs on journal lines→entries/accounts, invoice lines/allocations/credit-notes→invoices, payments→invoices, entries→fiscal years (`0092`, `0093`); `finance_invoices_enrollment_fk … ON DELETE SET NULL` (`0214`). FORCE RLS on every finance/accounting table. |
| **Voucher numbering serializes** | Allocation is an upsert on the counter row inside the caller's transaction (`withTenant` reuses the active tx, `db/tenant-context.ts:85-90`), so the row lock holds until commit and a rollback returns the number. Duplicates are additionally impossible: `accounting_entries_workspace_ref_active_uidx`. `voucherFormatKey` is at most 17 chars (`varchar(24)`), the prefix is alnum-only so the match regex cannot be injected, and the `(\d{1,9})` cast fits `int`. |
| **Archive is ledger-aware** | `finance/use-cases/financeRecordLifecycle.ts:35-120` posts archive/restore reversals keyed on `(archive|restore, archivedAt)` — idempotent per lifecycle event, and `tryPostRestoreJournal` only re-posts when the archive reversal is actually on the books. Invoice archive refuses while active payments exist. |
| **Posted entries are immutable and undeletable in the application** | `accountingLedgerGuards.assertEntriesMutable` (422), `accountingEntryMutationUseCases.deleteJournalEntryByIdHelper`, and `bulkSoftDeleteEntries`'s `status <> 'posted'` predicate. |

---

## 2. Findings

### P0 — silent corruption / ledger de-balancing

**F1 — an invoice save silently un-deleted a trashed invoice (or re-trashed a restored one).** *Fixed.*
`saveInvoice` and `bulkSaveInvoices` wrote `deletedAt`/`deletedBy`/`deletionReason` in their `ON CONFLICT … SET` lists (`db/repositories/financeInvoicesPersist.ts:43-45` and `:101-103` before the fix), taking the values from `mapAuditToInsert(record)` (`repositories/repositoryMappers.ts:93-102`). Records handed to the UI carry `deletedAt: null`, so a whole-list save from one session resurrected an invoice another session had archived. This is exactly the defect fixed for journal entries — `accountingEntriesPersist.entryUpdateSetValues` drops the same three columns, and `accountingPersistSoftDeleteDb` pins the behaviour — but the finance half was never fixed and had no parity test.
Fix: the three columns are gone from both SET lists (insert values still carry them for backup restore). New suite: `__tests__/db-integration/financePersistSoftDeleteDb.integration.test.ts` (red before the fix: both cases failed with `expected null not to be null`).

**F2 — a posted journal entry could be soft-deleted out of balance with no reversal.** *Fixed.*
The only database guard was `trg_accounting_entries_forbid_hard_delete`, a `BEFORE DELETE` trigger (`0104:185-188`, re-issued `0108:196-200`). `UPDATE … SET deleted_at` on a posted entry therefore succeeded: the entry disappeared from every report (all list/report queries filter `deletedAt IS NULL`, e.g. `accountingRepositoryListQuery.ts:46-50`) while its `accounting_journal_lines` stayed behind — the ledger silently lost one side of a balanced entry. The application guard lives in two functions and is bypassable by any new repository, import, raw statement or ops script.
Fix: `BEFORE UPDATE OF deleted_at` trigger `trg_accounting_entries_posted_archive_guard` raising `check_violation`, with the same `app.allow_hard_purge` escape the workspace purge (`dbPurge.ts:24`) and backup restore (`dbSyncRestoreService.ts:126`) already set.

**F3 — a posted entry's lines were rewritable at the repository layer.** *Fixed.*
`bulkSaveEntries` unconditionally deleted and re-inserted children for every entry in the batch (`accountingEntriesPersist.ts:17-84, 165-193`). Immutability lived only in `assertEntriesMutable` one layer up, and the existing DB test *enshrined* rewriting a posted entry's ref and lines (`accountingPersistDb.integration.test.ts` seeded `status: "posted"` and replaced its lines). Any future caller of the repository could change the ledger with no reversal.
Fix: (a) `bulkSaveEntries` takes `preserveChildren` and skips the child rewrite for posted entries; `upsertEntriesHelper` passes the posted ids of the batch; (b) the child delete now runs *before* the parent upsert, so a legitimate draft→posted save still works while the parent still reads `draft`; (c) `BEFORE DELETE` trigger `trg_accounting_journal_lines_posted_guard`; (d) the DB test fixture is now a draft entry and two new cases pin "posted lines untouched" and "a rewrite that skips `preserveChildren` is rejected by the database".
The trigger covers DELETE only, deliberately: delete+reinsert *is* the rewrite vector, while an in-place UPDATE of ledger rows is a legitimate maintenance operation — `091_backfill_functional_currency.ts` fills the IAS 21 columns that way, and data migrations are append-only, so a trigger that rejected UPDATE could not be paired with a flag added to that migration. Posted-entry content immutability therefore stays an application invariant (`assertEntriesMutable`), now backed by the database for the destructive path.

### P1 — integrity / correctness / precision

**F4 — `rate_date` was `varchar(10)` in four tables.** *Fixed.*
`accounting_journal_lines`/`accounting_opening_balances` (via `schema/accountingFxColumns.ts:14`), `accounting_exchange_rates` (`schema/accountingFx.ts:69`) and `fx_reference_rates` (`:105`). `0184` and `audit:finance-date-columns` had missed them, so format was unenforced and the "latest on or before" FX lookup compared text: `'2026-9-9'` sorts *after* `'2026-10-01'`, selecting the older September rate. Live types confirmed `character varying`.
Fix: migration converts all four to `date` with the `0184` strict-ISO guard (`lock_timeout` + abort on non-`YYYY-MM-DD`), the Drizzle columns are `date(..., { mode: "string" })`, and the audit script now covers them. Tests prove the type, chronological ordering through `lookupExchangeRate`, and rejection of a non-date value.

**F5 — every voucher allocation seq-scanned the journal.** *Fixed.*
`claimSequences` seeded the counter with a `regexp_match` over `accounting_entries.ref` *inside* the upsert's `VALUES` (`accountingVoucherRepository.ts:106-136`). `VALUES` are evaluated before conflict detection, so the scan ran on the hot path (once per journal save) even when the counter row already existed. `EXPLAIN` confirmed `Seq Scan on accounting_entries … Filter: ref ~ '^JE-(\d{1,9})$'`; no index can serve `~`.
Fix: split into `INSERT … ON CONFLICT DO NOTHING` (seed `GREATEST(max, floor)`) followed by `UPDATE … SET last_value = GREATEST(last_value, floor) + count RETURNING last_value`. The scan now runs once per counter row; concurrent allocators still serialize on the row lock (the losing INSERT becomes DO NOTHING and joins the UPDATE). New `EXPLAIN` touches only `accounting_voucher_counters`.

**F6 — two indexes existed only on operated databases.** *Fixed.*
`accounting_journal_lines_covering_idx (workspace_subdomain, account_id) INCLUDE (debit, credit)` and `finance_invoices_workspace_student_period_active_idx (workspace_subdomain, student_id, billing_period) WHERE deleted_at IS NULL` were present in `pg_indexes` but in no migration, no `schema.ts`, and no boot provisioner — a fresh database/CI never got them, so plan shape differed per environment.
Fix: the covering index is created by `0248` (raw SQL — drizzle-orm 0.45 cannot express `INCLUDE`, so the model deliberately does not claim it, matching the `attendance.ts:121-123` precedent). The invoice index moved to the new `db/migrations/financeConcurrentIndexes.ts`, provisioned `CONCURRENTLY` at boot (`dbInit.ts:91`, advisory lock `2145836408`), because `finance_invoices` is in the migration-index ratchet's large-table list.

**F7 — no index supported the default directory ordering.** *Fixed.*
Journal default order is `created_at DESC, id` (`accountingRepositoryListQuery.ts:181-203`); invoice/payment default is `created_at DESC` (`financeListQueryBuilders.ts:65-160`). Existing indexes covered `date`, `status`, `fiscal_year` — none serves that ORDER BY, so every page request sorted the tenant.
Fix: `accounting_entries_workspace_created_active_idx` and `accounting_entries_workspace_status_date_active_idx` in `0248` + the model; `finance_invoices_workspace_created_active_idx` and `finance_payments_workspace_created_active_idx` in the concurrent provisioner.

**F8 — allocation amounts lost precision.** *Fixed.*
`finance_payments.invoice_amount` is `numeric(19,4)` (`schema/finance.ts:115`) while `finance_payment_allocations.amount` was `numeric(12,2)` (`schema/financeBilling.ts:134`), and the writer passed `String(allocation.amount)` (`financeBillingInvoiceLines.ts:107`). A cross-currency settlement rounded to 4 dp was re-rounded on insert, so Σ allocations no longer reconciled against the applied amount.
Fix: column widened to `numeric(19,4)`; the writer rounds explicitly at that scale.

### P2 — hardening

**F9 — restore attribution was never written.** *Fixed.*
`restoredAt`/`restoredBy` exist in `softDeleteSchema.ts:33-38` and are selected by every reader, but the three restore paths set only `deletedAt/deletedBy/deletionReason` to NULL (`accountingEntriesLifecyclePersist.ts:199-279`, `financeInvoicesPersist.ts`, `financePaymentsPersist.ts`) — so a restored ledger row had no evidence of who restored it. Every other module writes them (`contacts`, `attendance`, `tasks`, `sessions`, `faculty`, `hasan…`). Fix: all three now set `restoredAt: now`, `restoredBy: userId`.

**F10 — status and source type were free text in the database.** *Fixed.*
`accounting_entries.status` (default `posted`, `schema/accounting.ts:135`) and `source_type` (`:139`) had no constraint; the legal source-type set lived only in `packages/shared/src/finance/accountingLedgerInvariants.ts:6-24`. Fix: `CHECK` constraints (NOT VALID) plus `__tests__/financeAccountingConstraintsParity.test.ts`, which pins the SQL list to `JOURNAL_SOURCE_TYPES` (the `0243` taxonomy pattern). All 15 values are reachable from real writers (invoice, payment, closing, reversal, opening, obligation, `fx_reval*`, `ias29_*`, `hedge_*`).

**F11 — FX line amounts had no negative-amount validation.** *Fixed (sign); single-sidedness documented.*
Only `debit`/`credit` had (NOT VALID) checks from `0092:63-73`; `txn_debit/txn_credit/func_debit/func_credit` accepted negatives on `accounting_journal_lines` *and* `accounting_opening_balances`. Fix: sign checks on both tables, NOT VALID.
Single-sidedness is deliberately **not** a database CHECK: `091_backfill_functional_currency.ts` copies `debit`/`credit` into the `txn_*`/`func_*` columns, and `0092` made its own single-side check NOT VALID precisely because legacy rows may carry both sides — a validating check would make that upgrade path hard-fail. Single-sidedness stays enforced at the application edge (`isJournalLineSingleSided`, and the opening-balance DTO rejects a doubly-sided row), and the DB keeps the sign rule. The journal-line guard therefore rejects only DELETE; `091`'s in-place UPDATE path is untouched.

**F12 — invoice currency/period/status were unvalidated.** *Fixed.*
`CHECK` `currency ~ '^[A-Z]{3}$'`, `billing_period ~ '^[0-9]{4}-[0-9]{2}$'`, `status IN (…INVOICE_STATUSES)` — all NOT VALID.

**F13 — allocations could be zero or negative.** *Fixed (check only).*
`CHECK (amount > 0)` NOT VALID. A unique `(payment, invoice)` was deliberately **not** added: the model allows multiple line-level allocations to one invoice (`invoice_line_id`), so the constraint would reject valid splits.

**F14 — `deleteInvoice` was a hard delete behind a trigger that always raises.** *Fixed.*
`financeInvoicesPersist.deleteInvoice` issued `DELETE FROM finance_invoices`, which `trg_finance_invoices_forbid_hard_delete` rejects — unless `allow_hard_purge` was set, in which case it destroyed the invoice and its subledger rows. It now delegates to the soft-delete path and documents that ledger-aware archiving is `financeRecordLifecycle.deleteInvoiceById`.

**F15 — report aggregates accumulated money in `float8`.** *Fixed.*
`aggregateFinanceCommandMetrics` summed `numeric` columns and cast the result to `float8` (`financeRepositoryList.ts:126-134`), reintroducing binary floating point on values the schema exists to keep exact. Fix: sums stay `numeric` and render as exact decimal text (`::numeric::text`), converted once at the boundary.

**F16 — generated entries were dated with the UTC day.** *Fixed.*
`postingDate` fell back to `new Date().toISOString().slice(0,10)` (`accounting/ledgerPosting/ledgerPostingHelpers.ts:16-18`). For a UTC+5 tenant, a credit note, invoice/payment reversal or obligation archive raised before 05:00 local posted into the previous accounting day. Fix: `postingDateForTenant(tenant, value)` uses `workspaceTodayIso` (`lib/workspaceDay.ts`) for the missing-date case; all eight call sites updated. The finance command-centre month bucket now uses the workspace day too instead of the server clock.

**F17 — voucher numbering changes were not audited.** *Fixed.*
`saveVoucherNumbering` upserted a ledger control (prefix, digits, starting sequence, rollover) with no audit row. It now records before/after state on the audit chain inside the same transaction.

### P3 — documented decisions (no code change)

**F18 — there are no tax columns.** `finance_invoices`, `finance_invoice_lines` and `finance_payments` have no `tax_amt`/`tax_rate`, no tax account link, and no VAT/GST/withholding surface; the default chart only contains *expense* accounts named Income/Deferred Tax. The precision question is therefore vacuous for tax, but the capability gap is real: billing tax requires new columns (`tax_rate numeric(9,6)`, `tax_amt numeric(19,4)`), a posting-rule account, and a line-level split. Recorded as a product decision, not a defect in the money types.

**F19 — the tag filter cannot be driven from tags.** `accounting_entry_tags` has only PK `(workspace, entry_id, tag)` + `(workspace, entry_id)`. The correlated `EXISTS` probe in `buildEntryListConditions` is served by the PK (verified by `EXPLAIN`), so there is no missing lookup index; a *reverse* index `(workspace_subdomain, tag) INCLUDE (entry_id)` would only help highly selective tags on a very large journal. Advisory.

**F20 — `moneyToCents` is a float path.** `Math.round(amount * 100)` (`packages/shared/src/finance/accountingLedgerInvariants.ts:43-48`) is bounded by `moneyAmountSchema`'s ≤2-decimal refinement and `hasAtMostTwoDecimals`, so it round-trips exactly for accepted input. New money code should use `@mms/shared` `Money`/`parseMoney` (BigInt minor units).

**F21 — `finance_invoices.student_id` / `finance_payments.student_id` have no FK (decision item).** Adding one is not a one-line change: `dbPurge.ts:56-63` deletes unknown tables (including `students`) *before* `finance_invoices`, so a RESTRICT FK would make a workspace purge fail. Doing it properly means reordering the purge and deciding the erase semantics for invoices; recorded here instead of half-fixed.

**F22 — `accounting_journal_lines.account_id` FK is `RESTRICT` live but undeclared in the model** (`schema/accounting.ts:203-206` has no `.onDelete`). Functionally equivalent for immediate constraints, but the generated DDL would differ. Parity fix when the model is next touched.

**F23 — free-text search has no trigram index.** `finance_invoices` client-style search uses `ilike '%…%'` over `student_name`, `class`, `session` with no `pg_trgm`; advisory (repo-wide pattern).

**F24 — voucher gaps are by design and undocumented in the UI.** A number is consumed by `MAX_COLLISION_ROUNDS` jumps, by `reserved`/hand-typed refs, and by a claimed-but-then-rolled-back save (the counter row is transactional, so a rollback returns it). Duplicates cannot occur (unique partial index), gaps can. Documented here; `peekVoucherSequence`'s `lastValue` is the honest source for a "next number" preview.

---

## 3. What the named suites do and do not assert

| Suite | Covers | Gap found at audit time |
|---|---|---|
| `accountingPersistDb` | batched upsert parity, child replacement, untouched-row preservation | It **asserted the defect**: a `posted` entry's ref and lines were replaced. Fixture is now `draft`; posted preservation + DB rejection are new cases. |
| `financeDateColumnsDb` | invoice `due_date`/`paid_date` semantics, metrics bucketing | Never touched `accounting_entries.date`, `finance_payments.date` or any `rate_date`; none asserted the column *type*. Added type/ordering/rejection cases. |
| `accountingListFiltersDb` | status, date range, account, tag, combined filters, filtered totals | Asserted results only — never the plan or index availability. New index assertions live in `accountingPostedLedgerGuardsDb` (they need a migrated database). |
| `accountingPersistSoftDeleteDb` | a whole-list save cannot resurrect/re-trash journal entries | Nothing on the finance side (F1) and nothing at the database level (F2). |
| `accountingVoucherCountersDb` | concurrency, seeding past `JE-9999`, hand-typed skips, rollback return, rollover policies, starting sequence, auto-generate off | No trashed-ref seed, no cross-format behaviour, no multi-transaction race. Added all three. |

---

## 4. Files changed

| File | Change |
|---|---|
| `apps/backend/src/db/migrations_drizzle/0248_finance_accounting_integrity.sql` | new: posted-archive guard, journal-line immutability, `rate_date`→`date`, allocation width, three indexes, NOT VALID checks |
| `apps/backend/src/db/migrations_drizzle/meta/0248_finance_accounting_integrity_snapshot.json`, `meta/_journal.json` | new snapshot + journal entry (see §5) |
| `apps/backend/src/db/migrations/financeConcurrentIndexes.ts` | new concurrent boot provisioner |
| `apps/backend/src/db/dbInit.ts` | wires the provisioner after `ensureAttendanceAnalyticsIndexes` |
| `apps/backend/src/db/schema/accounting.ts` | two indexes, two checks, covering-index note |
| `apps/backend/src/db/schema/accountingEntryChildren.ts`, `accountingModuleConfig.ts` | new: the four child/config tables split out of `accounting.ts` so it stays inside the 300-line ceiling (barrel + relations updated) |
| `apps/backend/src/db/schema/accountingFx.ts`, `accountingFxColumns.ts` | `rate_date` → `date` |
| `apps/backend/src/db/schema/accountingLedgerOps.ts` | opening-balance FX checks |
| `apps/backend/src/db/schema/finance.ts` | invoice/payment checks, directory-index notes |
| `apps/backend/src/db/schema/financeBilling.ts` | allocation `numeric(19,4)` + positive check |
| `apps/backend/src/db/repositories/financeInvoicesPersist.ts` | drop soft-delete columns from both SET lists; `deleteInvoice` delegates to soft delete; restore attribution |
| `apps/backend/src/db/repositories/accountingEntriesPersist.ts` | `preserveChildren`, clear-before-upsert ordering |
| `apps/backend/src/db/repositories/financeBillingInvoiceLines.ts` | explicit 4 dp rounding |
| `apps/backend/src/db/repositories/accountingVoucherRepository.ts` | allocation split + numbering audit |
| `apps/backend/src/db/repositories/accountingEntriesLifecyclePersist.ts`, `financePaymentsPersist.ts` | restore attribution |
| `apps/backend/src/db/repositories/financeRepositoryList.ts` | exact `numeric` sums, workspace-local month |
| `apps/backend/src/accounting/use-cases/accountingEntryMutationUseCases.ts` | passes `preserveChildren` |
| `apps/backend/src/accounting/repository/accountingRepository.ts` | `bulkSaveEntries` options |
| `apps/backend/src/accounting/ledgerPosting/ledgerPostingHelpers.ts` + 3 posting services | `postingDateForTenant` |
| `apps/backend/src/scripts/audit-finance-date-columns.ts` | four `rate_date` columns |

Tests added: `financePersistSoftDeleteDb`, `accountingPostedLedgerGuardsDb` (both DB-integration), `financeConcurrentIndexes` (unit), `financeAccountingConstraintsParity` (unit); extended `financeDateColumnsDb`, `accountingVoucherCountersDb`, `accountingPersistDb`.

## 5. Reviewed exception: hand-authored migration snapshot

`drizzle-kit generate` cannot run against this repository: the committed snapshot chain is malformed (`0000_snapshot.json` and 16 others fail to parse) and `0216`/`0217` collide on a parent snapshot, so the tool aborts before diffing. This is the pre-existing debt tracked by `scripts/check-migration-hygiene.mjs` (historical 0134–0196 gap in `docs/open-items.md`), not something this change introduced. Per `mms-schema-migrate` §2, the migration was hand-authored and `meta/0248_finance_accounting_integrity_snapshot.json` was derived from the `0247` snapshot with the exact model deltas applied (four `rate_date` types, the allocation precision, two indexes, nine checks), a fresh `id`, and `prevId` pointing at `0247`. When the chain is regenerated, `0248` must be regenerated with it.

## Appendix — reproduction queries

```sql
-- 1. No floating-point money in finance/accounting (expect 0 rows)
SELECT table_name, column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND data_type IN ('double precision','real','money')
   AND (table_name LIKE 'accounting%' OR table_name LIKE 'finance%');

-- 2. Every date-shaped column is a real date (expect character varying only for
--    role_date-style free text; rate_date must be missing from the varchar list)
SELECT table_name, column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND column_name IN ('date','due_date','paid_date','start_date','end_date',
                       'period_start','period_end','rate_date')
   AND (table_name LIKE 'accounting%' OR table_name LIKE 'finance%')
 ORDER BY 1,2;

-- 3. Ledger guards present
SELECT c.relname, t.tgname
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
 WHERE NOT t.tgisinternal
   AND c.relname IN ('accounting_entries','accounting_journal_lines')
 ORDER BY 1,2;

-- 4. Index drift: compare pg_indexes against the model before changing anything
SELECT tablename, indexname, indexdef
  FROM pg_indexes
 WHERE schemaname = 'public'
   AND tablename IN ('accounting_entries','accounting_journal_lines',
                     'finance_invoices','finance_payments')
 ORDER BY 1,2;

-- 5. The voucher seed must not scan the journal (expect only
--    accounting_voucher_counters in the plan)
EXPLAIN UPDATE accounting_voucher_counters
   SET last_value = GREATEST(last_value, 0) + 1
 WHERE workspace_subdomain = 'demo' AND format_key = 'NONE|-|JE' AND period_year = 0
 RETURNING last_value;
```

Measured before the change (dev database, `localhost:5432/mms`): 0 float columns; four `rate_date` varchar columns; `accounting_journal_lines_covering_idx` and `finance_invoices_workspace_student_period_active_idx` present in `pg_indexes` but in no migration; voucher seed `Seq Scan on accounting_entries`; tag filter served by the `accounting_entry_tags` primary key.

Measured after the change: 0 float columns; `rate_date` = `date` on all four tables; `trg_accounting_entries_posted_archive_guard` (`BEFORE UPDATE OF deleted_at`) and `trg_accounting_journal_lines_posted_guard` (`BEFORE DELETE`) present; the four indexes above present and reproducible; `accounting_entries_status_chk`, `accounting_entries_source_type_chk`, the two journal-line sign checks, `finance_invoices_status_chk`, `finance_invoices_billing_period_chk` and `finance_payment_allocations_amount_chk` present; `finance_payment_allocations.amount` = `numeric(19,4)`; the allocation UPDATE plan touches only `accounting_voucher_counters`.
