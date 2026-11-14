# API Layer, Fastify Routes & Serialization Audit: Obligations Module

Review of the Obligations HTTP surface — 22 contract routes, the generic bulk/soft-delete route factories, the metrics/report/export routes, and the request/response schemas behind them.

**Status: reviewed and fixed.** Four defects were found (two of them allowing a client to send parameters the server silently ignores) and are closed in this change set, alongside a repo-wide fix to the contract error handler's response-validation detection. No migration.

---

## 0. Endpoint inventory and premise correction

The brief names five endpoint families; two are not obligations and two do not exist at all:

| Briefed | Reality |
|---|---|
| obligation CRUD | Bulk replace (`PUT /collections/bulk`) + soft delete/restore. **No single-record create/read/update.** |
| bulk assessment | **No assessment concept.** |
| installment rescheduling | **No installment entity** anywhere in the repo (verified in the settlement audit). |
| settlement allocation | **Finance**, not obligations. |
| waiver submission | **Finance** credit note; no obligations waiver. |

What the module actually serves:

| Route | Schema in | Schema out | Error mapping |
|---|---|---|---|
| `GET /collections` | strict (after this change) | contract `z.array(record)` | `obligationsError` → 400/403/500, now response-validated |
| `GET /types`, `/mujtahids`, `/distributions`, `/reps`, `/wakala` | — | contract `z.array(record)` | same |
| `GET /preferences` | — | contract `{preferences}` | same |
| `PUT /preferences` | contract body | contract `{success, preferences}` | same |
| `GET /collections/:id/voucher` | contract `pathParams` | `z.unknown()` | same (404 included) |
| `PUT /types|/mujtahids|/reps|/wakala|/distributions|/collections/bulk` | Zod body via `parseRequest` | **unvalidated** | `sendIfHttpDomainError` |
| `PUT /wakala-aggregate/bulk` | Zod body | **unvalidated** | `sendIfHttpDomainError` |
| `DELETE /collections/:id`, `POST /collections/:id/restore` | `resourceIdParamsSchema` + body | `{success}` unvalidated | `sendIfHttpDomainError` |
| `POST /collections/bulk-delete|bulk-restore` | `bulkIdsBodySchema` | unvalidated | `sendIfHttpDomainError` |
| `GET /metrics` | — | **unvalidated** | `sendDatabaseError` |
| `GET /report-aggregates` | Zod query (now strict dates) | **unvalidated** | domain → DB fallback |
| `POST /export/csv`, `POST /import` | contract body | job envelope | 403/503 paths |

---

## Findings

### R — Route schema completeness

| # | Sev | Finding | Status |
|---|---|---|---|
| **R1** | HIGH | **`listCollections` advertised pagination it did not implement.** The query was `baseListQuerySchema` — `.passthrough()` — so `page`, `limit`, `search`, `sortField`, `sortDir`, `afterId`, `skipCount` **and any invented key** were accepted and then dropped: the handler forwarded them to `collectionCrud.loadAll`, which reads only `includeDeleted`. A client paginating received the whole list every time, and `?studentId=`/`?overdue=` silently no-opped. The frontend hook typed the query as `Record<string, unknown>`. | **Fixed** |
| **R2** | LOW | `deleteCollection` / `restoreCollection` declared `:id` with **no `pathParams`** — contract inaccuracy only, since the generic trash route validates `resourceIdParamsSchema` at runtime. | **Fixed** (types) |
| **R3** | HIGH | **The contract scope ran with response validation off and without the contract error handler**, while `contractRegistration.ts` documents both as required and accounting/workshops/sessions/questionBank/enrollments comply. A handler body that drifted from its schema shipped silently. | **Fixed** |
| **R4** | MEDIUM | Ten contract routes (`replace*` ×6, `listReps`, `listWakala`, `bulkDelete/RestoreCollections`) have **no contract handler** — the generic Fastify routes serve them, so the declared responses never apply. | Recorded (D3) |
| **R5** | MEDIUM | **`POST /widget-aggregates` was declared and served by nobody** — not in the contract router, and `registerWidgetAggregatesRoute` is wired only for contacts/students/faculty. A typed client call 404'd. | **Fixed** (route removed) |
| **R6** | MEDIUM | The generic bulk/trash routes and `GET /metrics` pass no `responseSchema`/`metricsSchema`, so their 200 bodies are unvalidated even though the factories support it. | Recorded (D4) |

### E — Domain error mapping

| # | Sev | Finding | Status |
|---|---|---|---|
| **E1** | HIGH | **Handlers returned statuses their routes did not declare.** `obligationsError` maps any 4xx domain error, but the five list/preferences routes declared only `200/403/500`. This shipped only because R3 left validation off; enabling it would have turned a legitimate 400 into a 500. | **Fixed** |
| **E2** | LOW | `GET /report-aggregates` ended in `catch { sendDatabaseError }`, bypassing the domain mapper. | **Fixed** |
| **E3** | — *(verified good)* | The module's real domain errors map cleanly and carry structure — `obligation_wakala_required` / `obligation_split_incomplete` / `obligation_account_invalid` → **400 `validation_error`**; `catalogue_in_use` / `stale_write` → **409** with `code` + `details`; the accounting year/period lock (`yearClosed`, `ledgerError` 422) surfaces on archive through the strict posting path. `errorEnvelopeExtras` preserves `code`/`violations`/`details`. | Verified |
| **E4** | — *(note)* | None of the brief's error classes exist (`AllocationExceedsOutstandingBalance`, `ObligationAlreadySettled`, `InvalidInstallmentSum`, `WaiverRequiresApproval`, `PeriodLocked`); their real counterparts are the finance `422` codes and the obligations codes above. | Recorded |

### P — Pagination & filtering

