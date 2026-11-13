# Accounting API layer audit — route schemas, error envelopes, pagination

Scope: the Accounting HTTP surface — the five named plugins (`accountingExchangeRateRoutes`,
`accountingVoucherNumberingRoutes`, `accountingReversalRoutes`, `accountingHedgeRoutes`,
`accountingIas29Routes`) plus the families that shared their conventions (`accountingReportRoutes`,
`accountingLedgerOpsRoutes`, `accountingFxRevaluationRoutes`, `accountingSpecializedEntryRoutes`,
`accountingSeedChartRoutes`, the chart-of-accounts lifecycle routes and the generic bulk registrars the
module uses), their ts-rest contracts and the client hooks that consume them.

Method: every claim is traced to the handler and, where one exists, to a test. "Verified" means the
control is enforced at runtime, not merely declared. No migration was needed: this change is request/response
validation, error envelopes and pagination.

---

## 1. What was already correct (verified, no change)

| Area | Evidence |
|---|---|
| The five named route files are fully validated | Exchange rates: every body/query parsed, every response through `sendValidated` (`accountingExchangeRateRoutes.ts`). Voucher numbering: query + body + response. Reversal: `resourceIdParamsSchema` + `journalReversalRequestSchema` + `journalReversalResultSchema`. Hedges: every write through `handleWrite`, list/preview validated. IAS 29: settings, price indices and both run endpoints validated. |
| No request field bypasses validation | Repo-wide grep for `request.body`/`request.query`/`request.params` outside `parseRequest`: zero in the Accounting routes. |
| Domain → HTTP mapping, no DB leakage | `mapDomainError` (4xx → `{type,message,violations?,details?}`), `sendDatabaseError` (23514 → 422 `ledger_guard` with a curated message, mapped SQLSTATEs → 400/409, otherwise 500 + server-side log), `sendValidated` → 500 `contract_violation`, ts-rest error handlers (Zod → 400, FK → 409, response drift → 500). |
| Ledger-ops request schemas | `.strict()` bodies with exact money decimals (`moneyAmountSchema`), `openingBalancesReplaceSchema` capped at 500 rows and single-sided, ordered date ranges, bounded ids. |
| General Ledger endpoint | Server-computed opening/movement/running balance, `.strict()` query with `limit ≤ 100` and ordered range, `total`/`hasMore`; keyset `afterId` honored (`id >` + `asc(id)`) with a `nextCursor`; compatibility branch capped at `UNPAGINATED_LIST_CAP` with `truncated`; `includeDeleted` gated by delete permission. |
| Contract router | ts-rest with `responseValidation: true` and the shared request-validation error handler. |

## 2. Findings

### Route schema completeness
- **A1 (P0) — 24 accounting responses were never validated.** Ledger ops 12 (`accountingLedgerOpsRoutes.ts` ×11 + `accountingBankingRoutes.ts`), reports 3, FX 4, specialized 1, seed 1, account archive/restore/bulk-delete 3 — all `reply.send` of hand-built payloads. A mapper that emitted a non-canonical decimal, an extra audit column or a missing key looked like a correct response. The contract declared `/ledger`, `/receivables-aging` and `/report-aggregates` with response schemas that nothing enforced, because the plain routes ignore the contract.
- **A2 (P1) — 23 validation sites discarded `details.issues`** by passing `parsed.message` instead of the parse result (reports 3, FX 3, ledger-ops 13, specialized 1), while 22 other sites preserved them.
- **A3 (P2) — five GETs accepted an unvalidated querystring** (`/currency-settings`, `/currency-exchangeability`, `/posting-rules`, `/bank-statements`, `/fx-revaluations`).
- **A4 (P2) — `POST /accounts/seed-default` had no request schema** (any JSON body accepted) and no response schema.
- **A5 (P2) — the three accounting list queries were `.passthrough()`**: `stat=posted` passed validation and was then ignored, returning unfiltered data under a filtered-looking UI — the exact bug class documented in `accountingListQuery.ts`.
- **A6 (P2) — the bulk-upsert bodies were unbounded arrays** (`z.array(...)` with no `.max()`).
- **A7 (P2) — `nextCursor` was emitted but undeclared** in the entries page contract.

### Domain error mapping
- **B1 (P1) — no machine-readable code.** Statuses were right (unbalanced/period-closed/year-locked/non-postable/currency-lock/exchangeability → 422, already-reversed → 409) but six different failures shared `type: "validation_error"`, so a client could only distinguish them by matching English prose.
- **B2 (P1) — `mapDeleteError` broke the envelope and the status**: any delete error whose message contained "Posted" became `400 { error }`, overriding the 422 `ledgerError` the use case already threw and diverging from the contract's `{success:true}` response.
- **B3 (P2) — two `ledgerError` definitions** (`accountingLedgerErrors.ts` and a local one in `accountingPeriodClose.ts`).
- **B4 (P2)** — eight `throw new Error("Tenant context required")` sites would have surfaced as 500 if the ALS tenant were ever lost.

