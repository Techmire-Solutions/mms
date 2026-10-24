# Accounting module — test coverage audit

Scope: backend accounting module (`apps/backend/src/accounting/**`, `apps/backend/src/routes/tenant/accounting/**`),
shared accounting sources (`packages/shared/src/accounting*.ts`, `packages/shared/src/contracts/accounting.contract.ts`),
plus frontend/e2e accounting tests. All line numbers are from the working tree at audit time (git status clean).

Method: read every production file and every test file listed; verified coverage claims by grepping for the specific
call sites / assertion strings in the test corpus. Nothing below is inferred from a coverage tool.

---

## (a) Coverage inventory

### Backend production files

| Production file | LOC | Covering test file(s) | Thoroughness |
|---|---|---|---|
| `apps/backend/src/accounting/ledgerPosting/ledgerPostingService.ts` | 195 | `apps/backend/src/__tests__/ledgerPostingService.test.ts` (8 tests) | **Happy path only.** All 4 collaborators mocked (`ledgerPostingService.test.ts:22-25`), incl. `prepareJournalEntryForPersist` stubbed to identity (`:18-20`). No duplicate-post, race, out-of-range fiscal year, or closed-year case. Indirect: `financeCollectUseCases.test.ts:15-17,98,172,220` and `financeService.test.ts:43-44` replace the whole module with `vi.fn()` → call-count assertions only. |
| `apps/backend/src/accounting/repository/accountingRepository.ts` | 106 | none (pure interface, no runtime) | n/a — covered by `tsc`. |
| `apps/backend/src/accounting/repository/accountingRepositoryAdapter.ts` | 68 | none | **Zero direct coverage.** No test imports the adapter (verified by grep); the DB integration test imports the concrete `db/repositories` functions directly (`accountingPersistDb.integration.test.ts:20`). A missing/wrong delegation entry would be invisible to the suite. |
| `apps/backend/src/accounting/use-cases/accountingLedgerGuards.ts` | 48 | `accountingLedgerGuards.test.ts` (4 tests) | Good narrow coverage: label→FK resolution + `source_type` default (`:30-35`), unbalanced posted rejection (`:37-46`), unbalanced draft allowed (`:48-57`), closed-year rejection (`:59-63`). **Unresolved/unknown-year → null `fiscal_year_id` fallback (`:44`) untested.** |
| `apps/backend/src/accounting/use-cases/accountingLedgerOpsUseCases.ts` | 108 | `accountingLedgerOpsUseCases.test.ts` (10 tests) | Happy path per function + tenant-missing once (`:48-50`) + broadcast assertions. No validation-rejection, no limit/boundary, no error path; every assertion is on a mocked repo call. |
| `apps/backend/src/accounting/use-cases/accountingPeriodClose.ts` | 79 | `accountingPeriodClose.test.ts` (4 tests) | Not-found (`:33-37`), already-closed (`:39-45`), missing retained earnings (`:47-56`), happy close + closing entry (`:58-91`). Balanced-closing failure (`:46-48`), idempotent existing-closing skip (`:50-51`), all-zero-net path, explicit `retainedEarningsAccountId` override untested. |
| `apps/backend/src/accounting/use-cases/accountingUseCases.ts` | 393 | `accountingUseCases.test.ts` (9 tests, fake repo) | Pagination/metrics delegation + no-tenant defaults (`:67-98`), soft-delete filtering (`:100-227`), posted immutability for **`lines` only** (`:229-264`), `deleteAccountById` guard (`:266-274`), bulk account guard, mixed case (`:276-293`). No coverage of `deleteJournalEntryById`, non-line content changes, `updateJournalEntryById`, restore, or `replace*`. |
| `apps/backend/src/routes/tenant/accounting/accountingContractRouter.ts` | 104 | `accounting.integration.test.ts` (14 tests) | 3 of 4 handlers (`listAccounts`, `listEntries`, `listFiscalYears`) exercised, **non-paginated branch only**; 200 + 401 + 403 envelope checks. Paginated branch (`:25-31, :53-59, :81-87`) and `includeDeleted` 403 branch (`:21-23, :49-51, :77-79`) untested. |
| `apps/backend/src/routes/tenant/accounting/accountingReportRoutes.ts` | 31 | `accounting.integration.test.ts:400-455` (2 tests) | 200 aggregate passthrough + 403 for unauthorized role. Invalid-query 400 path (`:23`) untested. |
| `apps/backend/src/routes/tenant/accounting/accountingLedgerOpsRoutes.ts` | 169 | **none** | **Zero coverage.** No test file references `/posting-rules`, `/opening-balances`, `/bank-statements`, `/bank-reconciliations`, or `/fiscal-years/:id/close` (verified by grep across `apps/backend/src/__tests__` and `e2e`). |

