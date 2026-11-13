# Examinations API, Fastify Routes & Serialization Audit — 2026-11-11

**Scope.** Every Examinations HTTP surface: exam CRUD/bulk upsert, the marks read/write, the
attendance gate + audited overrides, moderation and result publication, the setup config and
subjects reads, the CSV export/import queue routes, and the queued marks import/broadsheet export.
Checked request/params/query/response schemas, domain-error mapping, serialization/privacy and
broadsheet pagination.

**Method.** Read all route files, the three shared contract files, the generic CRUD/bulk
registrars, `httpErrors`/`contractError`/the global error handler, the results page and exam page
repositories, the analytics SQL, the marks import/export workers, the module route-action rules and
the existing integration tests. Ran the route-injection ratchet (18 contract paths, **6 untested**)
and the backend/shared/frontend/DB suites.

## Brief assumptions vs. reality

| Brief | Reality |
|---|---|
| "timetable allocation" endpoint with `TimetableRoomConflict` | **No examination timetable/room surface exists.** Exams carry only `date` + `duration`; room/teacher conflicts belong to the Sessions timetable (`enrollmentTimetableGuard`). No `exam_room_conflict` code exists. Recorded as R12. |
| "student/guardian endpoints" | **No student/guardian examination endpoint exists** (security audit R6). The boundary is staff RBAC + the published-only marks projection; a guardian token gets 403 on every examinations route (new test). Recorded as R13. |
| `ScoreExceedsMaxMarks` | `exam_marks_out_of_range` (400); PG `23514`/`22003` → 400 on the generic paths. |
| `ExamWindowLocked` | `exam_results_finalized`, `exam_archived`, `exam_published_immutable`, `exam_not_sat`, `unpublish_blocked_session_completed` (409). |
| `IneligibleStudent` | `exam_student_not_enrolled`, `exam_eligibility_unknown`, `exam_eligibility_blocked` (409). |

## Route inventory (after this change)

| Surface | Transport | Validation | Response contract | Role gate |
|---|---|---|---|---|
| `GET /exams` | ts-rest | **strict `examsListQuerySchema`** (page/limit ≤100, search, comma status enum, sort enum, includeDeleted, afterId, skipCount) | union `{exams}` / page (with `nextCursor`) + typed errors | `exams:read`; trash needs delete |
| `PUT /exams/bulk` | plain PUT | **`examBulkWriteSchema`** (ISO date, name 1..200, positive totals, passing ≤ total, classIds ≤100; read-only metadata accepted-and-ignored) | `{exams}` | `exams:write` |
| `DELETE /exams/:id`, `POST /exams/:id/restore` | plain | `resourceIdParamsSchema` + `softDeleteBodySchema`; contract now declares `pathParams` | `{success}` | `exams:delete` |
| `POST /exams/bulk-delete|bulk-restore` | ts-rest | `bulkStringIdsBodySchema` (≤500) | bulk envelope + typed errors | `exams:delete` |
| `GET /results` | ts-rest | strict keyset query (`cursor`, `limit` ≤500) | page envelope + typed errors | `exam_results:read`; non-graders published-only projection |
| `PUT /results/bulk` | plain PUT | `examMarksWriteListSchema` (≤2000) | `{results}` | `exams:write` |
| `GET /exams/:id/eligibility` | ts-rest | **`pathParams` added** | strict view | `exams:read` |
| `PUT /exams/:id/attendance-gate` | ts-rest | **`pathParams`** + threshold body | `{examId,minAttendancePct}` | `exams:write` |
| eligibility overrides (grant/revoke) | ts-rest | **`pathParams`** (`id`, `studentId` ≤64) + reason body | `{success}` | `exams:delete` |
| `POST /exams/:id/results/:studentId/moderation` | ts-rest | **`pathParams`** + grace/reason/OCC body | strict moderation DTO | `exams:delete` |
| `POST /exams/:id/results-finalization` | ts-rest | **`pathParams`** + `{finalized, reason?}` | stamp DTO | `exams:delete` |
| `POST /exams/:id/results/import|export` | plain | **params validated**, import body strict; contract routes added | 202 job envelope + typed errors | import `exams:write`; export `exams:read` + **published-only for non-graders** |
| `GET /report-aggregates` | plain | `reportComparisonQuerySchema` | shared aggregates | readers get **published-only analytics** |
| `GET /subjects`, `/field-config`, `/preferences` (+PUT) | ts-rest/plain | body schemas; no params needed | typed | `exams:read` / setup-write |

