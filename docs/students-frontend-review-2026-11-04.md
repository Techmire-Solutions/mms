# MMS Students Frontend Review — 2026-11-04

Independent, read-only review of the **students frontend** at `main` HEAD
`a51ae8bd53bf460ee836f0e15abb21f5fa199f90` (`a51ae8bd5`). It re-verifies the students items from the
multi-module frontend review (`docs/frontend-module-review-2026-11-04.md`, pinned at `30abb1b41`) and
deep-audits the whole feature, which that five-module pass could only sample. Line numbers are from the
tree as reviewed; every Critical/Major citation was re-read at HEAD.

**Scope:** `apps/frontend/src/tenant/features/students/**` (120 non-test files / 11,128 LOC:
`components/` 57 / 6,024 · `hooks/` 44 / 3,489 · `lib/` 18 / 1,604), plus the students-owned shared
surfaces: `tenant/hooks/collections/students.ts`, `lib/students/studentStatusUi.ts`,
`lib/data/studentsData.ts`, `components/reports/StudentReportView*` + `StudentReportTables` +
`reports/hooks/studentReport{Metrics,Export}` + `useStudentReportController`,
`components/common/descriptors/studentsDescriptor.ts`, the `lib/reports/widgetSeedsStudents.ts` seeds,
the `/students` entry in `lib/routing/moduleRegistry.ts` + `routeAccess`, and the shared primitives
(`ModuleTierPage`, `FormModal`, `DetailDrawerShell`, `WorkBatchTable`, `BulkSelectionBar`, `Modal`,
`ExportToolbar`, `ReportDataGridContainer`, `useModuleSetupSubTabs`, `useDocumentTemplate*`).

**Out of scope:** backend code (opened only to explain a UI symptom), other modules' features beyond the
shared primitives, the `apps/web` shell, styling redesigns. **No source or test file was edited.**

**Method:** production-path static audit (route → `StudentsPage` → controller → hook → query/mutation →
component), `git log 30abb1b41..HEAD -- apps/frontend/src`, the four independent audit slices were
re-checked line by line by the coordinating reviewer before inclusion, plus the execution pass in §1.
Playwright/axe were not run (no stack); a labelled `untested` item is not a pass.

## 0. Provenance

- HEAD `a51ae8bd5`; `git log --oneline 30abb1b41..HEAD -- apps/frontend/src` is **empty** — the frontend is
  byte-identical to the tree the multi-module review covered. Nothing below may be called "fixed" unless a
  citation proves it.
- At review start the tree was clean for students paths. A concurrent local process is editing non-module
  files (216 dirty paths by the end); the only reports-scope file it touched is
  `components/reports/ReportChartCard.tsx`, which this review does not cite. **0 students-feature paths are
  dirty**:
  `git status --porcelain -- apps/frontend/src/tenant/features/students …` returns only that unrelated file.

## 1. Baseline evidence

| Check | Result |
| --- | --- |
| `pnpm --filter mms-frontend test src/tenant/features/students` | **Pass** — 63 test files / **202 tests**, 5.2 s |
| Cold `tsc -p apps/frontend/tsconfig.json` (fresh `tsBuildInfoFile`) | **Pass** — exit 0 (a real compile, not a turbo replay) |
| `check-frontend-structure` | **Pass** — no feature-shape drift, no logic under `components/` |
| `check-shared-ui` | **Pass** — 0 duplicate primitives, 0 orphaned imports |
| `check-code-norms` | **Pass** — 0 `any`, 300-LOC ceiling `4` (baseline), tokens only |
| `check-bundle` | **Pass** — within budget |
| `check:i18n` | **Pass** — 9,530 keys, ar/ur/fa complete (0 fallback/missing) |
| `check:i18n-unused` | **Pass** — 454 unreferenced (baseline 517, improved) |
| Playwright / axe | **Not run** — needs the e2e stack. The students directory + row drawer *is* covered by `e2e/tests/a11y/a11y-populated.spec.ts:151-163`, so the multi-module review's "students opened no dialog" note is stale, but this pass did not execute it |

## 2. Verdict

**No Critical.** No authorization escalation, cross-tenant render, or server-trusting write was found: the
feature never checks `role`, never bypasses the contract, and all permission gates are cosmetic mirrors of
server checks. **5 new Major** and **17 new Minor**; **5 Majors and 5 Minors (two partial) carried open** from prior rounds;
**S-m2 is now closed**.

The new Majors are concentrated where a presentation shortcut meets real data: the gender "All" radio
writes the literal `all` and empties the directory (M1), editing a row from the list destroys its `notes`
because the list projection nulls them (M2), the Students report nests the data-grid container twice and
its inner toolbar exports one page (M3), the GR backfill stops after one 100-row chunk and self-gates
forever (M5), and the Setup sub-tab guard has no dialog so a dirty card editor makes the other sub-tab
unclickable (M4).

