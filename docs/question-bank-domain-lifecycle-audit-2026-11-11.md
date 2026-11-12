# Question Bank Domain & Lifecycle Audit (2026-11-11)

**Scope.** The Question Bank *domain* layer: per-type validation, option scoring, the authoring
lifecycle, and the guarantee that a question already used by a delivered paper cannot be rewritten
under it. The schema/persistence pass is
[`question-bank-schema-persistence-audit-2026-11-11.md`](question-bank-schema-persistence-audit-2026-11-11.md).

**Method.** Read the shared DTO/validator modules (`questionBankModuleManifest.ts`,
`questionBankSourceNormalize.ts`, `questionBankAnswerUtils.ts`), the use-case composition root, the
generic CRUD/bulk services, both route layers, the paper/result repositories, and the frontend form
and grading components. Then probed the two schemas directly with `tsx` (results below) and compared
against the `examinations/domain/` pattern that this module lacked.

## Evidence — what was enforced before this change

| Case | API write boundary (`questionBankQuestionListSchema`, live `PUT /questions/bulk`) | Browser form (`questionBankQuestionWriteSchema`) |
|---|---|---|
| mcq, 0 options | **accepted** | rejected (answer not in options) |
| mcq, 1 option, answer in options | **accepted** | accepted |
| mcq, answer not in options | **accepted** | rejected |
| true_false, answer `"maybe"` | **accepted** | **accepted** |
| numeric, answer `"about five"` | **accepted** | **accepted** |
| fill_blank, answer parts ≠ markers | **accepted** | **accepted** |
| matching, 3 lefts / 2 rights | **accepted** | **accepted** |
| ordering, 1 item | **accepted** | **accepted** |
| `marks: 0` | **accepted** (DB check was `>= 0`) | rejected only because `.strict()` forbids the key |
| short, empty answer | **accepted** | **accepted** |

## Findings — architectural violations

| # | Sev | Where | Finding | Status |
|---|---|---|---|---|
| W1 | P1 | `questionBankModuleManifest.ts:100`, `questionBankUseCases.ts:114` | **Validation was a browser concern.** The authoritative bulk PUT validated shape only, and the only type rules lived in the form resolver. | Fixed — `validateQuestionByType` is now the single authority, called by the write plan and the form |
| W2 | P1 | `questionBankModuleManifest.ts:117` | The write API was a free-form upsert with **no lifecycle**: no `status`, no transition table, no way to express "approved". | Fixed — 0241 + `questionLifecycle.ts` + guarded transitions |
| W3 | P1 | `AutoGradingResultRow.tsx:104`, `questionBankResultsPersist.ts:42` | **Scoring was client-side**; the API persisted any `scores` a client sent (a 1-mark question could be scored 999). | Fixed — `questionScoring.ts` recomputes on the server |
| W4 | P1 | `questionBankPageController.ts:121`, `questionBankQuestionsPersist.ts:68` | Every form edit **destroyed server-owned data**: `marks` reset to 1, `question_tags` wiped, and `restored_at` nulled (the 0240 `CASE` fell through to `excluded.restored_at`). | Fixed — the write plan merges server-owned fields from the stored row; the UI also merges over the stored record |
| W5 | P1 | `questionBankSourceNormalize.ts:127` | `normalizeQuestionTypePayload` ran only on the dead generic `create`/`updateById` path; the live bulk path stored unnormalized payloads. | Fixed — the write plan normalizes every changed row |
| W6 | P1 | `questionBankContractRouter.ts:115-147` | **Blanket `catch { return 500 }`** flattened domain refusals (including the 0240 lock) into `database_error`. | Fixed for the new endpoints (`mapDomainError`); the legacy handlers still use the 500 path |
| W7 | P2 | `tenantBulkService.ts:30` | `upsertWithBroadcast` is a generic parse-and-save helper with no hook for domain rules. | Fixed — `buildQuestionWritePlan` runs inside `bulkSaveQuestions` |
| W8 | P2 | `questionBankUseCases.ts:75` | Two write paths with different contracts (live bulk vs dead single-record CRUD). | Fixed — `saveQuestion` now delegates to the bulk plan, so both obey one contract |
| W9 | P2 | `routes/tenant/questionBank.ts` | No audit trail on question create/update/delete/restore. | Partly fixed — status moves and duplicates are audited; bulk content edits are not (recorded as a follow-up) |
| W10 | P2 | `questionBankTestsSync.ts:66` | Paper composition was freely rewritable after results existed. | Fixed — `assertPaperCompositionsEditable` + `published_at` |
| W11 | P2 | `examinationTestTables.ts:35` | `tests.total_marks` is independent of the linked questions' marks; percentages can exceed 100. | Open — recorded as D2 |
| W12 | P3 | `packages/shared/src/schemas/questionBank.dto.ts` | A third, unused validation surface (`*CreateSchema`/`*UpdateSchemaSanitized`). | Open — confirm-then-remove |
| W13 | P3 | `autoGradingShared.ts:4`, `performanceAnalyticsUtils.ts:8` | `sumScores` duplicated verbatim. | Open |
| W14 | P3 | `questionBankCore.ts:32` | `\|\|\|` compound-answer encoding in a text column; an answer containing the delimiter is silently split. | Open |

### Edge cases that were reachable (all now rejected on write)

Mcq with 0/1 options · duplicated choices · answer not among the choices · true_false answer outside the
pair · empty short answer · fill_blank with no marker or a wrong number of answers · matching with a
half-filled pair or mismatched counts · ordering with one item or a stale answer · non-numeric numeric
answer or negative tolerance · `marks` 0/fractional · whitespace-only text · type switched through the
API leaving stale options · duplicate categories · editing/retiring a question a delivered paper uses.