## Findings

### A · Route schema completeness

| # | Sev | Finding | Status |
|---|---|---|---|
| A1 | **P1** | No `pathParams` anywhere in the examinations contracts (6 gate routes, delete, restore), while other contracts use them; `standardRequestValidationErrorHandler` never saw a path-param error and the gate/moderation handlers read raw params. | **Fixed** — `examIdParamsSchema`/`examStudentParamsSchema` on all six gate routes; `pathParams` on delete/restore; test: a 65-char `studentId` → 400 before the handler |
| A2 | **P1** | `PUT /exams/bulk` used the **read** record as its write body: `date: z.string()` (invalid dates silently stored as NULL by `toDbDate`; the column is nullable), blank names, non-positive totals, `passing > total`, unbounded classes; server-owned fields (`resultsFinalizedAt`, soft-delete sextuple) were advertised as writable and silently ignored. | **Fixed** — [`examBulkWriteSchema`](../packages/shared/src/examinations/examinationsModuleManifest.ts) validates the mutable surface (ISO date, name, positive totals, passing ≤ total, classIds cap) and keeps read-only metadata optional for the list→save round-trip; the persist layer uses `requireDbDate` so a bad date is a 400, never a silent NULL. Tests: invalid date / passing>total / blank name → 400; metadata accepted without a write |
| A3 | **P2** | `GET /exams` reused `.passthrough()` `baseListQuerySchema`: `status` undeclared (worked only via passthrough), any key accepted, `sortField` a free string. | **Fixed** — strict [`examsListQuerySchema`](../packages/shared/src/examinations/examinationsListQuery.ts) (comma status enum, sort enum, page/limit bounds); tests for `limit=101`, `page=0`, `status=bogus`, unknown key |
| A4 | **P2** | Transfer routes had no route schema: params read manually, no response contract, DB/queue lookups outside the try/catch. | **Fixed** — `resourceIdParamsSchema` parsing, load wrapped with domain/DB mapping, `importExamMarks`/`exportExamResults` contract entries with 202 job + error responses |
| A5 | **P2** | Many contract routes declared 403/500 as `ok = z.unknown()`. | **Fixed** — every route now declares `errorResponse` (plus 400/404/409/503 where returned) |
| A6 | P3 | `nextCursor` emitted but undeclared. | **Fixed** — optional `nextCursor` on `examsPageResponseSchema` |
| A7 | P3 | Dual ownership: 20 contract paths, 10 implemented in the ts-rest router; the rest are plain routes with separate validation. | **Documented** — R14 (migrate the rest into the contract router + a parity ratchet) |

### B · Domain error mapping

| # | Sev | Finding | Status |
|---|---|---|---|
| B1 | **P1** | Gate errors carried no structured context: blocked/unknown/not-enrolled/out-of-range students existed only in a message (first five). | **Fixed** — typed `ExamEligibilityGateDetails` (`examId`, `students[]` with pct/required/marks, `counts`, `truncated` at 100) on all four errors; unit test asserts the blocked list |
| B2 | **P1** | `mapGateError` dropped `details`/`violations` and mapped no PostgreSQL codes → constraint failures on gate routes became 500. | **Fixed** — it now delegates to the shared `mapDomainError` + `mapConstraintError` |
| B3 | **P1** | `sendIfHttpDomainError` (the legacy bulk PUT/delete/restore paths the UI saves through) dropped `details`/`violations`. | **Fixed** — preserves both; route test: a blocked bulk marks save returns 409 with `details.students` |
| B4 | **P1** | `handleContractError` mapped only the FK violation (`23503`); `23505`/`23514`/`22001`/`22003`/`22P02` on contract routes became 500. | **Fixed** — routes through the shared PG map; tests: 23505 → 409, 23514 → 400 |
| B5 | P2 | The global handler reported an uncaught `HttpDomainError` as `type: error.code ?? "server_error"` and dropped details. | **Fixed** — dedicated branch keeps status/type/details/violations (test with `exam_not_sat` + `details.examId`) |
| B6 | P2 | Lifecycle/OCC errors were message-only (`stale_write`, `exam_not_sat`, `exam_archived`, `exam_cancelled`, `exam_already_published`, `unpublish_blocked_session_completed`, `illegal_exam_transition`, `exam_published_immutable`). | **Fixed** — `details` with `examId`/`examIds`/`from`/`to`/`studentId`/`version`; assertions in the lifecycle and OCC tests |
| B7 | P3 | Unpublish without a reason and grace-bound failures are 400 `validation_error` (message only). | Verified (existing tests) |

