# Accounting reporting, seeding, printable statements & exports audit

Scope: the financial-statements engine, COA seeding, printable vouchers/statements and the
CSV/XLSX export & bulk-import paths — reconciliation, opening/closing continuity, index use,
BiDi correctness and memory safety.

Method: traced each figure to its SQL, proved the identities with a real-PostgreSQL suite and pure
unit tests, and fixed what the measurements exposed. Findings are labelled by severity.

## 1. Verified sound (no change)

| Area | Evidence |
|---|---|
| Period semantics | Range drives flows (P&L, cash movement, Trial Balance rows); as-of drives stock (Balance Sheet); closing journals are excluded from the Income Statement and included in the Trial Balance |
| Money precision | Every figure aggregates in integer cents and converts once; the DTO enforces 2-dp money |
| GL math | Opening is strictly `< dateFrom`, movement is inclusive, `closing = opening + debit − credit`; posted + non-deleted only; functional currency only |
| COA seeding | `seedAccountsIfEmpty`: per-tenant advisory lock, counts **all** rows (archived included), chart + settings defaults in one transaction; 409 on a second seed. DB suite: two tenants concurrently, exactly one of two concurrent seeds, archived-row refusal |
| Voucher printing (7 kinds → payment/receipt/journal) | Print window sets `<html lang dir>`, RTL font stack, severs `opener`, escapes every interpolated value |
| Export safety | `escapeCsvCell`/`sanitizeExportValue` neutralise `= + - @ \| %`, tab/CR and whitespace-hidden formulas while keeping negative numbers numeric; ExcelJS writes strings (no formula interpretation) |
| Export backpressure/limits | Streaming CSV via `Readable.from(…, { highWaterMark: 16384 })` + `drain`-aware upload; buffered CSV capped at 50 MB / 5 000 rows; XLSX/JSON capped at 10 000 rows (413) |
| Bulk journal writes | Strict schema, 2 000-row cap, OCC, draft/post gate, and the 0254 trigger rejects unbalanced / single-line / zero-total / closed-period / summary-account postings. No journal CSV import by design |

## 2. Findings

- **R1 (P1) — report PDFs were not BiDi.** `exportReportPdf` used jsPDF `helvetica` + autoTable with
  no shaping/direction, so Arabic/Urdu/Farsi statements printed disconnected and LTR. The Typst BiDi
  engine and `financial-ledger.typ` existed but nothing invoked them.
- **R2 (P1) — gross cash flow double-counted internal transfers**, and `netCashFlowIndirect` was an
  ad-hoc `netSurplus + depreciation − ΔAR + ΔAP` that silently diverged from the direct movement for
  prepaid/accrued/inventory/contra-asset (non-name-matched) entries.
- **R3 (P1) — the GL page was three separate snapshots.** `loadAccountLedger` issued
  `Promise.all` over three read transactions, so a posting between them made the page's running
  balances disagree with `closingBalance` and with the next page.
- **R4 (P2) — the GL page materialised the whole account ledger per page** (`COUNT(*) OVER ()` and a
  window over every window row, then `rn > offset`), so deep paging cost grew with ledger size.
- **R5 (P2) — the trial balance made 2–3 full ledger passes** per report. (Index coverage was
  checked against the migrated database: `accounting_entries_workspace_status_date_active_idx`
  (0248) and `accounting_journal_lines_covering_idx` (0248) already serve the report predicates, so
  no new index was needed — the earlier plan to add one was dropped after inspection.)
- **R6 (P2) — balance-sheet rows diverged from the printed total**: `equity` includes unclosed P&L
  but the Equity rows did not, so the exported/on-screen rows did not add up to "Total Equity".
- **R7 (P2) — no accounting server export.** The registered `POST /api/accounting/export` route had no
  `accounting:export` runner (permanent 503) and the ledger export existed only in the browser, so a
  large register was truncated to the loaded page.

## 3. Fixes

1. **One-pass statements (R5).** `aggregateAccountingReport` now reads the ledger once with three
   conditional-aggregate sets (as-of / range / flow-excluding-closing). The existing 0248 indexes
   were verified as covering the predicates; the redundant `accounting_lines_workspace_account_idx`
   (a prefix of the covering index) is noted as a follow-up, not dropped here.
2. **Cash flow (R2).** Entry-level cash legs: `inflow += max(0, debit − credit)`,
   `outflow += max(0, credit − debit)`, so a transfer cancels instead of inflating both sides. The
   indirect total is derived from every non-cash account (`netSurplus − Σnon-cash BS(debit − credit)`),
   which reconciles to the direct movement by construction; `cashFlowAdjustments.other` carries the
   residual so the displayed lines always sum to it.
3. **GL snapshot + bounded paging (R3, R4).** `loadAccountLedger` reads opening, movement, count and
   the page inside **one** `repeatable read` transaction (`withTenantRead` gained `isolation`). The
   page query sorts/windows only the prefix up to `offset + limit` (`page_prefix` CTE) and takes the
   total from a separate count, so a deep page costs the prefix, not the ledger.
4. **Reconciling statements (R6).** The Balance Sheet panel and its export emit a "current period
   surplus (unclosed)" line whenever `equity ≠ Σ equity rows`, and the cash-flow panel/export show the
   `other` adjustment when non-zero (copy in en/ar/ur/fa).