### Transactional flaws found

- **T1** — the bulk PUT rewrote every row in the payload, bumping OCC tokens and rewriting children for
  untouched questions. *Fixed: the write plan returns only changed rows.*
- **T2** — child sync is delete-then-reinsert with no per-child identity. *Mitigated: `FOR UPDATE` on
  the question rows serialises concurrent saves; OCC catches a stale token.*
- **T3** — status transitions had no CAS. *Fixed: `UPDATE … WHERE version = ?` inside one transaction.*
- **T4** — scoring happened before any transaction (on the client). *Fixed: recomputed in the use case
  from the paper's stored answer keys.*
- **T5** — the delivery guard existed only as a DB trigger, so the API could not explain the refusal.
  *Fixed: `findReferencedQuestionIds` pre-checks in the write transaction and returns `409 question_in_use`.*

## What shipped

**Shared domain (pure, no I/O).**
- `packages/shared/src/examinations/questionInvariants.ts` — `validateQuestionByType`, the exhaustive
  per-type rule map, `QuestionInvariantCode` and the translation key for each code.
- `packages/shared/src/examinations/questionLifecycle.ts` — `draft → under_review → approved → retired`
  (retired reopens to draft), `canTransitionQuestion` failing closed, content-lock and
  approval-authority predicates.
- `questionBankQuestionWriteSchema` now delegates to the invariant validator, so the browser and the
  API cannot disagree (the existing message keys are preserved).

**Backend domain.**
- `questionBank/domain/questionWriteGuards.ts` — `assertQuestionEditable`,
  `assertQuestionTransition`, `assertPaperCompositionEditable` and their `409` errors
  (`question_locked`, `question_in_use`, `illegal_question_transition`, `paper_locked`).
- `questionBank/domain/questionScoring.ts` — `scoreAssessment` / `scoreQuestionAnswer`; the award is
  the question's marks, so an inflated score is not representable.
- `db/repositories/questionBankQuestionWritePlan.ts` — one authoritative plan per save: load stored
  rows `FOR UPDATE`, merge server-owned fields, normalise, validate changed rows, guard content edits,
  skip unchanged rows, and pre-check delivered-paper references.
- `db/repositories/questionBankPaperCompositionGuard.ts` — freezes a published paper's question set
  before the links are deleted.

**Migration `0241_question_bank_lifecycle_and_marks.sql`** (+ snapshot + journal):
`questions.status` with its CHECK and filter index; `marks > 0`; `tests.published_at`/`published_by`
with a pair CHECK; `test_questions.question_snapshot`; and the 0240 guard function replaced so a
published paper counts as evidence.

**API.** `POST /api/question-bank/questions/:id/status`, `…/:id/duplicate`,
`/api/question-bank/tests/:id/publish` — implemented in the contract router with domain-error mapping
and approval gated on the delete permission.

**Frontend.** The page controller merges the edited form over the stored record (marks/tags/restore
evidence survive), the detail drawer shows the status and offers submit/approve/reopen/retire/duplicate,
and the paper builder only offers approved questions.

## Behaviour changes worth calling out

- **A stale token now always conflicts**, even when the payload is otherwise identical — the caller is
  editing a version that no longer exists.
- **Re-saving an unchanged record is a no-op** (no version bump), so a collection PUT no longer churns
  untouched rows.
- **Client-supplied `scores` are ignored on write**; they are still returned on read.
- **`marks: 0` is rejected** at the DB and by the validator; existing zero-mark rows are repaired to 1
  by the migration.
- **Editing an `approved`/`retired` question is refused** until it is reopened to draft — and a
  referenced question cannot be reopened at all; duplicate it instead.

## Deferred

- **D1 — status in the Work directory.** The record already carries `status`, but the list has no
  status column or filter yet; today the status is visible in the detail drawer.
- **D2 — paper total vs question marks.** `tests.total_marks` is independent of the linked questions;
  publishing should warn when the sum differs (or derive it).
- **D3 — a dedicated approval permission.** Approve/retire currently reuse the module's delete
  permission because `students.read/write` is all the manifest defines.
- **D4 — question version history.** The guarantee is blocking + snapshots + duplicate; a
  `question_versions` table (the previous round's D6) would allow non-destructive revisions.
- **D5 — audit every content edit.** Status moves and duplicates are audited; bulk content edits are
  not yet (they would need the actor threaded into the write plan).
- **D6 — compound-answer delimiter.** `|||` collisions (W14) need a real child table.
- **D7 — dead DTO schemas** (`questionBank.dto.ts`) should be removed once confirmed unused.

## Verification

```bash
pnpm --filter mms-backend db:migrate && pnpm --filter mms-backend db:check
pnpm typecheck
pnpm --filter mms-backend test
pnpm --filter mms-backend exec vitest run --config vitest.db.config.ts \
  src/__tests__/db-integration/questionBankPersistenceDb.integration.test.ts
pnpm --filter mms-frontend test
node scripts/check-examinations-test-matrix.mjs
pnpm run check:i18n
bash scripts/ci/local-ci.sh
```

New coverage: 23 shared invariant cases, 6 lifecycle cases, 12 domain-guard/scoring cases, and 9
real-Postgres lifecycle scenarios (invalid write, server-owned field preservation, approved lock,
delivered-paper lock, transition table, referenced reopen, duplicate, publish snapshot + frozen
composition, empty/unpublishable paper).