## 3. Prior findings at HEAD

| ID | Prior verdict | Status | Evidence at `a51ae8bd5` |
| --- | --- | --- | --- |
| S-01 CSV import closes before completion | Major | **OPEN** | `StandardModuleCsvImportDialog.tsx:44-48` passes `onSuccess: onClose`; `useModuleCsvImportActions.ts:124-127` sets `completedJob` then calls `onSuccess()`; the completed panel at `ModuleImportDialog.tsx:119-122` never renders. Also `:128` `notify.error(\`Import failed: ${msg}\`)`, `:52`/`:96` constructed English labels |
| S-02 bulk status uses global statuses | Major | **OPEN** | `useStudentsPageOverlayState.ts:14` `studentStatusBadgeConfig(t)` with no list; `BulkSelectionBar.tsx:179-183` `statuses={Object.keys(statusConfig)}`; the tenant list exists at `useStudentsPageController.ts:44` (`resolveStudentStatuses(configuredStatuses)`) but is not threaded in |
| S-03 side switch disarms card dirty guard | Major | **OPEN** | `StudentCardTemplateEditor.tsx:224` `key={\`card-editor-${activeSide}-${conflict.reloadNonce}\`}` remounts the editor, whose mount reports `isDirty=false` (`TemplateEditor.tsx:106-108`) into `handleDirtyChange` (`StudentCardTemplateEditor.tsx:82-88`), clearing the guard while the other side is dirty |
| S-m1 "Total" KPI falls back to filtered count | Minor | **OPEN** | `StudentsPageView.tsx:63-66` `total={metricsTotal ?? shownCount}` + `StudentsCommandMetrics.tsx:22-25` |
| S-m2 avatar update misses students cache | Minor | **CLOSED** | `invalidateContactsQueries.ts:48-51` now invalidates `STUDENTS_QUERY_KEY` + `STUDENTS_METRICS_QUERY_KEY`, so the avatar contact update refreshes student rows |
| S-m3 card checkbox not gated by delete | Minor | **OPEN** | `StudentCard.tsx:63-67` sets `canSelect={canDelete}` but also passes `headerSlot` (`:74-84`); `DirectoryEntityCard.tsx:154` renders `headerSlot ?? (header ? …)` — so the gated `EntityCard.Header` is skipped and `StudentCardHeader.tsx:49-56` renders `EntityCard.Header` with **no** `showSelect` (defaults `true`). `canSelect` only reaches `useWorkCardAction` (`DirectoryEntityCard.tsx:126-133`), i.e. the Space-key/click path |
| S-m4 printed card defaults | Minor | **PARTIAL** | `studentCardTemplateBackDefaults.ts:10,18,46` still hardcode English and fall back to `"Madrasa Management System"`; the modal handoff is fixed (`StudentsPageOverlays.tsx:138` passes `branding.madrasaName`) |
| S-m5 dead create branch | Minor | **OPEN** | `useStudentsPageOverlayProps.ts:40-45` sets `setEditStudent(savedStudent)` for creates; `studentFormSaveFlow.ts:119-121` then closes and `useStudentsPageFormState.ts:19-22` nulls it |
| S-m6 OCC 409 falls to generic toast | Minor | **PARTIAL** | `studentFormApiErrors.ts:29-33` classifies only `errors[0].field === "grNumber"`; a version conflict has no field (`studentRouteHelpers.ts:64-70`) → `studentFormSaveFlow.ts:145` generic `students.saveFailed` with the backend message as description. Draft survives; no reload action |
| S-m7 / X-01 Setup draft lost on tier switch | Major | **OPEN** | `StudentsPageView.tsx:73` `<StudentsSetupTier />` with no `onPrefsDirtyChange`; `ModuleTierPage` unmounts the inactive tier |
| S-m8 / X-02 pagination hides on empty page | Major | **OPEN** | `StudentsList.tsx:81` `showPagination={workStudents.length > 0}`; `ModuleWorkListStateShell.tsx:91,131` renders pagination only when set; no page clamp (`useStudentsDirectoryFilters.ts:20-38`) |
| round-3/4 bulk-enroll FE gate | — | **CLOSED** | `StudentsBulkActionBar.tsx:66-69,96-99` requires `enrollments.write` in addition to `students.write` |
| round-4 m8 drill-down toast | Minor | **OPEN but unreachable** | `studentReportMetrics.ts:22-23,88-91` still toast before applying `{}`; but `metricItems` from `useStudentReportController.ts:174-176,213` has **no consumer** (repo-wide grep: only accounting's own items) and `StudentReportView` renders no KPI tiles, so the toast cannot fire. Dead code, not a live defect |

## 4. Reachability of the new findings

| ID | Entry point | Chain |
| --- | --- | --- |
| M1 | Work → Filters → Gender | `StudentsFiltersMenuButton.tsx:100-113` → `onGenderChange` → `useStudentsDirectoryFilters.ts:163` (`setStudentFilterGender`) → `useStudentsPageWorkQuery.ts:48` → `GET /api/students?gender=…` |
| M2 | Work row Edit / drawer Edit | `useStudentsPageFormState.ts:14` (row) → `useStudentFormState` → `studentFormDraft.ts:60` → `prepareStudentForSave` → `PUT /api/students/:id` |
| M3 | Reports → student list / history | `StudentReportView.tsx:62-104` → `StudentReportTables.tsx:48` (and `:203`) |
| M4 | Setup → card template dirty → click Preferences | `StudentsSetupTier.tsx:42-53` → `useModuleSetupSubTabs.ts:58` |
| M5 | Work tab, first visit as Setup writer | `useGrMigration.ts:72-77` → `POST /api/students/migrate-gr-numbers` |
| n1–n17 | see §6 | each row cites its chain |

## 5. New Major findings

### M1 — Major — "All genders" writes `gender=all` and empties the directory

**Evidence**

- `StudentsFiltersMenuButton.tsx:100-113` — the gender radio group's first option is
  `{ value: "all", label: t("students.allGenders") }`, and `onValueChange={onGenderChange}` forwards the raw
  value (`ModuleFilterGroups.tsx:60-77` renders `DropdownMenuRadioItem value={option.value}` unchanged).
- `useStudentsDirectoryFilters.ts:29` initialises the state to `""` (no option matches it, so the group
  renders with nothing selected), `:163` exposes `setStudentFilterGender` directly;
  `useStudentsWorkTierSource.ts:82` and `studentsPageWorkTierProps.ts:92` pass it through unmodified.
- `useStudentsPageWorkQuery.ts:48` — `gender: studentFilterGender || undefined`; selecting "All genders"
  sets `"all"`, which is truthy and is sent.
- Backend `studentRepositoryListQuery.ts:110-118` — `if (query.gender?.trim()) { … = ${genderFilter} }`, an
  equality filter with **no** `"all"` special case (only Contacts has an `"unspecified"` rule).

**Production path** Work → Filters → Gender → "All genders" → `GET /api/students?gender=all&…`.

**Consequence** The option that means "no filter" is the one that filters everything out: zero rows, a
"1 filter active" badge, the empty-state copy "No students match filters", and an untranslated
`Gender: all` chip (the descriptor chip falls back to the raw value). The list export then carries
`gender: "all"` (`useStudentsExportActions.ts:52-59`) and produces an empty CSV. This is the exact defect
`mms-frontend` flagged for **Faculty** (F-01) — Students shares the component but never got the mapping.

**Proposed fix** Map the sentinel at the boundary: `onGenderChange={(v) => setStudentFilterGender(v === "all" ? "" : v)}`
(or have the radio group accept an explicit `allValue`), and render `value={studentFilterGender || "all"}`
so the default is visibly selected. Pin with a test that selecting "All genders" leaves the query param
undefined, and a chip test that no `Gender: all` chip appears.

### M2 — Major — Editing a student from the list silently wipes `notes`

**Evidence**

- `apps/backend/src/db/repositories/studentRepositoryColumns.ts:47-54` — the list projection is
  `{ ...STUDENT_COLUMNS, notes: sql<string|null>\`NULL\`.as("notes") }`, documented as *"Consumers must NOT
  render or filter on notes from list results"*. `studentRepositoryMappers.ts:16-45` maps that `NULL` to
  `undefined` (`nullsToUndefined`).
- The form is opened with the **list/drawer row**, never a fresh full read: `useStudentsPageFormState.ts:14`
  `openEditForm(studentToEdit)`, row actions pass the row, and the drawer hand-off
  `useStudentsPageOverlayProps.ts:64-67` passes `overlays.viewStudent` — also the row. No
  `students.get`/by-id fetch exists anywhere under the feature (grep).
- `studentFormDraft.ts:59-61` — `notes: student?.notes ?? ""`, so a row without notes starts the draft with
  `""`, not `undefined`.
- `prepareStudentForSave` spreads the whole draft (`studentFormValidation.ts:94-101`), and the server merges
  with `mergeStudentPatch`, which skips only `undefined` (`studentNormalizeUseCases.ts:60-69`:
  `if (value !== undefined) next[key] = value`). `studentWriteUseCases.ts:189-195` calls it before
  `repo.save`, and `studentRepositoryPersist.ts:94` writes `notes: student.notes ?? null` → `''`.

**Production path** Work row `Edit` (or drawer → Edit) → save any change → `PUT /api/students/:id`.

**Consequence** Every edit started from the directory destroys the student's stored notes — the user sees
an empty Notes field (it was never fetched) and a routine status/guardian change silently commits `''`.
The same gap hides notes entirely in the detail drawer: `useStudentDetailModel.ts:159-161`
(`showNotesSection = Boolean(student.notes) && …`) is always false for list rows, so notes are invisible
before they are lost. This is silent data loss on the module's primary edit path.

**Proposed fix** Make the form payload *omitted-means-unchanged*: send `notes` only when the field is
present **and** the row was fully hydrated (or fetch the full student when the edit form opens and seed the
draft from it). Either way `getInitialStudentDraft` must not materialise `notes: ""` from a list row.
Pin with (a) a unit test that a list-row draft does not emit `notes: ""`, and (b) an integration test that a
form-shaped `PUT` without `notes` leaves the stored value intact — the backend's `mergeStudentPatch`
contract already supports it.

### M3 — Major — The Students report nests the data-grid container twice; the inner toolbar exports one page

**Evidence**

- `StudentReportView.tsx:62-104` renders `<ReportDataGridContainer title=… columns=… rows=… resolveRows=… page=… total=… hasMore=… onPageChange=…>` around `<StudentReportTables … />`.
- `StudentReportTables.tsx:48-60` (list) and `:203` (history) render **another**
  `<ReportDataGridContainer title=… columns={columns} rows={rows} moduleId="students">` with no
  `resolveRows`, no `page/total/onPageChange`, and `rows` built from the **current page only**.
- `ReportDataGridContainer.tsx:65-84` renders `ExportToolbar` whenever `title && (columns || rows || data || resolveRows)`; pagination needs `page`+`total`+`onPageChange` (`:66-69`), so the inner one is a toolbar-only duplicate.

**Consequence** Reports shows two titles and two export buttons per tab. The inner export has only the
page's rows and no `resolveRows`, so it silently exports ≤ one page while claiming to export the report —
a wrong artifact, not a cosmetic duplicate. The two tables also disagree on data: the outer `students` rows
are raw (`studentReportTypes.ts:82` `gender`), the inner rows are re-mapped with title-cased gender
(`StudentReportTables.tsx:38`), so the two CSVs differ. `FacultyReportView.tsx:66-89` is the correct
single-container shape.

**Proposed fix** Delete the inner `ReportDataGridContainer` from `StudentReportTables` (both tabs) and let
the view own title/export/pagination; keep the table inside as children. Pin with a view test asserting
exactly one toolbar/title per tab and that export resolves through `resolveRows`.

### M4 — Major — A dirty card template makes the Preferences sub-tab a dead click

**Evidence**

- `StudentsSetupTier.tsx:42-53` wires `isDirty` for both keys and `onDiscard`; `:67-71` renders only the
  `SubTabBar` and the active panel — there is **no** discard-confirm dialog in the tree.
- `useModuleSetupSubTabs.ts:58-62` — when a target sub-tab is dirty, `handleSubTabChange` sets
  `pendingSubTab` and **returns without switching**; the confirm dialog is the consumer's job:
  `discardConfirmOpen = pendingSubTab != null` (`:39`), `handleConfirmDiscard` (`:65-70`).
  Peers render it (`ContactsSetupTier.tsx:101-110`).
- `:23` `onPrefsDirtyChange` is optional and the page never passes it, so the tier-level state cannot help
  either.

**Consequence** After any unsaved edit in the card-template editor, clicking "Preferences" does nothing at
all — no dialog, no switch, no message. The only escape is leaving Setup (which discards silently, X-01).
Even a wired confirm would currently be inert: `onDiscard` only flips the local `prefsDirty`
(`StudentsSetupTier.tsx:48-51`) and `discardSetupDrafts` (`useStudentsSetupPanelState.ts:27-31`) has no
consumer, so the card editor's guard is never reset.

**Proposed fix** Render the shared discard dialog from `subTabs.discardConfirmOpen` /
`subTabs.handleConfirmDiscard` (copy the Contacts tier), and make `onDiscard` reset the card editor guard
(`templateGuard.discard()`), not just `prefsDirty`. Pin by cloning `ContactsSetupTier.test.tsx`: mark the
editor dirty, click Preferences, assert the dialog appears and that only confirming switches.

### M5 — Major — GR backfill stops after the first 100 students and never runs again

**Evidence**

- Backend contract: the route caps one call at a chunk and reports whether more work remains —
  `studentOperationUseCases.ts:176-177` `/** Cap per migrate request … (re-invoke while hasMore). */ const MIGRATE_GR_CHUNK = 100;`,
  `:203-208` (limit `MIGRATE_GR_CHUNK + 1`, `hasMore = candidates.length > MIGRATE_GR_CHUNK`), `:231`
  returns `{ updated, hasMore }`; the route spreads it (`studentOperationRoutes.ts:202-209`) and the shared
  contract declares `hasMore` (`students.contract.routes.ts:178-183`).
- Frontend: `useGrMigration.ts:33-35` types the response as `{ success: boolean; updated: number }` — no
  `hasMore` — and `:56-65` on success calls `invalidateStudentsQueries`, `markGrMigrationDone()`,
  `setNeedsMigrationScan(false)` and toasts "completed". Nothing re-invokes.
- `:72-77` — the run is gated by a tenant-scoped one-shot `localStorage` key, so once marked, no later
  visit retries. `useStudentsPageController.ts` runs it for any Setup writer opening Work.

**Production path** First Work visit (Setup writer) → `POST /api/students/migrate-gr-numbers` once →
localStorage `students_gr_migration_v1 = "1"`.

**Consequence** A tenant with more than 100 legacy students missing GR numbers gets exactly 100 backfilled;
the toast says the migration completed and the one-shot gate guarantees it never resumes — even though the
server explicitly reports `hasMore: true` and the contract documents re-invocation. The remaining students
keep blank GR numbers forever (until someone clears browser storage), which then flows into exports,
ID cards and reports. Silent, permanent incompleteness on a data-completion path.

**Proposed fix** Loop while `body.hasMore` (bounded, with progress), only call `markGrMigrationDone()` when
`hasMore === false`, and toast the cumulative `updated`. Pin with a test where the first response is
`{updated: 100, hasMore: true}` and the second `{updated: 3, hasMore: false}`: two calls, gate set only
after the second. (The existing test mocks `{success:true, updated:3}` and pins the single-call behaviour,
so it must be updated with the fix.)

## 6. New Minor findings

| # | Surface | Finding | Evidence |
| --- | --- | --- | --- |
| n1 | KPIs | Metrics render authoritative zeros (and the filtered count as "Total") while loading/failed, with no skeleton or error state; the metrics query itself turns an empty/failed body into `{}` | `StudentsPageView.tsx:63-66`; `StudentsCommandMetrics.tsx:18-30`; `useServerMetrics.ts:20-29` (`response?.metrics ?? ({} as T)`); the reports controller exposes `metricsLoading` (`useStudentReportController.ts:76,215`) but no view consumes it |
| n2 | Reports/export | The report export page-walks the **entire** filtered set into browser memory instead of the queued server export, skips `assertContractOk` (a 403/500 body makes `students` undefined → `TypeError` on spread), and its limit message is hardcoded English claiming 100,000 while `200 × maxPageSize(100)` = 20,000 | `studentReportExport.ts:57-71`; `useStudentsListQueries.ts:12-42` (no assert, `:33-36` message); server streaming path exists (`startServerStudentsCsvExport.ts`, `createModuleExportService` 250/page) |
| n3 | Work shortcuts | `/`, the Escape cascade and Cmd+N listen on `window` with no overlay guard, so Escape to close the drawer/form also clears the page selection (or silently clears search/filters behind the open dialog); the repo already ships `overlayLayerCount()` for this | `useModuleWorkKeyboardShortcuts.ts:64` (Escape), `:17-18` (`enabled` prop — Students pass none); `lib/overlayStack.ts:55` already exposes the counter a guard would read |
| n4 | Single delete | A failed single delete still closes the confirm dialog (`handleDelete` swallows and never rethrows), unlike bulk delete which returns `false` to keep it open — the user must re-open the row menu to retry | `useStudentsCrudActions.ts:74-87`; `useStudentsPageOverlayProps.ts:80-85`; contrast `:91-112` |
| n5 | Row restore | A rejected row-level restore is an unhandled promise rejection (the mutation rethrows; the menu handler fires and forgets); the drawer path catches | `useStudentsCrudActions.ts:64-70` (`throw error`); `StudentsListContent.tsx:72-79`; `useStudentsPageOverlayProps.ts:52-60` (drawer catches) |
| n6 | Detail restore | The restore button's spinner is detached from the request: `onRestore` is wrapped as `() => void onRestore(...)`, so the shared action awaits `undefined`, clears `restoring` immediately and re-enables the button while the request is in flight (double restore) | `StudentDetail.tsx:83`; `DetailDrawerRestoreOrEditAction.tsx:38-47` |
| n7 | Bulk status | A partial bulk-status failure (`failed > 0`, no throw) still clears the selection, so the failed rows cannot be retried without re-selecting them | `StudentsWorkTier.tsx:147-154`; `useStudentsCrudActions.ts:137-155` (resolves after `notifyBulkResult`) |
| n8 | Form | A failing duplicate-check blocks the save and reports a save failure: the check runs inside the save `try`, so a 403/500/network error never reaches `onSave` and surfaces as `students.saveFailed` | `studentFormSaveFlow.ts:85-91`; catch at `:124-146` |
| n9 | Work list | The list hook has no `placeholderData`, so every search debounce/filter/sort/page step unmounts the table into a skeleton (the canonical factory at `:49-50` and the Contacts twin at `useContactsQueries.ts:105` both set `placeholderData: (prev) => prev`, but the factory has no live caller) | `useStudentsQueries.ts:47-61`; `ModuleWorkListStateShell.tsx:105-135` (`AnimatePresence mode="wait"`) |
| n10 | Query keys | Filter *order* is part of the cache key: toggling statuses A,B vs B,A produces two keys and two identical server queries (also keys the selection-reset string) | `useStudentsPageWorkQuery.ts:47` (`studentFilterStatus.join(",")`); `useStudentsDirectoryFilters.ts:33` |
| n11 | Setup audit | One preferences save writes two audit rows: the server appends `student.preferences`, and the client adds a second `setup:preferences` row through `POST /setup-audit` with a client-chosen summary (fire-and-forget) | `useStudentsSetupSaveActions.ts:40-46`; `registerModuleSetupConfigRoutes.ts:181-189`; `registerModuleSetupAuditRoute.ts:42-58` |
| n12 | Setup state | The preferences draft is never re-based after save and ignores later server changes: the panel calls the mutation directly instead of `saveSettingsAsync`, so `settingsDraftDirtyRef` (`useModuleSettingsEditor.ts:51-60`, reset only at `:74-80`/discard) stays true for the rest of the mount — a second admin's change is silently overwritten on the next save (preferences have no OCC) | `useStudentsSetupSaveActions.ts:36-46`; `useModuleSettingsEditor.ts:51-62,74-80` |
| n13 | Create flow | A contact belonging to a **soft-deleted** student is offered by the picker without warning: create then silently restores that archived student (merging the new values), or, without delete permission, fails with the raw string "Restoring soft-deleted students requires delete permissions" under a generic save-failed toast | `useStudentFormLinkedData.ts:46-49`; backend active-only exclusion `studentRepositoryWidgetsOps.ts:22-38`; restore branch `studentWriteUseCases.ts:90-103`; permission throw `studentRestoreOnCreate.ts:40-41` |
| n14 | Detail / ID card | Session names are looked up from a sessions list capped at 100, so a student enrolled in the 101st+ session shows none (drawer sessions block, ID-card `sessionNames`) | `useSessions.ts:78-87` (`limit: 100`); `useStudentDetailModel.ts:105-110`; `StudentsPageOverlays.tsx:57-70` |
| n15 | Form | The auto-GR effect re-baselines the **whole** draft when the next-GR query resolves late, so typed edits on a create form become the dirty baseline and the discard prompt is skipped (typed data lost on Escape/Cancel) | `useStudentFormState.ts:122-137` (`setBaselineSnapshot(studentDraftSnapshot(nextDraft))`) |
| n16 | Reports | A list-tab error replaces the entire report shell, hiding the Enrollment History tab with it; a missing DOB renders/exports age `0` | `StudentReportView.tsx:17-28` (early return before `:57` `SubTabBar`); `studentReportTypes.ts:76` (`calcAge(student.dob) ?? 0`) |
| n17 | Reports (TZ) | Date-only report fields shift one day for tenants west of UTC: `enrolledDate`/`registeredDate` are `YYYY-MM-DD`, `formatDate` does `new Date(date)` (UTC midnight) then formats in the tenant timezone | `studentReportExport.ts:51`; `studentReportTypes.ts:87`; `settingsDateFormattersCore.ts:11-30` |

**Also verified (dead code, no live user impact):** `studentsListQueryOptions` (`useStudentsQueries.ts:37-52`)
and `studentsCommandMetricsQueryOptions` (`useStudentsAnalyticsQueries.ts:15-19`) have no production caller
(facade + tests only); `metricItems`/`buildStudentReportMetricItems` are computed and returned
(`useStudentReportController.ts:174-176,213`) but never rendered, so the round-4 m8 toast and its
"toggle-off still drills down" variant are unreachable; `components/StudentFormValidationScroll.test.tsx`
exists while its component no longer does.

## 7. Verified-clean surfaces

- **Access wiring** — `/students` is registry-declared with `moduleAccess("students")`
  (`moduleRegistry.ts:159-166`), resolved through `TENANT_APP_ROUTE_ACCESS` and gated by
  `ModuleAccessRoute.tsx:20-27` which fails closed on pending/error; pinned by `routeAccess.test.ts:110-112,145`.
- **Permission mirroring** — `canWrite/canDelete/canExport` come from the manifest
  (`usePermissions.ts:127-140`, `studentsModuleManifest.ts:73-81`); bulk enroll additionally requires
  `enrollments.write` (`StudentsBulkActionBar.tsx:66-69`); messaging needs the composer capability and is
  suppressed in trash (`StudentsListDesktopTable.tsx:95,144`); restore is delete-gated in both drawer and
  row menu (`useStudentsPageOverlayProps.ts:52`, `StudentsRowActions.tsx:70-83`).
- **Selection cannot go stale** — reset during render on filter/search/sort/trash/page change
  (`useStudentsDirectoryFilters.ts:33-53`); bulk payloads derive from rows ∩ selection
  (`useStudentsPageDirectoryProps.ts:13-20`, `studentsSelectionTargets.ts:11-24`).
- **Trash affordances** — toggle delete-gated (`StudentsListFilters.tsx:120-130`); create/import/export
  hidden and export no-ops in trash (`StudentsPageHeaderActions.tsx:26-40`,
  `useModuleServerCsvExportActions.ts:154-180`).
- **Form safety** — double submit blocked (`useStudentFormActionHandlers.ts:86-90` +
  `FormModalFooter` disabled state); discard confirm wired to `isDirty` with localized copy
  (`StudentForm.tsx:86-92`); first validation error scrolled/focused (`studentFormSaveFlow.ts:37-47`);
  `_blueprintId` is volatile in the dirty snapshot and stamped from `settings.version`
  (`studentFormDraft.ts:8-37`, `studentFormValidation.ts:94-101`); empty `registeredDate` → omitted
  (`studentFormValidation.ts:96-99`).
- **Archived chrome** — edit/print hidden, restore delete-gated, messaging suppressed
  (`StudentDetail.tsx:76-92,121-137`; `StudentDetailHeaderActions.tsx:34-57`).
- **i18n / a11y / BiDi** — the `students.*` namespace is complete in en/ar/ur/fa (gate: 0 missing/fallback)
  with matching placeholders; every key the feature references resolves; **zero** physical CSS utilities in any students `*.tsx`
  (`ml-/mr-/pl-/pr-/left-/right-/text-left/text-right/border-l/-r/rounded-l/-r`); `aria-busy`, skeleton
  `role="status" aria-live="polite"` and select-all/row `aria-label`s present
  (`StudentsWorkTier.tsx:92`, `ModuleWorkListStateShell.tsx:81,115-133`, `StudentsListDesktopTable.tsx:118-126`);
  touch targets use `min-h-11`/`min-w-11` (bulk bar `:106,118`, row menu).
- **Query layer** — cache identity is per tenant/user via `SessionQueryClient` re-keying
  (`lib/queryClient.ts:35-60`, `queryCacheSession.ts:29-36`), so keys correctly omit the tenant; students
  ↔ contacts invalidation is bidirectional (`invalidateStudentsQueries.ts:24-30`,
  `invalidateContactsQueries.ts:48-51`); realtime `students` broadcasts map to invalidation with per-frame
  coalescing (`lib/tenant/invalidateModuleQueries.ts:51-52`, `useTenantDatabaseUpdates.ts:41-79`); no
  optimistic writes exist, so there is no rollback gap.
- **Directory performance** — virtualization above 30 rows in both views (`WorkBatchTable.tsx:78`,
  `ModuleDirectoryCards`); one list + one metrics request per page (no N+1); sort fields are a subset of the
  backend allowlist (`studentsListVisibleColumns.ts` vs `studentRepositoryListQuery.ts:20-29`); column prefs
  are server-synced per user with rollback on failure.
- **Export integrity (Work path)** — the queued server export mirrors the visible filters
  (`useStudentsExportActions.ts:52-59`), selection export sends ids only with an idempotency key, and
  audit is server-written.

## 8. Test gaps

| Gap | Why it matters | Where to pin |
| --- | --- | --- |
| Gender sentinel mapping (M1) | The only reason this Major survived is that no test asserts the emitted query for "All genders" | `StudentsFiltersMenuButton.test.tsx` / `useStudentsDirectoryFilters.test.tsx` |
| List-row edit payload omits `notes` (M2) | Silent data loss has no spec on either side | `studentFormDraft` unit + a `PUT` integration preserving notes |
| Single report container (M3) | A structural duplicate has no assertion (and the inner export is wrong) | `StudentReportView` render test: one toolbar, export via `resolveRows` |
| Setup sub-tab discard dialog (M4) | No test covers the dirty sub-tab path; peers have one | clone `ContactsSetupTier.test.tsx` |
| GR backfill `hasMore` loop (M5) | The current test pins the single-call behaviour | `useGrMigration.test.tsx` |
| Overlay-aware shortcuts (n3) | No test dispatches Escape with an overlay open | `useModuleWorkKeyboardShortcuts` test |
| Failure-retry semantics (n4, n6, n7) | The asymmetric `false`/catch contracts are unpinned | crud-action + detail tests |
| `lib/` business rules | 18 files / 1,604 LOC and **0** test files: card-template defaults/presets/store, sibling match, visible columns, form draft, detail sorting | colocated `lib/*.test.ts` |
| `studentReportMetrics` | Drill-down/zero-fill rules untested (and now dead) | delete or pin |
| `studentsImportJob`-adjacent UI | No test covers import completion/partial-failure rendering (the panel is unreachable) | `StandardModuleCsvImportDialog` test |

## 9. Adversarial audit

**Edge cases.** "All genders" empties the list (M1); an empty last page hides the only way back (X-02);
editing a row with omitted notes erases them (M2); a contact owned by an archived student silently
resurrects that record (n13); a nameless row produces an English aria-label inside localized copy
(`StudentsListDesktopTable.tsx:125`). Blank GR/Student-ID never collides because the server stores `NULL`
and the unique indexes exclude blanks — the form does not need to compensate.

**Failure modes.** Metrics failures render authoritative zeros instead of an error (n1); a duplicate-check
outage blocks saving and blames the save (n8); a failed single delete closes its dialog (n4); a failed row
restore is an unhandled rejection (n5); report errors take the whole shell including the other tab (n16);
the report export throws a `TypeError` on a non-200 body instead of showing the server message (n2).
A stale-token 409 keeps the draft but offers no reload action (S-m6).

**Security / multi-tenancy.** No frontend gate is treated as a security boundary: the server re-checks
every action and the module gate is authoritative. No cross-tenant data is reachable — the cache is cleared
and re-keyed on tenant switch, and every query key is tenant-free by design. The only identity-adjacent
weakness is cosmetic (S-m3 checkbox), not an authorization bypass. Report export has no separate permission
check, but the students manifest maps `export` to `students.read`, so there is no narrower right to enforce
(it becomes a finding only if the manifest splits them).

**Concurrency.** Double click restore is possible because the spinner is detached (n6); bulk status clears
failed rows so they cannot be retried (n7); preferences ignore a second admin's concurrent change (n12);
the GR backfill is one-shot and non-resumable (M5); the late next-GR response re-baselines a create form
(n15).

## 10. Resolution plan

**Tier 1 — before the next students change** (all small, localized):

1. **M1** gender sentinel mapping + `value` default, with the pinning test.
2. **M2** stop materialising `notes: ""` from list rows (or hydrate before edit) and pin the `PUT`.
3. **M3** remove the inner `ReportDataGridContainer` (two call sites) so one toolbar/exporter remains.
4. **M4** render the shared discard dialog from `subTabs.discardConfirmOpen` and reset the card guard on discard.
5. **M5** loop on `hasMore` and mark the one-shot gate only when it is false.

**Tier 2 — next students patch:** carried **S-01** (keep the import dialog mounted through completion and
localize its copy), **S-02** (thread `resolveStudentStatuses(configuredStatuses)` into the bulk bar),
**S-03** (single editor instance or parent-derived dirtiness), **X-01/S-m7** (page-level leave guard),
**X-02/S-m8** (gate pagination on `pageData.total` and clamp the page). Then **n3–n8**, **n11–n13**.

**Tier 3 — debt batch:** **n9, n10, n14–n17**, delete the dead factories/drill-down builder and the stale
test file, and reconcile `lib/` test coverage.

**Hypotheses to measure, not patch:** the lookup write race (`createModuleLookupsHooks.ts:60-66`), print
bleed of page content behind the ID-card modal (needs a browser print), and whether any live UI still writes
`students_field_configs` (there is no Fields sub-tab, so the seed-vs-tenant field-config gap is latent).

## 11. Hypotheses not proven

- **Report export permission** — the export toolbar has no permission check while the header export is
  `canExport`-gated; because the manifest maps `export` to `students.read`, this is a gap only if the
  capability is split.
- **Lookup write race** — the form can edit statuses mid-edit (`useStudentFormStatusOptions.ts:25-27`) and
  the hook merges one kind into `current ?? staticDefaults`; reachable in principle, untested.
- **ID-card print bleed** — the modal calls `window.print()` directly and the print CSS hides chrome but not
  the page behind it; not browser-verified.
- **`useStudentColumnLayout` registry identity** — an unmemoised registry rebuild per render may force
  column derivation; needs a render-count measurement.
- **Date-only shift (n17)** — proven from the formatter's `new Date(date)` + tenant-timezone path, but not
  reproduced with `Intl` in this pass under a west-of-UTC zone.

## 12. Implementation status (2026-11-04)

| ID | Status | Change | Guard |
| --- | --- | --- | --- |
| M1–M5, n1–n17 | open | — | — |
| S-01, S-02, S-03, S-m3, S-m4 (partial), S-m5, S-m6 (partial), S-m7, S-m8 | open | — | — |
| S-m1 | open | — | — |
| S-m2 | **closed** | contacts invalidation now includes students list + metrics | `invalidateContactsQueries.ts:48-51` |
| round-4 m8 | open (dead) | — | `useStudentReportController.ts:213` has no consumer |