Adjacent (outside the listed paths, found while auditing): `apps/backend/src/routes/tenant/accountingSetupConfigRoutes.ts`
has no integration test, while the equivalent contacts/enrollments setup routes do
(`contacts.integration.test.ts:1308`, `enrollmentsSetup.integration.test.ts:61`).

### Shared production files

| Production file | LOC | Covering test file(s) | Thoroughness |
|---|---|---|---|
| `packages/shared/src/accountingLedgerInvariants.ts` | 96 | `accountingLedgerInvariants.test.ts` (6 tests) | Strong: cent rounding, single-sided lines, balanced/imbalanced/zero-total, id+label resolution, money refinements. |
| `packages/shared/src/accountingLedgerPosting.ts` | 168 | `accountingLedgerPosting.test.ts` (8 tests) | Strong for pure builders: missing-accounts null, discount split, cash/AR, closing incl. contra balances, null-when-no-activity, opening balance rejection, reversal/credit-note/late-fee direction — with `isJournalEntryBalanced` asserted as an invariant. |
| `packages/shared/src/accountingReportAggregates.ts` | 73 | `accountingReportAggregates.test.ts` (2 tests) | Parse + empty defaults only. |
| `packages/shared/src/accountingModuleManifest.ts` | 210 | `__tests__/accountingModuleManifest.test.ts` (2 tests) direct; `__tests__/softDeleteSharedInvariants.test.ts:36-38`, `__tests__/softDeleteDtoGuards.test.ts:87,266-272,416` indirect | `accountRecordSchema` trim/blank + `accountRecordInsertSchema` soft-delete-field rejection + manifest soft-delete config. **`journalEntryRecordSchema` / `fiscalYearRecordSchema` have no direct test.** |
| `packages/shared/src/accountingLedgerOps.ts` | 121 | none directly; happy-path parse only via `accountingLedgerOpsUseCases.test.ts:61-70,83-94,129-169` | No rejection tests (`max(500)`, strictness, 2-decimal money, iso dates). `closeFiscalYearBodySchema`, `openingBalancesQuerySchema`, `fiscalYearParamsSchema` only reachable through the untested ledger-ops routes. |
| `packages/shared/src/accountingListQuery.ts` | 38 | none (types only) | n/a at runtime. |
| `packages/shared/src/accountingModuleSettings.ts` | 55 | none | Zero coverage. |
| `packages/shared/src/accountingSetupConfigTypes.ts` | 267 | none (referenced only by `contracts/accounting.contract.ts` + barrel) | Zero coverage. |
| `packages/shared/src/contracts/accounting.contract.ts` | 211 | none | 14 operations declared; only 3 are implemented in `accountingContractRouter.ts:15,43,71`, and the router casts itself `as unknown as RouterImplementation<typeof accountingContract>` (`:99`), so the missing handlers are not caught by `tsc`. |

### DB-integration and frontend/e2e

