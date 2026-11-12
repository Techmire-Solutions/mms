# Question Bank API & Serialization Audit (2026-11-11)

**Scope.** The Question Bank HTTP surface: the ts-rest contract, the Fastify contract router and the
legacy route factories, together with the request/response schemas and the serialization of stored
questions. Follows the schema/persistence, domain/lifecycle and subsystems rounds.

**Method.** Read `questionBank.contract.ts`, the contract router, the legacy bulk/resource factories,
`baseListQuerySchema`, the list/picker repositories and the shared record schemas; then probed the
running route tests for request validation and payload shape.

## Findings

### A. Schema completeness

| # | Sev | Where | Finding |
|---|---|---|---|
| API1 | P1 | `questionBank.contract.ts` | `body: ok` (`z.unknown`) on `bulkUpdateQuestions`, `bulkUpdateTests`, `bulkUpdateResults`, `deleteQuestion`, `restoreQuestion`, `updateFieldConfig`, `updatePreferences` — the contract advertised no request contract. |
| API2 | P1 | contract router | **No route declared `pathParams`.** `:id`/`:attachmentId` were untyped and unvalidated (the legacy factories validate theirs; the contract routes did not). |
| API3 | P1 | `listQuestions` | Query schema was `baseListQuerySchema` = `z.object(...).passthrough()`: `categoryId`/`difficulty` were unbounded free strings, unknown keys were accepted, and there was no `status`, `tag`, `usage` or sort whitelist. |
| API4 | P2 | `listTests`, `listResults` | Query was `z.object({})` — no paging fields; both loaded up to 5 000 rows. |
| API5 | P1 | contract router registration | **`responseValidation` was off** (enrollments/sessions routers enable it), so declared response schemas were documentation. |
| API6 | P2 | contract vs factories | Five routes are declared in the contract but implemented by the legacy factories at the same paths — two sources of truth. Documented; the schemas now match the factories' validation. |
| API7 | P3 | `questionBankPreferencesPutBodySchema`, `questionBankReportQuerySchema` | `.passthrough()` / not `.strict()`. |

### B. Answer-key redaction

| # | Sev | Where | Finding |
|---|---|---|---|
| KEY1 | P1 | `questionBankQuestionRecordSchema` | **No redaction existed.** The stored record carries the answer key in `answer` (labelled "Explanation" in the UI) and every read path returned it — directory, paper picker and duplicate check shared one full payload. |
| KEY2 | P1 | RBAC | Read-only grants received keys. `auditor` holds the full read-only map and any custom role with `questionBank:read` can read; the module gate only requires the read action. |
| KEY3 | P2 | `questionBankExportRoutes.ts` | CSV export was gated on `canReadCollection` and its transfer schema includes an `explanation` (answer) column. |
| KEY4 | P2 | paper builder | There was **no picker endpoint**; the picker consumed the full list, so the key was handed to any caller who could open it. The client-side print/preview never printed answers (verified in `PrintablePaper.tsx`). |
| KEY5 | P3 | model | No rubric or examiner-note column exists; `answer` is the only secret field, so redaction = omit `answer`. |

### C. Pagination & filtering

| # | Sev | Where | Finding |
|---|---|---|---|
| PG1 | P1 | `GET /questions` snapshot branch | Up to **5 000** full records; the frontend loads the whole collection on every mount. |
| PG2 | P1 | `GET /tests`, `GET /assessment-results` | Unpaginated (500 default, 5 000 max) with full child hydration. |
| PG3 | P2 | list query | No `status`, `tag`, `usageCount` or `minUsage` filter. "Cognitive level" is not modelled — `difficulty` is the cognitive dimension. |
| PG4 | P3 | paged branch | `limit` was already clamped to 100 by `baseListQuerySchema` + `runListPage`; the gap was the snapshot branch. |

### D. Error mapping

