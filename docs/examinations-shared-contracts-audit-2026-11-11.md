# Examinations Shared Contracts & TypeScript Definitions — Audit (2026-11-11)

**Scope.** `packages/shared` as the single source of truth for Examinations DTOs, enums and runtime
schemas, cross-checked against the Drizzle schema, the ts-rest HTTP contract, the Fastify routes and
the frontend consumers.

**Headline:** mark-sheet/lifecycle DTOs were already centralized and strict, but the module carried
four hand-written copies of the preferences model, a duplicated status list in the filter menu, a
duplicated sort-field list, hand-written list/page interfaces that had drifted from their Zod
schemas, a dead public-result schema and a set of `as` casts over response bodies. The result-status
flags, assessment types, configurable grading scale, transcript and schedule models **do not
exist**; they are recorded below as decisions (D1–D3 and designs), not faked with dead types.

## What is centralized (verified)

| Contract | Location | Consumers |
|---|---|---|
| Exam read/write DTOs | `examinationsModuleManifest.ts` (`examRecordSchema`, `examBulkWriteSchema`) | Backend routes/use cases, frontend forms, CSV import/export |
| Mark-sheet payloads | `examMarksWriteSchema`/`examMarksWriteListSchema`, `examResultRecordInsertSchema` | `PUT /results/bulk`, marks import, `EnterMarks` |
| Result projections | `examResultPublicSchema` (reader) / `examResultRecordSchema` (staff) | `GET /results` projection, moderation panel, marks grid |
| Lifecycle | `examLifecycle.ts` (`EXAM_STATUSES`, transitions, publication rules) | DB CHECK, routes, form status options, membership repo |
| Ranking/scoring | `resultScoring.ts`, `gradeUtils.ts` (`GRADE_BANDS`) | Grid, report card, analytics SQL, exports |
| HTTP contract | `contracts/examinations.contract.ts` + `examinations.contractEligibility.ts` | ts-rest client, route handlers |

Runtime checks confirmed: body schemas are `.strict()`, bodies reject numeric strings (no
`z.coerce` outside list-query strings), and `normalizeMarks` rounds to the `numeric(8,2)` scale
deliberately (request may carry more decimals; the stored/returned value is column-scale).

## Findings

### Duplicated declarations / drift

| # | Sev | Finding | Fix |
|---|---|---|---|
| S1 | P2 | `ExaminationsFiltersMenuButton.tsx` re-declared `EXAM_STATUSES` locally (different order) and the list filters imported the type from that copy. | Import `EXAM_STATUSES`/`ExamStatus` from `@mms/shared`; a shared `isExamStatus` guard narrows the shared checkbox/menu callback values. |
| S2 | P2 | `EXAM_SORT_FIELDS` existed in shared and again as a literal `Set` in `examinationRepositoryList.ts`. | Repository imports the shared tuple. |
| S3 | P2 | `ExaminationsListQuery`/`ExaminationsListPageResult` were hand-written interfaces that had drifted from `examsListQuerySchema`/page schema (`afterId`, `skipCount`, `nextCursor` missing). Inspection showed the backend **does** implement keyset paging, so the fields were kept and typed instead of removed. | Types derive from the schemas (`z.infer`); the page schema lives in `examinationsListQuery.ts`; `nextCursor` is typed. |
| S4 | P2 | `listExams` returns a bare `{ exams }` for unpaged reads and a page envelope when paginated, so consumers cast the body. | Added `examsListResponseSchema` + `examsFromResponse()` normalizer; hooks no longer cast. |
| S5 | P2 | `examResultPublicSchema` was dead and its fields were re-declared inside the record schema; the contract typed readers as the full record. | `examResultRecordSchema = examResultPublicSchema.extend(internal fields)`; page schema + `ExamResultsPage` type added; the public projection is now the documented base. |
| S6 | P2 | Preferences existed four times: `ExaminationsSettings`, `ExaminationsModulePreferences`, an all-optional `.passthrough()` PUT body, and a hand-written GET response schema. | One strict `examinationsPreferencesSchema`; PUT = `.partial().strict()`; `ExaminationsModulePreferences` is inferred; `ExaminationsSettings extends` it; contract reuses the schema. |
| S7 | P2 | `ExamEligibilityState` was shared, but the contract re-encoded `z.enum(["eligible","blocked","unknown"])` and error details re-declared the subset. | `EXAM_ELIGIBILITY_STATES` + `examEligibilityStateSchema`; contract and `ExamGateStudentDetail.state` use it. |
| S8 | P2 | Finalization response `status` was `z.string()`; error-detail `from`/`to` were strings. | `z.enum(EXAM_STATUSES)`; `from`/`to` are `ExamStatus`. |
| S9 | P2 | `ExaminationsSettings.customFields?: []` (empty-tuple type) could not hold custom fields. | `customFields?: ModuleFieldDef[]`. |
| S10 | P3 | Report grade buckets were `z.string()` although only the six band labels are emitted. | `GRADE_LABELS` tuple + `z.enum(GRADE_LABELS)` + `GradeLabel` type. |
| S11 | P3 | `ExamResultModerationResult` was declared in the backend repository while the contract re-declared the same shape. | Shared `examResultModerationResponseSchema` + type; backend imports it. |
| S12 | P3 | Frontend `RankedResult` re-declared ranking fields and used `as unknown as RankedResult[]`. | Extends shared `RankedPosition`/`RankedInExam` (Omit-ing the optional copies on `StudentResultItem`); cast removed. |
| S13 | P3 | `buildExaminationsExportRows` cast to `ExportColumn[]` although the shapes are structurally identical. | Cast removed. |
| S14 | P2 | `.passthrough()` on the 202 job envelope; preferences PUT accepted unknown keys. | Job envelope strict with typed optional fields; preferences PUT strict. |
| S15 | P3 | `useEnterMarksStudents` cast `resolvedStudents as Student[]` (and the exam list/result hooks cast bodies). | Casts removed; results page is parsed through `examResultsPageResponseSchema`. |
| S16 | P3 | Drizzle typed `exams.status` as `string`; no test pinned the shared enum to the DB CHECK. | `$type<ExamStatus>()`; new DB test inserts every `EXAM_STATUSES` value and the existing invalid-status case still expects `23514`. |
| S17 | — | `.passthrough()` remains only on error envelopes (they legitimately carry `details`); field-config blobs stay `z.record(z.unknown())` (legacy cross-module registry, documented). | Accepted/document. |