### C · Serialization & privacy

| # | Sev | Finding | Status |
|---|---|---|---|
| C1 | **P1** | The queued marks export bypassed the published-only boundary: `POST /exams/:id/results/export` required only `examinations.read`, and the worker paged **all** marks with a `Grace Marks` column → a read-only auditor could download drafts + moderation adjustments. | **Fixed** — the route computes `includeInternal = canWriteCollection("exams")`; a non-grader gets 404 for an unpublished exam and the job runs published-only without the grace column (older queued jobs default to the safe mode). Route + worker tests |
| C2 | **P2** | Report aggregates aggregated every mark for any reader (draft-derived pass rates/top performers). | **Fixed** — `publishedOnly` flag through the use case into the analytics/comparison SQL for non-graders; DB test (draft mark visible to a grader, empty to a published-only read) |
| C3 | P2 | For a non-grader the route strips `markedBy`/`version`/moderation notes (tested) but keeps numeric `graceMarks`; the declared response type still includes the internal fields. | **Verified/intentional** — the projection is test-pinned; a lean `examResultPublicSchema` was added as the documented public shape (the contract still types the full record for writers) |
| C4 | P1 | No student/guardian endpoint exists. | **Verified** — guardian tokens get 403 on the marks list and export (new test); the boundary is staff RBAC + published-only. R13 records the portal design |
| C5 | P3 | Exams CSV export excludes marks; `allowDeleted` needs delete rights. | Verified |

### D · Pagination

| # | Sev | Finding | Status |
|---|---|---|---|
| D1 | ✓ | `GET /results` is keyset (`cursor`/`limit ≤500`, `hasMore`), clamped server-side; the client walk surfaces truncation (round 3); the export pages 500 with a 50k cap. | Verified |
| D2 | P3 | `GET /exams` without any list param loads every exam (exam-count-sized, with class/subject joins). | Documented |
| D3 | P3 | Six contract paths had no `app.inject` coverage — including all gate routes, finalization, field-config and preferences. | **Fixed** — inject tests for every path; baseline is now empty (20/20 covered) |

## Implemented in this change set

- Shared: `examsListQuerySchema`, `examBulkWriteSchema`, `examIdParamsSchema`/`examStudentParamsSchema` + `pathParams` on all exam routes, transfer contract routes, typed error responses/`nextCursor`, `examErrorDetails` types, `examResultPublicSchema`.
- Backend: `mapDomainError`/`mapConstraintError`/`mapDatabaseErrorCode` seam (used by `sendIfHttpDomainError`, `handleContractError`, `mapGateError`), domain-error branch in the global handler, gate/lifecycle/OCC `details`, `requireDbDate` in the exam persist, transfer route validation + published-only export audience, `includeInternal` in the export worker, published-only analytics for non-graders.
- Frontend: `ApiError.details` + `apiContractError` forwarding (the blocked-student list reaches the UI).
- Tests: 33 route integration tests (strict inputs, gate/override/finalization/setup inject coverage, guardian 403, structured error envelopes, bulk validation), gate `details` unit, lifecycle `details`, contract-error PG mapping, global-handler domain serialization, export privacy unit tests, shared schema tests, analytics DB test; route-injection baseline emptied (20/20).

## Deferred, decision-ready

- **R12 · Exam timetable/room allocation** — `POST /exams/:id/timetable` with rooms/invigilators, conflict checks against the Sessions timetable and other exams, `exam_room_conflict` 409 with `details.conflicts`.
- **R13 · Student/guardian results endpoint** — self-scoped `GET /api/portal/examinations/results`, filtered by the authenticated student link + `results_finalized_at`, returning `examResultPublicSchema` (never reason/actor).
- **R14 · Contract-handler migration** — move every remaining plain handler into the ts-rest router and add a ratchet that each contract path is owned by the contract router (today the contract is documentation for 10 of 20 paths).

## Verification

```bash
pnpm typecheck
pnpm --filter mms-backend test          # 493 files / 3524 tests
pnpm --filter @mms/shared test          # 269 files / 2141 tests
pnpm --filter mms-frontend test         # 1192 files / 4487 passed
pnpm --filter mms-backend test:db       # 83 files / 429 passed
node scripts/ci/check-examinations-route-injection.mjs   # 20 paths, 0 baselined
node scripts/check-examinations-test-matrix.mjs
pnpm check:docs && pnpm check:i18n
```