| Test asset | Coverage |
|---|---|
| `apps/backend/src/__tests__/db-integration/accountingPersistDb.integration.test.ts` (1 test, real Postgres) | `bulkSaveEntries` batched upsert parity: in-place update, insert, untouched-row preservation, child line/tag/attachment replacement (`:174-268`). Real persistence invariants asserted. Seeds **no** `source_type`/`source_id`, so the partial unique index is never exercised. |
| `apps/backend/src/__tests__/db-integration/crossTenantIsolation.integration.test.ts` | No accounting coverage at all (only `tenant_users`, `:1-40`). |
| `apps/backend/src/__tests__/db-integration/readonlyPathAudit.integration.test.ts:142-143` | Only `listAccountsByWorkspace` and `listAccountsPage` are asserted to run read-only. |
| `apps/backend/src/__tests__/softDeleteDataLayer.test.ts:363-380` | DB-level archive guard for `accountingAccountsRepository.bulkSoftDeleteAccounts` via a fake tx `$count`. |
| Frontend unit (7 files, 664 lines): `AccountingReportsTier.test.tsx`, `AccountingSettings.test.tsx`, `AccountingSetupTier.test.tsx`, `SimpleTransactionStepForm.test.tsx`, `useJournalEntriesTrashReversal.test.tsx`, `financialReportsExportHelpers.test.ts`, `journalEntriesQuickActions.test.ts` | Render/interaction, report export row building, quick-action parsing, and one client-side "posted entry cannot be trashed" warning (`useJournalEntriesTrashReversal.test.tsx:74-98`). No frontend test covers `useAccountingLedgerOps.ts`, `useAccountingTsrHooks.ts`, or `useAccountingApi.ts` ledger-ops calls. |
| e2e: `e2e/tests/tenant-critical-lifecycles.spec.ts:89`, `e2e/tests/tenant-operations-flow.spec.ts:105-107`, helper `e2e/helpers/tenantOperations.ts:649-734`; `e2e/tests/responsive-authenticated.spec.ts:62` | Creates two accounts, posts one 2500/2500 entry through the UI and asserts it appears in the list; RTL smoke. No assertion of stored accounting invariants, no reversal, no close, no duplicate post, no immutability check. |

---

## (b) Prioritised untested behaviour

### P0 — idempotency and the DB uniqueness contract

**G1. `persistGeneratedEntry` short-circuit is never executed.**
`apps/backend/src/accounting/ledgerPosting/ledgerPostingService.ts:28-29`
```ts
const existingId = await findEntryIdBySource(tenant, entry.source_type ?? '', entry.source_id ?? '');
if (existingId) return null;
```
No test returns a non-null id for the persist path: `ledgerPostingService.test.ts:44` sets it to `null` for every
test, and the only non-null stub (`:129-131`) answers the *separate* pre-lookup at
`ledgerPostingService.ts:135`. Missing test: call `tryPostInvoiceJournal` / `tryPostLateFeeJournals` /
`tryPostOpeningJournal` twice with `findEntryIdBySource` returning an id on the second call and assert `saveEntry`
was **not** called (and that `tryPostOpeningJournal` returns `null`).

**G2. Concurrent double-post and the partial unique index.**
`ledgerPostingService.ts:28-33` + `apps/backend/src/db/schema/accounting.ts:79-81` +
`apps/backend/src/db/migrations_drizzle/0092_accounting_ledger_integrity.sql:23-25`
(`accounting_entries_workspace_source_uidx` on `(workspace_subdomain, source_type, source_id)`, `deleted_at IS NULL`).
No test anywhere mentions the index or a `23505` on `accounting_entries` (grep: `23505` handling exists only for
contacts/faculty/students — `lib/pgErrors.ts` consumers). Two distinct untested outcomes:
* same entry id (the normal case — ids are deterministic, `ledgerPostingService.ts:45`): `saveEntry`
  (`apps/backend/src/db/repositories/accountingEntriesPersist.ts:85-98`) uses
  `onConflictDoUpdate(target: [workspace, id])`, so the loser of the race silently **overwrites** the winner's lines
  (children are deleted and re-inserted, `:23-48`) instead of being rejected. Nothing asserts this.
* different entry id with the same `(source_type, source_id)`: the insert conflicts on the partial index, which is
  **not** the conflict target, so it raises `23505`, and no accounting code maps it → raw 500. This is reachable
  because `source_type`/`source_id` are client-settable on the bulk upsert route
  (`packages/shared/src/accountingModuleManifest.ts:69-70, 98-99`; route `apps/backend/src/routes/tenant/accounting.ts:57`).
