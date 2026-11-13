# Finance API layer — route schemas, error mapping and pagination contracts

Scope: the HTTP layer of the Finance/Accounting module, with the five named families audited line by line (`accountingExchangeRateRoutes`, `accountingVoucherNumberingRoutes`, `accountingReversalRoutes`, `accountingHedgeRoutes`, `accountingIas29Routes`) plus the shared plumbing they rely on: `lib/zodRequest`, `lib/httpErrors`, `lib/dbErrorMapping`, `lib/contractError`, `lib/crudBulkRouteHelpers`, `lib/crudPaginatedRoutes`, the ts-rest contract routers, and the list-query schemas in `@mms/shared`.

Status: **Fixed** findings landed with this change; **Verified** items were exercised and needed no change; **Documented** items are deliberate limits or follow-ups.

---

## 1. What holds (verified, not just asserted)

| Guarantee | Evidence |
|---|---|
| **Every request is parsed by a schema** | Each named route validates its body against a shared Zod schema (`hedgeRelationshipCreateSchema`, `hedgeSettlementRequestSchema`, `hedgeReclassificationRequestSchema`, `hedgeValuationRequestSchema`, `ias29RequestSchema`, `priceIndexPutSchema`, `hyperinflationSettingsSchema`, `exchangeRatePutBodySchema`, `exchangeRateListQuerySchema`, `exchangeRateLookupQuerySchema`, `currencyExchangeabilityPutSchema`, `accountingCurrencySettingsPutSchema`, `voucherNumberingQuerySchema`, `voucherNumberingUpdateSchema`, `journalReversalRequestSchema`) and its `:id` against `resourceIdParamsSchema`. |
| **Decimal precision is validated at the edge** | Money uses `moneyAmountSchema` (≤2 dp) / `moneyDecimalAmountSchema` (≤4 dp); rates use `exchangeRateValueSchema` (≤10 dp, `> 0`); currencies are ISO-checked; `hedgeRelationshipCreateSchema.notional` is refined against the hedged currency's minor units (a 4 dp USD notional is rejected with the `notional` path). |
| **Typed domain errors map cleanly** | `sendIfHttpDomainError` / `mapDomainError` (`lib/httpErrors.ts`) preserve 4xx `statusCode` + `type` + `violations` + `details`. Duplicate journal reversal (`ConflictError`) → **409**; closed fiscal year, closed posting period, unbalanced posted entry (`ledgerError` 422) → **422**; body/query rejection → **400** with the shared envelope; missing rate / unknown id → **404**. |
| **Contract handlers keep the same envelope** | `handleContractError` maps `ZodError` → 400, FK → 409, other constraints → mapped status, response-contract failures → 500 `contract_violation`, and preserves domain statuses. |
| **Lists clamp and support keyset paging** | `baseListQueryFields.limit` is bounded by `LIST_PAGE_MAX_LIMIT` (100), `afterId` is a first-class cursor implemented in `listPageHelper` (keyed `id > afterId`), and the finance invoice/payment lists use `baseListQuerySchema` with explicit column projections (`check:db-projections` reports zero wildcard selects). |
| **Response precision is canonical where it matters** | Rates and 4 dp FX values are decimal strings canonicalized by the mappers (`canonicalStoredRate`/`trimNumeric`); 2 dp ledger amounts are JSON numbers by design (DTO schemas reject more decimals). |

## 2. Findings and dispositions

### P1 — fixed

**F1 — a database-enforced ledger guard surfaced as an anonymous 400.** *Fixed.*
`PG_CONSTRAINT_RESPONSES["23514"]` mapped every check violation to `400 {type:"constraint_violation", message:<operation description>}`. Since migrations 0248/0249 raise `check_violation` with the real reason (unbalanced posted entry, immutable posted lines, closed posting period), a write that reached the DB guard lost both its reason and the 422 class the use-case guards use. *Fix:* `lib/dbErrorMapping.ts` recognises the ledger guards' own message fragments (walking the driver `cause` chain via the new `pgErrorMessage`) and maps them to `422 {type:"ledger_guard", message:<guard message>}` in both `sendDatabaseError` and `mapConstraintError`; every other `23514` keeps the generic 400. Proven in `httpErrors.test.ts` and `contractError.test.ts`.

