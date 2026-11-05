# Students UI/UX Review — Fixes and Improvement Backlog (2026-11-04)

Focused UI/UX pass over the **Students** module at `main` HEAD `a51ae8bd5`, driven by the rendered review
`docs/ui-ux-review-2026-11-04/README.md` (still current — `git log 30abb1b41..HEAD -- apps/frontend/src` is
empty at baseline) and the code review `docs/students-frontend-review-2026-11-04.md`.

This pass **implemented** the contained, user-visible defects below (each with a pinning test) and left the
shell/table redesigns as a prioritised backlog, because they belong to shared layout primitives
(`ResponsiveAccordionTabs`, `WorkBatchTable`) rather than to Students.

## 0. Provenance

- Baseline HEAD `a51ae8bd5`; students paths were unchanged since `30abb1b41`.
- A **concurrent local process** was editing unrelated frontend files throughout this pass (dashboard,
  messaging, contacts, i18n packs; 450+ dirty paths). It also added three loose assertions in
  `ContactsBulkTagModal.test.tsx` / `ContactsCommandMetrics.test.tsx` / `ContactsToolbar.test.tsx` and removed
  `header` from the print-chrome hide list in `index.css` — both are the cause of the two suite failures
  recorded in §2 and are **outside this change set**.
- No backend, schema, or migration change. One shared UI primitive (`SectionLabel`) gained an optional
  `title` prop; every other shared change is behaviour-compatible.

## 1. What changed