Missing tests: (a) DB test asserting a second insert with the same source pair and a different id is rejected/handled;
(b) a race test (two concurrent `persistGeneratedEntry` calls) asserting exactly one entry and no overwrite of the
winner's lines.

**G3. Shared `source_type: 'reversal'` namespace between invoice reversals and credit notes.**
`ledgerPostingService.ts:144` writes `source_id: invoice.id`; `ledgerPostingService.ts:192` writes
`source_id: creditNoteId`. No test covers the case where those two ids are equal. Production ids differ by prefix
today (`cn-${randomUUID()}` — `apps/backend/src/finance/use-cases/financeCollectUseCases.ts:135`;
`inv-${randomUUID()}` — `apps/backend/src/finance/use-cases/financeInvoiceGenerationUseCases.ts:57`), but nothing
enforces the disjointness, and any id reaching `tryPostCreditNoteJournal` that equals an existing invoice id makes
the credit-note journal disappear silently through G1's `return null`. Missing tests: (a) credit note whose id equals
an invoice id must still post (or the collision must be rejected explicitly); (b) an existing entry with
`source_type: 'reversal'` + `source_id: <invoiceId>` must not suppress `tryPostInvoiceReversalJournal`.

### P1 — fiscal-year resolution and closed-period interaction

**G4. `resolveYearId` → `undefined` and the resulting null `fiscal_year_id`.**
`ledgerPostingService.ts:66-68` (`years.find(...)`), consumed at `:87, :107, :144, :157, :192`.
When the posting date (or "today") falls outside every configured year the value is `undefined`, so
`accountingLedgerGuards.ts:44` (`fiscal_year_id: resolved?.id ?? entry.fiscal_year_id`) leaves it undefined and
`accountingEntriesPersist.ts:111` (`fiscalYearId: record.fiscal_year_id || null`) writes `NULL`
(column nullable: `schema/accounting.ts:64`). No test exercises this branch: `accountingLedgerGuards.test.ts:30-35`
always supplies a resolvable label, and every service test stubs the guard (`ledgerPostingService.test.ts:18-20`).
Same gap for an *unknown* label (e.g. `fiscal_year: 'FY-NOPE'`): `resolveFiscalYearRef` returns `null`
(`packages/shared/src/accountingLedgerInvariants.ts:85-92`), the closed check passes, and the entry persists with a
null FK — nothing rejects it. Missing tests: date outside all years → no throw, `fiscal_year_id` null (assert the
intended policy); unknown label → same.

**G5. Closed fiscal year + TODAY's-date system postings.**
`ledgerPostingService.ts:139, 156, 181` all use `postingDate(undefined)` = today
(`ledgerPostingService.ts:19-21`). If today lands inside a **closed** year, `resolveYearId` returns that year's id and
`accountingLedgerGuards.ts:34-36` throws 422. No test sets up a closed year covering the current date, and the
interaction is not wired in any test because the guard is stubbed in `ledgerPostingService.test.ts:18-20`.
Concrete untested consequence: `cancelInvoice` (`financeCollectUseCases.ts:114-124`) first persists
`status: 'cancelled'` (`:121`) and only then calls `tryPostInvoiceReversalJournal` (`:123`) — untransacted, so a 422
from the guard leaves a cancelled invoice with no reversal posting; `createCreditNote` has the same shape
(`:151-152`). Missing tests: closed-year-covering-today for reversal / late fee / credit note, asserting the intended
atomicity/compensation.

### P1 — immutability and archive guards