| # | Sev | Finding | Status |
|---|---|---|---|
| **P1** | HIGH | **No server-side filtering existed on the list.** Contact, session, student and overdue filters are not representable — those columns are not on `obligation_collections`. Type/rep/date filters exist only on the report endpoint; the directory filters in the browser. | Documented (D2) |
| **P2** | MEDIUM | The list was silently capped at **2 000 rows** (max 10 000) with no honoured `limit` and no truncation signal — a larger workspace lost rows from the directory and its client-computed totals. | **Mitigated** (`limit`/`offset` honoured, cap documented; keyset envelope is D1) |
| **P3** | HIGH | **Report date filters reached SQL unvalidated.** `dateFrom`/`dateTo` were `z.string().max(32)` and the repository casts them to `::date`, so `?dateFrom=abc` was a PostgreSQL `22007` → **500 instead of 400**. | **Fixed** |
| **P4** | — *(verified good)* | Selective projections hold: every collection read is an explicit column list, `check:db-projections` reports 0 wildcard selects, and the report/metrics aggregate in SQL with `numeric::text`. | Verified |

---

## 1. What was applied

### 1.1 The list tells the truth about its query (R1, P2)

New `obligationsCollectionsQuerySchema` — `{ includeDeleted?, limit?, offset? }`, `.strict()`, `limit` 1…`OBLIGATIONS_COLLECTIONS_MAX_LIMIT` (2 000), `offset ≥ 0`. `loadObligationCollections` became a dedicated loader that threads all three to `repo.listObligationCollectionsByWorkspace` (which already supported them), replacing the generic `collectionCrud.loadAll` that discarded them.

Result: `?limit=25&offset=50` works; `?studentId=x`, `?page=2`, `?overdue=true` are now **400** instead of silently ignored; the browser-filtered directory keeps its behaviour (no parameters → the same 2 000-row default). The frontend hooks were retyped to `ObligationsCollectionsQuery`, so an ignored filter is now a compile error too.

### 1.2 Response validation and the contract error handler (R3, E1)

`installContractErrorHandler(fastify)` + `responseValidation: true` on the obligations contract plugin, matching accounting. Every status a handler can produce is now declared (`400` added to the five read endpoints and the voucher route; writes already had `400/409`).

A drifted body now answers `500 contract_violation` instead of shipping — proven by a new test that mocks a malformed record.

### 1.3 Repo-wide fix: response-validation detection

While proving 1.2 it turned out the shipped handler could never recognise the error: `ResponseValidationError` does not set `name`, and ts-rest resolves `@ts-rest/core` through a different module format from the backend, so `instanceof` also fails. The handler fell through to a generic `server_error`, and the same drift therefore answered differently per router. `isResponseValidationError` now also matches the class's message prefix and its `appRoute`/`cause` pair. Accounting's and sessions' contract-violation tests still pass.

### 1.4 Reports and small corrections (P3, E2, R2, R5)

- `obligationsReportQuerySchema`: `dateFrom`/`dateTo` → **`isoDateSchema`**, `typeId`/`repId` trimmed and bounded. `?dateFrom=abc` is now 400.
- `GET /report-aggregates` maps domain errors before the database fallback.
- `deleteCollection`/`restoreCollection` declare `pathParams` (the generic route already validated them at runtime).
- The dead `widget-aggregates` contract route is gone.

---

## 2. Deferred

| ID | Item |
|---|---|
| **D1** | Keyset-paginated list envelope (`{ items, nextCursor, truncated }`) with UI paging — the real fix for the 2 000-row cap. `afterId` already exists in `baseListQuerySchema` for other modules. |
| **D2** | Server-side search/sort and type/rep/date filters on the **list** endpoint (contact/session/overdue need new columns and are a product decision). |
| **D3** | Move the ten declared-but-generic write routes onto the contract router so `responseValidation` covers them. |
| **D4** | `responseSchema`/`metricsSchema` on the generic bulk, trash and metrics routes — needs a Zod→JSON-Schema helper the factories do not accept today. |
| **D5** | The `obligations:export` / `obligations:import` job runners: both endpoints still answer 503 (carried from the finance audit). |
| **D6** | An OpenAPI/pact export of the contract so the declared-status inventory cannot drift silently again. |

---

## 3. Verification

| Command | Result |
| --- | --- |
| `pnpm typecheck` | 6/6 packages |
| `pnpm --filter @mms/shared test` | 2 393 tests |
| `pnpm --filter mms-backend exec vitest run src/__tests__/obligation* src/__tests__/obligations* src/__tests__/contract*` | 81 tests |
| `obligations.integration.test.ts` | 17 tests, incl. unknown-key 400, limit/offset forwarding, drifted-body `contract_violation`, malformed report date 400 |
| `accountingHedgeRoutes` / `sessionsContractErrorHandler` | 33 tests (no regression from the detection fix) |
| `pnpm --filter mms-frontend exec vitest run src/tenant/features/obligations src/tenant/hooks/collections` | 111 tests |
| `check-code-norms` · `check-money-safety` · `check-docs` · `check-db-projections` · `check-backend-boundaries` · `check:i18n` | held |

Nothing in this change set needs a database; the DB suites that exist for the module ran in a later session (see the security audit).

## 4. Assumptions

1. Rejecting unknown query keys is safe — the only client sends `{ includeDeleted }`, and the two hooks that accepted arbitrary filters were a footgun, not a working feature (retyped to the contract).
2. Keeping the default list size at 2 000 preserves the client-filtered directory exactly; D1 replaces it with a cursor envelope.
3. Removing `widget-aggregates` is safe: no route served it and no frontend code called it.
4. Enabling `responseValidation` cannot affect the write routes — they are served by generic Fastify routes, not the contract router, so only the seven read/preferences/voucher handlers are validated, all covered by injection tests.
