# Accounting shared contracts & TypeScript definitions audit

Scope: the Accounting domain model in `packages/shared` — DTO ownership, enum/registry consistency
with the database, and runtime schema strictness for money and balanced vouchers.

Method: traced every Accounting DTO to its declaring module, compared the shared enums with the DB
`CHECK` constraints and the client interfaces, and probed the Zod boundary with failing inputs. The
fixes below remove duplicate declarations and close the places where a type was looser than the schema
it was supposed to describe.

## 1. Verified centralised (no change)

| Area | Evidence |
|---|---|
| COA nodes | `accountingModuleManifest.ts` (`accountRecordSchema`/insert/update, strict), `accountingAccountHierarchy.ts` (cycle/depth mirror), `accountingDefaultChart.ts`; backend repositories and the frontend re-export the shared `Account` (the frontend `ACCOUNT_TYPE_META` derives `normalBalance` from `normalBalanceForAccountType`) |
| Journal voucher payloads | record + line schemas, `accountingRecordLists.ts` caps, `accountingJournalTemplates.ts`, `accountingSpecializedEntries.ts` (fee/salary discriminated union used by the backend route), `accountingJournalReversal.ts` |
| FX rate models | `accountingFxSettings.ts` (`exchangeRateRecordSchema`, from≠to refinement), `accountingFxLines.ts`, `accountingFxRevaluation.ts`, `accountingFxReport.ts`, `accountingHyperinflation.ts` |
| Hedge records | `accountingHedgeSchemas.ts` + `accountingHedges.ts` (IFRS 9 valuation) |
| Report interfaces | `accountingReportAggregates.ts`, `accountingReportEndpoints.ts`, `accountingHttpResponses.ts` (every envelope lives there; no accounting route declares an inline response schema), `financialLedgerTypes.ts` |
| Enum registry | `accountingEnums.ts` is the canonical list; `financeAccountingConstraintsParity.test.ts` pins account types, fiscal-year statuses, posting-period statuses and source types to the 0248/0252/0253 SQL, and every DB check to the Drizzle model |
| Voucher/period states | stored statuses are `draft`/`posted` (matching `accounting_entries_status_chk`); `reversed` is derived (`JOURNAL_ENTRY_LIFECYCLE` + `isJournalEntryReversed`, shared by backend and UI); fiscal years active/closed/upcoming and posting periods open/closed match their checks |
| Money | no `any` in `packages/shared/src/finance`; no bare `z.number()` money in accounting DTOs; TypeBox is not used in this repository — Zod is the only runtime validator |
| Package drift | both apps depend on `@mms/shared` via `workspace:*`, and `turbo.json` makes `typecheck`/`test` depend on `^build`, so the built `dist` cannot drift from source |

## 2. Findings

- **S1 (P1) — hedge records were declared twice.** `accountingHedgeSchemas.ts` exported manual
  `HedgeRelationship` / `HedgeValuationRecord` interfaces while `accountingHttpResponses.ts` declared
  the matching Zod record schemas. Use cases returned the interfaces and routes validated with the
  schemas through `sendValidated(payload: unknown)`, so drift would only appear as a runtime 500.
- **S2 (P1) — the seeded chart was outside the subtype registry.** 13 default-chart subtypes were
  missing from `ACCOUNT_SUBTYPES` (`Current Assets`, `Fixed Assets`, `Cash & Bank`, `Current
  Liabilities`, `Long-Term Liabilities`, `Equity`, `Cost of Sales`, `Operating Expenses`, `Other
  Expenses`, `Other Income`, `Tax & Exceptional`, …), and nothing checked the seed against the
  registry — so the UI subtype picker could not represent accounts the seed created.
- **S3 (P1) — the request schema did not enforce balanced vouchers.** `PUT /entries/bulk` accepted
  `journalEntryListSchema` (the stored record shape), so an unbalanced posted voucher was only
  rejected later by the use-case guard (422) or the 0254 trigger.
