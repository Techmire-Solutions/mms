# Question Bank Print, Import/Export & Analytics Audit (2026-11-12)

**Scope.** Printable papers/answer keys (document templates, BiDi, option numbering, math/symbols),
bulk import and streaming export (options parsing, row errors, formula injection, memory), and the
dashboard/report aggregates (unindexed aggregations, silent field fallbacks).

**Method.** Read the paper builder and print helpers, the shared transfer schema/mapper and the CSV
serializer, the widget and report repositories, and the relevant indexes; then rendered the print
components and queried the aggregates against seeded tenants.

## 1. Printable papers & answer keys

| # | Sev | Finding | Resolution |
|---|---|---|---|
| P1 | **P1** | The print popup hardcoded `<html lang="en">` with no `dir`; every Arabic/Urdu paper printed LTR. | `buildPaperPrintHtml`/`openPaperPrintWindow` take `{language, direction}`; the handler passes the active locale. |
| P2 | **P1** | No answer key, marking key or bubble sheet existed; the only key view was screen-only in the detail drawer. | `PrintablePaper mode="answerKey"` renders the key (correct option highlighted, answer block, no answer lines) and `PrintableAnswerSheet` renders the bubble sheet; both are modes in the preview panel. |
| P3 | **P1** | `.qpaper` used `Inter, Arial` only; Urdu/Arabic printed with system fallbacks. | The print stylesheet uses the shared `PRINT_FONT_STACK` (Inter, Readex Pro, Noto Nastaliq Urdu, Vazirmatn, Amiri) and loads its stylesheet in the popup. |
| P4 | **P2** | No bidi isolation: mixed English/Arabic stems and `A.` labels could reorder in RTL. | `unicode-bidi: plaintext` on stems/options/answers; question numbers and option labels are wrapped in `<bdi>`. |
| P5 | **P2** | No document-templates integration (the module has its own React print path; templates are element/Typst layouts keyed by `/api/templates/:key`). | Deferred with a design note — see §5. |
| P6 | P3 | No math formatting; `$…$`/LaTeX prints literally. | Deferred (needs KaTeX + sanitisation). Documented. |
| P7 | P3 | Latin digits and `A`–`F` labels only. | Kept deliberately (exam convention) and bidi-isolated; documented. |

## 2. Import & export

| # | Sev | Finding | Resolution |
|---|---|---|---|
| I1 | **P1** | CSV import could not represent choice questions: no options column, `mcq`/`true_false` rejected. | The transfer schema gains `options` (pipe-separated); the mapper parses it, canonicalises the mcq answer (must match an option), validates true/false, and still rejects pair/order types with a row-level reason. |
| I2 | P2 | XLSX import unsupported (CSV-only dialog). | Documented as deferred. |
| I3 | P2 | No blueprint import; blueprints validate only on the assemble API. | Documented. |
| I4 | **P1** | The export buffered the whole artifact (up to 5,000 rows). | `generateQuestionBankCsvStreamChunks` streams the header once and one chunk per page; the generic runner now writes the stream to storage. `buildExport` remains for tests/small exports. |
| I5 | — | Formula injection was already neutralised by `escapeCsvCell` (`'` prefix for `= + - @ | %`, leading whitespace; negative numerics preserved). | Added a QB regression test (`=HYPERLINK`, `+cmd`). |
| I6 | — | Row-level errors and bounded memory (1 MB payload, 50-row chunks) already correct. | Extended to mcq/true_false rows. |

## 3. Analytics & widgets

| # | Sev | Finding | Resolution |
|---|---|---|---|
| A1 | **P1** | Unknown widget fields silently fell back to `questions.type`, reporting a wrong number. | Closed field map: `type`, `difficulty`, `questionLanguage`, `status`, `marks`, plus `categoryId`/`usageCount`; anything else is a **400**. |
| A2 | **P1** | `startsWith` was accepted but dropped, yielding unfiltered counts. | Implemented (`ILIKE 'value%'`). |
| A3 | **P1** | `filters[]` was accepted but ignored. | All rules are ANDed into the value and chart predicates. |
| A4 | P2 | No `status`/`categoryId`/`usageCount` support: drafts, questions-per-subject and overused questions were not expressible. | Added: enum status, category filter (`EXISTS`) and chart (junction-grouped), usage-count filter (indexed correlated count). |
| A5 | P2 | `lower(trim(col::text))` on enum columns prevented index use. | Enums compare directly (they are stored lowercase). |
| A6 | P2 | Monthly trend filtered `(submitted_at)::date` — a function on the column that defeats `assessment_results_workspace_submitted_idx`. | Raw-column lexical predicate `submitted_at >= to_char(date_trunc('month', now()) - interval '11 months', 'YYYY-MM-DD')` (the column is an ISO-8601 varchar). |
| A7 | — | Index coverage confirmed: `questions_ws_active_status_updated_idx`, `questions_ws_active_difficulty_type_idx`, `question_categories_workspace_cat_idx`, `test_questions_workspace_question_idx`, `assessment_answers_workspace_res_idx`. | No new index required. |
| A8 | P3 | "Topic gap" cannot show zero-question topics (categories are free-text junction rows, no registry). | Documented. |

## 4. What shipped

- Print: locale `lang`/`dir`, Arabic/Urdu font stack, bidi isolation, answer-key mode, printable
  answer sheet, mode switch in the preview (writers only).
- Import/export: `options` column + mcq/true_false mapping, streamed export, formula-injection test.
- Analytics: strict widget field resolution (`400` on unknown), `status`/`categoryId`/`usageCount`,
  `startsWith` and `filters[]`, enum-equality predicates, raw-column monthly range.
- i18n: `answerKey`, `answerSheet`, `paperView`, `answerSheetInstructions` in en/ar/ur/fa.

## 5. Deferred

- **Document-templates engine integration.** The engine stores element/Typst layouts keyed by
  `/api/templates/:key`; a QB integration needs a new template key plus a paper→element payload
  mapper (questions, sections, marks, key mode, bubble geometry) and a preview surface. Until then the
  bespoke print path above is the supported renderer.
- **XLSX import** (dialog and body schema are CSV).
- **LaTeX/math rendering** (KaTeX dependency + sanitisation review).
- **Topic gap** requires a category/subject registry so empty topics can be listed.

## 6. Verification

```bash
pnpm typecheck
pnpm --filter @mms/shared test
pnpm --filter mms-backend test
pnpm --filter mms-backend exec vitest run --config vitest.db.config.ts \
  src/__tests__/db-integration/questionBankPersistenceDb.integration.test.ts
pnpm --filter mms-frontend test
pnpm run check:i18n && bash scripts/ci/local-ci.sh
```

New tests: print HTML `lang`/`dir`/font link; paper vs answer-key vs answer-sheet rendering; mcq
options mapper (valid, too few, answer outside options); streaming chunks/header; formula injection;
widget status/category/usage/prefix/multi-rule and the unknown-field 400.