5. **BiDi PDFs (R1).** New `trial-balance.typ` (BiDi, `lang`/`direction` from the payload); `trial-balance`
   added to `TypstTemplateType`; server-built payloads (`accountingReportPdfUseCases`) from the same
   aggregates/ledger reads (never client input); `accounting:report-pdf` runner on the sandboxed PDF
   queue saves a downloadable artifact; `POST /api/accounting/reports/pdf` enqueues it (module action
   `read`); the report UI hides the client PDF and offers the server one. The GL PDF reuses
   `financial-ledger.typ` with a 10 000-line ceiling (413 with a narrowing hint). Both document
   endpoints are declared in the ts-rest contract (`accountingReportDocuments.contract.ts` + handlers)
   so the frontend uses `apiContract` instead of the raw transport — the direct-api-client baseline
   stays empty.
6. **Server exports (R7).** `POST /api/accounting/export` now has its `accounting:export` runner
   (COA, via `createModuleExportService`: streamed CSV, 10 000-row XLSX cap) and
   `POST /api/accounting/reports/ledger/export` streams the whole register with a keyset
   `(date, entry_id, id)` pager to a downloadable artifact (`accounting:export-ledger`).

## 4. Files changed

| Area | Files |
|---|---|
| Statements | `db/repositories/accountingRepositoryReport.ts`, new `accountingReportCashFlow.ts` |
| GL | `db/repositories/accountingReportEndpointsRepository.ts` (snapshot + bounded paging), new `accountingLedgerDocumentRepository.ts` / `accountingReceivablesAgingRepository.ts` (300-line splits), `db/tenant-context.ts` (`isolation`), `accounting/use-cases/accountingReportEndpointsUseCases.ts` |
| PDFs | `worker/templates/trial-balance.typ`, `worker/processors/typst-compiler.ts`, `accounting/use-cases/accountingReportPdfUseCases.ts`, `services/backgroundJobAccountingRunners.ts`, `routes/tenant/accounting/accountingReportDocument{Enqueue,Handlers}.ts`, `contracts/accountingReportDocuments.contract.ts`, `lib/moduleRouteActionRulesFinance.ts` |
| Exports | `services/accountingExportService.ts`, `lib/registerModuleCsvExportJobRunner.ts` (`kind`), `lib/csvExportEnqueue.ts` (reused) |
| Shared/UI | `finance/accountingReportAggregates.ts` (`other`), `finance/accountingReportEndpoints.ts` (PDF/export bodies), `documents/typstDocumentPayloadTypes.ts` (trial-balance payload), i18n ×4, `FinancialReports`, `FinancialStatementPanels`, `CashFlowStatementPanel`, `GeneralLedger(+Summary)`, `ExportToolbar(Compact)`, `ReportDataGridContainer`, hooks `useAccountingReportPdfExport` / `useAccountingLedgerExport` |
| Tests | `accountingReportCashFlow.test.ts` (new), `accountingExportService.test.ts` (new), `accountingReportPdfDocuments.test.ts` (new), `accountingReportDocumentEnqueue.test.ts` (new), `accountingReportDb.integration.test.ts` (transfer + indirect), `typstEngine.test.ts` |
| Docs | this file + `docs/README.md` |

## 5. Decisions & residuals

1. PDFs are server-rendered by Typst for all locales (one code path); jsPDF stays for non-accounting
   modules. An unavailable Typst binary surfaces as a failed job (`TemplateRenderError`), never an
   empty PDF.
2. The streamed ledger CSV has no running-balance column (a streamed multi-page prefix sum would need
   a per-row scan); the on-screen page export and the PDF keep it.
3. The 10 000-line printable ledger ceiling returns 413 with a "narrow the range" message rather than
   silently truncating.
4. Seeding is unchanged — the recorded proof is the existing DB suite (cross-tenant, concurrent,
   archived-row).
5. Deleted-account lines are still excluded from the trial balance (the archive guard prevents new
   cases); detecting historical imbalance is out of scope for this change.
6. The Typst template is path-tested but not compiled locally (no `typst` binary in this environment);
   production rendering uses the same engine as report cards, and a missing binary fails the job
   loudly. The template was written against the existing `financial-ledger.typ` constructs.
7. No index migration shipped: the plan's 0258 duplicated indexes that migration 0248 already
   creates (`accounting_entries (workspace, status, date DESC) WHERE deleted_at IS NULL` and
   `accounting_journal_lines (workspace, account_id) INCLUDE (debit, credit)`). Verified on the
   migrated database and removed before landing.

## 6. Verification

```bash
pnpm typecheck && pnpm --filter @mms/shared build
pnpm --filter @mms/shared test   # 288 files / 2354 tests
pnpm --filter mms-backend test   # 549 files / 3925 tests
pnpm --filter mms-frontend test  # 1218 files / 4569 tests
# throwaway PG16 + db:migrate:
DATABASE_URL=… pnpm --filter mms-backend test:db -- accounting finance auditAtomicityDb
#   → 39 suites / 236 tests on a fresh PostgreSQL 16
DATABASE_URL=… pnpm --filter mms-backend test:db -- accountingReportDb accountingSeedDb
pnpm run check:code-norms && pnpm run check:db-projections && pnpm run check:backend-boundaries \
  && pnpm run check:docs && pnpm run check:i18n && pnpm run check:migration-hygiene \
  && pnpm run check:migration-indexes && pnpm run check:tdd-pairing
DATABASE_URL=… bash scripts/ci/local-ci.sh --with-db
```