**F2 — client-correctable finance rejections became 500s.** *Fixed.*
`financeMutationOperations` threw a plain `Error("Payment amount exceeds the remaining invoice balance")` (no `statusCode`) → 500 through the contract handler and hand-written routes; `accountingEntryMutationUseCases` did the same for "Posted journal entries cannot be deleted" (rescued only by a message-matching route helper). Both now throw `HttpDomainError(422, "validation_error", …)`; the overpayment test asserts `statusCode: 422`.

**F3 — responses were not validated at runtime anywhere.** *Fixed.*
`@ts-rest/fastify` defaults `responseValidation: false`, and neither the accounting nor the finance contract router enabled it; the five hand-written families sent unvalidated objects. *Fix, two mechanisms:*
- **Contract routers:** `responseValidation: true` + the generalized `installContractErrorHandler` (a `ResponseValidationError` becomes a logged 500 `contract_violation` with `requestId`, matching the sessions pattern).
- **Hand-written routes:** `lib/validatedReply.ts` (`sendValidated`) parses every payload against the new shared envelope schemas in `packages/shared/src/finance/accountingHttpResponses.ts` before sending it. A drifted payload is a 500 `contract_violation`, never a malformed body.

### P2 — fixed

**F4 — hedge routes bypassed param validation and parsed a body on GET.** `handle()` read `request.params.id` by hand and the `GET /hedges` route parsed `request.body` with `z.unknown()` with no query schema. The route now parses `resourceIdParamsSchema`, skips body parsing on reads, and validates `hedgeListQuerySchema` (`limit` 1–100). *Test:* an oversized path id never reaches the use case.

**F5 — path ids were unbounded.** `resourceIdParamsSchema` was `min(1)` only; it is now `min(1).max(128)`, tightening every consumer. (find-my-way already caps a path param at 100 chars with 414; the schema bound covers ids carried in bodies/contract params.)

**F6 — the unpaginated list branches read whole collections.** The accounting contract's compatibility branch (`?page=` absent) loaded every account/entry/fiscal year with no limit. It now reads one **capped page** (`UNPAGINATED_LIST_CAP = 500`, so the chart-of-accounts pickers still work) and returns the additive `truncated` flag; the paged branch stays at `LIST_PAGE_MAX_LIMIT`. *Tests:* truncation reporting and the cap.

**F7 — list-query fields were permissive.** `afterId` and `sortField` had no bounds; they are now `max(128)` / `max(64)`. The shared accounting list schemas keep `.passthrough()` deliberately (clients may send analytics params; the loaders read only known keys) — the **new** hedge list and the IAS 29 list GETs are `.strict()`.

**F8 — validation errors were not field-structured.** `replyValidationError` sent only Zod's concatenated message. `parseRequest` now returns `issues`, and `replyValidationError` accepts the failed parse result and adds `details.issues: [{path, message}]` while keeping `type`/`message` backward compatible. Applied across the five families.

**F9 — strictness on the no-parameter GETs.** `emptyQuerySchema` now rejects unknown query parameters on the three IAS 29 list/settings reads (previously `?date=…` was silently ignored). *Test:* a query param on `/ias29-restatements` → 400.

### P3 — documented / previously verified

- **Contract/route drift is already covered.** `accounting.integration.test.ts` proves every operation declared in `accountingContract` has a registered `method + path`; the unimplemented-by-ts-rest operations are served by hand-written routes (ADR-010 keeps their contract responses `unknown`). No missing paths.
- **Money representation is mixed by design.** 2 dp ledger/document amounts are JSON numbers (exact within `2^53` cents); rates and 4 dp FX values are decimal strings. Response validation now enforces the documented scale.
- **`InvalidExchangeRateError` is unreachable through the API** — every entry point validates rates before `fxConvert`.
- **No Fastify JSON-Schema `schema.response` anywhere.** Serialization contracts are Zod-based (ts-rest `responseValidation` + `sendValidated`), not JSON Schema.
- **Remaining follow-up:** the compatibility list branch is bounded at 500 rows; tenants with a >500-account chart should use the paged contract/list hooks.

## 3. Landed changes

