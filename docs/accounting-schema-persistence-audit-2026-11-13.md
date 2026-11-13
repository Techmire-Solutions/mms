# Accounting — schema and persistence audit

Scope: the persistence layer behind the Accounting module — the Drizzle model
(`apps/backend/src/db/schema/{accounting,accountingAccounts,accountingEntryChildren,accountingFxColumns,accountingVoucherNumbering,accountingLedgerOps,accountingModuleConfig,softDeleteSchema}.ts`),
the SQL that actually enforces the rules (`0092`, `0127`, `0128`, `0248`, `0249`, `0252`, and the new
`0253`), the repositories that write them (`apps/backend/src/db/repositories/accounting*`), and the four
DB-integration suites named in the review request: `accountingPersistDb`, `accountingPersistSoftDeleteDb`,
`accountingVoucherCountersDb`, `accountingListFiltersDb`.

Method: every claim was read from the working tree and, where it matters, measured against a real
PostgreSQL 16 (`postgres:16-alpine`, fresh `db:migrate`, `pnpm --filter mms-backend test:db`). The
reproduction queries are in the appendix. Anything that is a policy decision rather than a defect is
marked **Documented**.

Status: findings **A1–D5** landed with migration `0253_accounting_schema_integrity.sql` plus the files in
§5. **Deviations** from the approved plan are listed in §6, including one finding whose severity was
corrected after measurement.

---

## 1. What is already correct (verified, no change)

| Area | Evidence |
|---|---|
| **No floating-point money columns** | Every debit/credit/functional/rate column is `numeric`: `accounting.ts:203-204` (`numeric(14,2)`), `accountingFxColumns.ts:14-20` (`numeric(19,4)` amounts, `numeric(20,10)` rate), `accountingFx.ts:72,94` (`numeric(20,10)` + `CHECK (rate > 0)`). The appendix query returns 0 float/`real`/`money` columns under `accounting_*`. |
| **Double-entry is database-enforced** | `0249:31-89` (`accounting_assert_entry_postable`), `0249:111-114` deferred per-line constraint trigger, `0249:119-139` posting guard, `0249:143-205` posted content immutability. |
| **Posted lines are immutable in place** | `0248:65-101` refuses DELETE of a posted entry's lines; `0249:172-205` refuses changes to debit/credit/account/entry. |
| **Posted entries cannot be archived** | `0248:42-61` `trg_accounting_entries_posted_archive_guard` (`BEFORE UPDATE OF deleted_at`). |
| **Voucher allocation serializes** | `accountingVoucherRepository.ts` allocates with `INSERT … ON CONFLICT DO NOTHING` + `UPDATE … RETURNING` inside the caller's transaction; `tenant-context.ts:74-114` makes a nested `withTenant` join the ambient transaction, so the counter row lock is held to commit and a rollback returns the number. Duplicates are additionally impossible via `accounting_entries_workspace_ref_active_uidx` (`0127`). |
| **Voucher counters are RLS-isolated** | `0128` enables + forces RLS with `tenant_isolation_policy` on both counter tables. |
| **Fiscal-year overlap is impossible** | `0251:58-59` `EXCLUDE USING gist` on the active date range. |
| **Soft-delete three-tier indexes exist** | Every accounting soft-deletable table carries the (A) trash scan, (B) active partial and (C) archived partial indexes. |

---

## 2. Findings

### P0 — silent corruption

**A1 — A whole-list settings save resurrected or re-trashed chart-of-accounts rows.** *Fixed.*
`accountingAccountsPersist.ts:42-44` (single save) and `:91-93` (bulk save) wrote `deleted_at`,
`deleted_by` and `deletion_reason` from the payload in their `ON CONFLICT … SET` lists. Every account
handed to the UI carries `deletedAt: null`, so a save in session 1 un-deleted an account session 2 had
archived — and wrote no restore attribution — while a stale row could re-trash an active one. This is
the exact defect fixed for journal entries (`accountingEntriesPersist.ts:131-141`) and for finance
documents in the 2026-11-12 audit (F1); the COA half was never fixed and had no parity test.
Fix: the three columns are gone from both `SET` lists (insert values still carry them for backup
restore). Pinned by `accountingPersistSoftDeleteDb` ("bulkSaveAccounts soft-delete ownership").