**G6. `assertEntriesMutable` covers only the `lines` field.**
`apps/backend/src/accounting/use-cases/accountingUseCases.ts:144-162`, comparison function `:60-77`.
`accountingUseCases.test.ts:229-264` mutates only `lines`. Untested: every other compared field
(`date, ref, description, status, fiscal_year, fiscal_year_id, source_type, source_id, transaction_type,
reversed_ref, simple_mode`, `:61-72`) and the normalisation tolerance (`normalizeLines` sort at `:43-50`,
`normalizeList` sort at `:52-54`) — e.g. reordering lines or tags on a posted entry must be tolerated, while flipping
posted→draft or rewriting the amount must be rejected. Also untested: `existing === undefined`
(posted id returned by `findPostedEntryIds` but absent from `findEntriesByIds` → silently allowed, `:154-160`), the
early returns at `:146` (`!tenant`, `!repo.findPostedEntryIds`, `entries.length === 0`), `postedIds.length === 0`
(`:148`), and the `updateJournalEntryById` call site (`:261-265`).
Separately, `deleteJournalEntryById`'s posted guard
(`accountingUseCases.ts:173-175`, message `Posted journal entries cannot be deleted`) has **no test anywhere**
(grep for that string returns 0 test hits); `accounting.integration.test.ts:370-383` mocks
`deleteJournalEntryById` wholesale, so even the route-level test cannot observe it.

**G7. `accountingPeriodClose.ts` failure and idempotency branches.**
* `:46-48` — `!lines && balances.some(net !== 0)` → 422 "Unable to produce a balanced closing entry". Untested.
* `:49-51` — existing `('closing', fiscalYearId)` entry → skip `saveEntry` but still mark the year closed. Untested
  (`accountingPeriodClose.test.ts:74` always stubs `null`).
* all-zero nets → `lines === null`, no throw, year still closed. Untested.
* `:28-29` — explicit `retainedEarningsAccountId` overriding preferences. Untested
  (the success test injects preferences, `:67`).
* `:34-37` — no test asserts the report is scoped to `dateFrom: year.startDate, dateTo: year.endDate`.

**G8. Archive-account guard: real count SQL untested; bulk partial branches untested.**
`accountingUseCases.ts:301-321` (single) and `:323-350` (bulk). Both tests inject fakes
(`accountingUseCases.test.ts:268, 279`), so the SQL that actually decides the guard —
`countActiveJournalLinesForAccount` (`apps/backend/src/db/repositories/accountingAccountsRepository.ts:329-356`) and
`countActiveJournalLinesForAccounts` (`:358-390`) — has **no test at all**: a wrong join or a dropped
`isNull(accountingEntries.deletedAt)` filter (`:351, :384`) would keep every existing test green while letting
accounts with live ledger lines be archived. Untested branches in the use-case: bulk all-blocked
(`accountingUseCases.ts:342-344`), failure arithmetic (`:345-349`, only `failed: 0` is exercised),
`deleteAccountById` missing tenant (`:306-307`) and blank id (`:309`).

### P2 — routes and shared schemas

**G9. `accountingLedgerOpsRoutes.ts` has zero coverage** (169 lines, 9 endpoints:
`/posting-rules` GET+PUT, `/fiscal-years/:id/close`, `/opening-balances` GET+PUT+POST, `/bank-statements` GET+PUT,
`/bank-reconciliations` POST). RBAC (`canReadCollection`/`canWriteCollection`), request-schema rejection,
`withTenant` read-only flags, and error mapping are all unverified at the HTTP boundary. The use-case tests mock
`accountingLedgerOpsRepository` (`accountingLedgerOpsUseCases.test.ts:26`), so no test proves the endpoints work.
Also untested in `accountingContractRouter.ts`: the paginated branch (3 handlers) and the
`includeDeleted`-without-delete-permission 403 branch.

**G10. Shared schema rejection paths and contract/handler drift.**
`packages/shared/src/accountingLedgerOps.ts` — only valid payloads are parsed anywhere
(`accountingLedgerOpsUseCases.test.ts:64-67, 86-88, 143, 155-161`): no test for `openingBalancesReplaceSchema`
`max(500)` (`:39`), the 2-decimal money refinement on balances (`:27-28`), `.strict()` rejection of unknown keys, or
invalid `isoDateSchema` on bank statements (`:49, :63-64`). `packages/shared/src/accountingModuleSettings.ts` and
`packages/shared/src/accountingSetupConfigTypes.ts` have no tests. `contracts/accounting.contract.ts` declares 14
operations but `accountingContractRouter.ts` implements 3, hidden behind the `as unknown as RouterImplementation`
cast at `:99`; nothing fails if a declared operation stays unimplemented.

