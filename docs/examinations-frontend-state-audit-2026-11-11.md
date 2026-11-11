# Examinations Frontend & State Management — Audit (2026-11-11)

**Scope.** The Examinations page shell (`ModulePageShell`), marks-entry modal/grid, TanStack Query
keys and invalidation, and the exam/setup/moderation forms. Goal: no stale caches after exam writes or
imports, keyboard-navigable virtualized grid, no silent loss of unsaved edits, and validation/error
feedback before submission.

## Architecture map

- Page: `ModulePageShell` with lazy Work/Reports/Setup tiers (there is no `TemplateModulePage`).
- Marks entry: `FormModal` → `EnterMarks` → `EnterMarksTable` (virtualized above 30 students) →
  `EnterMarksStudentRow`.
- State: local draft in `EnterMarks`; collection data from `useExaminationsExams` /
  `useExaminationsResults`; mutations in `useExaminationsApi`.
- Invalidation: `invalidateExaminationsQueries` (shared `createModuleQueryInvalidator`); live push
  maps `examinations`/`exams`/`exam_results` and always invalidates dashboard + dynamic widgets.
- Backend: exam CRUD and marks saves already broadcast via `upsertWithBroadcast`; gate/moderation
  handlers did not.

## Findings

### Query keys & cache invalidation
| # | Sev | Finding | Fix |
|---|---|---|---|
| Q1 | **P1** | The module invalidator omitted `DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY` and `DASHBOARD_SUMMARY_QUERY_KEY_ROOT`, so the same client's dashboard exam widgets/KPIs stayed stale after marks/publish/exam edits. | Both roots are invalidated by `invalidateExaminationsQueries` (widget slot in the factory + explicit dashboard root). |
| Q2 | **P1** | Import completion invalidated nothing: `StandardModuleCsvImportDialog` never forwarded `onSuccess`, so exam CSV and marks imports left exams/results/analytics stale (reports staleTime 5 min). | The dialog accepts `onSuccess`; `ExaminationsCsvImportDialog` and `EnterMarks` pass the module invalidator. |
| Q3 | P2 | The eligibility key was an inline literal and absent from the invalidator; only the finalize handler refetched its own instance. | `EXAMINATIONS_ELIGIBILITY_QUERY_KEY` added, used by the panel and invalidated with the module. |
| Q4 | P2 | Attendance/enrollment invalidation never touched exam eligibility, although attendance % and roster membership feed it. | Both invalidators also invalidate the eligibility key (via the public `@/tenant/hooks/collections/examinations` surface). |
| Q5 | P2 | **Corrected during implementation:** exam CRUD and marks saves already broadcast (`upsertWithBroadcast`/bulk service); moderation, publication, attendance-gate and override success paths did not. | Those four handlers now `broadcastTenantUpdate` (`exam_results` for moderation; `exams` for publication/gate/override), so the existing live-push mapper refreshes other clients. |
| Q6 | P3 | Two mutation surfaces (`useExaminationsApi`, contract hooks in `useExaminationsQueries`) exist; only the former is used by the page. | Kept the contract hooks (public facade/test contract) but documented; both call the same invalidator, so behaviour cannot drift. |
| Q7 | P3 | Eligibility body cast; Reports charts returned `null` on loading/error. | Shared `ExamEligibilityResponse` type; charts render loading/error + retry. |
| Q8 | — | Verified: metrics key matches `useServerMetrics`; results/analytics prefix invalidation; academic-catalog renames already invalidate `["examinations","exams"]`. | — |
| Q9 | — | No exam surface exists on student profiles, so there is nothing to invalidate there. | Documented (no profile feature). |