- **S4 (P2) — duplicated money schema.** `accountingSpecializedEntries.ts` carried a local
  `moneyDecimalStringSchema = /^\d+(\.\d{1,2})?$/` instead of the canonical decimal-string schema
  (no integer bound, different error message).
- **S5 (P2) — types looser than their schemas.** `AccountingListQuery.status?: string` /
  `accountType?: string` while the runtime schemas use enums; `accountingFinancialStatementItemSchema.type`
  was `z.string()`; the accounting report objects were not `.strict()`.
- **S6 (P2) — no DB pin for the stored journal statuses.** The parity test pinned the other enums but
  not `JOURNAL_ENTRY_STATUSES` against `accounting_entries_status_chk`, and nothing asserted that the
  derived `reversed` state stays out of the database vocabulary.
- **S7 (P2) — dead duplicated ledger math in the frontend.** `lib/data/accountingCalculations.ts`
  (`computeLedger`/`computeTrialBalance`/`computeFinancials`) re-implemented invariants owned by
  `packages/shared` and the server aggregates; no production code imported it.
- **S8 (P3) — hardcoded voucher status options** in `AccountingFiltersMenuButton` instead of deriving
  them from `JOURNAL_ENTRY_STATUSES`.
- **S9 (P3) — rate-key shape inlined twice.** Two repository signatures repeated
  `{ fromCurrency, toCurrency, rateDate, rateType }` instead of one shared key type.
- **S10 (P3) — `accountingApiResponses.test.ts`** actually exercised `accountingHttpResponses.ts`
  (overlapping the sibling file); renamed.
- **Adjacent (documented, out of scope):** `financeReportAggregates.ts` still carries money as
  unguarded `z.number()` (`collected`, `outstanding`, `total`, `totalDiscounted`), unlike the
  accounting aggregates; fixing it needs server-side rounding first and belongs to the finance module.

## 3. Fixes

1. **One declaration per DTO (S1).** `hedgeValuationFiguresSchema` / `hedgeValuationRecordSchema` /
   `hedgeRelationshipRecordSchema` moved into `accountingHedgeSchemas.ts` next to the designation
   fields they extend; `HedgeRelationship` / `HedgeValuationRecord` are now `z.infer` outputs, the
   manual interfaces are gone, and `accountingHttpResponses.ts` re-exports the schemas so every import
   path is unchanged.
2. **Registry and seed agree (S2, S6, S8).** `ACCOUNT_SUBTYPES` gained the seeded captions (both
   spellings stay selectable); `accountingDefaultChart.test.ts` now rejects any chart type/subtype
   outside the registry. The parity test pins `JOURNAL_ENTRY_STATUSES` to the SQL installing
   `accounting_entries_status_chk` and asserts the derived-only `reversed` value never appears there.
   The journal filter menu derives its options from `JOURNAL_ENTRY_STATUSES`.
3. **Balanced writes at the boundary (S3).** New `journalEntryWriteSchema` /
   `journalEntryWriteListSchema` in `accountingRecordLists.ts`: a **posted** voucher must have ≥2
   single-sided lines, `isJournalEntryBalanced` must hold, and `journalCurrencyImbalances` must be
   empty; drafts stay shape-only. `PUT /entries/bulk` now validates with the write list, so an
   unbalanced posted body returns **400 `validation_error`** with the `lines` path and the
   `accounting.voucher.unbalanced` message instead of a later 422. The response schema
   (`journalEntryRecordSchema`) is untouched, so legacy rows still serialise, and the use-case guard +
   0254 trigger remain as defence in depth.
4. **Canonical money schema (S4).** The specialized-entry amount uses
   `nonNegativeMoneyDecimalAmountSchema` (bounded integer part, storage decimals, canonical message);
   the money policy (2-dp guarded numbers for functional amounts, decimal strings for FX/hedge/
   statement amounts) is documented in `accountingLedgerInvariants.ts`.