**A2 — The account archive guard read the read replica and contradicted the bulk path.** *Fixed.*
`countActiveJournalLinesForAccount` / `…ForAccounts` ran under `withTenantRead`
(`accountingAccountsRepository.ts`), so replica lag could hide a line another request had just posted and
the archive would succeed. Separately, `bulkSoftDeleteAccounts` (`accountingAccountsPersist.ts:148-159`
before the fix) counted **every** journal line with no entry join — a draft or trashed-entry reference
blocked the bulk archive while single delete allowed it, and the count-then-update sequence had no lock.
Fix: one predicate (`posted`, `entries.deleted_at IS NULL`) in `accountingAccountGuards.postedLineCountsByAccount`,
executed on the primary inside the write transaction, with the account rows locked `FOR UPDATE` first;
both paths call it.

**A3 — A posted voucher's number could be renumbered at the database.** *Fixed.*
`0249:150-156` froze `date`, `status`, `fiscal_year_id`, `source_type`, `source_id` — but not `ref`, the
one column the counter table exists to protect. Content immutability lived only in
`accountingLedgerGuards.assertEntriesMutable` (`:231-245`), so any new repository method, import or ops
`UPDATE … SET ref` renumbered a posted voucher, freed its old number for reissue (the unique index is
partial on `deleted_at IS NULL`) and broke the audit chain.
Fix (0253): `accounting_entries_posted_columns_guard()` also freezes `ref` and `reversed_ref`.
`created_by` is deliberately still mutable — it is attribution, not ledger identity, and freezing it
would reject idempotent re-saves from a client that omits it. Pinned by
`accountingPostedLedgerGuardsDb` ("posted vouchers cannot be renumbered").

### P1 — integrity, precision, index

**B1 — No optimistic concurrency on draft vouchers or account configurations.** *Fixed.*
There was no `version` column and no `updated_at` compare-and-set: `saveEntry`/`bulkSaveEntries` and
`saveAccount`/`bulkSaveAccounts` were unconditional last-write-wins upserts. `lockJournalEntries`
(`accountingEntryLocks.ts:6-27`) serializes concurrent requests but cannot detect a *stale* client, so
two people editing one draft silently lost one edit. The repository already owned the primitives —
`lib/occHeaders.ts`, `naiveTimestamp` (`lib/dbDate.ts:47-55`), `saveFacultyIfVersionMatches`
(`facultyRepository.ts:159-195`) — unused by Accounting.
Fix (conditional CAS, as approved): `accountingEntryOcc.assertEntriesFresh` and
`accountingAccountGuards.assertAccountsFresh` compare the client's `updatedAt` against the stored row
under `FOR UPDATE` and return 409 `stale_write` with the offending ids. Journal bulk saves only check the
rows the save actually changes (`changedIds` from `journalEntryContentChanged`), and account saves only
check rows whose content differs, so a whole-list payload cannot be blocked by an untouched stale row.
Clients that omit the token keep working (recorded residual). Both writers now stamp the *stored*
`updated_at` back onto the records they return — required because `update_accounting_entries_updated_at`
(0031) overrides the column on every update; without it the next save would be a spurious 409.

**B2 — Command-centre metrics converted ledger money through `float8`.** *Fixed (hardening).*
`accountingRepositoryMetrics.ts:64-68` cast every money aggregate to `::float8` and then `Number(...)`;
`surplus` was a JavaScript float subtraction. Measurement corrected the initial severity: the aggregate
*is* a `numeric` sum, so the cast only loses the final conversion, and realistic `numeric(14,2)` totals
still round-trip through `signedMoneyAmountSchema` — this was a lossy boundary, not a reproduced 500.
It is still the pattern the 2026-11-12 audit banned for finance (F15) and that
`accountingRepositoryReport.ts:158` already avoids, so the sums now stay `::numeric::text` and convert
once through `roundMoneyAmount`, with `surplus` computed in integer cents. Pinned by
`accountingMetricsPrecisionDb`.