---

## (c) Test-quality findings

1. **The posting-service tests assert plumbing, not accounting.** `ledgerPostingService.test.ts:65-72, 97-104,
   115-121, 143-149, 166-172, 185-191` assert only `ref`/`source_type`/`source_id` on the object passed to
   `saveEntry`. No assertion covers `lines`, debit/credit direction, `date`, `fiscal_year_id`, or balance. Swapping
   Dr/Cr inside the service (or dropping the fiscal-year resolution) would not fail that file.
2. **The reversal fixture is malformed and its output is unasserted.** `ledgerPostingService.test.ts:132-138` stubs
   `findEntryById` with lines keyed `accountId` instead of `account_id` (`packages/shared/src/accountingModuleManifest.ts:46`),
   and the assertion at `:143-149` never inspects the reversed lines — so the test passes even if
   `buildReversalLines` returned the original debit/credit. The swap is only proven for the pure builder
   (`accountingLedgerPosting.test.ts:118-131`).
3. **The guard is stubbed inside the service suite.** `ledgerPostingService.test.ts:18-20` replaces
   `prepareJournalEntryForPersist` with an identity function, so no test connects "system posting" to
   "closed-year/unbalanced/unknown-year" behaviour. Both suites pass independently, which creates an illusion of
   integration that does not exist.
4. **`accounting.integration.test.ts` is an auth/envelope test over a mocked module.**
   `:57-84` replaces the entire `accountingUseCases` object, so every 200 assertion is against the mock. It cannot
   detect a broken `assertEntriesMutable` even though it PUTs `/api/accounting/entries/bulk` (`:266-282`), and it
   never touches the ledger-ops routes.
5. **Delegation/call-count assertions dominate two suites.** `accountingUseCases.test.ts:74, 84, 96-97` and most of
   `accountingLedgerOpsUseCases.test.ts` (e.g. `:58, 69-70, 92-93, 102-103, 114-116, 126, 148-149, 163-168`) assert
   "the repo was called with the tenant" — plumbing, not accounting invariants. The only real invariants asserted
   anywhere in the unit suite are: balanced builders (`accountingLedgerPosting.test.ts:44, 58, 74, 86, 97, 115, 127`),
   the guard's balance/closed checks (`accountingLedgerGuards.test.ts:37-63`), posted-immutability for `lines`
   (`accountingUseCases.test.ts:262`), and the archive guard against fake counters (`:273, 291-292`).
6. **Tenant isolation is not tested for accounting at all.** `runWithTenant('demo', …)` plus mock assertions only
   prove the tenant string is passed. `crossTenantIsolation.integration.test.ts` covers `tenant_users` only, and
   `readonlyPathAudit.integration.test.ts:142-143` covers two read paths for read-only-ness. No test proves that a
   workspace cannot read or mutate another workspace's accounts/entries/fiscal years.
7. **Real-Postgres evidence is thin but genuine.** `accountingPersistDb.integration.test.ts:174-268` does verify
   persistence invariants (in-place update, untouched-row preservation, child replacement) — but with no
   `source_type`/`source_id` seeded, so `accounting_entries_workspace_source_uidx` is never exercised by any test.
8. **Tests that would still pass with broken accounting logic (explicit):**
   * every test touching the archive guard, if `countActiveJournalLinesForAccount(s)` SQL were wrong (G8);
   * the immutability guard for any edit other than `lines` (G6);
   * all posting-service tests if debit/credit direction were swapped in the service (Q1) or if reversal lines were
     not swapped (Q2);
   * all `accounting.integration.test.ts` 200-path tests if the underlying use-cases were replaced by stubs (Q4);
   * nothing fails if `persistGeneratedEntry`'s idempotency `return null` were deleted (G1) or if the partial unique
     index were dropped (G2).