### Mark-sheet grid & page architecture
| # | Sev | Finding | Fix |
|---|---|---|---|
| G1 | **P1** | Unsaved marks were lost on modal close: the guard only handled `beforeunload`, and the modal passed no `isDirty`/discard labels. | `EnterMarks` reports dirtiness; the marks `FormModal` confirms a discard on X/Escape/backdrop. The exam form does the same. |
| G2 | **P1** | The grid re-seeded whenever `results` identity changed, wiping a dirty draft on any background refetch; a section save set a global "saved" flag and hid Save while other sections were dirty. | The persisted seed (id/version) is snapshotted when editing starts; refetches re-seed only when clean; save uses the snapshot so an external change still 409s. Save stays visible while dirty, and the saved badge is `saved && !isDirty`. |
| G3 | P2 | Keyboard navigation used DOM order and stopped at the virtual window edge; native Tab only crossed mounted rows. | Pure index resolver over the filtered roster; Tab/Shift+Tab/Enter/Arrow/Home/End scroll the virtualizer then focus by input id; Tab leaves the grid at the edges. |
| G4 | P2 | No row memoization: each keystroke re-rendered every mounted row (framer wrapper, avatar, score/grade) and recomputed the roster filter; callbacks were new each render. | `React.memo(EnterMarksStudentRow)`, `useCallback` mark change, `useMemo`/`useDeferredValue` filtering, one-pass invalid/dirty derivations. |
| G5 | P3 | Virtual rows keyed by index; no `aria-posinset`/`aria-setsize`. | Rows carry position/set-size (and stable inner id keys). |
| G6 | P3 | Numeric inputs inherited RTL. | Marks/grace/total/passing/duration inputs are `dir="ltr"` + end-aligned. |
| G7 | — | Verified: virtualization exists (>30), out-of-range highlight is immediate with `aria-invalid`, published grids are read-only, blank cells never save zero, OCC id/version echoed. | — |

### Forms & validation UX
| # | Sev | Finding | Fix |
|---|---|---|---|
| F1 | **P1** | Exam form validated only on submit and only name/date/classes; Save stayed enabled with `passing > total`, zero total or blank duration. | Pure `validateExamDraft` runs on every render; Save disabled while invalid; field errors show after touch or submit. |
| F2 | P1 | Numeric fields coerced per keystroke (`Number(...)` → NaN/0), and `totalMarks` had no error binding. | `parseIntegerInput` keeps cleared/partial input stable; total/duration error props added. |
| F3 | P2 | Save failures were double-toasted (controller + form), and the server message never appeared inline. | The controller throws `NotifiedMutationError` after notifying; the form skips the second toast and shows the message in `FormModal error`; marks saves show an inline banner with retry. |
| F4 | P2 | Closing the exam form discarded changes silently. | `isDirty` from the hook + discard confirm on the modal. |
| F5 | P2 | Preferences accepted any pass/max strings; no guard on sub-tab/page leave. | Numeric pass/max validation with field errors and blocked save; `beforeunload` guard, Setup sub-tab dirtiness, and the page tab switch confirm. |
| F6 | P2 | No grading-scale builder; only a grading-system select and fixed bands. | Documented as D3 (bands remain the engine); no fake builder added. |
| F7 | P3 | Moderation had disabled Apply but no inline reason; server errors only toasted. | Inline validation (grace bounds, reason length, total bound) and inline server error. |
| F8 | — | Verified: touched-field error clearing, print/export flows unaffected. | — |

## Implemented

- Invalidation: widget/dashboard roots, eligibility key, import-success callback, attendance/
  enrollment cross-module eligibility, live-push broadcasts for moderation/publication/gate/override.
- Grid: index keyboard navigation + auto-scroll, memoized rows, deferred filtering, a11y positions,
  LTR numeric inputs, dirty-preserving seed, discard confirms, inline save error/retry, dirty-gated
  Save, section-aware saved state.
- Forms: live exam validation (pure + tested), stable numeric input parsing, dirty/discard, inline
  server errors without duplicate toasts, preference validation + leave guards, moderation inline
  validation, Reports loading/error/retry.
- Tests: navigation resolver, grid focus movement, draft-survives-refetch, form validation/dirty/save
  failure, invalidator keys, updated import-dialog contract.

## Deferred / absent (recorded)

- **Timetable views** — no model/component (schedule design remains deferred).
- **Grading-scale builder** — D3; bands are fixed and `gradingSystem` is advisory.
- **Student-profile exam surface** — none exists.
- **Contract mutation hooks in `useExaminationsQueries`** — kept for the public facade; they share the
  invalidator and are not used by the page. Consolidation is a follow-up.
- Backend cross-node live push relies on the configured Redis pub/sub (existing infrastructure).

## Verification

```bash
pnpm typecheck
pnpm --filter mms-frontend test        # 1196 files / 4504 passed (2 skipped)
pnpm --filter mms-backend test         # 498 files / 3556 tests
pnpm --filter @mms/shared test         # 269 files / 2151 tests
pnpm --filter mms-backend test:db      # 83 files / 435 passed (1 skipped)
node scripts/check-examinations-test-matrix.mjs
pnpm check:docs && pnpm check:i18n
```