**B3 — Every voucher allocation scanned the whole tenant journal.** *Fixed.*
`accountingVoucherRepository.ts:209-218` probes taken refs with `ref = ANY(candidates)` and deliberately
includes trashed entries, so it carries **no** `deleted_at` predicate — which means the partial unique
index `accounting_entries_workspace_ref_active_uidx` cannot serve it, and no other index on `ref`
existed. The 2026-11-12 audit fixed the *seed* scan (F5) but not this per-allocation probe.
Fix (0253): `accounting_entries_workspace_ref_idx (workspace_subdomain, ref)`, non-partial. Pinned by
`accountingVoucherCountersDb` ("voucher allocation probe is index-backed").

**B4 — Journal-line `exchange_rate` had no positivity rule.** *Fixed.*
`accountingFxColumns.ts:16` is nullable `numeric(20,10)` with no CHECK, while both rate tables enforce
`rate > 0` (`accounting_exchange_rates_positive` `0188:37`, `fx_reference_rates_positive` `:119`), so a
zero or negative multiplier was storable on a foreign-currency line.
Fix (0253): `accounting_journal_lines_rate_positive_chk` (`NOT VALID`; applies to every new write). The
`func_* ≈ txn_* × rate` relation stays an application invariant — per-currency rounding makes it a poor
CHECK — and the existing 0249 mirror checks keep `func_*` equal to the functional amounts.

**B5 — The posting-period lock depended on free-text status.** *Fixed.*
`accounting.ts:102` is `varchar(20)` default `'open'` with no constraint, while `0249:77-87` decides
whether a period is locked by `status = 'closed'`. A stored `'Closed'` or `'LOCKED'` silently disabled
the monthly lock. `@mms/shared` `POSTING_PERIOD_STATUSES` already documented
`accounting_posting_periods_status_check` and `financeEnumParityDb` already asserted it — that suite was
red against a migrated database.
Fix (0253): the constraint now exists (pre-checked for out-of-enum rows, `NOT VALID` + `VALIDATE`), and
`accountingPostingPeriodsRepository.ts` takes its status type from the shared union.

**C1 — The chart of accounts had no hierarchy at all.** *Fixed.*
`accounting.ts:20-53` had no `parent_id`, `accountRecordSchema` had no parent field, and nothing
validated cycles or depth: hierarchy existed only as free-text `code` prefixes, which no rule checked.
Fix: `accounting_accounts.parent_account_id` with a composite self-FK
`(workspace_subdomain, parent_account_id) → (workspace_subdomain, id)`, a `parent <> id` CHECK, and a
`BEFORE INSERT OR UPDATE OF parent_account_id` trigger (`trg_accounting_accounts_hierarchy_guard`) that
takes a per-workspace advisory lock and then walks ancestors, rejecting cycles and chains deeper than 8.
The advisory lock is the point: two concurrent reparents could otherwise each observe an acyclic tree and
together close a loop. `parentId` is in the shared DTO; `@mms/shared` `checkAccountParent` mirrors the
rules for a readable 422 (`account_hierarchy_invalid`). The FK is `ON DELETE NO ACTION`, not `RESTRICT`,
so a whole-workspace or whole-tree delete does not depend on the order PostgreSQL visits rows.
Pinned by `accountingAccountsSchemaDb` (self-parent, cycle, depth, cross-workspace parent, archived
parent, application 422).

**C2 — Two active accounts could share a code.** *Fixed.*
`accounting.ts:40` was a plain index. `accounting_accounts.code` is the ledger's classification key and
the COA directory's primary sort, so duplicates make reports ambiguous.
Fix (0253): duplicate active codes are disambiguated first (`-dup-N`, the 0127 pattern) and
`accounting_accounts_workspace_code_active_uidx` makes the uniqueness real while staying recyclable
(trashed accounts are outside the index). `23505` maps to 409 `account_code_conflict`, and a restore
pre-checks the code (`accountingAccountsPersist.bulkRestoreAccounts`).