9. **Vitest config note (environment, not logic):** `apps/backend/vitest.db.config.ts` uses `test.poolOptions`, which
   Vitest 4 removed — running it prints `DEPRECATED test.poolOptions was removed in Vitest 4`. The DB suite still runs,
   but `singleThread`/`isolate: false` are silently ignored.

   > **Update (fixed in #148):** the `poolOptions` block was removed and replaced with a top-level
   > `isolate: false` in `apps/backend/vitest.db.config.ts`, so the deprecation no longer prints and
   > isolation is actually applied (the DB suite also runs noticeably faster). The `pg`
   > `client.query() when the client is already executing a query` deprecation noted in (d) 3 remains
   > — it is test-only and concerns the future pg@9 upgrade.

---

## (d) Commands run and observed results

Root scripts (`package.json:9-14`, `apps/backend/package.json`, `packages/shared/package.json`):
`pnpm test` → `turbo run test`; backend `pnpm --filter mms-backend test:unit` (`vitest run`);
shared `pnpm --filter @mms/shared test:unit` (`vitest run`);
DB suite `pnpm --filter mms-backend test:db` (`vitest run --config vitest.db.config.ts`).
The default backend include is `src/__tests__/**/*.{test,spec}.ts` with
`exclude: ['src/__tests__/db-integration/**']` (`apps/backend/vitest.config.ts`), so DB tests are opt-in.

Per the audit instruction, only accounting/shared-accounting files were run — no full suite, no e2e, no servers.

1. Backend accounting unit files (no DB required):

```bash
cd apps/backend && pnpm exec vitest run \
  src/__tests__/accounting.integration.test.ts \
  src/__tests__/accountingLedgerGuards.test.ts \
  src/__tests__/accountingLedgerOpsUseCases.test.ts \
  src/__tests__/accountingPeriodClose.test.ts \
  src/__tests__/accountingUseCases.test.ts \
  src/__tests__/ledgerPostingService.test.ts
```
Observed: `Test Files 6 passed (6)`, `Tests 49 passed (49)`, exit code 0, duration 2.25s.
Per file: `accountingLedgerGuards` 4, `accountingPeriodClose` 4, `ledgerPostingService` 8,
`accountingLedgerOpsUseCases` 10, `accountingUseCases` 9, `accounting.integration` 14.

2. Shared accounting files:

```bash
cd packages/shared && pnpm exec vitest run \
  src/accountingLedgerInvariants.test.ts \
  src/accountingLedgerPosting.test.ts \
  src/accountingReportAggregates.test.ts \
  src/__tests__/accountingModuleManifest.test.ts
```
Observed: `Test Files 4 passed (4)`, `Tests 18 passed (18)`, exit code 0, duration 171ms
(`accountingReportAggregates` 2, `accountingLedgerPosting` 8, `accountingLedgerInvariants` 6,
`accountingModuleManifest` 2).

3. Accounting DB integration file:

```bash
cd apps/backend && pnpm exec vitest run --config vitest.db.config.ts \
  src/__tests__/db-integration/accountingPersistDb.integration.test.ts
```
Observed: `Test Files 1 passed (1)`, `Tests 1 passed (1)`, exit code 0. Re-run with `--reporter=verbose` printed
`✓ … > upserts entries and replaces children while preserving untouched rows 12ms` — i.e. **not** skipped: a local
PostgreSQL was already reachable (`pingDatabase()` returned true at
`accountingPersistDb.integration.test.ts:43`), so this ran against real Postgres. No server or database was started by
this audit. Two non-fatal warnings appeared: the Vitest 4 `test.poolOptions` deprecation and
`pg` `client.query() when the client is already executing a query is deprecated`
(`accountingPersistDb.integration.test.ts:46-68`).

Not run (out of the requested scope): the remaining ~180 backend test files, the rest of the `db-integration`
directory, Playwright e2e suites, and frontend Vitest suites. No coverage tool was run, so no percentage figures are
claimed.