| # | Sev | Where | Finding |
|---|---|---|---|
| ERR1 | P1 | contract router | Six handlers caught everything and returned `500 database_error` (list questions/tests/results, report aggregates, bulk delete/restore). |
| ERR2 | P1 | guards | The 0240/0241 `23514` guard surfaced as a **500** on the contract delete path instead of a `4xx`. |

## What shipped

**Contract (`packages/shared/src/contracts/`)**
- New `questionBankActionRoutes.ts` holds the seven lifecycle/authoring routes (status, duplicate,
  duplicate-check, attachments, assemble, publish) so the main contract stays under the 300-line
  ceiling; every one now declares `pathParams: questionIdParamsSchema` /
  `questionAttachmentParamsSchema`.
- `questionBank.contract.ts`: `listQuestions` uses the new strict
  `questionBankQuestionsQuerySchema` (category/difficulty/status/tag/minUsage/sort whitelist/afterId);
  new `GET /questions/picker` with `questionBankPickerQuerySchema`; `listTests`/`listResults` use
  `questionBankPagedCollectionQuerySchema`; bulk bodies are the real list schemas; config bodies are
  the strict setup schemas; report query is `.strict()`; list responses are a strict union of
  `{questions}` / paged shapes so response validation cannot silently strip pagination fields.
- `questionBankSerialization.ts`: `questionBankQuestionSummarySchema` (record minus `answer`), the
  client union, and `serializeQuestionForClient` / `serializeQuestionsForClient`.

**Router**
- `responseValidation: true` — declared schemas are now enforced at runtime.
- `listQuestions` serializes through the redactor: a caller with `questions` **write** authority gets
  the full record, every other reader gets the summary.
- `pickerQuestions` always returns summaries, whatever the caller's privilege.
- `listTests`/`listResults` forward `page`/`limit` (capped at 100).
- Every catch now runs `mappedFailure`, which maps domain errors **and** PostgreSQL constraint codes
  (`23514`/`23503`/`23505`/`22003`) to the shared 4xx envelope.

**Repository / use cases**
- `status`, `tag` (`EXISTS` on `question_tags`), `type` and `minUsage` filters; `sortField=usageCount`
  orders by the correlated count over `test_questions` (uses the 0240 reverse index).
- `usageCount` is projected only when sorted/filtered on, so default list queries stay cheap.
- `listQuestionsPicker`: approved-only, paged, stable order.
- The unpaginated snapshot is capped at **500**.

**Permissions**
- CSV export now requires the `questions` write action (the answer key is a column).

## Verification

```bash
pnpm typecheck
pnpm --filter mms-backend test
pnpm --filter mms-backend exec vitest run --config vitest.db.config.ts \
  src/__tests__/db-integration/questionBankPersistenceDb.integration.test.ts
pnpm --filter mms-frontend test
node scripts/check-db-projections.mjs && node scripts/check-code-norms.mjs --ratchet
node scripts/check-backend-structure.mjs && node scripts/check-examinations-test-matrix.mjs
pnpm run check:i18n && bash scripts/ci/local-ci.sh
```

New route coverage: read-only redaction, writer payload includes the key, picker never returns it,
`limit=101`/`status=bogus`/`difficulty=extreme`/unknown-filter all `400`, action body schema `400`,
constraint failure on bulk delete → `400 constraint_violation`. DB coverage: status/tag/usage filters,
`usageCount` ordering, picker approved-only.

## Assumptions / deferred

- **Privilege line = `questions` write.** There is no candidate/student route in the module, so a
  separate "exam taker" tier is not modelled.
- **`answer` is the only secret**; `marks`, `difficulty`, `options` and `sourceCitations` stay visible.
- **Cognitive level is not modelled** — `difficulty` is the dimension.
- **The directory snapshot is capped at 500** (was 5 000). A tenant above the cap loses rows in the
  client-filtered directory until it moves to server pagination; the picker is the scalable path.
- **Five contract routes are served by the legacy factories**; the contract schemas now match what
  those factories validate, and the router comment records why no handler exists there.
- **CSV import/export still 503** (no background runners); only the schema and permission gate changed.