| # | Defect (source) | Fix | Pinning test |
| --- | --- | --- | --- |
| 1 | KPI labels ellipsized at 1024/375; 5-card strip orphaned at 375 (rendered review UX-02/UX-12) | `ModuleCommandMetricsGrid`: 5 items = 3 columns at `lg`, 5 at `xl`; 6 items = 4 at `xl`, 6 at `2xl`; odd counts make the last card span both mobile columns. `StatCard` compact label wraps to two lines (`line-clamp-2`, `break-words`, `text-balance`) with `title` fallback (`SectionLabel` now forwards `title`) | `ModuleCommandMetricsGrid.test.tsx`, `StatCard.test.tsx` |
| 2 | Import dropzone `label-content-name-mismatch` (serious axe; rendered review UX-03) | `DashedFileDropZone`: the interactive zone is named from its visible copy (`${title} ${description}`), the browse control from `browseLabel`; the hidden file input keeps `inputAriaLabel` | `DashedFileDropZone.test.tsx` |
| 3 | Import dialog closed on success, so partial-failure counts were never shown; constructed English failure copy (S-01) | `StandardModuleCsvImportDialog` no longer closes on submit success; the completed panel shows `imported of total` and the failed remainder; success toast removed (panel is the single surface); failure toast is localized (`module.import.failed`, 4 locales) with the server message as description | `StandardModuleCsvImportDialog.test.tsx`, `ModuleImportDialog.test.tsx`, `useModuleCsvImportActions.test.tsx`, `ContactsCsvImportDialog.test.tsx` |
| 4 | "All genders" wrote `gender=all` and emptied the directory; the default left no radio selected (M1) | `useStudentsDirectoryFilters` normalises the `all` sentinel to `""`; the menu renders `gender \|\| "all"` | `useStudentsDirectoryFilters.test.tsx`, `StudentsFiltersMenuButton.test.tsx` |
| 5 | Setup sub-tab click was dead while the card editor was dirty (M4) | `StudentsSetupTier` renders the shared discard dialog from `subTabs.discardConfirmOpen` / `clearPendingSubTab` / `handleConfirmDiscard`. The existing `onDiscard` already reset the card guard (the review's “inert onDiscard” claim was wrong; only the dialog was missing) | `StudentsSetupTier.discard.test.tsx` |
| 6 | Reports nested `ReportDataGridContainer` twice: duplicate title/toolbar and a page-only export (M3) | `StudentReportTables` returns the table bodies only; the view owns one container and passes `isLoading`/`empty`/copy/icon | `StudentReportView.test.tsx` |
| 7 | Pagination disappeared when the current page emptied; the pager could point past the last page (X-02/S-m8) | `StudentsList` gates pagination on `total`, not row count; the controller clamps the page once the fetch settles | `StudentsList.test.tsx` |
| 8 | Bulk-status menu offered global statuses, not the tenant's (S-02) | Overlay state accepts `statuses` and builds the bulk-bar badge/option config from `resolveStudentStatuses(configuredStatuses)` | `useStudentsPageOverlayState.test.tsx` |
| 9 | Side switch remounted the card editor and reported clean, disarming the unsaved guard (S-03) | `StudentCardTemplateEditor` remembers that the user edited (`hasUserEditedRef`) and never lets a remount's `false` clear the guard; reset on save/reload | `StudentCardTemplateEditor.dirty.test.tsx` |
| 10 | KPI band showed the filtered count as "Total" and hard zeros while loading/failed (S-m1/X-05/n1) | `StudentsCommandMetrics` renders `—` for unknown metrics, `aria-busy` while loading, and an inline `role="alert"` + Retry on failure; controller/view pass `isLoading/isError/onRetry` | `StudentsCommandMetrics.test.tsx` |
| 11 | Dead report KPI builder (`metricItems` + `studentReportMetrics.ts`) with an unreachable toast bug | Removed the builder, its data hooks and the module | typecheck + `StudentReportView.test.tsx` |
| 12 | Directory flashed a skeleton on every search/filter/page change (n9) | `useStudentsContractList` sets `placeholderData: (prev) => prev` (matching its factory and the Contacts twin) | `useStudentsQueries.test.tsx` |
| 13 | Escape behind an open drawer/form also cleared the page selection/filters; Cmd+N could open create over a dialog (n3) | Shared `useModuleWorkKeyboardShortcuts` and `useModuleCreateHotkey` bail out while `overlayLayerCount() > 0` | `useModuleWorkKeyboardShortcuts.test.tsx` |
| 14 | Failed single delete closed its confirm; partial bulk status cleared the selection; restore spinner detached (n4/n6/n7) | `handleDelete` resolves `false` and the overlay closes only on success; `handleBulkStatusChange` returns `{succeeded,failed}` and the work tier keeps a partial selection; `StudentDetail` passes the async restore directly | `useStudentsCrudActions.test.tsx` |
| 15 | A report-tab error replaced the whole shell (hiding the other tab); missing age rendered `0` (n16) | `StudentReportView` renders the `ErrorState` inside the active tab below the `SubTabBar`; `mapStudentRow` uses the `—` sentinel for unknown age | `StudentReportView.test.tsx` |
| 16 | Editing from the list silently wiped `notes` (M2) | `getInitialStudentDraft` only materialises `notes` when the row carries it (undefined values are no longer copied), so `mergeStudentPatch` preserves the stored value | `lib/studentFormDraft.test.ts` |
| 17 | GR backfill stopped after 100 students and self-gated forever (M5) | `useGrMigration` loops on the server's `hasMore` (bounded at 20 chunks), gates only when complete, toasts the cumulative count, and leaves the gate open when the cap is reached | `useGrMigration.test.tsx` |

## 2. Verification

| Check | Result |
| --- | --- |
| `pnpm --filter mms-frontend test` | **4,219 passed**, 2 skipped, **2 failed** — both outside this change set and attributable to the concurrent process: `printStyles.test.ts` (`header` missing from the print hide list in `index.css`) and `testAssertionSpecificity.test.ts` (3 new `toBeDefined` assertions in contacts tests; my change adds none) |
| Cold `tsc -p apps/frontend/tsconfig.json` (fresh tsbuildinfo) | **Pass** (exit 0) |
| Targeted ESLint on every touched file | **Pass** (0 problems) |
| `check-code-norms` | **Pass** (0 `any`, 300-LOC ceiling, tokens) |
| `check-frontend-structure`, `check-shared-ui` | **Pass** |
| BiDi sweep (`check-bidi-classes.mjs`, 3,949 files) | **Pass** — 0 physical direction classes |
| `check:i18n` / `check:i18n-unused` | **Pass** — 9,593 keys, ar/ur/fa complete; unused-key ratchet improved (454 vs 517) |
| axe / Playwright | **Not run** — no app + DB + Playwright stack in this environment. The students directory + drawer spec (`e2e/tests/a11y/a11y-populated.spec.ts:151-163`) and the import dropzone fix should be re-checked in the browser before release |

**Manual QA checklist (browser, 375/768/1024/1440 × en/ar/ur):** KPI labels fully readable and no orphan card;
"All genders" leaves the list unchanged and shows as selected; a dirty card template prompts on sub-tab
switch and discard remounts it; Reports shows one title/toolbar and the export covers all filtered rows;
deleting the last rows of page 2 keeps the pager and clamps back; a partial bulk status keeps failed rows
selected; Escape inside the drawer does not clear the selection; a list-row edit preserves the student's
notes; an import with failures keeps the dialog open with imported/failed counts; ID-card/session data
unaffected.

## 3. Improvement backlog (not implemented)

| Pri | Improvement | Why / acceptance |
| --- | --- | --- |
| P1 | **Mobile tier switcher** (rendered review UX-04) | At 375 the next tier header sits below a 6–7k px page; students need a sticky segmented tier bar or headers above collapsed bodies. Acceptance: every tier reachable within one viewport from the top. Shared shell change (`ResponsiveAccordionTabs`). |
| P1 | **Directory table overflow at 1024–1440** (UX-05) | The students table is ~1,400 px wide in a ~698 px container; Status/Actions are off-screen with no scroll affordance. Reduce default columns, freeze identifier + actions, or default to cards below `lg` (the hook already supports a table/cards default). Acceptance: Status + Actions visible at 1024 without horizontal scroll, or an explicit overflow cue. |
| P2 | **Report export server-side** | The Reports export page-walks the full filtered set into browser memory (`studentReportExport.ts`) and pays a COUNT per page; the queued Work export already streams server-side. Acceptance: one queued job, no client-side roster dump. |
| P2 | **Drawer information architecture** | Academic sessions currently render after relationships and notes are only shown when the row was hydrated. Acceptance: identity → academic → guardians/relations → notes; notes hydrated on drawer open. |
| P2 | **KPI semantics** | The five tiles mix scope (Total/Active/Inactive/New) with the filtered row count. Acceptance: four scope tiles plus a "showing X of Y" line; trash view never mixes active totals with deleted rows. |
| P2 | **Filter/saved-view affordances** | Search inside the status list, a visible "clear all" beside the chip row, and a saved-view shortcut. Acceptance: ≥10 statuses usable without scrolling a menu. |
| P3 | **Bulk bar ergonomics** | Order actions by frequency, surface the failed count with a retry, and offer "select all matching this filter" (selection is page-scoped today). |
| P3 | **Form navigation** | A validation summary with jump links and a sticky section nav for long forms; notes always visible after M2. |
| P3 | **Setup completeness** | `students.setup.fields`/`lookups` i18n keys exist but the Setup tier only renders Preferences + Card Template; either add the Fields tab or remove the dead configuration path. |
| P3 | **Printed-card defaults** | Localize `STUDENT IDENTITY CARD` / `TERMS & EMERGENCY INSTRUCTIONS` and stop falling back to the product name (carried S-m4). |
| P3 | **Dead code** | `studentsListQueryOptions` / `studentsCommandMetricsQueryOptions` have no production caller; the stale `StudentFormValidationScroll.test.tsx` no longer matches a component. |

## 4. Residual risks / hypotheses

- The students table fix for 1024 is **not implemented** (backlog P1); the KPI change only makes the labels
  readable. Wide-table behaviour is unchanged.
- The import completion panel shows imported/failed **counts**, not per-row row-error reasons (the job record
  carries progress only). Surfacing server row errors needs the job artifact or a GET endpoint — backlog.
- `useGrMigration` runs at most 20 chunks per visit; a workspace with >2,000 legacy students needs another
  Work visit (the gate stays open, so it resumes). Not measured against real tenant sizes.
- The two red suite tests are external; re-run after the concurrent process commits and fix `index.css`/the
  contacts assertions, then the suite should be green.
- axe was not executed; the dropzone accessible-name fix is verified by DOM assertions, not a browser scan.