| File | Change |
|---|---|
| `apps/backend/src/lib/pgErrors.ts` | `pgErrorMessage()` (walks the `cause` chain) |
| `apps/backend/src/lib/dbErrorMapping.ts` (new) | constraint/ledger-guard mapping + `ErrorEnvelopeBody`, re-exported by `httpErrors.ts` |
| `apps/backend/src/lib/httpErrors.ts` | ledger-guard 422 in `sendDatabaseError`; envelope moves out (length ceiling) |
| `apps/backend/src/lib/zodRequest.ts` | parse failures carry `issues`; `replyValidationError` emits `details.issues` |
| `apps/backend/src/lib/validatedReply.ts` (new) | `sendValidated` response enforcement |
| `apps/backend/src/lib/contractRegistration.ts` | `installContractErrorHandler` (sessions alias kept) |
| `apps/backend/src/routes/tenant/accounting/accountingHedgeRoutes.ts` | params/query schemas, validated responses, bounded list |
| `accountingIas29Routes.ts`, `accountingExchangeRateRoutes.ts`, `accountingVoucherNumberingRoutes.ts`, `accountingReversalRoutes.ts` | validated responses; strict no-param queries (IAS 29) |
| `accountingContractRouter.ts` + `financeContractRouter.ts` | `responseValidation: true`, shared error handler; capped compatibility branch |
| `apps/backend/src/db/repositories/accountingHedgesRepository.ts` (+ adapter) | `listHedgeRelationshipsPage` (limit + `truncated`) |
| `finance/use-cases/financeMutationOperations.ts`, `accounting/use-cases/accountingEntryMutationUseCases.ts` | typed 422 domain errors |
| `packages/shared/src/finance/accountingHttpResponses.ts` (new) | response envelopes + hedge record/valuation + reversal result schemas |
| `packages/shared/src/finance/accountingHedgeSchemas.ts` | `hedgeListQuerySchema`, `hedgeRelationshipFieldsSchema` split |
| `packages/shared/src/core/apiSchemas.ts`, `schemas/api.dto.ts` | `emptyQuerySchema`, `UNPAGINATED_LIST_CAP`, bounded id/cursor/sort fields |
| `packages/shared/src/contracts/accounting.contract.ts` | `truncated` on the three compatibility list responses |

## 4. Evidence

- `httpErrors.test.ts` (new, 10): ledger guard → 422 with message; unrelated `23514` → 400; `23505` → 409; unknown → 500; envelope `details.issues`.
- `contractError.test.ts` (+1): ledger guard on the contract path → 422.
- `accountingHedgeRoutes.test.ts` (3 → 8): bounded list + truncation, `limit=101` → 400, oversized id rejected, use-case drift → 500 `contract_violation`, and the preview endpoint publishes the full valuation record (the validation caught that the preview returns a record, not the bare figures — the schema was corrected, not the test).
- `accountingIas29Routes.test.ts` (5 → 6): unknown query param → 400.
- `accounting.integration.test.ts` (23 → 24): compatibility branch returns `truncated` and hits the cap; the declared-operation coverage test still passes with `responseValidation` on.
- `accountingReversalRoutes.test.ts`: publishes the full reversal result against `journalReversalResultSchema`; `reverseJournalEntryUseCase.test.ts` asserts the real production payload validates.
- DB suites: `accountingHedgesDb` (+1, including the preview record) and `accountingIas29Db` (+1) parse their real results with the route schemas.
- `financeService.test.ts`: overpayment asserts `statusCode: 422`.
- Shared `accountingHttpResponses.test.ts` (new, 11): envelopes accept canonical payloads, reject 11-dp rates, missing `truncated`, leaked keys, missing reversal link; bounded ids/cursors/queries.
- Whole-suite results: backend unit **528 files / 3742 tests**, shared **284 / 2297**, finance+accounting DB batch **20 files / 112 tests**, typecheck clean, all 15 ratchets green.

## 5. Recommended follow-ups

1. Raise or make configurable `UNPAGINATED_LIST_CAP` (or migrate the remaining pickers to the paged contract) if a workspace chart exceeds 500 accounts.
2. Add a lint/CI guard that new `GET` routes in the accounting/finance modules declare a query schema and a response schema (the pattern is now uniform, but nothing prevents a new route from skipping `sendValidated`).
3. Declare real response schemas (instead of `z.unknown()`) on the remaining ADR-010 contracts where the shapes are already modeled — the new shared envelopes make this mechanical.