### P2 — hardening

**D1 — Restore attribution was never written for accounts.** *Fixed.*
`bulkRestoreAccounts` cleared the three delete columns but never set `restored_at`/`restored_by`, though
the sextuple exists in `softDeleteSchema.ts:33-38` and every reader selects it — a restored account had
no evidence of who brought it back (the journal half was fixed in the 2026-11-12 audit, F9).
Fix: both columns are set, the actor id is honoured (it was ignored), and a 0253 `BEFORE UPDATE OF
deleted_at` trigger on `accounting_accounts` and `accounting_entries` requires them whenever
`deleted_at` goes `NOT NULL → NULL`. The trigger also rejects a `restored_at` **older** than the
deletion it undoes — a replayed attribution from an earlier restore is not evidence for this one. Purge
and maintenance flags are exempt.

**D2 — Archiving an account orphaned the configuration.** *Fixed.*
`accounting_posting_rules` FKs to nine accounts (`accountingLedgerOps.ts:42-62`) and the module
preferences (jsonb, `accountingModuleConfig.ts:22-29`) pin accounts, but soft delete bypasses every FK:
the cash/AR/fx/retained-earnings account could be archived while the configuration still pointed at it,
so every later posting failed.
Fix: `accounting_account_archive_guard` (0253) refuses the archive while any posting-rules column
references the account, and `assertAccountsNotConfigured` adds the jsonb retained-earnings pin plus a
readable 422 `account_configured`.

**D3 — Index gaps in the ledger and directory filters.** *Fixed.*
| Query shape | Index added (0253) |
|---|---|
| Voucher collision probe (`accountingVoucherRepository.ts:209-218`) | `accounting_entries_workspace_ref_idx` (B3) |
| Journal date range + `deleted_at IS NULL` (`accountingRepositoryListQuery.ts:87-95`) | `accounting_entries_workspace_date_active_idx` |
| COA type filter (`:49-52`) rode the non-partial index | `accounting_accounts_workspace_type_active_idx` |
| COA default order `created_at DESC, id` (`:156-179`) | `accounting_accounts_workspace_created_active_idx` |
| Fiscal-year default order (`:213-239`) | `accounting_fiscal_years_workspace_created_active_idx` |
| Tag filter (`:115-125`) | `accounting_entry_tags_workspace_tag_idx … INCLUDE (entry_id)` |

`accounting_entries`/`accounting_journal_lines` are not in the migration-index ratchet's large-table list,
so plain builds follow the 0248 precedent. The tag index uses `INCLUDE`, which drizzle-orm 0.45 cannot
express, so it is created in SQL and deliberately absent from the model/snapshot (the 0248
covering-index precedent). Two candidate indexes were **not** added because no measurement justified
them: `(workspace_subdomain, account_id, entry_id)` on lines (the existing entry-first index plus the
covering index already serve the semijoin) and any trigram index for `ilike '%…%'` search (repo-wide
pattern; see the 2026-11-12 audit F23).

**D4 — The DTO accepted amounts the column cannot store.** *Fixed (validation only).*
`moneyAmountSchema` allows up to safe integer cents (~9e13) while `debit`/`credit` are `numeric(14,2)`
(max 999,999,999,999.99): an over-range amount reached PostgreSQL and failed with `22003 numeric field
overflow` — a 500 for a payload problem. Fix: `accountingLedgerGuards.prepareJournalEntryForPersist`
rejects it as a 422. The column is deliberately **not** widened: the functional-currency contract is two
decimals until the DTOs move to decimal strings, and the functional mirror (`numeric(19,4)`) is pinned to
the 2-dp columns by `0249:208-218`.