5. **Types match schemas (S5, S9).** `AccountingListQuery.status` is `JournalEntryStatus` and
   `accountType` is `AccountingAccountType` (UI `all` sentinel narrowed with the new
   `isJournalEntryStatus` guard); `financialStatementItem.type` is the account-type enum; the
   statement item, trial-balance row, cash-flow adjustments and aggregate objects are `.strict()`.
   `ExchangeRateKey` (a `Pick` of `ExchangeRateRecord`) replaces the two inlined key shapes.
6. **Dead duplicate removed (S7).** `apps/frontend/src/lib/data/accountingCalculations.ts` is deleted
   with its re-exports; `accountingData.test.ts` now pins `centsToMoney` against the shared
   `moneyToCents`/`isJournalEntryBalanced` rules, and the local `JournalAmountSide`/form status unions
   reuse `NormalBalance`/`JournalEntryStatus`.

## 4. Files changed

| Area | Files |
|---|---|
| Shared registries & schemas | `finance/accountingEnums.ts`, `accountingRecordLists.ts`, `accountingHedgeSchemas.ts`, `accountingHttpResponses.ts`, `accountingReportAggregates.ts`, `accountingListQuery.ts`, `accountingSpecializedEntries.ts`, `accountingLedgerInvariants.ts`, `accountingFxSettings.ts` |
| Backend | `routes/tenant/accounting.ts` (write list schema), `accounting/repository/accountingFxRepository.ts`, `db/repositories/accountingExchangeRatesRepository.ts`, `__tests__/financeAccountingConstraintsParity.test.ts`, `__tests__/accounting.integration.test.ts` |
| Frontend | deleted `lib/data/accountingCalculations.ts`; `lib/data/accountingData.ts`(+test), `lib/journalEntriesControllerFilters.ts`, `hooks/useJournalEntriesFilterBridge.ts`, `hooks/useJournalLineAssist.ts`, `lib/journalEntryFormValidation.ts`, `components/AccountingFiltersMenuButton.tsx` |
| Tests | `accountingWriteSchemas.test.ts` (new), `accountingDefaultChart.test.ts`, `accountingHedgeSchemas.test.ts`, `accountingReportAggregates.test.ts`, renamed `accountingResponseEnvelopes.test.ts` |
| Docs | this file + `docs/README.md` |

## 5. Documented decisions
1. Zod only — the repository has no TypeBox dependency, and introducing one was rejected.
2. Money stays as documented: 2-dp numbers with safe-cents guards for functional amounts, decimal
   strings for FX/hedge/statement figures. A full string migration is a separate breaking change.
3. `ACCOUNT_SUBTYPES` gained values; the seeded chart data was not rewritten, so already-seeded
   tenants keep their labels while the picker offers them.
4. `PUT /entries/bulk` now answers 400 for an unbalanced posted voucher (previously 422 from the use
   case). The message key is unchanged; drafts and legacy responses are unaffected.
5. `financeReportAggregates` unguarded money is recorded as a finance follow-up.

## 6. Verification

```bash
pnpm typecheck && pnpm --filter @mms/shared build
pnpm --filter @mms/shared test    # 289 files / 2368 tests
pnpm --filter mms-backend test    # 549 files / 3928 tests
pnpm --filter mms-frontend test   # 1218 files / 4566 tests
DATABASE_URL=… pnpm --filter mms-backend test:db -- accounting finance auditAtomicityDb
pnpm run check:code-norms && pnpm run check:db-projections && pnpm run check:backend-boundaries \
  && pnpm run check:docs && pnpm run check:i18n && pnpm run check:migration-hygiene \
  && pnpm run check:migration-indexes && pnpm run check:tdd-pairing
DATABASE_URL=… bash scripts/ci/local-ci.sh --with-db
```

No migration: every DB enum already matched the shared registry, and the change is schema/type-level
plus one request-validation tightening.