### Pagination & projections
- **C1 (P1) — the aging report could not paginate**: the query took only `asOf`, the loader read 500 rows and returned `hasMore`, so the remainder was unreachable.
- **C2 (P1) — the Overview/Journal subtabs still paged the whole ledger through the browser**: `useAllAccountingEntries` → `fetchAllAccountingEntries` issued up to 50 × 100 `listEntries` calls, each entry carrying all of its lines, tags and attachments, and the dashboard recomputed the money figures client-side even though `/report-aggregates` and `/metrics` existed. The register list also always eager-loaded line sets and always ran `count(*)`.
- **C3 (verified)** — the ledger endpoint itself was already correct (see §1).

---

## 3. What changed

### Error contract (`code`)
`ACCOUNTING_ERROR_CODES` (`packages/shared/src/finance/accountingErrorCodes.ts`) plus an optional `code` that
`ledgerError`, `ConflictError`, `ValidationError`, `NotFoundError` and `PolicyViolationError` attach to the
error instance; `mapDomainError`, `handleContractError` and `installContractErrorHandler` read it
structurally and put it in the envelope (the contacts subclasses that already declared their own `code`
are unchanged). `type` and `message` keep their values, so existing clients keep working; new clients
branch on the code.

| Code | Where |
|---|---|
| `accounting.voucher.unbalanced` | journal balance + per-currency imbalance guards |
| `accounting.voucher.posted` | posted-entry immutability, posted-entry delete |
| `accounting.voucher.already-reversed` | reversal conflict and its unique-race fallback |
| `accounting.reversal.not-allowed` | draft reversal, non-reversible source types |
| `accounting.period.closed` | posting-period lock |
| `accounting.year.closed` | closed fiscal year (any write), already-closed close |
| `accounting.year.close-blocked` | the three year-end close preconditions |
| `accounting.account.not-postable` | archived/inactive/summary account, retained-earnings role |
| `accounting.account.currency-locked` | IAS 21 account-currency lock |
| `accounting.fx.no-rate` | missing closing/spot rate for a revaluation |
| `accounting.fx.lack-of-exchangeability` | estimated rate without an estimation reason |

`DELETE /api/accounting/entries/:id` now answers the shared `422 {type,message,code}` envelope (the
message-sniffing `mapDeleteError` is gone). The code member deliberately does not live on the
`HttpDomainError` base: subclasses such as the contacts errors declare their own literal `code`, and a base
member would have forced `override` (and a type widening) on all of them.

### Response contracts
Every Accounting response now goes through `sendValidated`: new envelopes in
`accountingHttpResponses.ts` for posting rules, fiscal-year close, posting periods, opening balances,
bank statements, reconciliation, FX runs/report, specialized entries, chart seeding, archive/restore/bulk
archive and the three bulk upserts; `fxReportSchema` and its row schemas were authored in
`accountingFxReport.ts` (the report was previously a TypeScript interface with no runtime contract).
A drifted payload now answers `500 contract_violation` and is logged with the request id.

### Request strictness
`/currency-settings`, `/currency-exchangeability`, `/posting-rules`, `/bank-statements` and
`/fx-revaluations` reject any query parameter (`emptyQuerySchema`); `POST /accounts/seed-default` rejects a
body; the entries/accounts list schemas are `.strict()` (with a dedicated strict fiscal-year schema so the
global `baseListQuerySchema` other modules share is untouched); the bulk-upsert arrays are capped
(accounts 2000, entries 2000, fiscal years 200). The 23 sites that dropped `details.issues` now pass the
parse result.

### Pagination & projection
- `GET /receivables-aging` accepts `page`/`limit` (1–500, default 100) and returns `page`/`limit`/`total`;
  `hasMore` is now actionable. The report panel pages with previous/next.
- `GET /entries?includeLines=false` returns header fields plus `lineCount`/`debitTotal`/`creditTotal`
  computed by one grouped aggregate, with `lines: []`. The register requests the projection; the drawer
  reads the full entry through the new `GET /entries/:id` (404 when unknown or outside the tenant, 403
  without read permission). Tags/attachments stay in the list — they are rendered row chips and tiny next to
  the line sets.
- The Overview/Journal whole-ledger fetch is gone: the dashboard takes its money figures from
  `/metrics` + `/report-aggregates`, and the six-month revenue/expense chart is now a server series
  (`monthly` on the command metrics) instead of a browser computation over every voucher. `recentEntries`
  renders the current page.

---

## 4. Files changed
Shared: `accountingErrorCodes.ts` (new), `accountingHttpResponses.ts`, `accountingFxReport.ts`,
`accountingListQuery.ts`, `accountingReportEndpoints.ts`, `accountingRecordLists.ts` (new, split from the
manifest for the 300-line ceiling), `accountingModuleManifest.ts`, `settings/moduleCommandMetricsFinance.ts`,
`contracts/accounting.contract.ts`, `contracts/accountingLedger.contract.ts`,
`i18n/appTranslations{En,Ar,Ur,Fa}.ts` (aging page copy), barrel entry.