**D5 — The Drizzle model did not declare CHECKs the database enforces.** *Fixed.*
`accounting.ts` declared only the two FX sign checks and the journal status/source checks; the database
also had `0092`'s `nonneg`/`single_side`, `0249`'s functional-mirror pair, `0252`'s account-type and
fiscal-year-status checks, and `0253`'s new ones. A reviewer reading the model concluded the rules did
not exist, and the hand-derived snapshots had already drifted.
Fix: every check is declared (`schema/accounting.ts`, `accountingAccounts.ts`) and
`financeAccountingConstraintsParity` now fails if a database check name is missing from the model or if
an enum list stops appearing in the migration SQL.

**Found during implementation — archiving a parent with active children.** *Fixed.*
Soft-deleting a parent left active children behind; every reader filters `deleted_at IS NULL`, so the
branch vanished from the tree and the next save of a child was rejected as `archived_parent`.
`bulkSoftDeleteAccounts` now refuses the archive unless the whole branch is in the same request (422
`account_has_children`). This is application-level on purpose: a per-row trigger cannot see sibling
updates in one statement and would reject legitimate branch deletes depending on row order.

---

## 3. What the four named suites assert now

| Suite | Covers (new/changed cases) |
|---|---|
| `accountingPersistDb` | batched upsert parity, child replacement, posted-line preservation. **New:** a stale `updatedAt` token is a 409 `stale_write`; the token handed back is accepted by the next save; a token-less batch still writes (conditional-CAS residual). |
| `accountingPersistSoftDeleteDb` | entries keep their trashed/active state across a whole-list save. **New:** the same ownership for accounts, and restore attribution on restore. |
| `accountingVoucherCountersDb` | concurrency, seeding past `JE-9999`, hand-typed skips, rollback return, rollover policies, trashed refs, cross-format. **New:** a ref lookup resolves through `accounting_entries_workspace_ref_idx` (usability; the probe's own plan is cost-dependent on a tiny suite table). |
| `accountingListFiltersDb` | status, date range, account, tag, combined filters, filtered totals. Unchanged — the new indexes change plans, not results, so their shape is asserted in `accountingPostedLedgerGuardsDb` instead. |
| `accountingAccountsSchemaDb` (**new**) | hierarchy persistence, self-parent, cycle, depth, cross-workspace parent, archived parent, 422s from the app guard, code uniqueness/recyclability, archive guards (posting rules, retained earnings, posted lines, active children, raw SQL bypass), restore attribution (write, reject un-attributed, reject replayed attribution), OCC (stale, unchanged, current token, omitted parent preserved). |
| `accountingPostedLedgerGuardsDb` | extended: posted `ref`/`reversed_ref` frozen (raw SQL), maintenance escape still works, the four new triggers and eight new indexes exist, index shapes match the queries, period-status check is present. |
| `accountingMetricsPrecisionDb` (**new**) | metrics money survives `accountingCommandMetricsSnapshotSchema`, `assets === 0.3` for 0.10 + 0.20, `surplus` exact. |

Result against a fresh PostgreSQL 16: **22 accounting DB suites / 148 tests pass.**

---

## 4. What this audit did *not* prove

- **Concurrency of the OCC path under real contention.** The CAS is exercised sequentially and against
  the trigger-stamped token; a true two-connection race is not simulated (it needs a second session
  holding the row lock). The `FOR UPDATE` predicate is the same one `saveFacultyIfVersionMatches` uses.
- **Cross-tenant isolation of the new objects.** RLS is inherited from the tables; no new table was
  added. The composite FK is exercised for a cross-workspace parent, which is the new attack surface.
- **Performance at scale.** Index plans are asserted by shape/usability, not by a production-sized
  `EXPLAIN` (the suite tables hold a few rows).
- **Posting-time account validation still reads the replica.** `assertJournalAccountsWritable` →
  `findAccountsByIds` uses `withTenantRead`; archive now locks the account row on the primary, but a
  posting that validates against lagging replica data remains possible. Recorded as follow-up, not fixed
  here (it touches the whole posting path).

---

## 5. Files changed

| File | Change |
|---|---|
| `apps/backend/src/db/migrations_drizzle/0253_accounting_schema_integrity.sql` | new: posted-ref freeze, COA hierarchy + guard trigger, unique code, archive guard, restore attribution, period-status check, rate-positive check, eight indexes |
| `…/migrations_drizzle/meta/0253_accounting_schema_integrity_snapshot.json`, `meta/_journal.json` | new snapshot (derived from 0252) + journal entry (§7) |
| `apps/backend/src/db/schema/accountingAccounts.ts` | new: COA table split out (300-line ceiling) with hierarchy, unique active code, partial indexes, declared checks |
| `apps/backend/src/db/schema/accounting.ts` | re-exports the COA; new entry indexes, period-status check, line sign/side/mirror/rate checks, fiscal-year created index + status check |
| `apps/backend/src/db/schema/accountingEntryChildren.ts` | documents the `INCLUDE` tag index (model cannot express it) |
| `apps/backend/src/db/schema/relations/accountingRelations.ts` | self-relations for `parent`/`children` |
| `apps/backend/src/db/schema/index.ts` | barrel export |
| `apps/backend/src/db/repositories/accountingAccountsPersist.ts` | soft-delete ownership, primary+locked line guard, hierarchy/freshness/config guards, restore attribution + code pre-check, parent preservation, token stamping |
| `apps/backend/src/db/repositories/accountingAccountGuards.ts` | new: hierarchy, config-reference, freshness and posted-line guards |
| `apps/backend/src/db/repositories/accountingAccountsHierarchyPersist.ts` | new: explicit parent upsert, unique-error mapping, restored-parent check |
| `apps/backend/src/db/repositories/accountingAccountsRepository.ts` | single projection (`parentId` included), guards moved to the primary |
| `apps/backend/src/db/repositories/accountingEntryOcc.ts` | new: entry CAS + stored-token readback |
| `apps/backend/src/db/repositories/accountingEntriesPersist.ts` | CAS on save/bulk, `changedIds`, token stamping |
| `apps/backend/src/db/repositories/accountingEntriesLifecyclePersist.ts` | `entryInsertValues` accepts the shared write timestamp |
| `apps/backend/src/db/repositories/accountingRepositoryMetrics.ts` | exact `numeric` sums, exact `surplus` |
| `apps/backend/src/db/repositories/accountingPostingPeriodsRepository.ts` | status from the shared union |
| `apps/backend/src/db/repositories/accountingRepositoryListPages.ts` | `parentAccountId` in the COA page projection |
| `apps/backend/src/accounting/use-cases/accountingEntryMutationUseCases.ts` | passes `changedIds` |
| `apps/backend/src/accounting/use-cases/accountingLedgerGuards.ts` | 422 bound for out-of-range ledger amounts |
| `apps/backend/src/accounting/repository/accountingRepository.ts` | `bulkSaveEntries` options |
| `packages/shared/src/finance/accountingAccountHierarchy.ts` + `.test.ts` | new pure hierarchy rules |
| `packages/shared/src/finance/accountingModuleManifest.ts` | `parentId` on the account record/insert schemas |
| `packages/shared/src/entry/indexDomainsOperations.ts` | export |
| `apps/backend/src/__tests__/…` | new `accountingAccountsSchemaDb`, `accountingMetricsPrecisionDb`; extended persist, soft-delete, voucher-counter, posted-guard and constraints-parity suites |

## 6. Deviations from the approved plan

1. **B2 severity corrected.** The plan said the `float8` cast could fail `signedMoneyAmountSchema` and
   return a 500. Measurement showed the aggregate is `numeric` and the cast is only the final conversion,
   which realistic `numeric(14,2)` totals survive. The change is kept as exactness/consistency with the
   finance precedent, and the doc says so instead of claiming a bug that was not reproduced.
2. **No `x-expected-updated-at` route plumbing.** Accounting's write surface is the bulk collection
   upsert (`registerIncludableBulkRoutes` / `registerSoftDeletableBulkRoutes`), not single-record PUTs, so
   the header would have had no consumer. Conditional CAS reads the `updatedAt` the payload already
   carries and stamps the new token back into the response.
3. **Eight indexes, not nine.** The planned `(workspace_subdomain, account_id, entry_id)` line index was
   dropped: the existing entry-first index plus the 0248 covering index already serve both semijoin
   directions, and no measurement justified a third index on the hottest table (D3).
4. **Extra finding and fix** for archiving a parent with active children, which the plan did not list.
5. **`created_by` not frozen** in the posted guard (the plan listed it): attribution, not ledger identity,
   and freezing it would reject idempotent re-saves from a partial payload.

## 7. Reviewed exception: hand-authored migration snapshot

`drizzle-kit generate` still cannot run against this repository: the committed snapshot chain is malformed
(`0000_snapshot.json` and 16 others fail to parse, `0216`/`0217` collide), which is the pre-existing debt
tracked by `scripts/check-migration-hygiene.mjs` and the 2026-11-12 audit §5. Per `mms-schema-migrate` §2,
`0253` is hand-authored and `meta/0253_accounting_schema_integrity_snapshot.json` was derived from the
`0252` snapshot with the exact model deltas (the `parent_account_id` column, the self-FK, four COA
indexes, two entry indexes, the tag index is *absent* because it uses `INCLUDE`, the fiscal-year index and
status check, the period-status check, the three journal-line checks), a fresh `id` and `prevId` pointing
at `0252`. When the chain is regenerated, `0253` must be regenerated with it.

## Appendix — reproduction

```bash
# Fresh PostgreSQL 16 (throwaway container), then the real migration + suites.
docker run -d --name mms-audit-pg -e POSTGRES_PASSWORD=mms -e POSTGRES_USER=mms \
  -e POSTGRES_DB=mms -p 55433:5432 postgres:16-alpine
export DATABASE_URL="postgres://mms:mms@127.0.0.1:55433/mms"
pnpm --filter mms-backend db:migrate
pnpm --filter mms-backend test:db -- accounting
```

```sql
-- 1. No floating-point money in accounting (expect 0 rows)
SELECT table_name, column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND data_type IN ('double precision','real','money')
   AND table_name LIKE 'accounting%';

-- 2. The 0253 objects exist
SELECT tgname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
 WHERE NOT t.tgisinternal AND c.relname IN ('accounting_accounts','accounting_entries')
 ORDER BY 1;
SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
   AND indexname LIKE 'accounting_%' ORDER BY 1;
SELECT conname FROM pg_constraint
 WHERE conname IN ('accounting_accounts_parent_fk','accounting_accounts_parent_not_self_chk',
                   'accounting_posting_periods_status_check',
                   'accounting_journal_lines_rate_positive_chk');

-- 3. The hierarchy trigger rejects a cycle (expect check_violation)
BEGIN;
UPDATE accounting_accounts SET parent_account_id = 'child-id' WHERE id = 'root-id';
ROLLBACK;

-- 4. A restore must be attributable (expect check_violation)
BEGIN;
UPDATE accounting_accounts SET deleted_at = now() WHERE id = 'some-id';
UPDATE accounting_accounts SET deleted_at = NULL WHERE id = 'some-id';
ROLLBACK;

-- 5. Reproducible index drift check before changing DDL
SELECT tablename, indexname, indexdef FROM pg_indexes
 WHERE schemaname = 'public' AND tablename LIKE 'accounting%' ORDER BY 1,2;
```

Measured: migration `0253` applied on a fresh database; 4 new triggers, **8 new indexes** (ref, journal
date, COA parent, COA unique active code, COA active type, COA directory order, fiscal-year directory
order, tag `INCLUDE`) and 4 new constraints present; **22 accounting
DB-integration suites / 148 tests green**; backend and shared unit suites green; `check:migration-hygiene`,
`check:migration-indexes`, `check:migrations-forward-only` green.