### Missing registries (brief item 2)

| # | Model | Reality / decision |
|---|---|---|
| M1 | Result status (`present`, `absent`, `exempted`, `disqualified`, `withheld`) | **No column, enum or DTO.** A missing mark is currently indistinguishable from a zero. Needs a migration, scoring/aggregate exclusion rules, report-card/transcript and export propagation (decision D1). |
| M2 | Assessment type (exam/quiz/assignment/practical) | **No column/enum/DTO** (decision D2). |
| M3 | Configurable grading scale / GPA | Fixed `GRADE_BANDS`; `gradingSystem` preference is stored but inert. The enum now restricts the setting to `percentage|letter|gpa|rubric`; behaviour remains D3. |
| M4 | Transcript response model | **None.** `TypstReportCardPayload` is a render payload; the term card is aggregated client-side. Needs a server DTO/endpoint plus persisted term aggregates. |
| M5 | Exam schedule (start time/room/timetable) | Only `date` + `duration`; no schedule/time/room model. |

## Implemented

- Shared: `EXAM_ELIGIBILITY_STATES`/schema; `GRADE_LABELS`/`GradeLabel`; grade-bucket enum; error
  details use `ExamStatus`/`ExamEligibilityState`; single preferences schema + grading enum
  (`EXAM_GRADING_SYSTEMS`, including `rubric`) + derived type; settings interface derives from it and
  fixes `customFields`; derived list query/page types + `examsListResponseSchema`/`examsFromResponse`;
  public/record result schemas and page/moderation schemas; contract uses the derived schemas and
  strict job envelope; eligibility contract uses the shared state/status enums.
- Backend: `exams.status` is `$type<ExamStatus>()`; the list repository reuses shared
  `EXAM_SORT_FIELDS` and filters statuses through `isExamStatus`; membership repository types
  lifecycle statuses; moderation result type imported from shared.
- Frontend: shared statuses in filters/labels; list/result hooks use the normalizer (no casts);
  ranked results extend the shared ranking types; students cast removed; grading `rubric` option and
  translations in en/ar/ur/fa.
- Tests: contract alignment (derived list, public/record, numeric-string rejection, finalization
  status, grade labels, preferences strict/grading enum), DB status parity (every shared status
  accepted, unknown rejected), existing suites unchanged.

## Deferred designs

- **D1 result status**: `EXAM_RESULT_STATUSES` enum, `exam_results.status` default `present`, scoring
  (absent/exempt → no score; disqualified/withheld → excluded from aggregates), contract/status
  filters, report-card/transcript tokens, export columns.
- **D2 assessment type**: `exams.assessment_type` default `exam`, form/filter/report wiring.
- **D3 grading scale**: band table or JSON preference, GPA mapping, engine + document consumption;
  `gradingSystem` stays advisory until then.
- **Exam schedule**: start time/room/timetable tables and conflict checks; DTO + UI.
- **Transcript**: `GET /students/:id/transcript` DTO derived from the term aggregate, replacing the
  client-side aggregation.
- **Field-registry typing**: the shared `moduleFieldConfig` base schema remains `z.record(unknown)`
  for legacy blobs; tightening it needs a migration/backfill across modules.

## Verification

```bash
pnpm typecheck
pnpm --filter @mms/shared test          # 269 files / 2141 tests
pnpm --filter mms-backend test          # 498 files / 3556 tests
pnpm --filter mms-backend test:db       # 83 files / 435 passed (1 skipped)
pnpm --filter mms-frontend test         # 1193 files / 4492 passed (2 skipped)
node scripts/check-examinations-test-matrix.mjs
pnpm check:docs && pnpm check:i18n
```
