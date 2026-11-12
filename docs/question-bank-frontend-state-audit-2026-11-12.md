# Question Bank Frontend & State-Management Audit (2026-11-12)

**Scope.** The module page, authoring modal, Work filters, TanStack Query factories and the blueprint
builder.

**Naming note.** `TemplateModulePage` and `TemplateFormModal` do not exist in this codebase; the page
is composed from `ModulePageShell` + `QuestionBankWorkTier`/`QuestionBankSettings` and the modal from
`FormModal`. The findings below target the real components.

## Findings

| # | Sev | Finding |
|---|---|---|
| F1 | **P1** | **MCQ options were hard-capped at four.** `QuestionFormAnswerFields` rendered `options.slice(0, 4)` and the draft started with four empties; no add/remove/reorder. The radio used the option **text** as its value, so two empty/duplicate options collided and could not be selected. |
| F2 | **P1** | **Whole-form re-render per keystroke.** `QuestionForm` called `watch()` with no selector and `useQuestionBankConfig` recomputed `getFlatFieldsConfig`, `getSortedFields` and `mergeQuestionCategories(settings.categories, questions)` on every render (no memo) — over a 500-row snapshot. |
| F3 | **P1** | **Stale analytics cache.** `QUESTION_BANK_REPORT_AGGREGATES_QUERY_KEY` was never invalidated (and the query holds a 5-minute `staleTime`), so create/approve/retire left the coverage/difficulty panels stale. |
| F4 | **P2** | **Whole-collection saves.** `handleQuestionSave` rebuilt and posted the entire questions array through `bulkUpdateQuestions` (same for tests), widening the OCC window and uploading up to 500 records per edit. |
| F5 | **P1** | **Blueprint builder had no preview and swallowed failures.** No available count, no mark total, no per-row validation before the server call; `void assemble()` had no catch; counts were silently coerced; rows could only be removed last-in-first-out. |
| F6 | **P2** | **Filters were category + difficulty only**, although the server list accepts `status` and `type` (drafts / approved workflow is the primary facet). |
| F7 | **P2** | **Lifecycle actions ignored approval authority.** `QuestionBankDetail` offered **Approve**/**Retire** to any writer (`canDelete` unused), which the API rejects with 403; the click ran `void onSetStatus(...)` with no catch → unhandled rejection, no feedback. |
| F8 | **P2** | **Media upload errors were unhandled.** `QuestionMediaSection.upload` had `try/finally` with no `catch`. |
| F9 | — | **RTL is sound.** Components use logical utilities (`text-start`, `ps-*`, `start-*`); the modal passes `dir`; no physical direction classes existed. A ratchet now enforces this. |

## What shipped

- **`QuestionFormMcqOptions`**: add (2–8), per-row remove, move up/down, and a correct-answer radio keyed
  by **row index**; editing the selected row carries `answer` with the new text, removing it clears the
  choice, reordering keeps the row selected. Duplicate/empty options surface the shared invariant error.
- **Performance**: `useQuestionBankLabels` and `useQuestionBankConfig` return memoized references; the
  classification/content/sources sections are `React.memo` with field-level comparators and
  `updateDraft` is a `useCallback`, so typing no longer re-renders every card.
- **Cache**: `createModuleQueryInvalidator` accepts a `reports` key and the Question Bank invalidator
  passes the report-aggregate key, so every mutation (create, status, delete/restore, publish,
  assemble, attachments) refreshes the coverage widgets.
- **Saves**: one edited question/test is sent (`bulkUpdateQuestions([question])`), not the collection.
- **Blueprint UX**: the panel runs the shared `assemblePaperBlueprint` engine against the loaded,
  approved, recency-filtered candidates and shows selected count, total marks and deficits live; each
  row shows its available count; invalid counts are flagged instead of coerced; rows can be removed
  individually and are capped at `BLUEPRINT_LIMITS.maxBuckets`; assembly errors render inline and toast.
- **Filters**: status and type facets (single-select, server query params) with chips and a combined
  active count.
- **Permissions/errors**: approve/retire only render when the caller has approver authority; lifecycle
  and duplicate failures toast and keep the drawer open; media upload failures toast.
- **Guardrail**: a source ratchet fails any QB `.tsx` that adds physical direction utilities.

## Deferred

- **Server-side blueprint preview endpoint** (the preview is computed from the loaded snapshot, so it
  cannot see approved questions beyond the 500-row list cap).
- **Read-model split for `answer`** in the questions collection (recorded in the shared-contracts audit).
- **Virtualised option list** — the 8-row cap makes it unnecessary.

## Verification

```bash
pnpm typecheck
pnpm --filter mms-frontend test
pnpm --filter mms-backend test
bash scripts/ci/local-ci.sh
```

New tests: MCQ add/edit/select/reorder/remove; section memoization is exercised through the existing
form tests; invalidator includes reports/metrics/lists; single-record save body; blueprint availability,
live preview, invalid count and failure states; status/type facet forwarding; approve gating;
RTL utility ratchet.