Backend: `accountingLedgerErrors.ts`, `accountingLedgerGuards.ts`, `accountingAccountPostability.ts`,
`accountingPeriodClose.ts`, `reverseJournalEntryUseCase.ts`, `accountingEntryMutationUseCases.ts`,
`exchangeRateUseCases.ts`, `fxRevaluationUseCases.ts`, `accountingUseCases.ts` (single-entry read);
`lib/httpErrors.ts`, `lib/dbErrorMapping.ts`, `lib/contractError.ts`, `lib/contractRegistration.ts`,
`lib/crudBulkRouteTypes.ts`, `lib/crudBulkRouteFactories.ts`, `lib/crudIncludableBulkRoutes.ts`;
routes `accountingLedgerOpsRoutes.ts`, `accountingBankingRoutes.ts` (new split), `accountingReportRoutes.ts`,
`accountingFxRevaluationRoutes.ts`, `accountingSpecializedEntryRoutes.ts`, `accountingSeedChartRoutes.ts`,
`accountingExchangeRateRoutes.ts`, `accountingContractRouter.ts`, `accounting.ts`; repositories
`accountingRepositoryListEntries.ts`, `accountingRepositoryMetrics.ts`,
`accountingReportEndpointsRepository.ts`; `accountingReportEndpointsUseCases.ts`.

Frontend: `accountingListFetch.ts`, `useAccountingQueries.ts`, `useAccountingPageController.ts`,
`AccountingPage.tsx`, `AccountingWorkTier` props, `useAccountingDashboardView.ts` (the old
`useAccountingDashboardModel` is deleted), `JournalEntriesModalLayer.tsx`, `ReceivablesAgingPanel.tsx`.

## 5. Tests

| Suite | Added/changed |
|---|---|
| `accountingApiResponses.test.ts` (shared, new) | every new envelope accepts the real shape and rejects drift; FX report rows, codes and the error envelope |
| `accountingListQuery.test.ts`, `accountingReportEndpoints.test.ts` (shared) | strict queries reject unknown params; `includeLines` coercion; aging `page`/`limit` bounds and required response fields |
| `accountingResponseContractRoutes.test.ts` (backend, new) | ledger-ops/report/FX/specialized/seed drift → 500 `contract_violation`; the five no-input GETs → 400 with `details.issues`; seed body → 400; posted-entry delete → 422 with `code` |
| `financeRbacRoutes.test.ts` | close/period fixtures completed for the now-validated responses |
| `accountingListFiltersDb` | projection: same headers, `lines: []`, totals equal the full read, tags kept, keyset page works |
| `accountingReportEndpointsDb` | aging pages across students with `total`/`hasMore` and page-independent totals |
| `AccountingDashboard.test.tsx`, `useAccountingApi.test.ts` (frontend) | chart series comes from the server; the register requests `includeLines=false` |

Measured: 34 accounting+finance DB suites / 212 tests green on a fresh PostgreSQL 16; backend unit
541 files / 3877 tests; shared 288 files / 2354 tests; frontend 1216 files (accounting 62 files / 337
tests); repo typecheck, ESLint, Prettier and every ratchet (including the strict TDD-pairing gate and the
shared-package SSOT purity check) green; `ci:local --with-db` passed.

## 6. Documented decisions
- `code` is additive and only set by the accounting sources listed above; other modules' errors keep
  `type`-only.
- The register projection keeps tags/attachments (row-rendered, small) and drops only line sets; the
  drawer's detail read is a new endpoint, not a widened list.
- `includesLines=false` returns `lines: []` plus the summary totals rather than omitting the key, so the DTO
  shape stays uniform for the frontend types.
- Simple mode no longer receives an `allEntries` fallback: duplicate-reference detection and the
  "already reversed" lookup are page-scoped client-side, while the server remains authoritative (unique ref
  → 409, double reversal → 409 with a code).
- Aging defaults to 100 rows per page with a 500 maximum; `total` makes any remaining truncation visible.

## Appendix — reproduction
```bash
docker run -d --name mms-audit-pg -e POSTGRES_PASSWORD=mms -e POSTGRES_USER=mms \
  -e POSTGRES_DB=mms -p 55433:5432 postgres:16-alpine
export DATABASE_URL="postgres://mms:mms@127.0.0.1:55433/mms"
pnpm --filter mms-backend db:migrate
pnpm --filter mms-backend test:db -- accounting finance
pnpm --filter mms-backend test && pnpm --filter @mms/shared test && pnpm --filter mms-frontend test
```
```bash
# Every accounting response site is validated:
grep -rn "reply.send" apps/backend/src/routes/tenant/accounting* | grep -v sendValidated   # empty
# The six named failures carry a code:
grep -rn "ACCOUNTING_ERROR_CODES\." apps/backend/src/accounting | wc -l
```
